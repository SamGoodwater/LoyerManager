/** Navigation entre panneaux et rendu global. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** show panel. */
  function showPanel(id) {
    var prev = getActivePanelId();
    if (prev === 'panel-settings' && id !== 'panel-settings' && App.flushSettingsIfDirty) {
      App.flushSettingsIfDirty(true);
    }
    App.$$('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === id);
    });
    App.$$('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.panel === id);
    });
    var fab = App.$('#btn-save-settings');
    if (fab) {
      fab.classList.toggle('fab-visible', id === 'panel-settings');
    }
    if (global.LoyerHelp) {
      LoyerHelp.updateTabAccessibility(id);
      LoyerHelp.closePopover();
    }
    if (id === 'panel-quittance') {
      if (App.state.quittanceUi.pendingEditId) {
        var qPending = App.state.quittanceUi.pendingEditId;
        App.state.quittanceUi.pendingEditId = null;
        App.loadQuittanceTemplateById(qPending).then(function () {
          App.applyQuittanceTabMode(App.isTemplateEditable(qPending) ? 'edit' : 'preview');
        });
      } else if (App.state.quittanceUi.mode === 'preview') {
        App.renderQuittancePreview();
      }
    }
    if (id === 'panel-mail') {
      if (global.LoyerMailOAuth && global.LoyerMailOAuth.updateMailSendButton) {
        global.LoyerMailOAuth.updateMailSendButton();
      }
      if (App.state.mailUi.pendingEditId) {
        var mPending = App.state.mailUi.pendingEditId;
        App.state.mailUi.pendingEditId = null;
        App.loadMailTemplateById(mPending).then(function () {
          App.applyMailTabMode(App.isTemplateEditable(mPending) ? 'edit' : 'preview');
        });
      } else if (App.state.mailUi.mode === 'preview') {
        App.renderMailPreview();
      }
    }
    if (id === 'panel-settings') {
      App.renderTemplateRegistry();
      if (global.LoyerMailOAuth && global.LoyerMailOAuth.renderStatusPanel) {
        var oauthPanel = document.getElementById('oauth-status-panel');
        if (oauthPanel) global.LoyerMailOAuth.renderStatusPanel(oauthPanel);
      }
    }
    if (id === 'panel-history') {
      if (global.LoyerActivityLog && global.LoyerActivityLog.loadAndRender) {
        global.LoyerActivityLog.loadAndRender();
      }
      if (global.LoyerActivityLog && global.LoyerActivityLog.loadRetentionSetting) {
        global.LoyerActivityLog.loadRetentionSetting();
      }
    }
    App.updatePeriodBarVisibility(id);
    App.updateHeaderSelection();
  }

  /** Id du panneau onglet actuellement visible. */
  function getActivePanelId() {
    var p = App.$('.panel.active');
    return p ? p.id : 'panel-dashboard';
  }

  /** refresh selectors. */
  function refreshSelectors() {
    if (global.LoyerPeriod) LoyerPeriod.refresh();
    App.updatePeriodTabLabels();
  }

  /** Rafraîchit le rendu DOM de render all. */
  function renderAll() {
    App.renderDashboard();
    App.renderPayments();
    App.renderSettings();
    App.renderQuittance();
  }

  App.showPanel = showPanel;
  App.getActivePanelId = getActivePanelId;
  App.refreshSelectors = refreshSelectors;
  App.renderAll = renderAll;
})(window);
