/*
 * Capa de datos editable desde el panel de administración.
 *
 * Los datos base viven en js/data/<ciudad>.js. Lo que el administrador
 * cambia se guarda como "overrides" que se aplican encima:
 *   - Publicada en Claude: base de datos compartida del artifact (todos los
 *     visitantes ven los cambios; solo Editores/Owner pueden escribir).
 *   - En Netlify: la API /api/data guarda en Netlify Blobs; para escribir hay
 *     que entrar con la contraseña del administrador (ADMIN_PASSWORD).
 *   - Abierta como archivo local: localStorage de este navegador (solo pruebas).
 */
(function () {
  var LOCAL_KEY = "rutaperu.overrides";
  var PASS_KEY = "rutaperu.adminpass";
  var API = "/api/data";
  var DEFAULT_SETTINGS = {
    exchangeRate: 3.75, taxiBase: 8, taxiPerMin: 0.6,
    // Servicio propio de taxi al aeropuerto (se reserva por WhatsApp).
    transferEnabled: true,
    whatsapp: "",
    transferPrices: { miraflores: 70, barranco: 75, sanisidro: 65, centro: 60, callao: 35 },
    featuredTour: null
  };

  var overrides = { attractions: {}, restaurants: {}, tours: {}, settings: {} };
  var listeners = [];
  var db = null;
  var mode = "local";
  var canEdit = false;
  var ready = false;
  var password = null;

  function emit() {
    listeners.forEach(function (fn) { fn(); });
  }

  function readLocal() {
    try {
      var raw = JSON.parse(localStorage.getItem(LOCAL_KEY) || "null");
      if (raw) {
        overrides.attractions = raw.attractions || {};
        overrides.restaurants = raw.restaurants || {};
        overrides.tours = raw.tours || {};
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

  function setAll(data) {
    overrides = {
      attractions: data.attractions || {}, restaurants: data.restaurants || {},
      tours: data.tours || {}, settings: data.settings || {}
    };
  }

  function session(fn) {
    try { return fn(window.sessionStorage); } catch (e) { return null; }
  }

  // Sitio publicado (Netlify): lee los cambios de la API del servidor.
  function initRemote() {
    return fetch(API, { cache: "no-store" }).then(function (res) {
      var type = res.headers.get("content-type") || "";
      if (!res.ok || type.indexOf("application/json") === -1) throw new Error("sin API");
      return res.json();
    }).then(function (data) {
      mode = "remote";
      setAll(data);
      var saved = session(function (s) { return s.getItem(PASS_KEY); });
      if (!saved) return;
      // Mantiene la sesión del administrador mientras la pestaña esté abierta.
      return login(saved).then(function () {}, function () {});
    });
  }

  function login(pass) {
    return fetch("/api/login", { method: "POST", headers: { authorization: "Bearer " + pass } }).then(function (res) {
      if (res.status === 200) {
        password = pass;
        canEdit = true;
        session(function (s) { s.setItem(PASS_KEY, pass); });
        emit();
        return true;
      }
      if (res.status === 503) throw { code: "not_configured" };
      throw { code: "unauthorized" };
    });
  }

  function logout() {
    password = null;
    canEdit = false;
    session(function (s) { s.removeItem(PASS_KEY); });
    emit();
  }

  function remoteWrite(body) {
    return fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: "Bearer " + password },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (res.status === 401) { logout(); throw { code: "unauthorized" }; }
      if (!res.ok) throw { code: "unavailable" };
      return res.json();
    }).then(function (data) { setAll(data); emit(); });
  }

  function init() {
    readLocal();
    var claude = window.claude;
    if (!claude || typeof claude.use !== "function") {
      var local = function () {
        // Archivo abierto en la computadora: el panel guarda en este navegador.
        mode = "local";
        canEdit = true;
      };
      var done = function () { ready = true; emit(); };
      if (location.protocol !== "http:" && location.protocol !== "https:") {
        local();
        done();
        return Promise.resolve();
      }
      return initRemote().catch(local).then(done);
    }
    // Dentro de Claude solo se usa la base compartida.
    overrides = { attractions: {}, restaurants: {}, tours: {}, settings: {} };
    return claude.use("db").then(function (handle) {
      if (!handle) return finish();
      db = handle;
      mode = "db";
      subscribeCollection("attractions");
      subscribeCollection("restaurants");
      subscribeCollection("tours");
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
    if (mode === "remote") return remoteWrite({ action: "save", kind: kind, id: id, data: data });
    overrides[kind][id] = data;
    writeLocal();
    emit();
    return Promise.resolve();
  }

  function remove(kind, id) {
    if (mode === "db") return db.collection(kind).doc(id).delete();
    if (mode === "remote") return remoteWrite({ action: "remove", kind: kind, id: id });
    delete overrides[kind][id];
    writeLocal();
    emit();
    return Promise.resolve();
  }

  function saveSettings(data) {
    if (mode === "db") return db.doc("config/settings").set(data);
    if (mode === "remote") return remoteWrite({ action: "settings", data: data });
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

  // Datos base con sus cambios, más los lugares nuevos que creó el administrador.
  function merge(baseList, ovMap, includeHidden) {
    var known = {};
    var out = baseList.map(function (x) { known[x.id] = true; return apply(x, ovMap[x.id]); });
    Object.keys(ovMap).forEach(function (id) {
      var ov = ovMap[id];
      if (!known[id] && ov && ov.custom) out.push(apply({ id: id }, ov));
    });
    return out.filter(function (x) { return includeHidden || !x.hidden; });
  }

  /** Ciudad con los cambios del administrador aplicados. */
  function effective(base, includeHidden) {
    var c = Object.assign({}, base);
    c.settings = Object.assign({}, DEFAULT_SETTINGS, base.settings || {}, overrides.settings);
    c.attractions = merge(base.attractions, overrides.attractions, includeHidden);
    c.restaurants = merge(base.restaurants, overrides.restaurants, includeHidden);
    c.tours = merge(base.tours || [], overrides.tours, includeHidden);
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
    needsLogin: function () { return mode === "remote" && !canEdit; },
    login: login,
    logout: logout,
    ready: function () { return ready; },
    defaults: DEFAULT_SETTINGS
  };
})();
