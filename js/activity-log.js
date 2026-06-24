/**
 * Journal d'activité (historique serveur).
 */
(function (global) {
  'use strict';

  var EVENT_LABELS = {
    mail_sent: 'Mail envoyé',
    mail_draft: 'Brouillon mail',
    csv_import: 'Import CSV',
    export_pdf: 'Export PDF',
    export_docx: 'Export DOCX',
    export_html: 'Export HTML',
    oauth_connected: 'Connexion OAuth',
    oauth_disconnected: 'Déconnexion OAuth'
  };

  /** Échappe HTML lignes journal. */
  function escapeHtml(s) {
    if (global.LoyerCalc && global.LoyerCalc.escapeHtml) return global.LoyerCalc.escapeHtml(s);
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /** Format date/heure FR pour entrée journal. */
  function formatDate(iso) {
    if (!iso) return '—';
    try {
      var d = new Date(iso);
      return d.toLocaleString('fr-FR');
    } catch (e) {
      return iso;
    }
  }

  /** Libellé français du type d'événement. */
  function eventLabel(type) {
    return EVENT_LABELS[type] || type;
  }

  /** Table HTML paginée du journal. */
  function renderTable(container, data) {
    if (!container) return;
    var items = (data && data.items) || [];
    if (!items.length) {
      container.innerHTML = '<p class="empty-msg">Aucun événement enregistré.</p>';
      return;
    }
    var rows = items
      .map(function (row) {
        var statusClass = row.status === 'error' ? 'activity-status-error' : 'activity-status-ok';
        return (
          '<tr>' +
          '<td>' +
          escapeHtml(formatDate(row.createdAt)) +
          '</td>' +
          '<td>' +
          escapeHtml(eventLabel(row.eventType)) +
          '</td>' +
          '<td class="' +
          statusClass +
          '">' +
          escapeHtml(row.status) +
          '</td>' +
          '<td>' +
          escapeHtml(row.summary) +
          '</td>' +
          '<td class="activity-error-cell">' +
          escapeHtml(row.errorMessage || '') +
          '</td>' +
          '</tr>'
        );
      })
      .join('');
    container.innerHTML =
      '<table class="data-table activity-log-table"><thead><tr>' +
      '<th>Date</th><th>Type</th><th>Statut</th><th>Résumé</th><th>Erreur</th>' +
      '</tr></thead><tbody>' +
      rows +
      '</tbody></table>' +
      (data.total > items.length
        ? '<p class="field-hint">' + items.length + ' / ' + data.total + ' événements affichés.</p>'
        : '');
  }

  /** Fetch API activity-log + renderTable. */
  function loadAndRender(options) {
    options = options || {};
    var tbodyHost = document.getElementById('activity-log-body');
    if (!tbodyHost) return Promise.resolve();
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      tbodyHost.innerHTML = '<p class="field-hint">Connexion au serveur requise.</p>';
      return Promise.resolve();
    }
    tbodyHost.innerHTML = '<p class="field-hint">Chargement…</p>';
    var params = {
      limit: options.limit || 100,
      offset: 0
    };
    var typeFilter = document.getElementById('activity-log-type-filter');
    if (typeFilter && typeFilter.value) params.type = typeFilter.value;
    return global.LoyerServerApi.fetchActivityLog(params).then(function (data) {
      renderTable(tbodyHost, data);
    }).catch(function (err) {
      tbodyHost.innerHTML = '<p class="field-hint">' + escapeHtml(err.message) + '</p>';
    });
  }

  /** POST log-export après export quittance/dashboard. */
  function logExportEvent(format, summary, metadata) {
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) return Promise.resolve();
    var map = { pdf: 'export_pdf', docx: 'export_docx', html: 'export_html' };
    var eventType = map[format] || 'export_pdf';
    return global.LoyerServerApi.logExport(eventType, summary, metadata);
  }

  /** GET app-settings historyRetentionMonths. */
  function loadRetentionSetting() {
    var retentionInput = document.getElementById('set-history-retention-months');
    if (!retentionInput || !global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.resolve();
    }
    return global.LoyerServerApi.fetchAppSettings().then(function (data) {
      if (data.historyRetentionMonths != null) {
        retentionInput.value = String(data.historyRetentionMonths);
      }
    }).catch(function () {});
  }

  /** Filtre, refresh, export CSV, purge, rétention. */
  function initControls() {
    var refreshBtn = document.getElementById('btn-activity-log-refresh');
    var exportBtn = document.getElementById('btn-activity-log-export-csv');
    var purgeBtn = document.getElementById('btn-activity-log-purge');
    var typeFilter = document.getElementById('activity-log-type-filter');
    var retentionInput = document.getElementById('set-history-retention-months');
    var saveRetentionBtn = document.getElementById('btn-save-history-retention');

    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        loadAndRender();
      });
    }
    if (typeFilter) {
      typeFilter.addEventListener('change', function () {
        loadAndRender();
      });
    }
    if (exportBtn) {
      exportBtn.addEventListener('click', function () {
        if (global.LoyerServerApi) global.LoyerServerApi.downloadActivityCsv({});
      });
    }
    if (purgeBtn) {
      purgeBtn.addEventListener('click', function () {
        if (!global.LoyerNotify) return;
        global.LoyerNotify.confirm('Supprimer tout l\'historique ?', {
          confirmLabel: 'Purger',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          return global.LoyerServerApi.purgeActivityLog({ all: true });
        }).then(function (res) {
          if (!res) return;
          loadAndRender();
          global.LoyerNotify.success('Historique purgé.');
        });
      });
    }
    if (saveRetentionBtn && retentionInput) {
      saveRetentionBtn.addEventListener('click', function () {
        var months = parseInt(retentionInput.value, 10);
        if (isNaN(months)) months = 24;
        global.LoyerServerApi.saveAppSettings({ historyRetentionMonths: months }).then(function () {
          if (global.LoyerNotify) global.LoyerNotify.success('Durée de conservation enregistrée.');
        });
      });
    }
  }

  /** Point d'entrée module Historique. */
  function init() {
    initControls();
  }

  global.LoyerActivityLog = {
    init: init,
    loadAndRender: loadAndRender,
    loadRetentionSetting: loadRetentionSetting,
    logExportEvent: logExportEvent
  };
})(window);
