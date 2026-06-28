/**
 * Exports PDF, DOCX et HTML.
 */
(function (global) {
  'use strict';

  var BATCH_EXPORT_CSS =
    '.quittance-export-page{display:block;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}' +
    '.quittance-export-page:last-child{page-break-after:auto;break-after:auto}' +
    '.quittance-page-break{page-break-before:always;break-before:page;height:0;margin:0;padding:0;border:0;line-height:0;font-size:0}';

  /** Déclenche téléchargement navigateur d'un Blob. */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** wrap for export. */
  function wrapForExport(innerHtml, forDocx) {
    var headerCss =
      '.quittance-doc{font-size:10.5pt;line-height:1.35;color:#111}' +
      '.quittance-header{width:100%;border-collapse:collapse;border:none;margin-bottom:0.65rem}' +
      '.quittance-header td{border:none;padding:0;vertical-align:top}' +
      '.quittance-party-bailleur{text-align:left;width:50%}' +
      '.quittance-party-locataire{text-align:right;width:50%}' +
      '.quittance-party-label,.quittance-party h3{font-size:0.72rem;letter-spacing:0.06em;text-transform:uppercase;margin:0 0 0.08rem;padding:0;line-height:1.1;color:#5c6b7a}' +
      '.quittance-party-lines,.quittance-party p:not(.quittance-party-label){margin:0;padding:0;line-height:1.15}' +
      '.ql-align-right{text-align:right}';
    var bodyMargin = forDocx ? '0.75rem auto' : '0';
    return (
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
      '<style>@page{margin:12mm}body{font-family:Georgia,serif;max-width:100%;margin:' +
      bodyMargin +
      ';line-height:1.35;color:#111;font-size:10.5pt}' +
      'p{margin:0.15rem 0}' +
      BATCH_EXPORT_CSS +
      headerCss +
      '.quittance-title{text-align:center;font-size:1.05rem;margin:0.35rem 0 0.45rem}' +
      'h4,.quittance-subtitle{margin:0.4rem 0 0.2rem;font-size:0.92rem}' +
      '.quittance-list,.quittance-payments pre{white-space:pre-wrap;font-family:inherit;background:#f8fafc;padding:0.3rem 0.45rem;border-radius:3px;border:none;font-size:0.88rem;margin:0}' +
      'table.quittance-amounts{width:100%;border-collapse:collapse;margin:0.3rem 0 0.4rem;font-size:0.92rem}' +
      'table.quittance-amounts td{padding:0.18rem 0;border-bottom:1px solid #e5e7eb;vertical-align:top}' +
      'table.quittance-amounts tr:last-child td{border-bottom:none}' +
      '.quittance-meta{color:#64748b;font-size:0.88rem;margin:0.2rem 0}' +
      '.quittance-legal{font-size:0.78rem;line-height:1.3;color:#475569;margin:0.35rem 0 0}' +
      '.quittance-footer{margin-top:0.65rem;text-align:right}.quittance-footer>p{margin:0}' +
      '.quittance-signature{margin-top:0.35rem;font-weight:bold;text-align:right}' +
      '.quittance-signature-img,.quittance-footer img{width:180px;height:auto;max-width:180px;display:block;margin:0.35rem 0 0 auto;object-fit:contain}' +
      '.quittance-signature-name{margin-top:0.35rem;margin-bottom:0;font-weight:600;text-align:right}' +
      'strong,b{font-weight:bold}em,i{font-style:italic}u{text-decoration:underline}' +
      '</style></head><body>' +
      innerHtml +
      '</body></html>'
    );
  }

  /** Prépare le HTML quittance pour export Word. */
  function prepareDocxHtml(html) {
    var content = html || '';
    if (global.LoyerEditor && global.LoyerEditor.prepareHtmlForExport) {
      content = global.LoyerEditor.prepareHtmlForExport(content);
    }
    return content;
  }

  /** wait for layout. */
  function waitForLayout() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

  /** Attend le chargement images avant capture PDF. */
  function waitForImages(container) {
    if (!container) return Promise.resolve();
    var imgs = container.querySelectorAll('img');
    var pending = [];
    for (var i = 0; i < imgs.length; i++) {
      if (!imgs[i].complete) pending.push(imgs[i]);
    }
    if (!pending.length) return Promise.resolve();
    return Promise.all(
      pending.map(function (img) {
        return new Promise(function (resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      })
    );
  }

  /** split batch html. */
  function splitBatchHtml(html) {
    var host = document.createElement('div');
    host.innerHTML = html;
    var sections = host.querySelectorAll('.quittance-export-page');
    if (!sections.length) return [html];
    var pages = [];
    for (var i = 0; i < sections.length; i++) {
      pages.push(sections[i].innerHTML);
    }
    return pages;
  }

  /** Options html2pdf (format A4, marges réduites, une page). */
  function getPdfOptions(filename) {
    return {
      margin: [10, 10, 10, 10],
      filename: filename ? filename + '.pdf' : 'export.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, scrollY: 0, scrollX: 0 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['avoid-all'] }
    };
  }

  /** Prépare l'élément DOM avant capture PDF (supprime padding écran). */
  function withPdfExportSurface(container, work) {
    var host = container && container.closest ? container.closest('.quill-editor-host') : null;
    if (host) host.classList.add('is-pdf-export');
    if (container) container.classList.add('is-pdf-export');
    return Promise.resolve()
      .then(work)
      .finally(function () {
        if (host) host.classList.remove('is-pdf-export');
        if (container) container.classList.remove('is-pdf-export');
      });
  }

  /** Rafraîchit le rendu DOM de render export page. */
  function renderExportPage(el, pageHtml) {
    el.innerHTML = pageHtml;
    applyQuittanceLayout(el);
    return waitForLayout().then(function () {
      return waitForImages(el);
    });
  }

  /** Exporte export pdf multi page. */
  function exportPdfMultiPage(pages, filename, asBlob) {
    var el = getExportElement();
    if (!el) return Promise.reject(new Error('Élément export quittance introuvable.'));
    var savedHtml = el.innerHTML;
    var opt = getPdfOptions(filename);
    var worker = null;
    var chain = Promise.resolve();

    return withPdfExportSurface(el, function () {
      pages.forEach(function (pageHtml, index) {
        chain = chain.then(function () {
          return renderExportPage(el, pageHtml).then(function () {
            if (index === 0) {
              worker = html2pdf().set(opt);
              return worker.from(el).toContainer().toCanvas().toPdf();
            }
            return worker.get('pdf').then(function (pdf) {
              pdf.addPage();
              return worker.from(el).toContainer().toCanvas().toPdf();
            });
          });
        });
      });

      return chain
        .then(function () {
          if (!worker) return Promise.reject(new Error('Export PDF impossible.'));
          if (asBlob) return worker.output('blob');
          return worker.save();
        })
        .finally(function () {
          el.innerHTML = savedHtml;
          applyQuittanceLayout(el);
        });
    });
  }

  /** apply quittance layout. */
  function applyQuittanceLayout(el) {
    if (global.LoyerEditor && global.LoyerEditor.applyQuittanceLayout) {
      global.LoyerEditor.applyQuittanceLayout(el);
    }
  }

  /** Élément DOM racine à capturer pour export. */
  function getExportElement() {
    if (global.LoyerEditor && global.LoyerEditor.getExportElement) {
      return global.LoyerEditor.getExportElement();
    }
    return null;
  }

  /** with export element html. */
  function withExportElementHtml(html, callback) {
    var el = getExportElement();
    if (!el) return Promise.reject(new Error('Élément export quittance introuvable.'));
    var savedHtml = el.innerHTML;
    el.innerHTML = html;
    applyQuittanceLayout(el);
    return waitForLayout()
      .then(function () {
        return waitForImages(el);
      })
      .then(function () {
        return withPdfExportSurface(el, function () {
          return callback(el);
        });
      })
      .finally(function () {
        el.innerHTML = savedHtml;
        applyQuittanceLayout(el);
      });
  }

  /** Exporte export pdf. */
  function exportPdf(container, filename) {
    if (typeof html2pdf === 'undefined') {
      window.print();
      return Promise.resolve();
    }
    return withPdfExportSurface(container, function () {
      return waitForLayout()
        .then(function () {
          return waitForImages(container);
        })
        .then(function () {
          return html2pdf().set(getPdfOptions(filename)).from(container).save();
        });
    });
  }

  /** Blob PDF depuis élément DOM. */
  function getPdfBlob(container) {
    if (typeof html2pdf === 'undefined') {
      return Promise.reject(new Error('html2pdf missing'));
    }
    return withPdfExportSurface(container, function () {
      return waitForLayout()
        .then(function () {
          return waitForImages(container);
        })
        .then(function () {
          return html2pdf().set(getPdfOptions(null)).from(container).output('blob');
        });
    });
  }

  /** Exporte export pdf from html. */
  function exportPdfFromHtml(html, filename) {
    if (typeof html2pdf === 'undefined') {
      window.print();
      return Promise.resolve();
    }
    var pages = splitBatchHtml(html);
    if (pages.length <= 1) {
      var content = pages.length ? pages[0] : html;
      return withExportElementHtml(content, function (el) {
        return html2pdf().set(getPdfOptions(filename)).from(el).save();
      });
    }
    return exportPdfMultiPage(pages, filename, false);
  }

  /** Blob PDF depuis chaîne HTML. */
  function getPdfBlobFromHtml(html) {
    if (typeof html2pdf === 'undefined') {
      return Promise.reject(new Error('html2pdf missing'));
    }
    var pages = splitBatchHtml(html);
    if (pages.length <= 1) {
      var content = pages.length ? pages[0] : html;
      return withExportElementHtml(content, function (el) {
        return html2pdf().set(getPdfOptions(null)).from(el).output('blob');
      });
    }
    return exportPdfMultiPage(pages, null, true);
  }

  /** Exporte export html from html. */
  function exportHtmlFromHtml(html, filename) {
    downloadBlob(new Blob([wrapForExport(html)], { type: 'text/html;charset=utf-8' }), filename + '.html');
    return Promise.resolve();
  }

  /** Exporte export html. */
  function exportHtml(container, filename) {
    var html = wrapForExport(container.innerHTML);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename + '.html');
    return Promise.resolve();
  }

  /** Exporte export docx from html. */
  function exportDocxFromHtml(html, filename) {
    if (typeof htmlDocx === 'undefined') {
      if (global.LoyerNotify) global.LoyerNotify.error('Bibliothèque DOCX non chargée.');
      return Promise.reject(new Error('htmlDocx missing'));
    }
    var blob = htmlDocx.asBlob(wrapForExport(prepareDocxHtml(html), true));
    downloadBlob(blob, filename + '.docx');
    return Promise.resolve();
  }

  /** Exporte export docx. */
  function exportDocx(container, filename) {
    if (typeof htmlDocx === 'undefined') {
      if (global.LoyerNotify) global.LoyerNotify.error('Bibliothèque DOCX non chargée.');
      return Promise.reject(new Error('htmlDocx missing'));
    }
    var html = wrapForExport(prepareDocxHtml(container.innerHTML), true);
    var blob = htmlDocx.asBlob(html);
    downloadBlob(blob, filename + '.docx');
    return Promise.resolve();
  }

  global.LoyerExport = {
    exportHtml: exportHtml,
    exportHtmlFromHtml: exportHtmlFromHtml,
    exportDocx: exportDocx,
    exportDocxFromHtml: exportDocxFromHtml,
    exportPdf: exportPdf,
    exportPdfFromHtml: exportPdfFromHtml,
    getPdfBlob: getPdfBlob,
    getPdfBlobFromHtml: getPdfBlobFromHtml,
    wrapForExport: wrapForExport,
    splitBatchHtml: splitBatchHtml
  };
})(window);
