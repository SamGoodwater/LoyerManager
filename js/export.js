/**
 * Exports PDF, DOCX et HTML.
 */
(function (global) {
  'use strict';

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

  function exportHtml(container, filename) {
    var html = wrapForExport(container.innerHTML);
    downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), filename + '.html');
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

  function exportPdf(container, filename) {
    if (typeof html2pdf === 'undefined') {
      window.print();
      return Promise.resolve();
    }
    var opt = {
      margin: 15,
      filename: filename + '.pdf',
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    return html2pdf().set(opt).from(container).save();
  }

  function getPdfBlob(container) {
    if (typeof html2pdf === 'undefined') {
      return Promise.reject(new Error('html2pdf missing'));
    }
    var opt = {
      margin: 15,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    return html2pdf().set(opt).from(container).output('blob');
  }

  global.LoyerExport = {
    exportHtml: exportHtml,
    exportDocx: exportDocx,
    exportPdf: exportPdf,
    getPdfBlob: getPdfBlob,
    wrapForExport: wrapForExport
  };
})(window);
