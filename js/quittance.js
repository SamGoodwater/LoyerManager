/**
 * Rendu quittance depuis modèle (templates/quittances/{id}.html).
 */
(function (global) {
  'use strict';

  function render(data, year, month, templateId) {
    templateId =
      templateId ||
      (global.LoyerTemplates ? global.LoyerTemplates.resolveDefaultId('quittance', data.settings) : 'principal');
    return global.LoyerTemplates.loadTemplate('quittance', templateId)
      .then(function (template) {
        var quittanceData = global.LoyerCalc.buildQuittanceData(data, year, month);
        quittanceData.signature = (data.settings.mail && data.settings.mail.signature) || '';
        var html = global.LoyerTemplates.fillTemplate(template, quittanceData);
        global.LoyerEditor.setHtml(html);
        var el = global.LoyerEditor.getExportElement();
        if (el) {
          el.dataset.year = year;
          el.dataset.month = month;
        }
        return quittanceData;
      });
  }

  function getRenderedHtml() {
    return global.LoyerEditor.getHtml();
  }

  function getFilename(year, month) {
    return 'Quittance_' + year + '-' + String(month).padStart(2, '0');
  }

  global.LoyerQuittance = {
    render: render,
    getRenderedHtml: getRenderedHtml,
    getExportElement: function () {
      return global.LoyerEditor.getExportElement();
    },
    getFilename: getFilename
  };
})(window);
