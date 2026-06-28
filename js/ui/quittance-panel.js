/** Panneau quittance : aperçu et export. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Bascule aperçu vs édition ; sauvegarde modèle si dirty. */
  function applyQuittanceTabMode(mode) {
    var apply = function () {
      App.state.quittanceUi.mode = mode;
      App.$$('#panel-quittance .template-mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      var previewWrap = App.$('#quittance-preview-wrap');
      var editWrap = App.$('#quittance-edit-wrap');
      if (mode === 'preview') {
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (editWrap) editWrap.classList.add('hidden');
        App.setEditorReadOnly('quittance-preview', true);
        App.renderQuittancePreview();
        return;
      }
      if (previewWrap) previewWrap.classList.add('hidden');
      if (editWrap) editWrap.classList.remove('hidden');
      App.loadQuittanceTemplateEditor(App.state.quittanceUi.raw);
      App.setEditorReadOnly('template-quittance', !App.isQuittanceTemplateEditable());
      App.setTemplateLayoutPreview('#quittance-template-layout', false);
      App.updateTemplateEditControls('quittance');
      App.refreshTemplatePlaceholderSidebars();
    };

    if (mode === 'preview' && App.state.quittanceUi.mode === 'edit' && App.state.quittanceUi.dirty && App.isQuittanceTemplateEditable()) {
      return App.saveQuittanceTemplateFromTab({ silent: true })
        .then(apply)
        .catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
    }
    if (mode === 'preview' && App.state.quittanceUi.mode === 'edit' && App.state.quittanceUi.dirty) {
      App.state.quittanceUi.dirty = false;
    }
    if (mode === 'edit' && !App.isQuittanceTemplateEditable()) {
      LoyerNotify.info('Les modèles complet et court sont en lecture seule. Dupliquez-les pour les modifier.');
      mode = 'preview';
    }
    apply();
    return Promise.resolve();
  }

  /** Masque la barre Quill après rendu aperçu mois. */
  function lockQuittancePreviewEditor() {
    App.setEditorReadOnly('quittance-preview', true);
  }

  /** True si l'aperçu quittance contient du texte visible. */
  function quittancePreviewHasContent() {
    var el = App.getQuittanceExportEl();
    if (!el) return false;
    return !!String(el.textContent || '').replace(/\s|&nbsp;/g, '');
  }

  /** Rejette si l'aperçu quittance est vide (évite export PDF/DOCX vides). */
  function assertQuittancePreviewHasContent() {
    if (quittancePreviewHasContent()) return;
    throw new Error('Aperçu quittance vide — vérifiez le modèle et la connexion au serveur.');
  }

  /** Injecte HTML quittance remplacé dans le conteneur aperçu. */
  function renderQuittancePreview() {
    var id = App.state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
    var ctx = App.getExportPeriodContext();
    var hint = App.$('#quittance-preview-hint');
    if (ctx.isRange) {
      if (hint) {
        hint.textContent =
          LoyerCalc.listMonthsInRange(ctx.fromYear, ctx.fromMonth, ctx.toYear, ctx.toMonth, App.state.data).length +
          ' quittances seront générées à l\'export (PDF, DOCX, HTML, mail).';
        hint.classList.remove('hidden');
      }
      return LoyerQuittance.renderBatchPreview(
        App.state.data,
        ctx.fromYear,
        ctx.fromMonth,
        ctx.toYear,
        ctx.toMonth,
        id
      )
        .then(lockQuittancePreviewEditor)
        .then(assertQuittancePreviewHasContent)
        .catch(function (err) {
          console.error(err);
          LoyerNotify.error(err.message || 'Impossible de générer les quittances.');
          throw err;
        });
    }
    if (hint) hint.classList.add('hidden');
    return LoyerQuittance.render(App.state.data, App.state.selectedYear, App.state.selectedMonth, id)
      .then(lockQuittancePreviewEditor)
      .then(assertQuittancePreviewHasContent)
      .catch(function (err) {
        console.error(err);
        LoyerNotify.error(err.message || 'Impossible de générer la quittance.');
        throw err;
      });
  }

  /** Rafraîchit label période et aperçu quittance. */
  function renderQuittance() {
    if (App.state.quittanceUi.mode === 'preview') {
      return App.renderQuittancePreview();
    }
    return Promise.resolve();
  }

  /** Élément DOM source pour export (aperçu ou éditeur). */
  function getQuittanceExportEl() {
    return LoyerQuittance.getExportElement();
  }

  /** Nom de fichier suggéré selon période et modèle. */
  function getQuittanceExportFilename(ctx) {
    if (ctx.isRange) {
      return LoyerQuittance.getBatchFilename(
        LoyerCalc.monthKey(ctx.fromYear, ctx.fromMonth),
        LoyerCalc.monthKey(ctx.toYear, ctx.toMonth)
      );
    }
    return LoyerQuittance.getFilename(App.state.selectedYear, App.state.selectedMonth);
  }

  /** Enregistre l'export dans le journal d'activité serveur. */
  function logQuittanceExport(format, ctx, filename, source) {
    if (!global.LoyerActivityLog || !global.LoyerActivityLog.logExportEvent) return Promise.resolve();
    var label = format.toUpperCase();
    var summary = 'Export ' + label + ' : ' + (filename || 'quittance');
    return global.LoyerActivityLog.logExportEvent(format, summary, {
      source: source || 'quittance',
      filename: filename || '',
      isRange: !!(ctx && ctx.isRange),
      fromKey: ctx && ctx.isRange ? LoyerCalc.monthKey(ctx.fromYear, ctx.fromMonth) : null,
      toKey: ctx && ctx.isRange ? LoyerCalc.monthKey(ctx.toYear, ctx.toMonth) : null
    });
  }

  /** Export PDF, DOCX ou HTML pour le mois/période courante. */
  function exportQuittanceFormat(format) {
    var ctx = App.getExportPeriodContext();
    var id = App.state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
    return App.renderQuittancePreview().then(function () {
      App.assertQuittancePreviewHasContent();
      var fn = App.getQuittanceExportFilename(ctx);
      var chain;
      if (format === 'pdf') {
        if (ctx.isRange) {
          chain = LoyerQuittance.exportBatch(
            App.state.data,
            ctx.fromYear,
            ctx.fromMonth,
            ctx.toYear,
            ctx.toMonth,
            id,
            'pdf'
          );
        } else {
          chain = LoyerQuittance.buildFilledHtml(
            App.state.data,
            App.state.selectedYear,
            App.state.selectedMonth,
            id
          ).then(function (html) {
            return LoyerExport.exportPdfFromHtml(html, fn);
          });
        }
      } else if (ctx.isRange) {
        chain = LoyerQuittance.exportBatch(
          App.state.data,
          ctx.fromYear,
          ctx.fromMonth,
          ctx.toYear,
          ctx.toMonth,
          id,
          format
        );
      } else if (format === 'docx') {
        chain = LoyerExport.exportDocx(App.getQuittanceExportEl(), fn);
      } else {
        chain = LoyerExport.exportHtml(App.getQuittanceExportEl(), fn);
      }
      return chain.then(function () {
        if (format === 'pdf' || format === 'docx') {
          return App.logQuittanceExport(format, ctx, fn, 'quittance');
        }
      });
    });
  }

  App.applyQuittanceTabMode = applyQuittanceTabMode;
  App.assertQuittancePreviewHasContent = assertQuittancePreviewHasContent;
  App.renderQuittancePreview = renderQuittancePreview;
  App.renderQuittance = renderQuittance;
  App.getQuittanceExportEl = getQuittanceExportEl;
  App.getQuittanceExportFilename = getQuittanceExportFilename;
  App.logQuittanceExport = logQuittanceExport;
  App.exportQuittanceFormat = exportQuittanceFormat;

  /** Boutons régénérer, exports, toggle mode, modèle. */
  function bindQuittanceEvents() {
    App.bindIf('#btn-refresh-quittance', function (el) {
      el.addEventListener('click', function () {
        App.flushTemplateEditsIfNeeded('quittance')
          .then(renderQuittancePreview)
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Enregistrement impossible.');
          });
      });
    });
    App.bindIf('#btn-refresh-mail', function (el) {
      el.addEventListener('click', function () {
        App.flushTemplateEditsIfNeeded('mail')
          .then(App.renderMailPreview)
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Enregistrement impossible.');
          });
      });
    });
    App.bindIf('#btn-export-pdf', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['quittance'], function () {
          return App.exportQuittanceFormat('pdf');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
    App.bindIf('#btn-export-docx', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['quittance'], function () {
          return App.exportQuittanceFormat('docx');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
    App.bindIf('#btn-export-html', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['quittance'], function () {
          return App.exportQuittanceFormat('html');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
  }

  App.bindQuittanceEvents = bindQuittanceEvents;
})(window);
