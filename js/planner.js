/*
 * Motor de itinerarios basado en reglas.
 *
 * Todos los tiempos se manejan en minutos absolutos desde la medianoche del
 * día de llegada (día 0). Así un vuelo de madrugada o una llegada nocturna
 * se calculan sin casos especiales.
 */
(function () {
  var DAY = 1440;

  var PACES = {
    relaxed:  { start: 9 * 60 + 30, end: 21 * 60 + 30, maxActivities: 4, gap: 20, mealExtra: 15 },
    moderate: { start: 9 * 60,      end: 22 * 60 + 30, maxActivities: 5, gap: 10, mealExtra: 0 },
    intense:  { start: 8 * 60,      end: 23 * 60 + 30, maxActivities: 7, gap: 5,  mealExtra: -15 }
  };


  function toMin(hhmm) {
    var p = hhmm.split(":");
    return parseInt(p[0], 10) * 60 + parseInt(p[1], 10);
  }

  function fmt(abs) {
    var m = ((abs % DAY) + DAY) % DAY;
    var h = Math.floor(m / 60), mm = m % 60;
    return (h < 10 ? "0" : "") + h + ":" + (mm < 10 ? "0" : "") + mm;
  }

  function km(a, b) {
    var R = 6371, toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad, dLng = (b.lng - a.lng) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.sqrt(s));
  }

  // Estimación de traslado en Lima: caminando si está cerca, si no en taxi
  // con velocidad urbana lenta y algo más rápida por vías expresas.
  function travel(a, b) {
    var d = km(a, b);
    if (d < 0.15) return { min: 0, mode: "none", km: d };
    if (d <= 1.2) return { min: Math.max(5, Math.round(d * 14 / 5) * 5), mode: "walk", km: d };
    var min = d <= 12 ? 10 + d * 3.2 : 10 + 12 * 3.2 + (d - 12) * 1.6;
    return { min: Math.round(min / 5) * 5, mode: "taxi", km: d };
  }


  // Generador pseudoaleatorio con semilla para que "regenerar" dé variaciones
  // reproducibles.
  function rng(seed) {
    var s = seed >>> 0 || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  function addDays(dateStr, n) {
    var p = dateStr.split("-");
    return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10) + n);
  }

  function attractionScore(a, prefs) {
    var s = a.priority;
    a.interests.forEach(function (i) { if (prefs.interests.indexOf(i) !== -1) s += 6; });
    if (a.night && prefs.interests.indexOf("nightlife") === -1) s -= 20;
    if (prefs.budget === "low" && a.cost >= 100) s -= 8;
    if (prefs.budget === "mid" && a.cost >= 200) s -= 3;
    return s;
  }

  function restaurantFits(r, budget) {
    if (budget === "low") return r.price === 1 || (r.price === 2 && r.cost <= 80);
    if (budget === "mid") return r.price <= 2 || (r.price === 3 && r.cost <= 200);
    return true;
  }

  function restaurantScore(r, prefs) {
    var s = 0;
    if (prefs.budget === "high") s += r.price * 4 + (r.famous ? 6 : 0);
    if (prefs.budget === "mid") s += r.price === 2 ? 6 : 2;
    if (prefs.budget === "low") s += r.price === 1 ? 6 : 0;
    if (prefs.interests.indexOf("gastronomy") !== -1 && r.famous) s += 6;
    return s;
  }

  /**
   * prefs = {
   *   arrivalDate: "YYYY-MM-DD", arrivalTime: "HH:MM", days: n,
   *   departureTime: "HH:MM", flightType: "intl" | "dom",
   *   hotelZone, pace, budget, interests: [], seed
   * }
   */
  function plan(city, prefs) {
    var pace = PACES[prefs.pace] || PACES.moderate;
    // Tarifa aproximada de taxi por aplicativo (editable en el panel admin).
    var settings = city.settings || {};
    var taxiBase = settings.taxiBase != null ? settings.taxiBase : 8;
    var taxiPerMin = settings.taxiPerMin != null ? settings.taxiPerMin : 0.6;
    function taxiCost(t) {
      return t.mode === "taxi" ? Math.round(taxiBase + t.min * taxiPerMin) : 0;
    }
    var rand = rng(prefs.seed || 1);
    var zone = city.zones[prefs.hotelZone] || city.zones.miraflores;
    var hotel = { lat: zone.lat, lng: zone.lng, zone: prefs.hotelZone };
    var airport = city.airport;
    var nDays = Math.max(1, Math.min(14, prefs.days | 0));

    var transfer = travel(airport, hotel);
    transfer.min += 15; // margen extra por el tráfico hacia/desde el aeropuerto
    if (transfer.mode !== "taxi") transfer.mode = "taxi";

    var arrAbs = toMin(prefs.arrivalTime);
    var exitAirport = prefs.flightType === "dom" ? 30 : 75; // migración y equipaje
    var atHotel = arrAbs + exitAirport + transfer.min;
    var readyAbs = atHotel + (pace === PACES.relaxed ? 75 : 45);

    var depAbs = (nDays - 1) * DAY + toMin(prefs.departureTime);
    var airportBuffer = prefs.flightType === "dom" ? 120 : 180;
    var leaveAbs = depAbs - airportBuffer - transfer.min;

    var warnings = [];
    if (leaveAbs - 20 <= atHotel) {
      return { error: "tooShort" };
    }

    var used = {};
    var usedRest = {};
    var days = [];
    for (var d = 0; d < nDays; d++) {
      var date = addDays(prefs.arrivalDate, d);
      days.push({ index: d, date: date, weekday: date.getDay(), events: [], cost: 0 });
    }

    function dayOf(abs) {
      return Math.max(0, Math.min(nDays - 1, Math.floor(abs / DAY)));
    }

    function push(ev, day) {
      day = day || days[dayOf(ev.start)];
      day.events.push(ev);
      day.cost += (ev.cost || 0) + (ev.travel ? taxiCost(ev.travel) : 0);
    }

    // --- Llegada -----------------------------------------------------------
    // Aunque pase la medianoche, la llegada se muestra completa en el día 1.
    push({ type: "arrival", start: arrAbs, end: arrAbs + exitAirport, place: airport }, days[0]);
    push({ type: "transfer-in", start: arrAbs + exitAirport, end: atHotel, travel: transfer, place: hotel }, days[0]);
    push({ type: "checkin", start: atHotel, end: readyAbs, place: hotel }, days[0]);

    // --- Salida ------------------------------------------------------------
    var pickup = leaveAbs - 20;
    push({ type: "pickup", start: pickup, end: leaveAbs, place: hotel });
    push({ type: "transfer-out", start: leaveAbs, end: leaveAbs + transfer.min, travel: transfer, place: airport });
    push({ type: "airport", start: leaveAbs + transfer.min, end: depAbs, place: airport });
    push({ type: "flight", start: depAbs, end: depAbs, place: airport });

    // El checkout suele ser a mediodía; si el vuelo es más tarde, avisamos.
    var lastDayBase = (nDays - 1) * DAY;
    if (pickup - lastDayBase > 12 * 60 + 60 && nDays > 1) warnings.push("luggage");
    if (readyAbs >= DAY && nDays > 1) warnings.push("lateArrival");

    // Tiempo mínimo para regresar al hotel antes de ir al aeropuerto.
    var hotelDeadline = pickup;

    for (d = 0; d < nDays; d++) {
      planDay(days[d], d * DAY);
    }

    function planDay(day, base) {
      var start = Math.max(base + pace.start, readyAbs);
      if (day.index > 0 && readyAbs > base && readyAbs < base + 9 * 60) {
        // Llegó de madrugada: le damos unas horas de descanso.
        start = Math.max(start, base + 11 * 60);
      }
      var end = Math.min(base + pace.end, hotelDeadline);
      if (end - start < 45) return;

      var t = start;
      var loc = hotel;
      var count = 0;
      var lastEnd = t;
      var dayTripDone = false;
      // El día de llegada se arma más ligero por el cansancio del vuelo.
      var maxActivities = day.index === 0 ? Math.max(2, pace.maxActivities - 2) : pace.maxActivities;
      var lunchStart = base + 12 * 60 + 30, lunchLatest = base + 14 * 60 + 30;
      var dinnerStart = base + 19 * 60 + 30, dinnerLatest = base + 21 * 60 + 30;
      var lunchDone = !(start <= lunchLatest && end >= base + 13 * 60 + 30);
      var dinnerDone = !(start <= dinnerLatest && end >= base + 20 * 60 + 30);
      var isFirst = day.index === 0, isLast = base + DAY > depAbs;
      var guard = 0;

      // La cena puede terminar después del horario del ritmo elegido.
      while ((t < end || (!dinnerDone && t <= dinnerLatest)) && guard++ < 40) {
        if (!lunchDone && t >= lunchStart) {
          lunchDone = true;
          if (addMeal("lunch")) continue;
        }
        if (!dinnerDone && t >= dinnerStart) {
          dinnerDone = true;
          if (addMeal("dinner")) continue;
        }

        var pick = count < maxActivities || dinnerDone ? chooseActivity() : null;
        if (pick) {
          if (pick.gap >= 45) addFree(t, pick.start - pick.travel.min, loc);
          used[pick.a.id] = true;
          if (!pick.a.night) count++;
          push({
            type: "activity", item: pick.a, start: pick.start, end: pick.end,
            travel: pick.travel, cost: pick.a.cost, place: pick.a
          }, day);
          if (pick.a.replacesMeal && pick.start <= lunchLatest) lunchDone = true;
          if (pick.a.dayTrip) dayTripDone = true;
          lastEnd = pick.end;
          t = pick.end + pace.gap;
          loc = pick.a;
          continue;
        }

        // Sin actividades posibles: tiempo libre hasta la siguiente comida.
        var next = null;
        if (!lunchDone && t < lunchStart) next = lunchStart;
        else if (!dinnerDone && t < dinnerStart) next = dinnerStart;
        if (next === null) {
          // Último día: aprovecha el rato que queda antes de ir al aeropuerto.
          var home = travel(loc, hotel).min;
          if (end === hotelDeadline && end - home - t >= 45) {
            addFree(t, end - home, loc);
            lastEnd = end - home;
          }
          break;
        }
        if (next - t >= 45) {
          var back = travel(loc, hotel);
          var restAtHotel = next - t >= 150 && back.min <= 45;
          addFree(t, next, restAtHotel ? hotel : loc, restAtHotel ? back : null);
          if (restAtHotel) loc = hotel;
          lastEnd = next;
        }
        t = next;
      }

      // Regreso al hotel al final del día (excepto si ya sale al aeropuerto).
      if (loc !== hotel) {
        var ret = travel(loc, hotel);
        if (ret.mode !== "none") {
          push({ type: "return", start: lastEnd, end: lastEnd + ret.min, travel: ret, place: hotel }, day);
        }
      }

      function chooseActivity() {
        var best = null;
        city.attractions.forEach(function (a) {
          if (used[a.id]) return;
          var hours = a.hours[day.weekday];
          if (!hours) return;
          if (a.night && (prefs.interests.indexOf("nightlife") === -1 || !dinnerDone)) return;
          if (a.dayTrip && (isFirst || isLast || nDays < 3 || dayTripDone)) return;

          var tr = travel(loc, a);
          var arrive = t + tr.min;
          var open = base + toMin(hours[0]), close = base + toMin(hours[1]);
          var s = a.fixedStart ? base + toMin(a.fixedStart) : Math.max(arrive, open);
          if (s < arrive) return;
          var e = s + a.duration;
          if (e > close) return;
          if (!a.night && e > end) return;
          if (a.night && e > end + 60) return;

          // Debe poder volver al hotel a tiempo para ir al aeropuerto.
          if (e + travel(a, hotel).min > hotelDeadline) return;

          // No retrasar demasiado las comidas.
          if (!lunchDone && e > lunchLatest - 15 && !a.replacesMeal) return;
          if (!dinnerDone && !a.night && e > (a.evening ? dinnerLatest : dinnerStart + 30)) return;

          var wait = s - arrive;
          if (wait > 120) return;

          var score = attractionScore(a, prefs) - tr.min * 0.3 - wait * 0.06 + rand() * 2.5;
          if (a.sunset) {
            var local = s - base;
            if (local >= 16 * 60 && local <= 18 * 60 + 30) score += 6; else score -= 2;
          }
          if (a.evening) score += (s - base >= 18 * 60) ? 5 : -3;
          // Las excursiones fuera de la ciudad compensan el traslado largo.
          if (a.dayTrip) score += tr.min * 0.25 + 2;

          if (!best || score > best.score) {
            best = { a: a, start: s, end: e, travel: tr, score: score, gap: wait };
          }
        });
        return best;
      }

      function addMeal(kind) {
        var best = null;
        city.restaurants.forEach(function (r) {
          if (usedRest[r.id] || r.meals.indexOf(kind) === -1) return;
          if (!restaurantFits(r, prefs.budget)) return;
          if (r.id === "airport-food" && prefs.hotelZone !== "callao" && !(isLast && kind === "dinner")) return;
          var tr = travel(loc, r);
          if (tr.min > 40) return;
          var s = t + tr.min;
          var duration = (r.duration || 90) + pace.mealExtra;
          if (s + duration + travel(r, hotel).min > hotelDeadline) return;
          var score = restaurantScore(r, prefs) - tr.min * 0.35 + rand() * 3;
          if (!best || score > best.score) best = { r: r, start: s, travel: tr, score: score, duration: duration };
        });
        if (!best) return false;
        usedRest[best.r.id] = true;
        push({
          type: "meal", meal: kind, item: best.r, start: best.start, end: best.start + best.duration,
          travel: best.travel, cost: best.r.cost, place: best.r
        }, day);
        lastEnd = best.start + best.duration;
        t = lastEnd + pace.gap;
        loc = best.r;
        return true;
      }

      function addFree(from, to, where, tr) {
        if (to - from < 45) return;
        push({ type: "free", start: from, end: to, travel: tr || null, place: where, zone: zoneOf(where) }, day);
      }
    }

    function zoneOf(place) {
      return place.zone || prefs.hotelZone;
    }

    days.forEach(function (day) {
      day.events.sort(function (a, b) { return a.start - b.start; });
    });

    return {
      days: days,
      warnings: warnings,
      hotelZone: prefs.hotelZone,
      total: days.reduce(function (s, d) { return s + d.cost; }, 0)
    };
  }

  window.Planner = { plan: plan, fmt: fmt, DAY: DAY };
})();
