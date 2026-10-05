/*
 * Exporta el itinerario actual a PDF con jsPDF.
 * Dentro de Claude el archivo se entrega con la capacidad "downloads";
 * como sitio estático se descarga directamente.
 */
(function () {
  var C = {
    accent: [194, 65, 45], teal: [31, 111, 120], text: [42, 33, 28],
    muted: [115, 102, 92], line: [230, 220, 207], soft: [243, 236, 226], gold: [215, 154, 43]
  };
  var PAGE_W = 210, PAGE_H = 297, M = 16, TIME_W = 28, CONTENT_X = M + TIME_W + 4;
  var CONTENT_W = PAGE_W - CONTENT_X - M;

  // Las fuentes estándar de PDF solo cubren Latin-1: quitamos emojis y
  // cambiamos guiones tipográficos.
  function clean(s) {
    return String(s || "")
      .replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"')
      .replace(/…/g, "...").replace(/[^\x00-\xFF]/g, "").replace(/\s+/g, " ").trim();
  }

  function build(data) {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: "mm", format: "a4" });
    var y = M;
    var es = data.lang === "es";

    function color(c) { doc.setTextColor(c[0], c[1], c[2]); }
    function font(style, size) { doc.setFont("helvetica", style); doc.setFontSize(size); }
    function lines(text, width, style, size) { font(style, size); return doc.splitTextToSize(clean(text), width); }
    function lh(size) { return size * 0.42; }

    function ensure(h) {
      if (y + h > PAGE_H - M - 8) { doc.addPage(); y = M; }
    }

    // Encabezado
    doc.setFillColor(C.accent[0], C.accent[1], C.accent[2]);
    doc.rect(0, 0, PAGE_W, 34, "F");
    doc.setTextColor(255, 255, 255);
    font("bold", 9); doc.text("RUTA PERÚ", M, 11);
    font("bold", 19); doc.text(clean(data.title), M, 21);
    font("normal", 10); doc.text(clean(data.summary), M, 28);
    y = 44;
    if (data.persona) {
      var persona = lines(data.persona, PAGE_W - 2 * M, "italic", 10);
      color(C.text); doc.text(persona, M, y);
      y += persona.length * lh(10) + 4;
    }

    data.warnings.forEach(function (w) {
      var l = lines(w, PAGE_W - 2 * M - 6, "normal", 9);
      ensure(l.length * lh(9) + 6);
      doc.setFillColor(224, 240, 241);
      doc.roundedRect(M, y - 4, PAGE_W - 2 * M, l.length * lh(9) + 5, 2, 2, "F");
      color(C.text); doc.text(l, M + 3, y);
      y += l.length * lh(9) + 5;
    });

    data.days.forEach(function (day) {
      ensure(30);
      y += 4;
      color(C.accent); font("bold", 8.5); doc.text(clean(day.label).toUpperCase(), M, y);
      color(C.muted); font("normal", 8); doc.text(clean(data.labels.estDay), PAGE_W - M, y, { align: "right" });
      y += 6;
      color(C.text); font("bold", 14);
      var date = clean(day.date);
      doc.text(date.charAt(0).toUpperCase() + date.slice(1), M, y);
      font("bold", 10.5); doc.text(clean(day.cost), PAGE_W - M, y, { align: "right" });
      y += 3.5;
      doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(0.4);
      doc.line(M, y, PAGE_W - M, y);
      y += 6;

      day.events.forEach(function (ev) {
        var title = lines(ev.title, CONTENT_W, "bold", 10.5);
        var desc = ev.desc ? lines(ev.desc, CONTENT_W, "normal", 8.8) : [];
        var tip = ev.tip ? lines((es ? "Consejo: " : "Tip: ") + ev.tip, CONTENT_W - 4, "italic", 8.5) : [];
        var meta = ev.meta.slice();
        if (ev.travelSelf) meta.push(ev.travelSelf.text);
        var metaLines = meta.length ? lines(meta.join("  ·  "), CONTENT_W, "normal", 8.5) : [];
        var h = (ev.travelBefore ? 5 : 0) + title.length * lh(10.5) + desc.length * lh(8.8) +
          (tip.length ? tip.length * lh(8.5) + 3 : 0) + metaLines.length * lh(8.5) + (ev.mapUrl ? 4.5 : 0) + (ev.bookUrl ? 4.5 : 0) + 5;
        ensure(h);

        if (ev.travelBefore) {
          color(C.muted); font("normal", 8);
          doc.text(clean((es ? "Traslado: " : "Getting there: ") + ev.travelBefore.text), CONTENT_X, y);
          y += 5;
        }

        var top = y;
        color(ev.logistic ? C.teal : C.text); font("bold", 9.5);
        doc.text(clean(ev.span), M, y);
        // Marca de la línea de tiempo
        var mark = ev.type === "activity" || ev.type === "tour" ? C.accent : ev.type === "meal" ? C.gold : C.line;
        doc.setFillColor(mark[0], mark[1], mark[2]);
        doc.circle(CONTENT_X - 3, y - 1.2, 1.1, "F");

        color(ev.logistic ? C.muted : C.text); font("bold", 10.5);
        doc.text(title, CONTENT_X, y);
        y += title.length * lh(10.5);

        if (desc.length) {
          color(C.muted); font("normal", 8.8);
          doc.text(desc, CONTENT_X, y);
          y += desc.length * lh(8.8);
        }
        if (tip.length) {
          y += 1;
          doc.setFillColor(250, 240, 220);
          doc.rect(CONTENT_X - 1, y - 3.2, CONTENT_W + 1, tip.length * lh(8.5) + 1.8, "F");
          color(C.text); font("italic", 8.5);
          doc.text(tip, CONTENT_X + 1, y);
          y += tip.length * lh(8.5) + 2;
        }
        if (metaLines.length) {
          color(C.text); font("bold", 8.5);
          doc.text(metaLines, CONTENT_X, y);
          y += metaLines.length * lh(8.5);
        }
        if (ev.mapUrl) {
          color(C.teal); font("normal", 8.5);
          doc.textWithLink(clean(data.labels.map) + " >", CONTENT_X, y, { url: ev.mapUrl });
          y += 4.5;
        }
        if (ev.bookUrl) {
          color(C.accent); font("bold", 8.5);
          doc.textWithLink(clean(data.labels.book) + " >", CONTENT_X, y, { url: ev.bookUrl });
          y += 4.5;
        }
        y = Math.max(y, top + 6) + 3;
      });
    });

    // Total
    var note = lines(data.note, PAGE_W - 2 * M - 8, "normal", 8.5);
    ensure(24 + note.length * lh(8.5));
    y += 4;
    doc.setFillColor(C.soft[0], C.soft[1], C.soft[2]);
    doc.roundedRect(M, y, PAGE_W - 2 * M, 18 + note.length * lh(8.5), 3, 3, "F");
    color(C.muted); font("normal", 9); doc.text(clean(data.labels.estTotal), M + 4, y + 7);
    color(C.accent); font("bold", 15); doc.text(clean(data.total), M + 4, y + 14);
    if (data.avg) {
      color(C.muted); font("normal", 9); doc.text(clean(data.labels.avgPerson), PAGE_W / 2 + 4, y + 7);
      color(C.text); font("bold", 13); doc.text(clean(data.avg), PAGE_W / 2 + 4, y + 14);
    }
    color(C.muted); font("normal", 8.5); doc.text(note, M + 4, y + 19);
    y += 24 + note.length * lh(8.5);

    // Taxi al aeropuerto
    if (data.taxi) {
      var taxi = lines(data.taxi.text, PAGE_W - 2 * M - 8, "bold", 9.5);
      ensure(taxi.length * lh(9.5) + 12);
      doc.setFillColor(224, 240, 241);
      doc.roundedRect(M, y - 1, PAGE_W - 2 * M, taxi.length * lh(9.5) + 9, 3, 3, "F");
      color(C.teal); font("bold", 9.5); doc.text(taxi, M + 4, y + 4.5);
      font("normal", 8.5);
      doc.textWithLink(clean(data.labels.taxiBook) + " >", M + 4, y + 4.5 + taxi.length * lh(9.5) + 0.5, { url: data.taxi.url });
      y += taxi.length * lh(9.5) + 14;
    }

    // Consejos
    ensure(16);
    color(C.text); font("bold", 12); doc.text(clean(data.labels.tips), M, y);
    y += 6;
    data.tips.forEach(function (tip) {
      var l = lines(tip, PAGE_W - 2 * M - 5, "normal", 9);
      ensure(l.length * lh(9) + 2);
      color(C.accent); font("bold", 9); doc.text("-", M, y);
      color(C.text); font("normal", 9); doc.text(l, M + 5, y);
      y += l.length * lh(9) + 1.5;
    });
    var disc = lines(data.disclaimer, PAGE_W - 2 * M, "italic", 8);
    ensure(disc.length * lh(8) + 4);
    y += 3;
    color(C.muted); font("italic", 8); doc.text(disc, M, y);

    // Pie de página
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i);
      color(C.muted); font("normal", 7.5);
      doc.text("Ruta Perú", M, PAGE_H - 8);
      doc.text((es ? "Página " : "Page ") + i + (es ? " de " : " of ") + n, PAGE_W - M, PAGE_H - 8, { align: "right" });
    }
    return doc;
  }

  function download(onStatus) {
    var data = window.App && App.exportData();
    if (!data || !window.jspdf) return Promise.reject({ code: "unavailable" });
    var doc = build(data);
    var claude = window.claude;
    if (claude && typeof claude.use === "function") {
      return claude.use("downloads").then(function (downloads) {
        if (!downloads) throw { code: "unavailable" };
        return downloads.save({ filename: data.fileName, data: doc.output("blob") });
      });
    }
    doc.save(data.fileName);
    return Promise.resolve();
  }

  var btn = document.getElementById("btn-pdf");
  var statusEl = document.getElementById("pdf-status");
  if (btn) {
    btn.addEventListener("click", function () {
      var label = btn.textContent;
      btn.disabled = true;
      btn.textContent = App.t("pdfBusy");
      statusEl.hidden = true;
      // Deja que el botón se repinte antes de armar el PDF.
      setTimeout(function () {
        var job;
        try { job = download(); } catch (e) { job = Promise.reject(e); }
        job.catch(function (e) {
          if (e && (e.code === "declined" || e.code === "rate_limited")) return;
          statusEl.textContent = App.t("pdfError");
          statusEl.hidden = false;
        }).then(function () {
          btn.disabled = false;
          btn.textContent = label;
        });
      }, 30);
    });
  }

  window.PdfExport = { build: build, download: download };
})();
