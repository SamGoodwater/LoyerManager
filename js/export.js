/**
 * Exports PDF, DOCX et HTML.
 */
(function (global) {
  'use strict';

  var BATCH_EXPORT_CSS =
    '.quittance-export-page{display:block;page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid}' +
    '.quittance-export-page:last-child{page-break-after:auto;break-after:auto}' +
    '.quittance-page-break{page-break-before:always;break-before:page;height:0;margin:0;padding:0;border:0;line-height:0;font-size:0}';

  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function wrapForExport(innerHtml) {
    return (
      '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">' +
      '<style>body{font-family:Georgia,serif;max-width:800px;margin:2rem auto;line-height:1.5;color:#111}' +
      BATCH_EXPORT_CSS +
      '.quittance-header{display:flex;flex-direction:row;justify-content:space-between;align-items:flex-start;gap:2rem;width:100%;margin-bottom:2rem}' +
      '.quittance-party{flex:1 1 45%;min-width:180px}' +
      '.quittance-party-bailleur{text-align:left}' +
      '.quittance-party-locataire,.quittance-header .quittance-party:last-child{text-align:right}' +
      '.quittance-party h3{font-size:0.85rem;letter-spacing:0.05em;margin:0 0 0.5rem;color:#5c6b7a}' +
      '.quittance-title{text-align:center;margin:1.5rem 0}' +
      '.quittance-list,.quittance-payments pre{white-space:pre-wrap;font-family:inherit;background:#f8f8f8;padding:1rem;border-radius:4px;border:none}' +
      '.quittance-footer{margin-top:2rem;text-align:right}.quittance-footer>p{margin:0}' +
      '.quittance-signature{margin-top:0.75rem;font-weight:bold;text-align:right}' +
      '.quittance-signature-img,.quittance-footer img{width:250px;height:auto;max-width:250px;display:block;margin-top:0.5rem;margin-left:auto;object-fit:contain}' +
      '.quittance-signature-name{margin-top:0.75rem;margin-bottom:0;font-weight:600;text-align:right}' +
      'strong,b{font-weight:bold}em,i{font-style:italic}u{text-decoration:underline}' +
      '</style></head><body>' +
      innerHtml +
      '</body></html>'
    );
  }

  function waitForLayout() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(resolve);
      });
    });
  }

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

  function getPdfOptions(filename) {
    return {
      margin: 15,
      filename: filename ? filename + '.pdf' : 'export.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
  }

  function renderExportPage(el, pageHtml) {
    el.innerHTML = pageHtml;
    applyQuittanceLayout(el);
    return waitForLayout().then(function () {
      return waitForImages(el);
    });
  }

  function exportPdfMultiPage(pages, filename, asBlob) {
    var el = getExportElement();
    if (!el) return Promise.reject(new Error('Élément export quittance introuvable.'));
    var savedHtml = el.innerHTML;
    var opt = getPdfOptions(filename);
    var worker = null;
    var chain = Promise.resolve();

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
  }

  function applyQuittanceLayout(el) {
    if (global.LoyerEditor && global.LoyerEditor.applyQuittanceLayout) {
      global.LoyerEditor.applyQuittanceLayout(el);
    }
  }

  function getExportElement() {
    if (global.LoyerEditor && global.LoyerEditor.getExportElement) {
      return global.LoyerEditor.getExportElement();
    }
    return null;
  }

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
        return callback(el);
      })
      .finally(function () {
        el.innerHTML = savedHtml;
        applyQuittanceLayout(el);
      });
  }

  function exportPdf(container, filename) {
    if (typeof html2pdf === 'undefined') {
      window.print();
      return Promise.resolve();
    }
    return waitForLayout()
      .then(function () {
        return waitForImages(container);
      })
      .then(function () {
        return html2pdf().set(getPdfOptions(filename)).from(container).save();
      });
  }

  function getPdfBlob(container) {
    if (typeof html2pdf === 'undefined') {
      return Promise.reject(new Error('html2pdf missing'));
    }
    return waitForLayout()
      .then(function () {
        return waitForImages(container);
      })
      .then(function () {
        return html2pdf().set(getPdfOptions(null)).from(container).output('blob');
      });
  }

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

  function exportHtmlFromHtml(html, filename) {
    downloadBlob(new Blob([wrapForExport(html)], { type: 'text/html;charset=utf-8' }), filename + '.html');
    return Promise.resolve();
  }

  function exportHtml(container, filename) {
    var html = wrapForExport(container.innerHTML);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename + '.html');
    return Promise.resolve();
  }

  function exportDocxFromHtml(html, filename) {
    if (typeof htmlDocx === 'undefined') {
      if (global.LoyerNotify) global.LoyerNotify.error('Bibliothèque DOCX non chargée.');
      return Promise.reject(new Error('htmlDocx missing'));
    }
    var blob = htmlDocx.asBlob(wrapForExport(html));
    downloadBlob(blob, filename + '.docx');
    return Promise.resolve();
  }

  function exportDocx(container, filename) {
    if (typeof htmlDocx === 'undefined') {
      if (global.LoyerNotify) global.LoyerNotify.error('Bibliothèque DOCX non chargée.');
      return Promise.reject(new Error('htmlDocx missing'));
    }
    var html = wrapForExport(container.innerHTML);
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
