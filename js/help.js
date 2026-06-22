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
      'Ligne du haut : mois (input natif), bouton « Période » pour ajouter une date de fin, légende colorée à droite. Timeline scrollable en dessous — en mode période, le 1er clic fixe la date « Au », puis les clics à gauche/droite ajustent le début ou la fin ; à l\'intérieur de la plage, le bord le plus proche est modifié. Glisser = sélection directe.',
    'dash-kpis':
      'Indicateurs annuels : solde cumulé à date, taux de recouvrement, mois partiels ou impayés, retard moyen. La heatmap colore chaque mois selon son statut — en mode période, un clic ne change que le détail virements et le récap du mois.',
    'dash-print':
      'Imprime le tableau de bord (KPIs, tableaux, heatmap). Les graphiques sont masqués à l\'impression car ils ne s\'exportent pas bien en papier.',
    'dash-monthly-table':
      'Pour chaque mois : statut (payé, partiel, impayé…), loyer attendu, reçu, différence et solde cumulé. Un indicateur +X j signale un retard de paiement.',
    'dash-payments-month':
      'Liste des virements reçus pour le mois sélectionné. Si rien n\'apparaît, vérifiez que vous avez bien saisi ou importé des virements dans l\'onglet Virements.',
    'dash-charts':
      'Graphique empilé : part reçue vs reste dû par mois. Courbe de solde : vert = avance locataire, rouge = dette.',
    'dash-yearly':
      'Vue d\'ensemble année par année : utile pour faire le point sur une année complète.',
    'payments-list':
      'Tous vos virements enregistrés. Vous pouvez modifier ou supprimer une ligne avec les boutons dans la colonne Actions.',
    'payments-csv':
      'Importez un fichier CSV exporté depuis votre banque (relevé de compte), ou déposez-le n\'importe où sur la page. L\'application repère automatiquement les virements du locataire. Les doublons sont ignorés.',
    'payments-manual':
      'Ajoutez un virement un par un si vous n\'avez pas de fichier CSV, ou pour corriger une saisie.',
    'payments-clear':
      'Attention : supprime tous les virements d\'un coup. Utilisez plutôt la suppression ligne par ligne si possible.',
    'settings-lease':
      'Indiquez la date de début du bail et le jour du mois où le loyer est normalement versé (souvent le 1er ou le 5). Ces dates servent aux calculs du tableau de bord.',
    'settings-bailleur':
      'Vos coordonnées en tant que propriétaire. Elles apparaissent sur la quittance de loyer et dans les mails via les mots-clés {{bailleur.*}}.',
    'settings-locataire':
      'Coordonnées du locataire. Elles apparaissent sur la quittance et dans les mails via les mots-clés {{locataire.*}}.',
    'settings-signature':
      'Scan ou photo de votre signature (PNG, JPG, WebP ou GIF, max. 5 Mo). Elle sera placée en bas de la quittance (mot-clé {{signatureHtml}}). Vous pouvez restaurer la signature par défaut à tout moment.',
    'settings-emitters':
      'Pour l\'import CSV : indiquez le nom du locataire tel qu\'affiché dans l\'app, puis les mots à chercher dans le libellé bancaire (un par ligne). Exemple : Jean Dupont',
    'settings-prices':
      'Montant du loyer et date à partir de laquelle il s\'applique. Ajoutez un palier si le loyer a changé (ex. révision annuelle).',
    'settings-mail':
      'Destinataires des e-mails (À, CC, CCI) et signature texte (mot-clé {{signature}}). Le corps et l\'objet du mail se modifient dans l\'onglet Mail.',
    'settings-data':
      'Les données (data/loyer-data.json) et les modèles (templates/) sont enregistrés via api.php. La clé API (config.php) n\'est pas un compte : c\'est un secret qui autorise le navigateur à lire/écrire ces fichiers. Exportez régulièrement une copie JSON ; import par bouton ou glisser-déposer.',
    'settings-templates':
      'Liste des modèles enregistrés sur le serveur. Le modèle principal est fourni par défaut en lecture seule (aperçu et export possibles ; édition interdite). Importez un fichier pour créer un nouveau modèle, ou dupliquez le principal via « + Nouveau modèle ».',
    'mail-period':
      'Mois ou période via la barre en haut (timeline incluse sur Quittance et Mail). En plage, le mail utilise {{periodeText}} et le PDF joint contient toutes les quittances.',
    'mail-edit':
      'Mots-clés : {{periodeText}}, {{moisDebutText}}, {{moisFinText}}, {{texteQuittancesJointes}}, etc. En plage, {{periodeText}} affiche « janvier 2025 → juin 2025 » ; en mois unique, le mois seul.',
    'quittance-period':
      'Mois ou période via la barre en haut (timeline incluse). En plage, l\'aperçu et les exports PDF/DOCX/HTML génèrent une quittance par mois.',
    'quittance-edit':
      'Le modèle principal est en lecture seule (aperçu uniquement). Pour le personnaliser, dupliquez-le via « Nouveau modèle… » ou importez un fichier .html. Les autres modèles s\'éditent normalement ; l\'enregistrement est automatique en revenant à l\'aperçu. Panneau Mots-clés à droite.',
    'quittance-export':
      'PDF, DOCX ou HTML pour le mois ou la période sélectionnée. « Exporter plusieurs… » reste disponible pour une plage manuelle distincte.',
    'batch-quittance-export':
      'Choisissez une plage Du/Au (intersectée avec la période de bail). Le modèle actuellement sélectionné dans l\'onglet Quittance est utilisé. Au-delà de 24 mois, l\'export peut être lent.',
    'quittance-mail':
      'EML + PDF : crée un fichier e-mail avec la quittance en pièce jointe (mise en forme conservée). mailto : ouvre votre webmail — le corps HTML est copié (collez avec Ctrl+V pour gras, italique, etc.) ; le lien mailto ne transmet que du texte brut avec sauts de ligne.',
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
