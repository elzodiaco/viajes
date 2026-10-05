/*
 * Capa de datos editable desde el panel de administración.
 *
 * Los datos base viven en js/data/<ciudad>.js. Lo que el administrador
 * cambia se guarda como "overrides" que se aplican encima:
 *   - Publicada en Claude: base de datos compartida del artifact (todos los
 *     visitantes ven los cambios; solo Editores/Owner pueden escribir).
 *   - Como sitio estático: localStorage de este navegador (solo para probar).
 */
(function () {
  var LOCAL_KEY = "rutaperu.overrides";
  var DEFAULT_SETTINGS = { exchangeRate: 3.75, taxiBase: 8, taxiPerMin: 0.6 };

  var overrides = { attractions: {}, restaurants: {}, settings: {} };
  var listeners = [];
  var db = null;
  var mode = "local";
  var canEdit = false;
  var ready = false;

  function emit() {
    listeners.forEach(function (fn) { fn(); });
  }

  function readLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
      if (raw) {
        overrides.attractions = raw.attractions || {};
        overrides.restaurants = raw.restaurants || {};
        overrides.settings = raw.settings || {};
      }
    } catch (e) { /* sin almacenamiento: se usan los datos base */ }
  }

  function writeLocal() {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(overrides)); } catch (e) { /* ignorado */ }
  }

  function subscribeCollection(kind) {
    db.collection(kind).onSnapshot(function (snap) {
      var map = {};
      snap.docs.forEach(function (d) { if (d.exists) map[d.id] = d.data(); });
      overrides[kind] = map;
      emit();
    }, function () { /* la página sigue funcionando con los datos base */ });
  }

  function init() {
    readLocal();
    var claude = window.claude;
    if (!claude || typeof claude.use !== "function") {
      // Sitio estático: el panel se abre con #admin y guarda en este navegador.
      canEdit = true;
      ready = true;
      return Promise.resolve();
    }
    // Dentro de Claude solo se usa la base compartida.
    overrides = { attractions: {}, restaurants: {}, settings: {} };
    return claude.use("db").then(function (handle) {
      if (!handle) return finish();
      db = handle;
      mode = "db";
      subscribeCollection("attractions");
      subscribeCollection("restaurants");
      db.doc("config/settings").onSnapshot(function (snap) {
        overrides.settings = snap.exists ? snap.data() : {};
        emit();
      }, function () {});
      // Solo el dueño de la página puede administrarla.
      return claude.use("user").then(function (user) {
        if (!user) return finish();
        return user.isOwner().then(function (ok) { canEdit = !!ok; finish(); });
      });
    }).catch(finish);

    function finish() { ready = true; emit(); }
  }

  function save(kind, id, data) {
    if (mode === "db") return db.collection(kind).doc(id).set(data);
    overrides[kind][id] = data;
    writeLocal();
    emit();
    return Promise.resolve();
  }

  function remove(kind, id) {
    if (mode === "db") return db.collection(kind).doc(id).delete();
    delete overrides[kind][id];
    writeLocal();
    emit();
    return Promise.resolve();
  }

  function saveSettings(data) {
    if (mode === "db") return db.doc("config/settings").set(data);
    overrides.settings = data;
    writeLocal();
    emit();
    return Promise.resolve();
  }

  // "09:00-17:00" | "" (cerrado)  <->  ["09:00","17:00"] | null
  function hoursToStrings(hours) {
    return hours.map(function (h) { return h ? h[0] + "-" + h[1] : ""; });
  }
  function stringsToHours(list) {
    return list.map(function (s) { return s ? s.split("-") : null; });
  }

  function apply(item, ov) {
    if (!ov) return Object.assign({}, item);
    var out = Object.assign({}, item, ov);
    if (ov.hours) out.hours = stringsToHours(ov.hours);
    out.edited = true;
    return out;
  }

  /** Ciudad con los cambios del administrador aplicados. */
  function effective(base, includeHidden) {
    var c = Object.assign({}, base);
    c.settings = Object.assign({}, DEFAULT_SETTINGS, base.settings || {}, overrides.settings);
    c.attractions = base.attractions.map(function (a) { return apply(a, overrides.attractions[a.id]); })
      .filter(function (a) { return includeHidden || !a.hidden; });
    c.restaurants = base.restaurants.map(function (r) { return apply(r, overrides.restaurants[r.id]); })
      .filter(function (r) { return includeHidden || !r.hidden; });
    return c;
  }

  window.DataStore = {
    init: init,
    onChange: function (fn) { listeners.push(fn); },
    save: save,
    remove: remove,
    saveSettings: saveSettings,
    effective: effective,
    hoursToStrings: hoursToStrings,
    mode: function () { return mode; },
    canEdit: function () { return canEdit; },
    ready: function () { return ready; },
    defaults: DEFAULT_SETTINGS
  };
})();
