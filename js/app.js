(function () {
  var STORAGE_KEY = "rutaperu.form";
  var LANG_KEY = "rutaperu.lang";
  var INTERESTS = ["gastronomy", "history", "art", "beach", "nature", "nightlife", "shopping", "adventure"];
  var ICONS = {
    arrival: "🛬", "transfer-in": "🚕", checkin: "🏨", pickup: "🧳", "transfer-out": "🚕",
    airport: "🛂", flight: "🛫", lunch: "🍽️", dinner: "🍷", free: "☕", rest: "🛏️", return: "🏨",
    gastronomy: "🥘", history: "🏛️", art: "🎨", beach: "🌊", nature: "🌿", nightlife: "🎶",
    shopping: "🛍️", adventure: "🪂"
  };

  var form = document.getElementById("planner-form");
  var resultEl = document.getElementById("result");
  var lang = pickLang();
  var lastPrefs = null;
  var lastResult = null;

  function storage(fn) {
    try { return fn(window.localStorage); } catch (e) { return null; }
  }

  function pickLang() {
    var saved = storage(function (s) { return s.getItem(LANG_KEY); });
    if (saved === "es" || saved === "en") return saved;
    return (navigator.language || "es").toLowerCase().indexOf("es") === 0 ? "es" : "en";
  }

  function t(key, vars) {
    var parts = key.split(".");
    var v = I18N[lang];
    for (var i = 0; i < parts.length && v != null; i++) v = v[parts[i]];
    if (typeof v !== "string") return key;
    return v.replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] != null ? vars[k] : ""; });
  }

  function L(obj) {
    if (obj == null) return "";
    return typeof obj === "string" ? obj : (obj[lang] || obj.es);
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function soles(n) {
    return "S/ " + Math.round(n).toLocaleString(lang === "es" ? "es-PE" : "en-US");
  }

  function dollars(n) {
    var usd = n / city().settings.exchangeRate;
    return "US$ " + (usd < 10 ? usd.toFixed(1) : Math.round(usd).toLocaleString("en-US"));
  }

  // Precio en soles con su equivalente en dólares.
  function money(n) {
    return n > 0 ? soles(n) + " · " + dollars(n) : t("free");
  }

  function duration(min) {
    var h = Math.floor(min / 60), m = min % 60;
    if (!h) return m + " " + t("mins");
    return h + " " + t("hours") + (m ? " " + m + " " + t("mins") : "");
  }

  function city() {
    return DataStore.effective(CITIES[form.elements.city.value] || CITIES.lima);
  }

  // ---------------------------------------------------------------- i18n UI
  function applyLang() {
    document.documentElement.lang = lang;
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach(function (el) {
      el.textContent = t(el.getAttribute("data-i18n"));
    });
    document.querySelectorAll("[data-lang]").forEach(function (b) {
      b.setAttribute("aria-pressed", b.getAttribute("data-lang") === lang ? "true" : "false");
    });
    renderZones();
    renderInterests();
    if (lastResult) render(lastResult, lastPrefs);
  }

  function renderZones() {
    var select = document.getElementById("hotelZone");
    var current = select.value || "miraflores";
    var zones = city().zones;
    select.innerHTML = Object.keys(zones).filter(function (k) { return zones[k].hotel; }).map(function (k) {
      return '<option value="' + k + '">' + esc(L(zones[k].name)) + "</option>";
    }).join("");
    select.value = current;
  }

  function renderInterests() {
    var box = document.getElementById("interests");
    var checked = selectedInterests();
    if (!box.children.length) checked = ["gastronomy", "history"];
    box.innerHTML = INTERESTS.map(function (k) {
      return '<label class="chip"><input type="checkbox" name="interests" value="' + k + '"' +
        (checked.indexOf(k) !== -1 ? " checked" : "") + "><span>" + ICONS[k] + " " + esc(t("interest." + k)) + "</span></label>";
    }).join("");
  }

  function selectedInterests() {
    return Array.prototype.slice.call(form.querySelectorAll('input[name="interests"]:checked'))
      .map(function (i) { return i.value; });
  }

  // ------------------------------------------------------------ form state
  function readForm() {
    var el = form.elements;
    return {
      city: el.city.value,
      arrivalDate: el.arrivalDate.value,
      arrivalTime: el.arrivalTime.value,
      days: Math.max(1, Math.min(14, parseInt(el.days.value, 10) || 1)),
      departureTime: el.departureTime.value,
      flightType: el.flightType.value,
      hotelZone: el.hotelZone.value,
      pace: el.pace.value,
      budget: el.budget.value,
      interests: selectedInterests()
    };
  }

  function fillForm(p) {
    var el = form.elements;
    ["arrivalDate", "arrivalTime", "days", "departureTime", "hotelZone"].forEach(function (k) {
      if (p[k] != null) el[k].value = p[k];
    });
    ["flightType", "pace", "budget"].forEach(function (k) {
      var r = form.querySelector('input[name="' + k + '"][value="' + p[k] + '"]');
      if (r) r.checked = true;
    });
    if (p.interests) {
      form.querySelectorAll('input[name="interests"]').forEach(function (i) {
        i.checked = p.interests.indexOf(i.value) !== -1;
      });
    }
  }

  function todayISO() {
    var d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  }

  // --------------------------------------------------------------- render
  // Contenido de un evento como datos; lo usan la vista HTML y el PDF.
  function eventData(ev, res) {
    var c = city();
    var zoneName = L((c.zones[res.hotelZone] || {}).name);
    var title = "", desc = "", tip = "", icon = ICONS[ev.type] || "📍", meta = [], tags = [];

    switch (ev.type) {
      case "arrival":
        title = t("ev.arrival", { airport: L(c.airport.name) }); desc = t("ev.arrivalDesc"); break;
      case "transfer-in":
        title = t("ev.transferIn", { zone: zoneName }); desc = t("ev.transferInDesc"); break;
      case "checkin":
        title = t("ev.checkin"); desc = t("ev.checkinDesc"); break;
      case "pickup":
        title = t("ev.pickup"); desc = t("ev.pickupDesc"); break;
      case "transfer-out":
        title = t("ev.transferOut"); desc = t("ev.transferOutDesc"); break;
      case "airport":
        title = t("ev.airport");
        desc = t("ev.airportDesc", {
          buffer: duration(lastPrefs.flightType === "dom" ? 120 : 180),
          type: t(lastPrefs.flightType).toLowerCase()
        });
        break;
      case "flight":
        title = t("ev.flight"); desc = t("ev.flightDesc"); break;
      case "return":
        title = t("ev.return"); break;
      case "free":
        var atHotel = ev.place.lat === c.zones[res.hotelZone].lat && ev.travel;
        icon = atHotel ? ICONS.rest : ICONS.free;
        title = atHotel ? t("ev.rest") : t("ev.free");
        desc = atHotel ? t("ev.restDesc") : L((c.zones[ev.zone] || {}).free);
        break;
      case "meal":
        icon = ICONS[ev.meal];
        title = t("ev." + ev.meal, { name: L(ev.item.name) });
        desc = L(ev.item.desc);
        if (ev.item.reservation) tags.push(t("reservation"));
        meta.push(L(c.zones[ev.item.zone].name));
        meta.push("~" + money(ev.cost));
        break;
      case "activity":
        var a = ev.item;
        icon = ICONS[a.interests[0]] || "📍";
        title = L(a.name);
        desc = L(a.desc);
        tip = L(a.tip);
        meta.push(L(c.zones[a.zone].name));
        meta.push(duration(a.duration));
        meta.push(money(a.cost));
        a.interests.forEach(function (i) { tags.push(t("interest." + i)); });
        break;
    }

    var mapUrl = null;
    if (ev.type === "activity" || ev.type === "meal") {
      var q = L(ev.item.name) + ", " + L(c.zones[ev.item.zone].name) + ", Lima, Perú";
      mapUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
    }

    var travel = null;
    var isTransfer = ev.type === "return" || ev.type === "transfer-in" || ev.type === "transfer-out";
    if (ev.travel && ev.travel.mode !== "none") {
      travel = { mode: ev.travel.mode, text: duration(ev.travel.min) + " " + t(ev.travel.mode) };
    }
    return {
      type: ev.type,
      icon: icon, title: title, desc: desc, tip: tip, meta: meta, tags: tags, mapUrl: mapUrl,
      span: ev.end > ev.start ? Planner.fmt(ev.start) + "–" + Planner.fmt(ev.end) : Planner.fmt(ev.start),
      travelBefore: isTransfer ? null : travel,
      travelSelf: isTransfer ? travel : null,
      logistic: ["arrival", "transfer-in", "checkin", "pickup", "transfer-out", "airport", "flight", "return"].indexOf(ev.type) !== -1
    };
  }

  function travelIcon(tr) { return tr.mode === "walk" ? "🚶" : "🚕"; }

  function eventView(ev, res) {
    var d = eventData(ev, res);
    var meta = d.meta.slice();
    if (d.travelSelf) meta.push(travelIcon(d.travelSelf) + " " + d.travelSelf.text);
    return (d.travelBefore ? '<div class="travel">' + travelIcon(d.travelBefore) + " " + d.travelBefore.text + "</div>" : "") +
      '<article class="event ' + d.type + (d.logistic ? " logistic" : "") + '">' +
        '<div class="time">' + d.span + "</div>" +
        '<div class="dot" aria-hidden="true">' + d.icon + "</div>" +
        '<div class="body">' +
          "<h4>" + esc(d.title) + "</h4>" +
          (d.desc ? "<p>" + esc(d.desc) + "</p>" : "") +
          (d.tip ? '<p class="tip">💡 ' + esc(d.tip) + "</p>" : "") +
          (meta.length ? '<div class="meta">' + meta.map(function (m) { return "<span>" + esc(m) + "</span>"; }).join("") + "</div>" : "") +
          (d.tags.length || d.mapUrl ? '<div class="tags">' + d.tags.map(function (x) { return '<span class="tag">' + esc(x) + "</span>"; }).join("") +
            (d.mapUrl ? '<a class="tag link" target="_blank" rel="noopener" href="' + d.mapUrl + '">📍 ' + esc(t("map")) + "</a>" : "") + "</div>" : "") +
        "</div>" +
      "</article>";
  }

  /** Itinerario actual como datos simples, para exportarlo a PDF. */
  function exportData() {
    if (!lastResult) return null;
    var c = city(), res = lastResult, prefs = lastPrefs;
    var dateFmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    return {
      lang: lang,
      title: t("yourTrip") + " " + L(c.name),
      summary: t("summary", { days: prefs.days, zone: L(c.zones[prefs.hotelZone].name), flight: prefs.departureTime }),
      warnings: res.warnings.map(function (w) { return t("warnings." + w); }),
      days: res.days.map(function (d, i) {
        return {
          label: t("day") + " " + (i + 1),
          date: dateFmt.format(d.date),
          cost: money(d.cost),
          events: d.events.map(function (ev) { return eventData(ev, res); })
        };
      }),
      labels: { estDay: t("estDay"), estTotal: t("estTotal"), tips: t("tipsTitle"), map: t("map") },
      total: soles(res.total) + " · " + dollars(res.total),
      note: t("estNote") + " " + t("rate", { rate: c.settings.exchangeRate.toFixed(2) }),
      tips: c.tips.map(L),
      disclaimer: t("disclaimer"),
      fileName: "itinerario-" + c.id + "-" + prefs.arrivalDate + ".pdf"
    };
  }

  function render(res, prefs) {
    var c = city();
    var dateFmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "long", day: "numeric", month: "long" });
    var shortFmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "short", day: "numeric" });

    document.getElementById("result-title").textContent = t("yourTrip") + " " + L(c.name);
    document.getElementById("result-summary").textContent = t("summary", {
      days: prefs.days, zone: L(c.zones[prefs.hotelZone].name), flight: prefs.departureTime
    });

    document.getElementById("warnings").innerHTML = res.warnings.map(function (w) {
      return '<div class="notice">ℹ️ ' + esc(t("warnings." + w)) + "</div>";
    }).join("");

    document.getElementById("day-tabs").innerHTML = res.days.map(function (d, i) {
      return '<a href="#day-' + i + '"><strong>' + t("dayShort") + " " + (i + 1) + "</strong><span>" + esc(shortFmt.format(d.date)) + "</span></a>";
    }).join("");

    document.getElementById("days").innerHTML = res.days.map(function (d, i) {
      var hasActivity = d.events.some(function (e) { return e.type === "activity" || e.type === "meal"; });
      return '<section class="card day" id="day-' + i + '">' +
        '<header class="day-head"><div><span class="day-num">' + t("day") + " " + (i + 1) + "</span>" +
        "<h3>" + esc(dateFmt.format(d.date)) + "</h3></div>" +
        '<div class="day-cost"><small>' + esc(t("estDay")) + "</small><strong>" + money(d.cost) + "</strong></div></header>" +
        '<div class="timeline">' + d.events.map(function (ev) { return eventView(ev, res); }).join("") + "</div>" +
        (hasActivity ? "" : '<p class="muted small">' + esc(t("emptyDay")) + "</p>") +
        "</section>";
    }).join("");

    document.getElementById("total").innerHTML =
      "<div><small>" + esc(t("estTotal")) + "</small><strong>" + soles(res.total) +
      ' <span class="usd">' + dollars(res.total) + "</span></strong></div>" +
      '<p class="muted small">' + esc(t("estNote")) + " " +
      esc(t("rate", { rate: c.settings.exchangeRate.toFixed(2) })) + "</p>";

    document.getElementById("tips").innerHTML = c.tips.map(function (tip) {
      return "<li>" + esc(L(tip)) + "</li>";
    }).join("");
  }

  function showError(msg) {
    var el = document.getElementById("form-error");
    el.textContent = msg;
    el.hidden = !msg;
  }

  function generate(seed) {
    var prefs = readForm();
    if (!prefs.arrivalDate || !prefs.arrivalTime || !prefs.departureTime) {
      showError(t("errors.missing"));
      return;
    }
    prefs.seed = seed;
    var res = Planner.plan(city(), prefs);
    if (res.error) {
      showError(t("errors." + res.error));
      resultEl.hidden = true;
      return;
    }
    showError("");
    lastPrefs = prefs;
    lastResult = res;
    storage(function (s) { s.setItem(STORAGE_KEY, JSON.stringify(prefs)); });
    render(res, prefs);
    resultEl.hidden = false;
    resultEl.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ---------------------------------------------------------------- events
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    generate(1);
  });

  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-step]");
    if (!b) return;
    var input = form.elements.days;
    input.value = Math.max(1, Math.min(14, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute("data-step"), 10)));
  });

  function updateEarlyHint() {
    var v = form.elements.departureTime.value;
    document.getElementById("early-hint").hidden = !(v && v < "06:00");
  }
  form.elements.departureTime.addEventListener("input", updateEarlyHint);

  document.querySelectorAll("[data-lang]").forEach(function (b) {
    b.addEventListener("click", function () {
      lang = b.getAttribute("data-lang");
      storage(function (s) { s.setItem(LANG_KEY, lang); });
      applyLang();
    });
  });

  document.getElementById("btn-regen").addEventListener("click", function () {
    generate(Math.floor(Math.random() * 1e9) + 2);
  });
  document.getElementById("btn-edit").addEventListener("click", function () {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  });


  // ------------------------------------------------------------------ init
  form.elements.arrivalDate.value = todayISO();
  form.elements.arrivalDate.min = todayISO();
  applyLang();
  var saved = storage(function (s) { return JSON.parse(s.getItem(STORAGE_KEY) || "null"); });
  if (saved) {
    if (saved.arrivalDate && saved.arrivalDate < todayISO()) delete saved.arrivalDate;
    fillForm(saved);
  }
  updateEarlyHint();

  // Cuando el administrador cambia precios u horarios, se recalcula el plan.
  DataStore.onChange(function () {
    if (lastPrefs) {
      var res = Planner.plan(city(), lastPrefs);
      if (!res.error) { lastResult = res; render(res, lastPrefs); }
    }
  });
  DataStore.init();

  window.App = { lang: function () { return lang; }, exportData: exportData, t: t };
})();
