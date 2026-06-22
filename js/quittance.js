/**
 * Rendu quittance depuis modèle (templates/quittances/{id}.html).
 */
(function (global) {
  'use strict';

  function resolveTemplateId(data, templateId) {
    return (
      templateId ||
      (global.LoyerTemplates
        ? global.LoyerTemplates.resolveDefaultId('quittance', data.settings)
        : 'principal')
    );
  }

  function buildFilledHtml(data, year, month, templateId) {
    var id = resolveTemplateId(data, templateId);
    return global.LoyerTemplates.loadTemplate('quittance', id).then(function (template) {
      var quittanceData = global.LoyerCalc.buildQuittanceData(data, year, month);
      quittanceData.signature = (data.settings.mail && data.settings.mail.signature) || '';
      return global.LoyerTemplates.fillTemplate(template, quittanceData);
    });
  }

  function buildBatchHtml(data, fromYear, fromMonth, toYear, toMonth, templateId) {
    var months = global.LoyerCalc.listMonthsInRange(fromYear, fromMonth, toYear, toMonth, data);
    if (!months.length) {
      return Promise.reject(new Error('Aucun mois dans la plage sélectionnée.'));
    }
    var id = resolveTemplateId(data, templateId);
    var promises = months.map(function (m, index) {
      return buildFilledHtml(data, m.year, m.month, id).then(function (html) {
        var pageBreak =
          index > 0
            ? '<div class="quittance-page-break" style="page-break-before:always;break-before:page;" aria-hidden="true">' +
              '<br style="page-break-before:always;mso-break-type:section-break;clear:both;" />' +
              '</div>'
            : '';
        return (
          pageBreak +
          '<section class="quittance-export-page" style="page-break-after:always;break-after:page;page-break-inside:avoid;break-inside:avoid;">' +
          html +
          '</section>'
        );
      });
    });
    return Promise.all(promises).then(function (parts) {
      return {
        html: parts.join(''),
        monthCount: months.length,
        fromKey: months[0].key,
        toKey: months[months.length - 1].key
      };
    });
  }

  function getBatchFilename(fromKey, toKey) {
    return 'Quittances_' + fromKey + '_' + toKey;
  }

  function exportBatch(data, fromYear, fromMonth, toYear, toMonth, templateId, format) {
    return buildBatchHtml(data, fromYear, fromMonth, toYear, toMonth, templateId).then(function (result) {
      var filename = getBatchFilename(result.fromKey, result.toKey);
      if (format === 'pdf') {
        return global.LoyerExport.exportPdfFromHtml(result.html, filename);
      }
      if (format === 'docx') {
        return global.LoyerExport.exportDocxFromHtml(result.html, filename);
      }
      if (format === 'html') {
        return global.LoyerExport.exportHtmlFromHtml(result.html, filename);
      }
      return Promise.reject(new Error('Format inconnu : ' + format));
    });
  }

  function getPeriodPdfBlob(data, fromYear, fromMonth, toYear, toMonth, templateId) {
    return buildBatchHtml(data, fromYear, fromMonth, toYear, toMonth, templateId).then(function (result) {
      return global.LoyerExport.getPdfBlobFromHtml(result.html);
    });
  }

  function render(data, year, month, templateId) {
    return buildFilledHtml(data, year, month, templateId).then(function (html) {
      global.LoyerEditor.setHtml(html);
      var el = global.LoyerEditor.getExportElement();
      if (el) {
        el.dataset.year = year;
        el.dataset.month = month;
      }
      return global.LoyerCalc.buildQuittanceData(data, year, month);
    });
  }

  function getRenderedHtml() {
    return global.LoyerEditor.getHtml();
  }

  function getFilename(year, month) {
    return 'Quittance_' + year + '-' + String(month).padStart(2, '0');
  }

  function renderBatchPreview(data, fromYear, fromMonth, toYear, toMonth, templateId) {
    return buildBatchHtml(data, fromYear, fromMonth, toYear, toMonth, templateId).then(function (result) {
      global.LoyerEditor.setHtml(result.html);
      var el = global.LoyerEditor.getExportElement();
      if (el) {
        el.dataset.batch = '1';
        el.dataset.fromKey = result.fromKey;
        el.dataset.toKey = result.toKey;
        el.dataset.monthCount = String(result.monthCount);
        delete el.dataset.year;
        delete el.dataset.month;
      }
      return result;
    });
  }

  global.LoyerQuittance = {
    render: render,
    renderBatchPreview: renderBatchPreview,
    buildFilledHtml: buildFilledHtml,
    buildBatchHtml: buildBatchHtml,
    exportBatch: exportBatch,
    getPeriodPdfBlob: getPeriodPdfBlob,
    getBatchFilename: getBatchFilename,
    getRenderedHtml: getRenderedHtml,
    getExportElement: function () {
      return global.LoyerEditor.getExportElement();
    },
    getFilename: getFilename
  };
})(window);
