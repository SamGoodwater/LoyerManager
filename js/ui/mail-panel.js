/** Panneau mail : aperçu et envoi. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Bascule aperçu vs édition mail ; flush sujet/corps si dirty. */
  function applyMailTabMode(mode) {
    var apply = function () {
      App.state.mailUi.mode = mode;
      App.$$('#panel-mail .template-mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      var previewWrap = App.$('#mail-tab-preview-wrap');
      var editWrap = App.$('#mail-tab-edit-wrap');
      if (mode === 'preview') {
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (editWrap) editWrap.classList.add('hidden');
        App.setEditorReadOnly('mail-preview', true);
        App.renderMailPreview();
        return;
      }
      if (previewWrap) previewWrap.classList.add('hidden');
      if (editWrap) editWrap.classList.remove('hidden');
      App.syncMailSubjectFromForm();
      App.loadMailTemplateEditor(App.state.mailUi.raw);
      var subjectInp = App.$('#set-mail-subject-template');
      if (subjectInp) {
        subjectInp.readOnly = !App.isMailTemplateEditable();
        subjectInp.value = App.state.mailUi.mailSubjectRaw;
      }
      App.setEditorReadOnly('template-mail', !App.isMailTemplateEditable());
      App.setTemplateLayoutPreview('#mail-template-layout', false);
      App.updateTemplateEditControls('mail');
      App.refreshTemplatePlaceholderSidebars();
    };

    if (mode === 'preview' && App.state.mailUi.mode === 'edit' && App.state.mailUi.dirty && App.isMailTemplateEditable()) {
      return App.saveMailTemplateFromTab({ silent: true })
        .then(apply)
        .catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
    }
    if (mode === 'preview' && App.state.mailUi.mode === 'edit' && App.state.mailUi.dirty) {
      App.state.mailUi.dirty = false;
    }
    if (mode === 'edit' && !App.isMailTemplateEditable()) {
      LoyerNotify.info('Les modèles complet et court sont en lecture seule. Dupliquez-les pour les modifier.');
      mode = 'preview';
    }
    apply();
    return Promise.resolve();
  }

  /** Aperçu corps mail + objet avec mots-clés remplacés. */
  function renderMailPreview() {
    var id = App.state.mailUi.selectedId || LoyerTemplateManager.getDefaultId(App.state.data.settings, 'mail');
    var ctx = App.getExportPeriodContext();
    var refYear = ctx.isRange ? ctx.toYear : App.state.selectedYear;
    var refMonth = ctx.isRange ? ctx.toMonth : App.state.selectedMonth;
    var hint = App.$('#mail-preview-hint');
    if (hint) {
      if (ctx.isRange) {
        hint.textContent =
          'Mail rédigé pour la période — le PDF joint contiendra ' +
          LoyerCalc.listMonthsInRange(ctx.fromYear, ctx.fromMonth, ctx.toYear, ctx.toMonth, App.state.data).length +
          ' quittance(s).';
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }
    return LoyerTemplates.loadFilledMail(App.state.data, refYear, refMonth, id, ctx).then(function (filled) {
      var subjectInp = App.$('#mail-preview-subject');
      if (subjectInp) subjectInp.value = filled.subject;
      var previewEd = LoyerEditor.get('mail-preview');
      if (previewEd) {
        previewEd.setHtml(filled.bodyHtml);
        App.setEditorReadOnly('mail-preview', true);
      }
    });
  }

  /** Prépare envoi, brouillon, EML ou mailto selon le mode. */
  function prepareMailAction(mode) {
    var mailId = App.state.mailUi.selectedId || LoyerTemplateManager.getDefaultId(App.state.data.settings, 'mail');
    var qId = App.state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
    var ctx = App.getExportPeriodContext();
    return App.renderQuittancePreview().then(function () {
      return LoyerMail.prepareMail(
        mode,
        App.state.data,
        App.state.selectedYear,
        App.state.selectedMonth,
        App.getQuittanceExportEl(),
        mailId,
        ctx,
        qId
      );
    });
  }

  App.applyMailTabMode = applyMailTabMode;
  App.renderMailPreview = renderMailPreview;
  App.prepareMailAction = prepareMailAction;

  /** Boutons envoi, brouillon, menu Autres, toggle mode. */
  function bindMailEvents() {
    App.bindIf('#btn-mail-send', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['mail', 'quittance'], function () {
          return App.prepareMailAction('send');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });
    App.bindIf('#btn-mail-draft', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['mail', 'quittance'], function () {
          return App.prepareMailAction('draft');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });
    App.bindIf('#btn-mail-eml', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['mail', 'quittance'], function () {
          return App.prepareMailAction('eml');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });
    App.bindIf('#btn-mail-nav', function (el) {
      el.addEventListener('click', function () {
        App.withTemplatesSaved(['mail', 'quittance'], function () {
          return App.prepareMailAction('mailto');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });
  }

  App.bindMailEvents = bindMailEvents;
})(window);
