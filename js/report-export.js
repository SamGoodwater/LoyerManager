/**
 * Impression des rapports tableau de bord (blocs, synthèse visuelle, rapport complet).
 * L'utilisateur peut enregistrer en PDF depuis la boîte de dialogue d'impression du navigateur.
 */
(function (global) {
  'use strict';

  var PRINT_CLASS_PREFIX = 'report-print-';

  /** Affiche l'en-tête du rapport (visible uniquement à l'impression). */
  function updatePrintBanner(title) {
    var banner = document.getElementById('report-print-banner');
    if (!banner) return;
    var App = global.LoyerApp;
    var period =
      App && App.getPeriodDisplayLabel ? App.getPeriodDisplayLabel() : '';
    var now = new Date().toLocaleString('fr-FR');
    banner.innerHTML =
      '<h1>' +
      escapeHtml(title) +
      '</h1>' +
      (period ? '<p>Période : <strong>' + escapeHtml(period) + '</strong></p>' : '') +
      '<p class="report-print-date">Imprimé le ' +
      escapeHtml(now) +
      '</p>';
  }

  function escapeHtml(text) {
    if (global.LoyerApp && global.LoyerApp.escapeHtml) {
      return global.LoyerApp.escapeHtml(text);
    }
    return String(text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  var TITLES = {
    summary: 'Tableau de bord',
    month: 'Détail du mois',
    payments: 'Détail des paiements',
    viz: "Vue d'ensemble et récapitulatif annuel",
    full: 'Rapport complet',
    'modal-month': 'Détail du mois',
    'modal-payment': 'Détail du paiement'
  };

  /** Lance l'impression d'un bloc ou d'une combinaison prédéfinie. */
  function printReport(kind) {
    var Notify = global.LoyerNotify;
    if (!TITLES[kind]) {
      if (Notify) Notify.warn('Type de rapport inconnu.');
      return;
    }

    if (kind === 'modal-month') {
      var monthModal = document.getElementById('modal-month-detail');
      if (!monthModal || monthModal.classList.contains('hidden')) {
        if (Notify) Notify.warn('Ouvrez d\'abord le détail d\'un mois.');
        return;
      }
      var monthTitle = global.LoyerApp && global.LoyerApp.$('#modal-month-detail-title');
      if (monthTitle && monthTitle.textContent.trim()) {
        updatePrintBanner(monthTitle.textContent.trim());
      } else {
        updatePrintBanner(TITLES[kind]);
      }
      syncMonthNoteForPrint();
    } else if (kind === 'modal-payment') {
      if (!global.LoyerApp || !global.LoyerApp.state.editingPaymentId) {
        if (Notify) Notify.warn('Enregistrez ou ouvrez un paiement existant pour l\'imprimer.');
        return;
      }
      var payTitle = global.LoyerApp.$('#modal-payment-title');
      updatePrintBanner(
        payTitle && payTitle.textContent.trim()
          ? payTitle.textContent.trim()
          : TITLES[kind]
      );
    } else {
      updatePrintBanner(TITLES[kind]);
      if (global.LoyerApp && global.LoyerApp.showPanel) {
        global.LoyerApp.showPanel('panel-dashboard');
      }
    }

    var body = document.body;
    body.classList.add('report-print-active', PRINT_CLASS_PREFIX + kind);

    var cleanup = function () {
      body.classList.remove('report-print-active', PRINT_CLASS_PREFIX + kind);
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);

    if (Notify) Notify.info('Choisissez « Enregistrer au format PDF » dans la fenêtre d\'impression si besoin.');

    requestAnimationFrame(function () {
      window.print();
    });
  }

  /** Copie la note du mois vers le bloc visible à l'impression. */
  function syncMonthNoteForPrint() {
    var ta = document.getElementById('month-detail-note');
    var exp = document.getElementById('month-detail-note-export');
    if (ta && exp) exp.textContent = ta.value.trim() || '—';
  }

  /** Attache les boutons d'impression rapport. */
  function bindReportButtons() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-report-export]');
      if (!btn || btn.disabled) return;
      e.preventDefault();
      printReport(btn.getAttribute('data-report-export'));
    });
  }

  /** Active/désactive l'impression paiement selon le mode édition. */
  function syncPaymentReportButton() {
    var btn = document.getElementById('btn-report-payment-modal');
    if (!btn || !global.LoyerApp) return;
    var editing = !!global.LoyerApp.state.editingPaymentId;
    btn.disabled = !editing;
    btn.title = editing
      ? 'Imprimer le détail de ce paiement'
      : 'Enregistrez d\'abord le paiement pour l\'imprimer';
  }

  global.LoyerReportExport = {
    printReport: printReport,
    bindReportButtons: bindReportButtons,
    syncPaymentReportButton: syncPaymentReportButton
  };
})(window);
