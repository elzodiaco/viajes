/*
 * Panel de administración: editar precios, horarios y textos de las
 * atracciones y restaurantes, y los ajustes generales (tipo de cambio,
 * tarifa de taxi). Los cambios se guardan con DataStore.
 */
(function () {
  var DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  var DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

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

  function zoneName(c, z) { return c.zones[z] ? es(c.zones[z].name) : z; }

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
    } else if (!allowed) {
      gateEl.innerHTML = "<h3>Acceso restringido</h3>" +
        '<p class="muted">Este panel solo está disponible para el administrador de la página. ' +
        "Si eres el administrador, abre este enlace con tu cuenta de Claude.</p>";
    }
    var local = DataStore.mode() !== "db";
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
    searchEl.parentNode.hidden = tab === "settings" || !!editing;
    if (editing) { listEl.hidden = true; editorEl.hidden = false; return; }
    listEl.hidden = false;
    editorEl.hidden = true;
    if (tab === "settings") return renderSettings();

    var c = city();
    var q = searchEl.value.trim().toLowerCase();
    var items = (tab === "attractions" ? c.attractions : c.restaurants).filter(function (it) {
      return !q || (es(it.name) + " " + en(it.name) + " " + zoneName(c, it.zone)).toLowerCase().indexOf(q) !== -1;
    });

    listEl.innerHTML = '<div class="admin-table-wrap"><table class="admin-table"><thead><tr>' +
      "<th>Nombre</th><th>Zona</th><th>" + (tab === "attractions" ? "Entrada" : "Gasto por persona") + "</th>" +
      "<th>" + (tab === "attractions" ? "Horario" : "Comidas") + "</th><th>Estado</th><th></th></tr></thead><tbody>" +
      items.map(function (it) {
        var status = (it.hidden ? '<span class="pill off">Oculto</span>' : '<span class="pill on">Visible</span>') +
          (it.edited ? ' <span class="pill edited">Editado</span>' : "");
        var detail = tab === "attractions" ? esc(hoursSummary(it.hours))
          : esc(it.meals.map(function (m) { return m === "lunch" ? "Almuerzo" : "Cena"; }).join(" y "));
        return "<tr><td><strong>" + esc(es(it.name)) + "</strong></td><td>" + esc(zoneName(c, it.zone)) + "</td>" +
          '<td class="num">' + price(it.cost) + "</td><td>" + detail + "</td><td>" + status + "</td>" +
          '<td><button type="button" class="btn small" data-edit="' + esc(it.id) + '">Editar</button></td></tr>';
      }).join("") +
      "</tbody></table></div>" +
      (items.length ? "" : '<p class="muted">No hay resultados para esa búsqueda.</p>');
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
  function openEditor(kind, id) {
    editing = { kind: kind, id: id };
    var c = city();
    var it = (kind === "attractions" ? c.attractions : c.restaurants).filter(function (x) { return x.id === id; })[0];
    var common =
      field("ed-name-es", "Nombre (español)", input("ed-name-es", es(it.name))) +
      field("ed-name-en", "Nombre (inglés)", input("ed-name-en", en(it.name))) +
      field("ed-desc-es", "Descripción (español)", textarea("ed-desc-es", es(it.desc)), true) +
      field("ed-desc-en", "Descripción (inglés)", textarea("ed-desc-en", en(it.desc)), true);

    var specific;
    if (kind === "attractions") {
      specific =
        field("ed-tip-es", "Consejo (español, opcional)", textarea("ed-tip-es", es(it.tip)), true) +
        field("ed-tip-en", "Consejo (inglés, opcional)", textarea("ed-tip-en", en(it.tip)), true) +
        field("ed-cost", "Precio de entrada por persona (S/)", input("ed-cost", it.cost, "number", ' min="0" step="1"') +
          '<small class="hint" id="ed-cost-usd">' + (usd(it.cost) || "Gratis") + "</small>") +
        field("ed-duration", "Duración de la visita (minutos)", input("ed-duration", it.duration, "number", ' min="15" step="5"')) +
        field("ed-priority", "Importancia (1 a 10)", input("ed-priority", it.priority, "number", ' min="1" max="10" step="1"')) +
        field("ed-fixed", "Hora fija de inicio (opcional, p. ej. tours)", input("ed-fixed", it.fixedStart || "", "time")) +
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
        field("ed-cost", "Gasto aproximado por persona (S/)", input("ed-cost", it.cost, "number", ' min="0" step="1"') +
          '<small class="hint" id="ed-cost-usd">' + (usd(it.cost) || "Gratis") + "</small>") +
        field("ed-price", "Nivel de precio",
          '<select id="ed-price">' + [[1, "Económico"], [2, "Medio"], [3, "Alto"]].map(function (p) {
            return '<option value="' + p[0] + '"' + (it.price === p[0] ? " selected" : "") + ">" + p[1] + "</option>";
          }).join("") + "</select>") +
        field("ed-duration", "Duración de la comida (minutos)", input("ed-duration", it.duration || 90, "number", ' min="30" step="5"')) +
        '<div class="field"><span class="label">Sirve</span><div class="checks">' +
        check("ed-lunch", "Almuerzo", it.meals.indexOf("lunch") !== -1) +
        check("ed-dinner", "Cena", it.meals.indexOf("dinner") !== -1) +
        check("ed-reservation", "Requiere reserva", !!it.reservation) +
        "</div></div>";
    }

    editorEl.innerHTML =
      '<form class="card admin-form" id="editor-form" novalidate>' +
      '<div class="editor-head"><button type="button" class="btn small" data-back>← Volver a la lista</button>' +
      "<h3>" + esc(es(it.name)) + "</h3>" +
      '<span class="muted small">' + esc(zoneName(c, it.zone)) + "</span></div>" +
      '<div class="admin-grid">' + common + specific + "</div>" +
      check("ed-hidden", "Ocultar del planificador (no aparecerá en los itinerarios)", !!it.hidden) +
      '<p class="error" id="editor-error" hidden></p>' +
      '<div class="admin-actions">' +
      '<button class="btn primary" type="submit">Guardar cambios</button>' +
      '<button class="btn" type="button" data-back>Cancelar</button>' +
      (it.edited ? '<button class="btn danger" type="button" data-reset>Restaurar valores originales</button>' : "") +
      '<span class="confirm" id="reset-confirm" hidden>¿Seguro? <button class="btn small danger" type="button" data-reset-yes>Sí, restaurar</button></span>' +
      "</div></form>";
    render();
    window.scrollTo(0, panel.offsetTop - 70);
  }

  function val(id) { return document.getElementById(id).value.trim(); }
  function num(id) { return parseFloat(document.getElementById(id).value); }
  function checked(id) { return document.getElementById(id).checked; }

  function collect() {
    var kind = editing.kind;
    var errors = [];
    var data = {
      name: { es: val("ed-name-es"), en: val("ed-name-en") || val("ed-name-es") },
      desc: { es: val("ed-desc-es"), en: val("ed-desc-en") || val("ed-desc-es") },
      cost: num("ed-cost"),
      duration: num("ed-duration"),
      hidden: checked("ed-hidden")
    };
    if (!data.name.es) errors.push("Escribe el nombre en español.");
    if (!(data.cost >= 0)) errors.push("El precio debe ser 0 o mayor.");
    if (!(data.duration >= 15)) errors.push("La duración debe ser de al menos 15 minutos.");

    if (kind === "attractions") {
      var tipEs = val("ed-tip-es"), tipEn = val("ed-tip-en");
      data.tip = tipEs ? { es: tipEs, en: tipEn || tipEs } : null;
      data.priority = Math.max(1, Math.min(10, Math.round(num("ed-priority")) || 5));
      data.fixedStart = val("ed-fixed") || null;
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
      data.meals = [];
      if (checked("ed-lunch")) data.meals.push("lunch");
      if (checked("ed-dinner")) data.meals.push("dinner");
      data.reservation = checked("ed-reservation");
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
    var name = r.data.name.es;
    DataStore.save(editing.kind, editing.id, r.data).then(function () {
      editing = null;
      render();
      toast("Guardado: " + name);
    }, function (e) {
      toast("No se pudo guardar. " + (e && e.code === "invalid_argument" ? "Tu cuenta no tiene permiso para editar." : "Inténtalo de nuevo."), true);
    });
  }

  function resetItem() {
    DataStore.remove(editing.kind, editing.id).then(function () {
      editing = null;
      render();
      toast("Se restauraron los valores originales.");
    }, function () { toast("No se pudo restaurar. Inténtalo de nuevo.", true); });
  }

  function saveSettings() {
    var data = {
      exchangeRate: num("set-rate"),
      taxiBase: num("set-taxi-base"),
      taxiPerMin: num("set-taxi-min")
    };
    var errors = [];
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
    if (t.closest("[data-back]")) { editing = null; return render(); }
    if (t.closest("[data-reset]")) { document.getElementById("reset-confirm").hidden = false; return; }
    if (t.closest("[data-reset-yes]")) return resetItem();
  });

  panel.addEventListener("change", function (e) {
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
  });

  panel.addEventListener("submit", function (e) {
    e.preventDefault();
    if (e.target.id === "editor-form") saveEditor();
    if (e.target.id === "settings-form") saveSettings();
  });

  DataStore.onChange(function () {
    if (!panel.hidden && !editing) open();
  });
  syncWithHash();
})();
