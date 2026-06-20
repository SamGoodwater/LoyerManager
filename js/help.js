/**
 * Aide contextuelle : infobulles, popovers et navigation vers l'onglet Aide.
 */
(function (global) {
  'use strict';

  var showPanelFn = null;
  var openPopoverEl = null;
  var openTriggerEl = null;

  var TEXTS = {
    'save-badge':
      'Indique si vos données sont bien enregistrées sur le serveur. Vert = api.php a écrit data/loyer-data.json et templates/. Orange = serveur ou clé API à vérifier (Paramètres → Données).',
    'dash-period':
      'Choisissez l\'année et le mois à examiner. Tous les tableaux et graphiques du tableau de bord se mettent à jour automatiquement.',
    'dash-monthly-table':
      'Pour chaque mois : le loyer attendu, ce qui a été reçu, la différence et le solde cumulé depuis le début de la location. Cliquez sur une ligne pour sélectionner ce mois.',
    'dash-payments-month':
      'Liste des virements reçus pour le mois sélectionné. Si rien n\'apparaît, vérifiez que vous avez bien saisi ou importé des virements dans l\'onglet Virements.',
    'dash-charts':
      'Les graphiques visualisent la même information que les tableaux : comparaison attendu / reçu et évolution du solde dans le temps.',
    'dash-yearly':
      'Vue d\'ensemble année par année : utile pour faire le point sur une année complète.',
    'payments-list':
      'Tous vos virements enregistrés. Vous pouvez modifier ou supprimer une ligne avec les boutons dans la colonne Actions.',
    'payments-csv':
      'Importez un fichier CSV exporté depuis votre banque (relevé de compte). L\'application repère automatiquement les virements du locataire. Les doublons sont ignorés.',
    'payments-manual':
      'Ajoutez un virement un par un si vous n\'avez pas de fichier CSV, ou pour corriger une saisie.',
    'payments-clear':
      'Attention : supprime tous les virements d\'un coup. Utilisez plutôt la suppression ligne par ligne si possible.',
    'settings-lease':
      'Indiquez la date de début du bail et le jour du mois où le loyer est normalement versé (souvent le 1er ou le 5). Ces dates servent aux calculs du tableau de bord.',
    'settings-bailleur':
      'Vos coordonnées en tant que propriétaire. Elles apparaissent sur la quittance de loyer.',
    'settings-locataire':
      'Coordonnées du locataire. Elles apparaissent aussi sur la quittance.',
    'settings-signature':
      'Scan ou photo de votre signature (PNG ou JPG, max. 400 Ko). Elle sera placée en bas de la quittance. Vous pouvez restaurer la signature par défaut à tout moment.',
    'settings-emitters':
      'Pour l\'import CSV : indiquez le nom du locataire tel qu\'affiché dans l\'app, puis les mots à chercher dans le libellé bancaire (un par ligne). Exemple : MARYSE VALLEE.',
    'settings-prices':
      'Montant du loyer et date à partir de laquelle il s\'applique. Ajoutez un palier si le loyer a changé (ex. révision annuelle).',
    'settings-mail':
      'Destinataires des e-mails et signature texte (mot-clé {{signature}}). Le corps et l\'objet du mail se modifient dans l\'onglet Mail.',
    'settings-data':
      'Les données (data/loyer-data.json) et les modèles (templates/) sont enregistrés via api.php sur le serveur. Exportez régulièrement une copie JSON. Si api_key est définie dans config.php, saisissez la clé ici.',
    'settings-templates':
      'Liste des modèles enregistrés sur le serveur (templates/quittances/, templates/mails/). Choisissez le modèle par défaut, modifiez ou supprimez. L\'édition du contenu se fait dans les onglets Quittance et Mail.',
    'mail-period':
      'Aperçu du mail pour le mois choisi dans le Tableau de bord. Basculez en « Édition du modèle » pour modifier objet et corps.',
    'quittance-period':
      'La quittance correspond au mois choisi dans le Tableau de bord. Changez le mois là-bas si vous voulez une autre période.',
    'quittance-edit':
      'Choisissez un modèle, basculez en « Édition du modèle » pour modifier le HTML avec mots-clés {{…}}, ou restez en « Aperçu du mois » pour voir la quittance remplie. « Régénérer » recalcule l\'aperçu.',
    'quittance-export':
      'PDF : pour imprimer ou archiver. DOCX : pour Word. HTML : fichier web autonome. Le PDF est le plus courant pour envoyer au locataire.',
    'quittance-mail':
      'EML + PDF (onglet Mail) : crée un fichier e-mail avec la quittance en pièce jointe. mailto : ouvre votre webmail avec objet et corps préremplis — attachez le PDF manuellement.',
    'csv-import-modal':
      'Cochez les virements à importer. Les lignes déjà présentes sont marquées comme doublons et ne seront pas reimportées. Validez avec « Importer la sélection ».',
    'payment-form-modal':
      'Renseignez la date et le montant reçus. L\'émetteur doit correspondre à un nom configuré dans Paramètres. Les champs libellé et référence sont optionnels en saisie manuelle.'
  };

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getText(id) {
    return TEXTS[id] || '';
  }

  function closePopover() {
    if (openPopoverEl && openPopoverEl.parentNode) {
      openPopoverEl.parentNode.removeChild(openPopoverEl);
    }
    if (openTriggerEl) {
      openTriggerEl.setAttribute('aria-expanded', 'false');
    }
    openPopoverEl = null;
    openTriggerEl = null;
  }

  function positionPopover(popover, trigger) {
    var rect = trigger.getBoundingClientRect();
    var margin = 8;
    popover.style.top = rect.bottom + margin + window.scrollY + 'px';
    popover.style.left = Math.max(margin, rect.left + window.scrollX) + 'px';
    var maxW = Math.min(320, window.innerWidth - margin * 2);
    popover.style.maxWidth = maxW + 'px';

    requestAnimationFrame(function () {
      var popRect = popover.getBoundingClientRect();
      if (popRect.right > window.innerWidth - margin) {
        popover.style.left = window.innerWidth - popRect.width - margin + window.scrollX + 'px';
      }
      if (popRect.bottom > window.innerHeight - margin) {
        popover.style.top = rect.top + window.scrollY - popRect.height - margin + 'px';
      }
    });
  }

  function openPopover(trigger) {
    var id = trigger.getAttribute('data-help-id');
    var text = trigger.getAttribute('data-help') || getText(id);
    if (!text) return;

    closePopover();

    var popover = document.createElement('div');
    popover.className = 'help-popover';
    popover.setAttribute('role', 'tooltip');
    popover.id = 'help-popover-' + (id || 'custom');
    popover.innerHTML =
      '<p class="help-popover-text">' + escapeHtml(text) + '</p>' +
      '<button type="button" class="help-popover-close" aria-label="Fermer l\'aide">×</button>';

    document.body.appendChild(popover);
    positionPopover(popover, trigger);

    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-describedby', popover.id);
    openPopoverEl = popover;
    openTriggerEl = trigger;

    popover.querySelector('.help-popover-close').addEventListener('click', closePopover);
  }

  function helpTriggerHtml(id, label) {
    var aria = label ? ' aria-label="' + escapeHtml(label) + '"' : '';
    return (
      '<button type="button" class="help-trigger" data-help-id="' +
      escapeHtml(id) +
      '"' +
      aria +
      ' aria-expanded="false"><span aria-hidden="true">?</span></button>'
    );
  }

  function bindHelpTriggers(root) {
    (root || document).querySelectorAll('.help-trigger:not([data-help-bound])').forEach(function (btn) {
      btn.setAttribute('data-help-bound', '1');
      if (!btn.getAttribute('aria-label') && btn.getAttribute('data-help-id')) {
        btn.setAttribute('aria-label', 'Afficher l\'aide');
      }
    });
  }

  function updateTabAccessibility(activePanelId) {
    document.querySelectorAll('nav.tabs [role="tab"]').forEach(function (tab) {
      var selected = tab.getAttribute('data-panel') === activePanelId;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  function bindEvents() {
    document.addEventListener('click', function (e) {
      var goto = e.target.closest('.help-goto');
      if (goto && showPanelFn) {
        var panel = goto.getAttribute('data-panel');
        var anchor = goto.getAttribute('data-help-anchor');
        if (panel) showPanelFn(panel);
        if (anchor) {
          setTimeout(function () {
            var el = document.getElementById(anchor);
            if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 80);
        }
        return;
      }

      var trigger = e.target.closest('.help-trigger');
      if (trigger) {
        e.preventDefault();
        e.stopPropagation();
        if (openTriggerEl === trigger) closePopover();
        else openPopover(trigger);
        return;
      }

      if (openPopoverEl && !e.target.closest('.help-popover')) {
        closePopover();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closePopover();
    });

    document.querySelectorAll('.help-toc a[href^="#"]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        var href = link.getAttribute('href');
        if (!href || href.charAt(0) !== '#') return;
        var target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          if (target.tabIndex === undefined || target.tabIndex < 0) target.tabIndex = -1;
          target.focus({ preventScroll: true });
        }
      });
    });

    var tablist = document.querySelector('nav.tabs[role="tablist"]');
    if (tablist) {
      tablist.addEventListener('keydown', function (e) {
        var tabs = Array.prototype.slice.call(tablist.querySelectorAll('[role="tab"]'));
        var idx = tabs.indexOf(document.activeElement);
        if (idx === -1) return;
        var next = idx;
        if (e.key === 'ArrowRight') next = (idx + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') next = (idx - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[next].focus();
        if (showPanelFn) showPanelFn(tabs[next].getAttribute('data-panel'));
      });
    }
  }

  function init(showPanel) {
    showPanelFn = showPanel;
    bindHelpTriggers();
    bindEvents();
  }

  function refresh() {
    bindHelpTriggers();
  }

  global.LoyerHelp = {
    TEXTS: TEXTS,
    init: init,
    refresh: refresh,
    closePopover: closePopover,
    helpTriggerHtml: helpTriggerHtml,
    updateTabAccessibility: updateTabAccessibility
  };
})(window);
