/**
 * Point d'entrée — initialisation et branchement des événements globaux.
 */
(function (global) {
  'use strict';

  var App = global.LoyerApp;

  /** Écouteurs globaux (beforeunload flush, raccourcis). */
  function bindEvents() {
    App.bindFileDropImport();

    var mainContent = App.$('#main-content');
    var brandHome = App.$('#app-brand-home');
    if (brandHome) {
      brandHome.addEventListener('click', function (e) {
        e.preventDefault();
        App.showPanel('panel-dashboard');
        if (mainContent && mainContent.scrollIntoView) {
          mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    App.$$('.tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        App.showPanel(btn.dataset.panel);
      });
    });

    App.initPeriodPicker();
    App.updatePeriodBarVisibility('panel-dashboard');

    App.bindDashboardEvents();
    App.bindPaymentsEvents();
    App.bindSettingsEvents();
    App.bindTemplatesEvents();
    App.bindQuittanceEvents();
    App.bindMailEvents();
  }

  /** Après auth : renderAll, init modules, hide loading. */
  function finishInit() {
    LoyerEditor.init();
    bindEvents();
    App.bindSaveStatusEvents();
    if (global.LOYER_SITE_META) {
      var ghLink = App.$('#footer-github-link');
      if (ghLink && global.LOYER_SITE_META.githubUrl) {
        ghLink.href = global.LOYER_SITE_META.githubUrl;
      }
    }
    if (global.LoyerHelp) LoyerHelp.init(App.showPanel);
    if (global.LoyerConsent) LoyerConsent.init();
    var versionEl = App.$('#app-version-label');
    if (versionEl && global.LoyerApp && global.LoyerApp.version) {
      versionEl.textContent = 'v' + global.LoyerApp.version;
    }
    if (global.LoyerMailOAuth) {
      LoyerMailOAuth.init().then(function () {
        if (location.hash.indexOf('settings-mail-oauth') !== -1) {
          App.showPanel('panel-settings');
          var block = document.getElementById('settings-mail-oauth');
          if (block) block.scrollIntoView({ behavior: 'smooth' });
        }
      });
    }
    if (global.LoyerActivityLog) LoyerActivityLog.init();
    if (global.LoyerAuth && global.LoyerAuth.updateHeaderAuthUi) {
      global.LoyerAuth.updateHeaderAuthUi();
    }
    if (global.LoyerAuth && global.LoyerAuth.getCachedStatus) {
      var authStatus = global.LoyerAuth.getCachedStatus();
      if (authStatus && authStatus.demo && global.LoyerDemoUi && global.LoyerDemoUi.applyDemoUi) {
        global.LoyerDemoUi.applyDemoUi(authStatus);
      }
    }
    App.renderAll();
    App.initTemplatesUi();
    App.showPanel('panel-dashboard');
  }

  /** Point d'entrée : auth, store, shell, panneaux. */
  function init() {
    App.showLoading();
    var boot = global.LoyerAuth ? global.LoyerAuth.ensureAuthenticated() : Promise.resolve();
    boot
      .then(function () {
        return LoyerStore.init();
      })
      .then(function (result) {
        App.state.data = result.data;
        finishInit();
        if (global.LoyerAuth && global.LoyerAuth.handleProfileImportedReturn) {
          global.LoyerAuth.handleProfileImportedReturn();
        }
        App.applyInitResult(result);
        if (result.mode === 'server' && result.created) {
          LoyerNotify.success('Données et modèles initialisés sur le serveur.');
        }
      })
      .catch(function (err) {
        if (err && (err.message === 'Configuration requise' || err.message === 'Connexion requise')) {
          return;
        }
        if (err && err.name === 'CorruptDataFileError') {
          App.state.data = LoyerStore.normalizeData(LoyerStore.createDefaultData());
          finishInit();
          App.applyInitResult({});
          App.hideLoading();
          App.handleCorruptFile(err);
          return;
        }
        console.error(err);
        LoyerNotify.error(err && err.message ? err.message : 'Erreur au chargement des données.');
      })
      .finally(function () {
        App.hideLoading();
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
