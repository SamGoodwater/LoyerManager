/** État global et utilitaires DOM. */
(function (global) {
  'use strict';
  var App = global.LoyerApp || {};
  global.LoyerApp = App;

  App.SIGNATURE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

  App.state = {
    data: null,
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    period: {
      rangeUiOpen: false,
      fromYear: new Date().getFullYear(),
      fromMonth: new Date().getMonth() + 1,
      toYear: new Date().getFullYear(),
      toMonth: new Date().getMonth() + 1
    },
    focusYear: new Date().getFullYear(),
    focusMonth: new Date().getMonth() + 1,
    dashboardChartYear: new Date().getFullYear(),
    editingPaymentId: null,
    paymentModalContext: null,
    monthDetail: null,
    paymentFilters: null,
    csvImportItems: [],
    quittanceUi: {
      selectedId: null,
      mode: 'preview',
      raw: '',
      dirty: false,
      pendingEditId: null
    },
    mailUi: {
      selectedId: null,
      mode: 'preview',
      raw: '',
      mailSubjectRaw: '',
      dirty: false,
      pendingEditId: null
    }
  };

  var lastNotifiedSaveStatus = '';

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return document.querySelectorAll(sel);
  }

  /** addEventListener si l'élément existe. */
  function bindIf(id, fn) {
    var el = $(id);
    if (el) fn(el);
  }

  /** Formate montant en euros (locale fr-FR). */
  function fmt(n) {
    return LoyerCalc.formatCurrency(n);
  }

  /** Délègue store.save (debounced). */
  function persist() {
    App.state.data = LoyerStore.save(App.state.data);
    updateDataFileStatus();
    handleSaveStatusChange(LoyerStore.getSaveStatus());
  }

  /** show loading. */
  function showLoading() {
    var el = $('#app-loading');
    if (el) el.classList.remove('hidden');
  }

  /** hide loading. */
  function hideLoading() {
    var el = $('#app-loading');
    if (el) el.classList.add('hidden');
  }

  /** Gestionnaire d'événement : handle save status change. */
  function handleSaveStatusChange(status) {
    if (status === lastNotifiedSaveStatus) return;
    if (status === 'error' && global.LoyerNotify) {
      LoyerNotify.warn('Impossible d\'enregistrer vos modifications. Réessayez dans un instant.');
    }
    lastNotifiedSaveStatus = status;
  }

  /** Met à jour update save status badge. */
  function updateSaveStatusBadge(status) {
    handleSaveStatusChange(status);
  }

  /** Ouvre open settings data section. */
  function openSettingsDataSection() {
    App.showPanel('panel-settings');
    var card = $('#settings-data-section');
    if (card) card.classList.remove('hidden');
    var el = $('#settings-data-section');
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  /** Attache les écouteurs d'événements pour bind save status events. */
  function bindSaveStatusEvents() {
    LoyerStore.onSaveStatusChange(handleSaveStatusChange);
  }

  /** apply init result. */
  function applyInitResult(result) {
    if (!result) return;
    updateDataFileStatus();
    handleSaveStatusChange(LoyerStore.getSaveStatus());
    if (result.needsApiKey) {
      LoyerNotify.warn('Clé d\'accès requise — renseignez-la dans Paramètres.');
      openSettingsDataSection();
    }
  }

  /** Échappe texte pour insertion HTML sûre. */
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Indicateur connexion/sauvegarde serveur. */
  function updateDataFileStatus() {
    var card = $('#settings-data-section');
    var el = $('#data-file-status');
    var intro = $('#settings-data-intro');
    if (!el) return;

    if (LoyerStore.usesServerStorage && LoyerStore.usesServerStorage()) {
      if (card) card.classList.add('hidden');
      if (intro) intro.classList.add('hidden');
      App.updateServerApiKeyBlock(false);
      if (App.refreshSettingsNav) App.refreshSettingsNav();
      return;
    }

    if (card) card.classList.remove('hidden');

    if (global.LoyerServerApi && global.LoyerServerApi.isHttpContext && global.LoyerServerApi.isHttpContext()) {
      if (LoyerStore.isServerAuthRequired && LoyerStore.isServerAuthRequired()) {
        el.textContent = 'Une clé d\'accès est nécessaire pour lire et enregistrer vos données.';
        el.className = 'data-file-status data-file-status-warn';
        if (intro) intro.classList.add('hidden');
        App.updateServerApiKeyBlock(true);
        return;
      }
      el.textContent = 'Connexion au serveur impossible. Vérifiez que l\'application est bien ouverte via son adresse web.';
      el.className = 'data-file-status data-file-status-warn';
      if (intro) intro.classList.add('hidden');
      App.updateServerApiKeyBlock(false);
      return;
    }

    el.textContent = 'Connexion au serveur impossible. Vérifiez que l\'application est bien ouverte via son adresse web.';
    el.className = 'data-file-status data-file-status-warn';
    if (intro) intro.classList.add('hidden');
    App.updateServerApiKeyBlock(false);
    if (App.refreshSettingsNav) App.refreshSettingsNav();
  }

  /** Gestionnaire d'événement : handle corrupt file. */
  function handleCorruptFile(err) {
    return LoyerNotify.corruptFileDialog(
      'Vos données semblent endommagées et ne peuvent pas être lues.',
      err.parseError
    ).then(function (action) {
      if (action === 'download') {
        LoyerStore.downloadCorruptBackup(err.rawText);
        LoyerNotify.info('Copie de secours téléchargée.');
        return handleCorruptFile(err);
      }
      if (action === 'reset') {
        LoyerStore.downloadCorruptBackup(err.rawText);
        return LoyerStore.recreateAfterCorruption().then(function (data) {
          App.state.data = data;
          App.renderAll();
          updateDataFileStatus();
          handleSaveStatusChange('saved');
          LoyerNotify.success('Données recréées. Une copie du fichier endommagé a été téléchargée.');
        });
      }
      App.state.data = LoyerStore.normalizeData(LoyerStore.createDefaultData());
      App.renderAll();
      updateDataFileStatus();
      handleSaveStatusChange(LoyerStore.getSaveStatus());
      LoyerNotify.warn('Données non réinitialisées — affichage vide.');
    });
  }

  App.$ = $;
  App.$$ = $$;
  App.bindIf = bindIf;
  App.fmt = fmt;
  App.persist = persist;
  App.showLoading = showLoading;
  App.hideLoading = hideLoading;
  App.updateSaveStatusBadge = updateSaveStatusBadge;
  App.openSettingsDataSection = openSettingsDataSection;
  App.bindSaveStatusEvents = bindSaveStatusEvents;
  App.applyInitResult = applyInitResult;
  App.escapeHtml = escapeHtml;
  App.updateDataFileStatus = updateDataFileStatus;
  App.handleCorruptFile = handleCorruptFile;
})(window);
