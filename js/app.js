(function () {
  var STORAGE_KEY = "rutaperu.form";
  var LANG_KEY = "rutaperu.lang";
  var INTERESTS = ["gastronomy", "history", "art", "beach", "nature", "nightlife", "shopping", "adventure"];
  var ICONS = {
    arrival: "🛬", "transfer-in": "🚕", checkin: "🏨", pickup: "🧳", "transfer-out": "🚕",
    airport: "🛂", flight: "🛫", lunch: "🍽️", dinner: "🍷", free: "☕", rest: "🛏️", return: "🏨",
    tour: "🚐",
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

  function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
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
    renderTourOffer();
    if (steps) showStep(stepIndex);
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
      interests: selectedInterests(),
      // Respuestas del cuestionario
      travelWith: el.travelWith.value || "solo",
      firstTimeAns: el.firstTime.value,
      foodAns: el.food.value,
      tourAns: el.wantsTour.value,
      firstTime: el.firstTime.value !== "no",
      avoidSeafood: el.food.value === "noSeafood",
      wantsTour: el.wantsTour.value === "yes"
    };
  }

  function fillForm(p) {
    var el = form.elements;
    ["arrivalDate", "arrivalTime", "days", "departureTime", "hotelZone"].forEach(function (k) {
      if (p[k] != null) el[k].value = p[k];
    });
    [["flightType", "flightType"], ["pace", "pace"], ["budget", "budget"], ["travelWith", "travelWith"],
      ["firstTime", "firstTimeAns"], ["food", "foodAns"], ["wantsTour", "tourAns"]].forEach(function (k) {
      var r = form.querySelector('input[name="' + k[0] + '"][value="' + p[k[1]] + '"]');
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
        title = t("ev.transferIn", { zone: zoneName });
        desc = ev.fixedFare ? t("ev.transferOurs") : t("ev.transferInDesc");
        if (ev.fixedFare) meta.push(money(ev.cost));
        break;
      case "checkin":
        title = t("ev.checkin"); desc = t("ev.checkinDesc"); break;
      case "pickup":
        title = t("ev.pickup"); desc = t("ev.pickupDesc"); break;
      case "transfer-out":
        title = t("ev.transferOut");
        desc = t("ev.transferOutDesc") + (ev.fixedFare ? " " + t("ev.transferOurs") : "");
        if (ev.fixedFare) meta.push(money(ev.cost));
        break;
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
      case "tour":
        var tour = ev.item;
        icon = ICONS.tour;
        title = L(tour.name) + " · " + tour.provider;
        desc = L(tour.desc) + " " + t("tour.stopsLine", { list: tour.stops.map(L).join(", ") });
        tip = L(tour.tip);
        meta.push(duration(tour.duration));
        meta.push("US$ " + tour.priceUsd + " · " + soles(ev.cost));
        tags.push(t("reservation"));
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
      travel = { mode: ev.travel.mode, text: duration(ev.travel.min) + (ev.fixedFare ? "" : " " + t(ev.travel.mode)) };
    }
    return {
      type: ev.type,
      icon: icon, title: title, desc: desc, tip: tip, meta: meta, tags: tags, mapUrl: mapUrl,
      bookUrl: ev.type === "tour" ? ev.item.url : null,
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
          (d.bookUrl ? '<a class="btn primary small book" target="_blank" rel="noopener" href="' + esc(d.bookUrl) + '">' + esc(t("tour.book")) + "</a>" : "") +
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
      labels: { estDay: t("estDay"), estTotal: t("estTotal"), tips: t("tipsTitle"), map: t("map"), book: t("tour.book"), taxiBook: t("cab.book") },
      persona: personaText(prefs),
      taxi: (function () {
        var info = taxiInfo(res, prefs);
        if (!info) return null;
        return {
          text: t("cab.pdf", { phone: info.phone, date: info.pickupDate, time: info.pickupTime }),
          url: "https://wa.me/" + info.phone + "?text=" + encodeURIComponent(t("cab.msgHello") + "\n• " +
            t("cab.msgPickup") + ": " + info.pickupDate + ", " + info.pickupTime)
        };
      })(),
      total: soles(res.total) + " · " + dollars(res.total),
      note: t("estNote") + " " + t("rate", { rate: c.settings.exchangeRate.toFixed(2) }),
      tips: c.tips.map(L),
      disclaimer: t("disclaimer"),
      fileName: "itinerario-" + c.id + "-" + prefs.arrivalDate + ".pdf"
    };
  }

  function personaText(prefs) {
    var likes = prefs.interests.map(function (i) { return t("persona.i." + i); });
    var last = likes[likes.length - 1] || "";
    // En español "y" pasa a "e" antes de una palabra que suena con "i".
    var and = lang === "es" && /^h?i/i.test(last) ? " e " : t("persona.and");
    var list = likes.length > 1 ? likes.slice(0, -1).join(", ") + and + last : likes.join("");
    return t("persona.lead", {
      who: t("persona." + prefs.travelWith),
      first: t(prefs.firstTime ? "persona.firstYes" : "persona.firstNo"),
      likes: list ? t("persona.likes", { list: list }) : ""
    });
  }

  function currentTour() {
    return city().tours[0] || null;
  }

  // Tarjeta del tour: oferta en el cuestionario y en los resultados.
  function tourCardHTML(tour, extra) {
    return '<div class="tour-head"><span class="tour-badge">' + esc(t("tour.badge")) + "</span>" +
      '<span class="tour-provider">' + esc(tour.provider) + "</span></div>" +
      "<h3>" + esc(L(tour.name)) + "</h3>" +
      '<p class="tour-price"><strong>US$ ' + tour.priceUsd + "</strong> <span>" + esc(t("tour.from")) + " · ≈ " +
        soles(tour.priceUsd * city().settings.exchangeRate) + "</span></p>" +
      "<p>" + esc(L(tour.desc)) + "</p>" +
      '<p class="tour-facts"><span>⏱ ' + esc(t("tour.hours", { h: Math.round(tour.duration / 60) })) + "</span>" +
        "<span>🕘 " + esc(t("tour.departures", { times: tour.departures.join(" · ") })) + "</span></p>" +
      "<details><summary>" + esc(t("tour.stops")) + "</summary><ol>" +
        tour.stops.map(function (x) { return "<li>" + esc(L(x)) + "</li>"; }).join("") + "</ol>" +
        '<p class="muted small">' + esc(L(tour.includes)) + "</p></details>" +
      (extra || "");
  }

  function renderTourOffer() {
    var tour = currentTour();
    var box = document.getElementById("tour-offer");
    box.innerHTML = tour ? tourCardHTML(tour) : "";
  }

  function renderTourCard(res, prefs) {
    var tour = currentTour();
    var box = document.getElementById("tour-card");
    if (!tour) { box.innerHTML = ""; return; }
    var ev = null, dayIndex = -1;
    res.days.forEach(function (d, i) {
      d.events.forEach(function (e) { if (e.type === "tour") { ev = e; dayIndex = i; } });
    });
    var status = ev
      ? '<p class="tour-status">✅ ' + esc(t("tour.included", { day: dayIndex + 1, from: Planner.fmt(ev.start), to: Planner.fmt(ev.end) })) + "</p>"
      : "";
    var actions = '<div class="tour-actions">' +
      (!ev && !prefs.wantsTour ? '<button type="button" class="btn" id="tour-add">' + esc(t("tour.add")) + "</button>" : "") +
      (tour.url ? '<a class="btn primary" target="_blank" rel="noopener" href="' + esc(tour.url) + '">' + esc(t("tour.book")) + "</a>" : "") +
      "</div>";
    box.innerHTML = '<aside class="card tour-card">' + tourCardHTML(tour, status + actions) + "</aside>";
  }

  // ------------------------------------------------- taxi al aeropuerto
  function findEvent(res, type) {
    var found = null;
    res.days.forEach(function (d) {
      d.events.forEach(function (e) { if (e.type === type) found = { ev: e, date: d.date, base: d.index * Planner.DAY }; });
    });
    return found;
  }

  function taxiInfo(res, prefs) {
    var s = city().settings;
    if (!s.transferEnabled || !s.whatsapp) return null;
    var out = findEvent(res, "transfer-out");
    var arr = findEvent(res, "transfer-in");
    if (!out) return null;
    var fmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "long", day: "numeric", month: "long" });
    // El recojo puede caer la noche anterior a un vuelo de madrugada.
    var outDate = new Date(res.days[0].date.getTime());
    outDate.setDate(outDate.getDate() + Math.floor(out.ev.start / Planner.DAY));
    var arrDate = new Date(res.days[0].date.getTime());
    arrDate.setDate(arrDate.getDate() + Math.floor(arr.ev.start / Planner.DAY));
    return {
      phone: s.whatsapp,
      price: (s.transferPrices || {})[prefs.hotelZone],
      pickupDate: fmt.format(outDate), pickupTime: Planner.fmt(out.ev.start),
      arrivalDate: fmt.format(arrDate), arrivalTime: Planner.fmt(arr.ev.start)
    };
  }

  function taxiMessage(info, prefs, fields) {
    var zone = L(city().zones[prefs.hotelZone].name);
    var lines = [
      t("cab.msgHello"),
      "• " + t("cab.msgName") + ": " + fields.name,
      "• " + t("cab.msgPickup") + ": " + info.pickupDate + ", " + info.pickupTime,
      "• " + t("cab.msgHotel") + ": " + fields.hotel + " (" + zone + ")",
      "• " + t("cab.msgFlight") + ": " + prefs.departureTime + " (" + t("cab." + prefs.flightType) + ")" +
        (fields.flightNo ? " " + fields.flightNo : ""),
      "• " + t("cab.msgPax") + ": " + fields.pax + " · " + t("cab.msgBags") + ": " + fields.bags
    ];
    if (info.price) lines.push("• " + t("cab.msgPrice") + ": " + money(info.price));
    if (fields.arrival) lines.push("• " + t("cab.msgArrival") + ": " + info.arrivalDate + ", " + info.arrivalTime);
    lines.push(t("cab.msgFrom"));
    return lines.join("\n");
  }

  function taxiFields() {
    return {
      name: document.getElementById("taxi-name").value.trim(),
      hotel: document.getElementById("taxi-hotel").value.trim(),
      pax: document.getElementById("taxi-pax").value || "1",
      bags: document.getElementById("taxi-bags").value || "1",
      flightNo: document.getElementById("taxi-flight").value.trim(),
      arrival: document.getElementById("taxi-arrival").checked
    };
  }

  function updateTaxiLink() {
    var link = document.getElementById("taxi-book");
    if (!link || !lastResult) return;
    var info = taxiInfo(lastResult, lastPrefs);
    link.href = "https://wa.me/" + info.phone + "?text=" + encodeURIComponent(taxiMessage(info, lastPrefs, taxiFields()));
  }

  function renderTaxiCard(res, prefs) {
    var box = document.getElementById("taxi-card");
    var info = taxiInfo(res, prefs);
    if (!info) { box.innerHTML = ""; return; }
    // Conserva lo que el turista ya escribió si el plan se vuelve a generar.
    var prev = document.getElementById("taxi-name") ? taxiFields() : { name: "", hotel: "", pax: "2", bags: "2", flightNo: "", arrival: false };
    var num = function (id, label, value) {
      return '<label class="field" for="' + id + '"><span>' + esc(label) + '</span><input id="' + id + '" type="number" min="1" max="12" value="' + esc(value) + '"></label>';
    };
    box.innerHTML =
      '<section class="card taxi-card" aria-labelledby="taxi-title">' +
        '<div class="taxi-head"><span class="taxi-icon" aria-hidden="true">🚖</span><div>' +
          '<h3 id="taxi-title">' + esc(t("cab.title")) + "</h3>" +
          "<p>" + esc(t("cab.lead", { date: info.pickupDate, time: info.pickupTime, flight: prefs.departureTime })) + "</p>" +
        "</div>" +
        (info.price ? '<div class="taxi-price"><small>' + esc(t("cab.price")) + "</small><strong>" + money(info.price) + "</strong></div>" : "") +
        "</div>" +
        '<div class="taxi-grid">' +
          '<label class="field wide" for="taxi-name"><span>' + esc(t("cab.name")) + '</span><input id="taxi-name" type="text" autocomplete="name" value="' + esc(prev.name) + '"></label>' +
          '<label class="field wide" for="taxi-hotel"><span>' + esc(t("cab.hotel")) + '</span><input id="taxi-hotel" type="text" value="' + esc(prev.hotel) + '"></label>' +
          num("taxi-pax", t("cab.pax"), prev.pax) +
          num("taxi-bags", t("cab.bags"), prev.bags) +
          '<label class="field wide" for="taxi-flight"><span>' + esc(t("cab.flightNo")) + '</span><input id="taxi-flight" type="text" value="' + esc(prev.flightNo) + '"></label>' +
        "</div>" +
        '<label class="check"><input id="taxi-arrival" type="checkbox"' + (prev.arrival ? " checked" : "") + "> " +
          esc(t("cab.arrival", { date: info.arrivalDate, time: info.arrivalTime })) + "</label>" +
        '<p class="error" id="taxi-error" hidden></p>' +
        '<div class="taxi-actions"><a class="btn whatsapp" id="taxi-book" target="_blank" rel="noopener" href="#">' + esc(t("cab.book")) + "</a>" +
        '<span class="muted small">' + esc(t("cab.note")) + "</span></div>" +
      "</section>";
    updateTaxiLink();
  }

  function render(res, prefs) {
    var c = city();
    var dateFmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "long", day: "numeric", month: "long" });
    var shortFmt = new Intl.DateTimeFormat(lang === "es" ? "es-PE" : "en-US", { weekday: "short", day: "numeric" });

    document.getElementById("result-title").textContent = t("yourTrip") + " " + L(c.name);
    document.getElementById("result-summary").textContent = t("summary", {
      days: prefs.days, zone: L(c.zones[prefs.hotelZone].name), flight: prefs.departureTime
    });

    document.getElementById("result-persona").textContent = personaText(prefs);
    renderTourCard(res, prefs);

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
        "<h3>" + esc(capitalize(dateFmt.format(d.date))) + "</h3></div>" +
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

    renderTaxiCard(res, prefs);

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

  // ---------------------------------------------------------- cuestionario
  var steps = Array.prototype.slice.call(form.querySelectorAll(".step"));
  var stepIndex = 0;
  var advanceTimer = null;

  function visibleSteps() {
    return steps.filter(function (st) { return st.getAttribute("data-step") !== "tour" || currentTour(); });
  }

  function showStep(i, focus) {
    var vs = visibleSteps();
    stepIndex = Math.max(0, Math.min(vs.length - 1, i));
    var isLast = stepIndex === vs.length - 1;
    steps.forEach(function (st) { st.hidden = st !== vs[stepIndex]; });
    document.getElementById("wizard-count").textContent = isLast
      ? t("q.last") : t("q.progress", { n: stepIndex + 1, total: vs.length - 1 });
    document.getElementById("wizard-bar").style.width = Math.round((stepIndex + 1) / vs.length * 100) + "%";
    document.getElementById("wizard-back").hidden = stepIndex === 0;
    document.getElementById("wizard-next").hidden = isLast;
    document.getElementById("wizard-submit").hidden = !isLast;
    showError("");
    if (focus) {
      var legend = vs[stepIndex].querySelector("legend");
      if (legend) { legend.setAttribute("tabindex", "-1"); legend.focus({ preventScroll: true }); }
      form.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Las preguntas de una sola opción necesitan respuesta para avanzar.
  function stepAnswered() {
    var st = visibleSteps()[stepIndex];
    var radios = st.querySelectorAll(".options input[type=radio]");
    if (!radios.length) return true;
    return Array.prototype.some.call(radios, function (r) { return r.checked; });
  }

  function nextStep() {
    clearTimeout(advanceTimer);
    if (!stepAnswered()) { showError(t("q.pickFirst")); return; }
    showStep(stepIndex + 1, true);
  }

  document.getElementById("wizard-next").addEventListener("click", nextStep);
  document.getElementById("wizard-back").addEventListener("click", function () {
    clearTimeout(advanceTimer);
    showStep(stepIndex - 1, true);
  });

  // Al elegir una opción, pasa solo a la siguiente pregunta.
  form.addEventListener("change", function (e) {
    if (e.target.type === "radio" && e.target.closest(".options")) {
      clearTimeout(advanceTimer);
      advanceTimer = setTimeout(nextStep, 260);
    }
  });

  // ---------------------------------------------------------------- events
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (stepIndex < visibleSteps().length - 1) { nextStep(); return; }
    generate(1);
  });

  resultEl.addEventListener("input", function (e) {
    if (e.target.closest && e.target.closest(".taxi-card")) {
      document.getElementById("taxi-error").hidden = true;
      updateTaxiLink();
    }
  });
  resultEl.addEventListener("change", function (e) {
    if (e.target.id === "taxi-arrival") updateTaxiLink();
  });

  resultEl.addEventListener("click", function (e) {
    if (e.target.id === "taxi-book") {
      var f = taxiFields();
      var err = document.getElementById("taxi-error");
      if (!f.name || !f.hotel) {
        e.preventDefault();
        err.textContent = t("cab.missing");
        err.hidden = false;
        (f.name ? document.getElementById("taxi-hotel") : document.getElementById("taxi-name")).focus();
        return;
      }
      err.hidden = true;
      updateTaxiLink();
    }
    if (e.target.id === "tour-add") {
      var yes = form.querySelector('input[name="wantsTour"][value="yes"]');
      if (yes) yes.checked = true;
      generate(lastPrefs ? lastPrefs.seed : 1);
    }
  });

  form.addEventListener("click", function (e) {
    var b = e.target.closest("[data-delta]");
    if (!b) return;
    var input = form.elements.days;
    input.value = Math.max(1, Math.min(14, (parseInt(input.value, 10) || 1) + parseInt(b.getAttribute("data-delta"), 10)));
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
    showStep(0, true);
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
  showStep(0);

  // Cuando el administrador cambia precios u horarios, se recalcula el plan.
  DataStore.onChange(function () {
    renderTourOffer();
    showStep(stepIndex);
    if (lastPrefs) {
      var res = Planner.plan(city(), lastPrefs);
      if (!res.error) { lastResult = res; render(res, lastPrefs); }
    }
  });
  DataStore.init();

  window.App = { lang: function () { return lang; }, exportData: exportData, t: t };
})();
