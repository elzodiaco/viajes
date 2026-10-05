/*
 * Panel de administración: editar precios, horarios y textos de las
 * atracciones y restaurantes, y los ajustes generales (tipo de cambio,
 * tarifa de taxi). Los cambios se guardan con DataStore.
 */
(function () {
  var DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
  var FARE_ZONES = ["miraflores", "barranco", "sanisidro", "centro", "callao"];

  var panel = document.getElementById("admin");
  var listEl = document.getElementById("admin-list");
  var editorEl = document.getElementById("admin-editor");
  var searchEl = document.getElementById("admin-search");
  var toastEl = document.getElementById("admin-toast");
  var gateEl = document.getElementById("admin-gate");
  var bodyEl = document.getElementById("admin-body");
  var tab = "attractions";
  var editing = null; // { kind, id }
  var toastTimer = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function es(v) { return v == null ? "" : typeof v === "string" ? v : (v.es || ""); }
  function en(v) { return v == null ? "" : typeof v === "string" ? v : (v.en || ""); }

  function city() { return DataStore.effective(CITIES.lima, true); }

  function usd(n) {
    var rate = city().settings.exchangeRate;
    return n > 0 ? "US$ " + (n / rate).toFixed(n / rate < 10 ? 1 : 0) : "";
  }

  function price(n) {
    return n > 0 ? "S/ " + n + ' <span class="muted">· ' + usd(n) + "</span>" : '<span class="muted">Gratis</span>';
  }

  function zoneName(c, z) { return c.zones[z] ? es(c.zones[z].name) : (z || ""); }

  function listOf(c, kind) {
    return kind === "attractions" ? c.attractions : kind === "tours" ? c.tours : c.restaurants;
  }

  function soles(usdAmount) {
    return "S/ " + Math.round(usdAmount * city().settings.exchangeRate);
  }

  function statusPills(it, extra) {
    return (it.hidden ? '<span class="pill off">Oculto</span>' : '<span class="pill on">Visible</span>') +
      (it.custom ? ' <span class="pill new">Nuevo</span>' : it.edited ? ' <span class="pill edited">Editado</span>' : "") +
      (extra || "");
  }

  function addButton(kind) {
    var label = { attractions: "+ Agregar atracción", restaurants: "+ Agregar restaurante", tours: "+ Agregar tour" }[kind];
    return '<div class="admin-add"><button type="button" class="btn primary" data-add="' + kind + '">' + label + "</button></div>";
  }

  function hoursSummary(hours) {
    var open = hours.filter(Boolean);
    var closed = DAY_ORDER.filter(function (d) { return !hours[d]; }).map(function (d) { return DAYS[d].slice(0, 3); });
    var uniq = {};
    open.forEach(function (h) { uniq[h.join("–")] = true; });
    var ranges = Object.keys(uniq);
    var txt = ranges.length === 1 ? ranges[0] : ranges.length ? "Varía según el día" : "Cerrado";
    return txt + (closed.length && open.length ? " · cierra " + closed.join(", ") : "");
  }

  function toast(msg, isError) {
    toastEl.textContent = msg;
    toastEl.className = "admin-toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = "admin-toast"; }, 3200);
  }

  // ------------------------------------------------------------ open/close
  // El panel solo se abre desde el enlace con #admin y solo para el dueño.
  function open() {
    var wasHidden = panel.hidden;
    document.body.classList.add("admin-open");
    panel.hidden = false;
    var allowed = DataStore.canEdit();
    bodyEl.hidden = !allowed;
    gateEl.hidden = allowed;
    if (!DataStore.ready()) {
      gateEl.innerHTML = '<p class="muted">Verificando acceso…</p>';
    } else if (DataStore.needsLogin()) {
      // Sitio en Netlify: se entra con la contraseña del administrador.
      if (!document.getElementById("login-form")) {
        gateEl.innerHTML = '<form id="login-form" class="login-form" novalidate>' +
          "<h3>Entrar al panel</h3>" +
          '<p class="muted">Escribe la contraseña de administrador que configuraste en Netlify.</p>' +
          '<div class="field"><label for="login-pass">Contraseña</label>' +
          '<input id="login-pass" type="password" autocomplete="current-password"></div>' +
          '<p class="error" id="login-error" hidden></p>' +
          '<button class="btn primary" type="submit" id="login-btn">Entrar</button></form>';
      }
    } else if (!allowed) {
      gateEl.innerHTML = "<h3>Acceso restringido</h3>" +
        '<p class="muted">Este panel solo está disponible para el administrador de la página. ' +
        "Si eres el administrador, abre este enlace con tu cuenta de Claude.</p>";
    }
    var local = DataStore.mode() === "local";
    document.getElementById("admin-logout").hidden = !(allowed && DataStore.mode() === "remote");
    document.getElementById("admin-mode").textContent = !allowed ? "" : local
      ? "Modo de prueba: los cambios se guardan solo en este navegador."
      : "Los cambios se guardan en la nube y los ven todos los visitantes de la página.";
    if (allowed) render();
    if (wasHidden) window.scrollTo(0, 0);
  }

  function close() {
    document.body.classList.remove("admin-open");
    panel.hidden = true;
    editing = null;
    try { history.replaceState(null, "", location.pathname + location.search); } catch (e) { /* ignorado */ }
  }

  function syncWithHash() {
    if (location.hash === "#admin") open();
    else if (!panel.hidden) close();
  }

  // ------------------------------------------------------------------ list
  function render() {
    if (panel.hidden) return;
    document.querySelectorAll("[data-admin-tab]").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-admin-tab") === tab ? "true" : "false");
    });
    searchEl.parentNode.hidden = tab === "settings" || tab === "tours" || !!editing;
    if (editing) { listEl.hidden = true; editorEl.hidden = false; return; }
    listEl.hidden = false;
    editorEl.hidden = true;
    if (tab === "settings") return renderSettings();

    var c = city();
    var q = searchEl.value.trim().toLowerCase();
    if (tab === "tours") return renderTours(c);
    var items = listOf(c, tab).filter(function (it) {
      return !q || (es(it.name) + " " + en(it.name) + " " + zoneName(c, it.zone)).toLowerCase().indexOf(q) !== -1;
    });

    listEl.innerHTML = addButton(tab) + '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      "<th>Nombre</th><th>Zona</th><th>" + (tab === "attractions" ? "Entrada" : "Gasto por persona") + "</th>" +
      "<th>" + (tab === "attractions" ? "Horario" : "Comidas") + "</th><th>Estado</th><th></th></tr></thead><tbody>" +
      items.map(function (it) {
        var status = statusPills(it);
        var detail = tab === "attractions" ? esc(hoursSummary(it.hours))
          : esc(it.meals.map(function (m) { return m === "lunch" ? "Almuerzo" : "Cena"; }).join(" y "));
        return "<tr><td><strong>" + esc(es(it.name)) + "</strong></td><td>" + esc(zoneName(c, it.zone)) + "</td>" +
          '<td class="num">' + price(it.cost) + "</td><td>" + detail + "</td><td>" + status + "</td>" +
          '<td><button type="button" class="btn small" data-edit="' + esc(it.id) + '">Editar</button></td></tr>';
      }).join("") +
      "</tbody></table></div>" +
      (items.length ? "" : '<p class="muted">No hay resultados para esa búsqueda.</p>');
  }

  function renderTours(c) {
    var featured = Planner.featuredTour(DataStore.effective(CITIES.lima));
    listEl.innerHTML = addButton("tours") +
      '<p class="muted small">El tour destacado se ofrece en el cuestionario y se agenda en el itinerario; los demás aparecen como "Más tours" en los resultados.</p>' +
      '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      "<th>Tour</th><th>Operador</th><th>Precio</th><th>Salidas</th><th>Estado</th><th></th></tr></thead><tbody>" +
      c.tours.map(function (it) {
        var status = statusPills(it, featured && featured.id === it.id ? ' <span class="pill star">Destacado</span>' : "");
        return "<tr><td><strong>" + esc(es(it.name)) + "</strong></td><td>" + esc(it.provider) + "</td>" +
          '<td class="num">US$ ' + it.priceUsd + ' <span class="muted">· ' + soles(it.priceUsd) + "</span></td>" +
          "<td>" + esc(it.departures.join(", ")) + "</td><td>" + status + "</td>" +
          '<td><button type="button" class="btn small" data-edit="' + esc(it.id) + '">Editar</button></td></tr>';
      }).join("") + "</tbody></table></div>";
  }

  function renderSettings() {
    var s = city().settings;
    listEl.innerHTML =
      '<form class="card admin-form" id="settings-form" novalidate>' +
      "<h3>Ajustes generales</h3>" +
      '<div class="admin-grid">' +
      field("set-rate", "Tipo de cambio (S/ por US$ 1)", '<input id="set-rate" type="number" step="0.01" min="0.5" value="' + s.exchangeRate + '">') +
      field("set-taxi-base", "Taxi: tarifa base (S/)", '<input id="set-taxi-base" type="number" step="0.5" min="0" value="' + s.taxiBase + '">') +
      field("set-taxi-min", "Taxi: costo por minuto de viaje (S/)", '<input id="set-taxi-min" type="number" step="0.05" min="0" value="' + s.taxiPerMin + '">') +
      "</div>" +
      '<p class="muted small">Ejemplo: un taxi de 30 minutos cuesta aprox. S/ ' +
      Math.round(s.taxiBase + 30 * s.taxiPerMin) + ". El tipo de cambio se usa para mostrar los precios en dólares.</p>" +
      "<h3>Taxi al aeropuerto (tu servicio)</h3>" +
      '<p class="muted small">Al final del itinerario el turista puede reservar contigo el traslado al aeropuerto. ' +
      "La reserva llega a tu WhatsApp con la hora de recojo, el hotel, el vuelo, los pasajeros y las maletas.</p>" +
      check("set-transfer-on", "Ofrecer el taxi al aeropuerto", s.transferEnabled !== false) +
      '<div class="admin-grid">' +
      field("set-whatsapp", "Tu número de WhatsApp (con código de país, p. ej. 51987654321)",
        input("set-whatsapp", s.whatsapp || "", "tel", ' inputmode="tel" placeholder="51987654321"')) +
      "</div>" +
      '<div class="field"><span class="label">Precio por trayecto según la zona del hotel (S/)</span><div class="admin-grid fares">' +
      FARE_ZONES.map(function (z) {
        var v = (s.transferPrices || {})[z];
        return field("set-fare-" + z, zoneName(city(), z), input("set-fare-" + z, v == null ? "" : v, "number", ' min="0" step="1"'));
      }).join("") + "</div></div>" +
      '<p class="error" id="settings-error" hidden></p>' +
      '<div class="admin-actions"><button class="btn primary" type="submit">Guardar ajustes</button></div>' +
      "</form>";
  }

  function field(id, label, control, wide) {
    return '<div class="field' + (wide ? " wide" : "") + '"><label for="' + id + '">' + esc(label) + "</label>" + control + "</div>";
  }

  function input(id, value, type, extra) {
    return '<input id="' + id + '" type="' + (type || "text") + '" value="' + esc(value) + '"' + (extra || "") + ">";
  }

  function textarea(id, value) {
    return '<textarea id="' + id + '" rows="3">' + esc(value) + "</textarea>";
  }

  function check(id, label, checked) {
    return '<label class="check"><input id="' + id + '" type="checkbox"' + (checked ? " checked" : "") + "> " + esc(label) + "</label>";
  }

  // ---------------------------------------------------------------- editor
  var INTERESTS = {
    gastronomy: "Gastronomía", history: "Historia y museos", art: "Arte", beach: "Playa y mar",
    nature: "Naturaleza y vistas", nightlife: "Vida nocturna", shopping: "Compras", adventure: "Aventura"
  };
  var ATTR_FLAGS = [
    ["kids", "Ideal para niños"], ["romantic", "Romántico (parejas)"], ["sunset", "Mejor al atardecer"],
    ["evening", "Mejor de noche"], ["night", "Vida nocturna (después de la cena)"], ["dayTrip", "Excursión fuera de la ciudad"]
  ];
  var REST_FLAGS = [
    ["seafood", "Cebichería / pescados y mariscos"], ["adultsOnly", "No recomendado para niños"],
    ["famous", "Destacado (restaurante famoso)"], ["reservation", "Requiere reserva"]
  ];
  var NOUN = { attractions: "atracción", restaurants: "restaurante", tours: "tour" };

  function zoneCenter(z) {
    var zone = city().zones[z] || city().zones.miraflores;
    return { lat: zone.lat, lng: zone.lng };
  }

  // Plantilla para un lugar o tour nuevo.
  function blank(kind) {
    var base = { id: null, custom: true, name: "", desc: "", tip: null, zone: "miraflores", lat: null, lng: null };
    if (kind === "attractions") {
      return Object.assign(base, {
        interests: [], cost: 0, duration: 60, priority: 5, fixedStart: null,
        hours: [0, 1, 2, 3, 4, 5, 6].map(function () { return ["09:00", "18:00"]; })
      });
    }
    if (kind === "restaurants") return Object.assign(base, { price: 2, cost: 60, meals: ["lunch", "dinner"], duration: 90 });
    var c = zoneCenter("centro");
    return Object.assign(base, {
      provider: "", priceUsd: 30, duration: 180, departures: ["09:00"], stops: [], covers: [], includes: "", url: "",
      end: { lat: c.lat, lng: c.lng, zone: "centro" }
    });
  }

  function zoneSelect(id, current) {
    var zones = city().zones;
    return '<select id="' + id + '">' + Object.keys(zones).map(function (k) {
      return '<option value="' + k + '"' + (k === current ? " selected" : "") + ">" + esc(es(zones[k].name)) + "</option>";
    }).join("") + "</select>";
  }

  function coordsValue(lat, lng) {
    return lat == null || lng == null ? "" : Number(lat).toFixed(5) + ", " + Number(lng).toFixed(5);
  }

  // Acepta un enlace de Google Maps o "lat, lng".
  function parseCoords(text) {
    var m = /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/.exec(text) || /@(-?\d+\.\d+),\s*(-?\d+\.\d+)/.exec(text) ||
      /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/.exec(text);
    return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
  }

  function locationFields(prefix, label, zone, lat, lng) {
    return field(prefix + "zone", label, zoneSelect(prefix + "zone", zone)) +
      field(prefix + "coords", "Ubicación exacta (opcional)",
        input(prefix + "coords", coordsValue(lat, lng), "text", ' placeholder="Pega un enlace de Google Maps o -12.1211, -77.0297"') +
        '<small class="hint">Si lo dejas vacío usamos el centro de la zona.</small>');
  }

  function checksField(label, items, prefix, isOn, wide) {
    return '<div class="field' + (wide ? " wide" : "") + '"><span class="label">' + esc(label) + '</span><div class="checks">' +
      items.map(function (x) { return check(prefix + x[0], x[1], isOn(x[0])); }).join("") + "</div></div>";
  }

  function openEditor(kind, id) {
    editing = { kind: kind, id: id };
    var c = city();
    var isNew = !id;
    var it = isNew ? blank(kind) : listOf(c, kind).filter(function (x) { return x.id === id; })[0];
    var common =
      field("ed-name-es", "Nombre (español)", input("ed-name-es", es(it.name))) +
      field("ed-name-en", "Nombre (inglés)", input("ed-name-en", en(it.name))) +
      field("ed-desc-es", "Descripción (español)", textarea("ed-desc-es", es(it.desc)), true) +
      field("ed-desc-en", "Descripción (inglés)", textarea("ed-desc-en", en(it.desc)), true);

    var specific;
    if (kind === "tours") {
      var settings = c.settings;
      var featured = Planner.featuredTour(c);
      var end = it.end || {};
      specific =
        field("ed-provider", "Operador", input("ed-provider", it.provider)) +
        field("ed-url", "Enlace para reservar (web o WhatsApp)", input("ed-url", it.url, "url", ' placeholder="https://wa.me/51987654321"')) +
        field("ed-price-usd", "Precio por persona (US$)", input("ed-price-usd", it.priceUsd, "number", ' min="0" step="1"') +
          '<small class="hint" id="ed-price-sol">≈ ' + soles(it.priceUsd) + "</small>") +
        field("ed-duration", "Duración (minutos)", input("ed-duration", it.duration, "number", ' min="30" step="15"')) +
        field("ed-departures", "Horas de salida (separadas por coma)", input("ed-departures", (it.departures || []).join(", "))) +
        locationFields("ed-end-", "Zona donde termina el tour", end.zone || "centro", end.lat, end.lng) +
        field("ed-stops-es", "Recorrido en español (una parada por línea)", textarea("ed-stops-es", (it.stops || []).map(es).join("\n")), true) +
        field("ed-stops-en", "Recorrido en inglés (una parada por línea, opcional)", textarea("ed-stops-en", (it.stops || []).map(en).join("\n")), true) +
        field("ed-incl-es", "Qué incluye (español)", textarea("ed-incl-es", es(it.includes)), true) +
        field("ed-incl-en", "Qué incluye (inglés)", textarea("ed-incl-en", en(it.includes)), true) +
        field("ed-tip-es", "Nota (español, opcional)", textarea("ed-tip-es", es(it.tip)), true) +
        field("ed-tip-en", "Nota (inglés, opcional)", textarea("ed-tip-en", en(it.tip)), true) +
        checksField("Lugares que visita (no se repetirán en el itinerario de quien tome el tour)",
          c.attractions.map(function (a) { return [a.id, es(a.name)]; }), "ed-cov-",
          function (k) { return (it.covers || []).indexOf(k) !== -1; }, true) +
        '<div class="field wide">' + check("ed-featured", "Ofrecer este tour en el cuestionario (tour destacado)",
          featured ? featured.id === it.id : isNew && !settings.featuredTour && !c.tours.length) + "</div>";
    } else if (kind === "attractions") {
      specific =
        locationFields("ed-", "Zona", it.zone, it.lat, it.lng) +
        field("ed-tip-es", "Consejo (español, opcional)", textarea("ed-tip-es", es(it.tip)), true) +
        field("ed-tip-en", "Consejo (inglés, opcional)", textarea("ed-tip-en", en(it.tip)), true) +
        field("ed-cost", "Precio de entrada por persona (S/)", input("ed-cost", it.cost, "number", ' min="0" step="1"') +
          '<small class="hint" id="ed-cost-usd">' + (usd(it.cost) || "Gratis") + "</small>") +
        field("ed-duration", "Duración de la visita (minutos)", input("ed-duration", it.duration, "number", ' min="15" step="5"')) +
        field("ed-priority", "Importancia (1 a 10)", input("ed-priority", it.priority, "number", ' min="1" max="10" step="1"')) +
        field("ed-fixed", "Hora fija de inicio (opcional, p. ej. tours)", input("ed-fixed", it.fixedStart || "", "time")) +
        checksField("Intereses (para quién es)", Object.keys(INTERESTS).map(function (k) { return [k, INTERESTS[k]]; }), "ed-int-",
          function (k) { return (it.interests || []).indexOf(k) !== -1; }, true) +
        checksField("Características", ATTR_FLAGS, "ed-flag-", function (k) { return !!it[k]; }, true) +
        '<div class="field wide"><span class="label">Horario de atención</span><div class="hours">' +
        DAY_ORDER.map(function (d) {
          var h = it.hours[d];
          return '<div class="hours-row"><label class="check hours-day"><input type="checkbox" id="ed-open-' + d + '"' + (h ? " checked" : "") + "> " + DAYS[d] + "</label>" +
            '<input type="time" id="ed-from-' + d + '" aria-label="' + DAYS[d] + ' abre" value="' + (h ? h[0] : "09:00") + '"' + (h ? "" : " disabled") + ">" +
            '<span class="muted">a</span>' +
            '<input type="time" id="ed-to-' + d + '" aria-label="' + DAYS[d] + ' cierra" value="' + (h ? h[1] : "17:00") + '"' + (h ? "" : " disabled") + ">" +
            '<span class="closed-label muted"' + (h ? " hidden" : "") + ">Cerrado</span></div>";
        }).join("") +
        "</div></div>";
    } else {
      specific =
        locationFields("ed-", "Zona", it.zone, it.lat, it.lng) +
        field("ed-cost", "Gasto aproximado por persona (S/)", input("ed-cost", it.cost, "number", ' min="0" step="1"') +
          '<small class="hint" id="ed-cost-usd">' + (usd(it.cost) || "Gratis") + "</small>") +
        field("ed-price", "Nivel de precio",
          '<select id="ed-price">' + [[1, "Económico"], [2, "Medio"], [3, "Alto"]].map(function (p) {
            return '<option value="' + p[0] + '"' + (it.price === p[0] ? " selected" : "") + ">" + p[1] + "</option>";
          }).join("") + "</select>") +
        field("ed-duration", "Duración de la comida (minutos)", input("ed-duration", it.duration || 90, "number", ' min="30" step="5"')) +
        checksField("Sirve", [["lunch", "Almuerzo"], ["dinner", "Cena"]], "ed-meal-",
          function (k) { return it.meals.indexOf(k) !== -1; }) +
        checksField("Características", REST_FLAGS, "ed-flag-", function (k) { return !!it[k]; }, true);
    }

    var removeLabel = it.custom ? "Eliminar " + NOUN[kind] : "Restaurar valores originales";
    var confirmLabel = it.custom ? "Sí, eliminar" : "Sí, restaurar";
    editorEl.innerHTML =
      '<form class="card admin-form" id="editor-form" novalidate>' +
      '<div class="editor-head"><button type="button" class="btn small" data-back>← Volver a la lista</button>' +
      "<h3>" + (isNew ? "Nuevo " + (kind === "attractions" ? "lugar" : NOUN[kind]) : esc(es(it.name))) + "</h3>" +
      (isNew ? "" : '<span class="muted small">' + esc(zoneName(c, it.zone || (it.end || {}).zone)) + "</span>") + "</div>" +
      '<div class="admin-grid">' + common + specific + "</div>" +
      check("ed-hidden", "Ocultar (no aparecerá en los itinerarios)", !!it.hidden) +
      '<p class="error" id="editor-error" hidden></p>' +
      '<div class="admin-actions">' +
      '<button class="btn primary" type="submit">' + (isNew ? "Agregar " + NOUN[kind] : "Guardar cambios") + "</button>" +
      '<button class="btn" type="button" data-back>Cancelar</button>' +
      (!isNew && (it.edited || it.custom) ? '<button class="btn danger" type="button" data-reset>' + removeLabel + "</button>" : "") +
      '<span class="confirm" id="reset-confirm" hidden>¿Seguro? <button class="btn small danger" type="button" data-reset-yes>' + confirmLabel + "</button></span>" +
      "</div></form>";
    render();
    window.scrollTo(0, panel.offsetTop - 70);
  }

  function val(id) { return document.getElementById(id).value.trim(); }
  function num(id) { return parseFloat(document.getElementById(id).value); }
  function checked(id) { return document.getElementById(id).checked; }

  // Zona + coordenadas: si no hay coordenadas válidas se usa el centro de la zona.
  function readLocation(prefix, errors) {
    var zone = val(prefix + "zone");
    var raw = val(prefix + "coords");
    var pos = raw ? parseCoords(raw) : null;
    if (raw && !pos) errors.push("No entendimos la ubicación. Pega un enlace de Google Maps o coordenadas como -12.1211, -77.0297.");
    else if (pos && (pos.lat < -13 || pos.lat > -11 || pos.lng < -78 || pos.lng > -76)) errors.push("Esa ubicación parece estar fuera de Lima. Revisa las coordenadas.");
    var c = pos || zoneCenter(zone);
    return { zone: zone, lat: c.lat, lng: c.lng };
  }

  function slug(text) {
    return (text || "lugar").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "lugar";
  }

  function collect() {
    var kind = editing.kind;
    var errors = [];
    var data = {
      name: { es: val("ed-name-es"), en: val("ed-name-en") || val("ed-name-es") },
      desc: { es: val("ed-desc-es"), en: val("ed-desc-en") || val("ed-desc-es") },
      duration: num("ed-duration"),
      hidden: checked("ed-hidden")
    };
    if (!data.name.es) errors.push("Escribe el nombre en español.");
    if (!data.desc.es) errors.push("Escribe una descripción corta en español.");
    if (!(data.duration >= 15)) errors.push("La duración debe ser de al menos 15 minutos.");
    if (kind !== "tours") {
      data.cost = num("ed-cost");
      if (!(data.cost >= 0)) errors.push("El precio debe ser 0 o mayor.");
      Object.assign(data, readLocation("ed-", errors));
    }

    if (kind === "tours") {
      data.provider = val("ed-provider");
      data.url = val("ed-url");
      data.priceUsd = num("ed-price-usd");
      if (!(data.priceUsd >= 0)) errors.push("El precio debe ser 0 o mayor.");
      if (data.url && !/^https:\/\//.test(data.url)) errors.push("El enlace debe empezar con https:// (por ejemplo https://wa.me/51999999999).");
      data.departures = val("ed-departures").split(/[,\s]+/).filter(Boolean);
      var badTime = data.departures.filter(function (x) { return !/^([01]\d|2[0-3]):[0-5]\d$/.test(x); });
      if (!data.departures.length || badTime.length) errors.push("Escribe las horas de salida en formato 24 h, por ejemplo: 09:00, 14:00.");
      data.departures.sort();
      var end = readLocation("ed-end-", errors);
      data.end = end;
      data.start = { lat: end.lat, lng: end.lng };
      var stopsEs = val("ed-stops-es").split("\n").map(function (x) { return x.trim(); }).filter(Boolean);
      var stopsEn = val("ed-stops-en").split("\n").map(function (x) { return x.trim(); });
      data.stops = stopsEs.map(function (x, i) { return { es: x, en: stopsEn[i] || x }; });
      if (!data.stops.length) errors.push("Escribe al menos una parada del recorrido.");
      data.covers = city().attractions.filter(function (a) { return checked("ed-cov-" + a.id); }).map(function (a) { return a.id; });
      var inclEs = val("ed-incl-es"), inclEn = val("ed-incl-en");
      data.includes = { es: inclEs, en: inclEn || inclEs };
      var noteEs = val("ed-tip-es"), noteEn = val("ed-tip-en");
      data.tip = noteEs ? { es: noteEs, en: noteEn || noteEs } : null;
    } else if (kind === "attractions") {
      var tipEs = val("ed-tip-es"), tipEn = val("ed-tip-en");
      data.tip = tipEs ? { es: tipEs, en: tipEn || tipEs } : null;
      data.priority = Math.max(1, Math.min(10, Math.round(num("ed-priority")) || 5));
      data.fixedStart = val("ed-fixed") || null;
      data.interests = Object.keys(INTERESTS).filter(function (k) { return checked("ed-int-" + k); });
      if (!data.interests.length) errors.push("Marca al menos un interés, para saber a quién recomendarlo.");
      ATTR_FLAGS.forEach(function (f) { data[f[0]] = checked("ed-flag-" + f[0]); });
      var hours = [];
      for (var d = 0; d < 7; d++) {
        if (!checked("ed-open-" + d)) { hours.push(""); continue; }
        var from = val("ed-from-" + d), to = val("ed-to-" + d);
        if (!from || !to || to <= from) errors.push(DAYS[d] + ": la hora de cierre debe ser posterior a la de apertura.");
        hours.push(from + "-" + to);
      }
      if (hours.every(function (h) { return !h; })) errors.push("Marca al menos un día abierto, o usa \"Ocultar\".");
      data.hours = hours;
      if (data.fixedStart) {
        var fixedOk = hours.some(function (h) { return h && h.split("-")[0] <= data.fixedStart && data.fixedStart < h.split("-")[1]; });
        if (!fixedOk) errors.push("La hora fija de inicio debe estar dentro del horario de atención.");
      }
    } else {
      data.price = parseInt(val("ed-price"), 10);
      data.meals = ["lunch", "dinner"].filter(function (m) { return checked("ed-meal-" + m); });
      REST_FLAGS.forEach(function (f) { data[f[0]] = checked("ed-flag-" + f[0]); });
      if (!data.meals.length) errors.push("Marca si sirve almuerzo, cena o ambos.");
    }
    return { data: data, errors: errors };
  }

  function showError(id, errors) {
    var el = document.getElementById(id);
    el.innerHTML = errors.map(esc).join("<br>");
    el.hidden = !errors.length;
  }

  function saveEditor() {
    var r = collect();
    showError("editor-error", r.errors);
    if (r.errors.length) return;
    var kind = editing.kind;
    var isNew = !editing.id;
    var existing = isNew ? null : listOf(city(), kind).filter(function (x) { return x.id === editing.id; })[0];
    var id = isNew ? slug(r.data.name.es) + "-" + Date.now().toString(36).slice(-4) : editing.id;
    if (isNew || (existing && existing.custom)) r.data.custom = true;
    var wantFeatured = kind === "tours" && checked("ed-featured");
    var name = r.data.name.es;
    DataStore.save(kind, id, r.data).then(function () {
      if (kind !== "tours") return;
      var s = city().settings;
      var isFeatured = s.featuredTour === id;
      if (wantFeatured === isFeatured) return;
      // Cambia cuál tour se ofrece en el cuestionario.
      var next = Object.assign({}, s, { featuredTour: wantFeatured ? id : null });
      return DataStore.saveSettings(next);
    }).then(function () {
      editing = null;
      render();
      toast((isNew ? "Agregado: " : "Guardado: ") + name);
    }, function (e) {
      toast("No se pudo guardar. " + (e && e.code === "invalid_argument" ? "Tu cuenta no tiene permiso para editar." : "Inténtalo de nuevo."), true);
    });
  }

  function resetItem() {
    var item = listOf(city(), editing.kind).filter(function (x) { return x.id === editing.id; })[0];
    var wasCustom = !!(item && item.custom);
    DataStore.remove(editing.kind, editing.id).then(function () {
      editing = null;
      render();
      toast(wasCustom ? "Eliminado." : "Se restauraron los valores originales.");
    }, function () { toast("No se pudo restaurar. Inténtalo de nuevo.", true); });
  }

  function saveSettings() {
    var data = {
      exchangeRate: num("set-rate"),
      taxiBase: num("set-taxi-base"),
      taxiPerMin: num("set-taxi-min"),
      transferEnabled: checked("set-transfer-on"),
      whatsapp: val("set-whatsapp").replace(/[^\d]/g, ""),
      transferPrices: {},
      featuredTour: city().settings.featuredTour || null
    };
    var errors = [];
    FARE_ZONES.forEach(function (z) {
      var v = num("set-fare-" + z);
      if (v >= 0) data.transferPrices[z] = v;
      else errors.push("Escribe el precio del taxi para " + zoneName(city(), z) + ".");
    });
    if (data.transferEnabled && !/^\d{8,15}$/.test(data.whatsapp)) {
      errors.push("Escribe tu número de WhatsApp con código de país, solo números (por ejemplo 51987654321).");
    }
    if (!(data.exchangeRate >= 0.5)) errors.push("Ingresa un tipo de cambio válido (por ejemplo 3.75).");
    if (!(data.taxiBase >= 0) || !(data.taxiPerMin >= 0)) errors.push("Las tarifas de taxi deben ser 0 o mayores.");
    showError("settings-error", errors);
    if (errors.length) return;
    DataStore.saveSettings(data).then(function () {
      render();
      toast("Ajustes guardados.");
    }, function () { toast("No se pudieron guardar los ajustes.", true); });
  }

  // ---------------------------------------------------------------- events
  window.addEventListener("hashchange", syncWithHash);
  document.getElementById("admin-close").addEventListener("click", close);
  searchEl.addEventListener("input", render);

  document.querySelectorAll("[data-admin-tab]").forEach(function (b) {
    b.addEventListener("click", function () {
      tab = b.getAttribute("data-admin-tab");
      editing = null;
      render();
    });
  });

  panel.addEventListener("click", function (e) {
    var t = e.target;
    if (t.closest("[data-edit]")) return openEditor(tab, t.closest("[data-edit]").getAttribute("data-edit"));
    if (t.closest("[data-add]")) return openEditor(t.closest("[data-add]").getAttribute("data-add"), null);
    if (t.closest("[data-back]")) { editing = null; return render(); }
    if (t.closest("[data-reset]")) { document.getElementById("reset-confirm").hidden = false; return; }
    if (t.closest("[data-reset-yes]")) return resetItem();
  });

  panel.addEventListener("change", function (e) {
    // Al cambiar de zona, la ubicación exacta anterior ya no aplica.
    if (e.target.id === "ed-zone" || e.target.id === "ed-end-zone") {
      document.getElementById(e.target.id.replace("zone", "coords")).value = "";
      return;
    }
    var m = /^ed-open-(\d)$/.exec(e.target.id);
    if (!m) return;
    var on = e.target.checked;
    document.getElementById("ed-from-" + m[1]).disabled = !on;
    document.getElementById("ed-to-" + m[1]).disabled = !on;
    e.target.closest(".hours-row").querySelector(".closed-label").hidden = on;
  });

  panel.addEventListener("input", function (e) {
    if (e.target.id === "ed-cost") {
      document.getElementById("ed-cost-usd").textContent = usd(parseFloat(e.target.value) || 0) || "Gratis";
    }
    if (e.target.id === "ed-price-usd") {
      document.getElementById("ed-price-sol").textContent = "≈ " + soles(parseFloat(e.target.value) || 0);
    }
  });

  function doLogin() {
    var btn = document.getElementById("login-btn");
    var err = document.getElementById("login-error");
    var pass = document.getElementById("login-pass").value;
    if (!pass) { err.textContent = "Escribe la contraseña."; err.hidden = false; return; }
    btn.disabled = true;
    DataStore.login(pass).then(function () {
      gateEl.innerHTML = "";
      open();
    }, function (e) {
      btn.disabled = false;
      err.textContent = e && e.code === "not_configured"
        ? "Falta configurar la contraseña en Netlify (variable ADMIN_PASSWORD)."
        : e && e.code === "unauthorized" ? "Contraseña incorrecta." : "No se pudo conectar. Inténtalo de nuevo.";
      err.hidden = false;
    });
  }

  document.getElementById("admin-logout").addEventListener("click", function () {
    DataStore.logout();
    open();
  });

  panel.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "login-form") return doLogin();
    if (e.target.id === "editor-form") saveEditor();
    if (e.target.id === "settings-form") saveSettings();
  });

  DataStore.onChange(function () {
    if (!panel.hidden && !editing) open();
  });
  syncWithHash();
})();
