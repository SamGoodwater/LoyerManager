/**
 * Aide contextuelle : infobulles, popovers et navigation vers l'onglet Aide.
 */
(function (global) {
  'use strict';

  var showPanelFn = null;
  var openPopoverEl = null;
  var openTriggerEl = null;

  var HELP_LABELS = {
    'period-bar': 'Aide : choisir un mois ou une période',
    'period-status': 'Signification des couleurs de statut',
    'header-selection': 'Aide : mois actuellement consulté',
    'dash-period': 'Aide : période affichée sur le tableau de bord',
    'dash-kpis': 'Aide : chiffres clés en un coup d\'œil',
    'dash-month-stats': 'Aide : détail du mois sélectionné',
    'dash-report-export': 'Aide : imprimer ce bloc',
    'dash-report-full': 'Aide : rapport complet à imprimer',
    'dash-monthly-table': 'Aide : tableau mois par mois',
    'dash-payments-month': 'Aide : paiements du mois choisi',
    'dash-charts': 'Aide : graphique de synthèse',
    'dash-heatmap': 'Aide : calendrier coloré des mois',
    'dash-yearly': 'Aide : bilan année par année',
    'dash-month-modal': 'Aide : fenêtre détail d\'un mois',
    'payments-list': 'Aide : liste de tous les paiements',
    'payments-csv': 'Aide : importer un relevé bancaire',
    'payments-manual': 'Aide : ajouter un paiement à la main',
    'payments-demo-csv': 'Aide : fichier de démonstration',
    'settings-auto-save': 'Aide : enregistrement automatique',
    'settings-lease': 'Aide : dates et échéance du loyer',
    'settings-bailleur': 'Aide : vos coordonnées de propriétaire',
    'settings-locataire': 'Aide : coordonnées du locataire',
    'settings-signature': 'Aide : image de signature',
    'settings-emitters': 'Aide : reconnaissance des paiements à l\'import',
    'settings-prices': 'Aide : montants du loyer dans le temps',
    'settings-templates': 'Aide : modèles de quittance et de mail',
    'settings-mail': 'Aide : destinataires des e-mails',
    'settings-mail-oauth': 'Aide : connexion Gmail ou Outlook',
    'settings-mail-smtp': 'Aide : envoi par serveur mail classique',
    'settings-backup-json': 'Aide : sauvegarder ou restaurer vos données',
    'settings-data': 'Aide : clé d\'accès technique',
    'settings-account': 'Aide : votre compte utilisateur',
    'auth-passphrase': 'Aide : mot de passe de connexion',
    'auth-email': 'Aide : adresse e-mail de connexion',
    'auth-oauth-login': 'Aide : connexion Google ou Microsoft',
    'auth-backup-restore': 'Aide : restaurer une sauvegarde',
    'btn-delete-data': 'Aide : supprimer les données de loyer',
    'btn-delete-account': 'Aide : supprimer le compte',
    'btn-clear-smtp': 'Aide : effacer la configuration d\'envoi mail',
    'btn-test-smtp': 'Aide : tester la connexion au serveur mail',
    'payment-status': 'Aide : origine du paiement',
    'template-mode': 'Aide : aperçu ou modification du modèle',
    'placeholder-keywords': 'Aide : textes automatiques dans les modèles',
    'quittance-period': 'Aide : mois de la quittance',
    'quittance-edit': 'Aide : personnaliser le modèle',
    'quittance-export': 'Aide : télécharger la quittance',
    'batch-quittance-export': 'Aide : exporter plusieurs mois d\'un coup',
    'mail-period': 'Aide : mois du message e-mail',
    'mail-edit': 'Aide : personnaliser le mail',
    'quittance-mail': 'Aide : envoyer la quittance par e-mail',
    'history-activity-log': 'Aide : journal des actions',
    'history-refresh': 'Aide : actualiser le journal',
    'history-purge': 'Aide : effacer le journal',
    'history-filter': 'Aide : filtrer le journal',
    'history-retention': 'Aide : durée de conservation du journal',
    'privacy': 'Aide : confidentialité et données',
    'csv-import-modal': 'Aide : valider l\'import bancaire',
    'payment-form-modal': 'Aide : saisir ou modifier un paiement'
  };

  var TEXTS = {
    'period-bar':
      'Choisissez le mois à consulter avec les flèches, ou ouvrez « Période » pour sélectionner plusieurs mois d\'affilée. La frise colorée en dessous reprend les mêmes mois : un clic sélectionne, un survol affiche si le loyer est payé, partiel ou impayé.',
    'period-status':
      'Vert = loyer entièrement reçu. Bleu clair = trop-perçu. Jaune = paiement partiel. Rouge = rien ou presque reçu. Gris = échéance pas encore passée.',
    'dash-period':
      'Le mois ou la période choisi en haut de page filtre tous les tableaux et graphiques de cette page.',
    'dash-kpis':
      'Solde cumulé (avance ou dette), part des loyers bien encaissés, nombre de mois incomplets, et retard moyen de paiement le cas échéant.',
    'dash-month-stats':
      'Quand plusieurs mois sont sélectionnés, ce bloc détaille le mois sur lequel vous avez cliqué dans le calendrier coloré.',
    'dash-report-export':
      'Ouvre la fenêtre d\'impression pour ce bloc seul (indicateurs, tableau, paiements ou graphique selon l\'icône). Choisissez « Enregistrer au format PDF » pour obtenir un fichier.',
    'dash-report-full':
      'Imprime tous les blocs : indicateurs, détail par mois, paiements, graphique et récapitulatif par année (sans le calendrier coloré).',
    'dash-monthly-table':
      'Chaque ligne résume un mois : ce qui était dû, ce qui a été reçu, l\'écart et le solde cumulé. Cliquez une ligne pour la sélectionner. L\'icône crayon ouvre le détail du mois (liste des paiements et note personnelle). Une pastille 📝 indique qu\'une note existe.',
    'dash-payments-month':
      'Liste des paiements enregistrés pour le mois sélectionné. Si elle est vide, ajoutez des paiements dans l\'onglet Paiements (import bancaire ou saisie manuelle).',
    'dash-charts':
      'Graphique du mois ou de l\'année : trait = loyer attendu ; barres vertes = encaissements ; orange = remboursements ; rouge = manque ; bleu = trop-perçu ; tirets = solde cumulé. Les flèches changent d\'année.',
    'dash-month-modal':
      'Ouvrez cette fenêtre avec l\'icône crayon à gauche d\'un mois. Vous y voyez tous les paiements du mois, pouvez en ajouter ou modifier, et laisser une note interne (non incluse dans les quittances).',
    'dash-heatmap':
      'Chaque case est un mois, coloré selon l\'état du paiement. Survolez pour le détail, cliquez pour sélectionner ce mois dans les tableaux.',
    'dash-yearly':
      'Vue annuelle : total attendu, total reçu, écart et solde cumulé pour chaque année.',
    'header-selection':
      'Indique le mois actuellement consulté lorsque vous avez sélectionné une plage de plusieurs mois.',
    'template-mode':
      'Aperçu du mois : la quittance ou le mail est rempli avec vos vraies données. Édition du modèle : vous modifiez la mise en page ; l\'enregistrement se fait en revenant à l\'aperçu.',
    'placeholder-keywords':
      'Ces mots-clés (ex. nom du locataire, montant, période) sont remplacés automatiquement à l\'export. Cliquez sur un mot-clé pour l\'insérer dans le modèle.',
    'auth-oauth-login':
      'Connectez-vous avec Google ou Microsoft, sans mot de passe Loyer Manager. L\'adresse doit correspondre à votre compte, sauf lors de la toute première création.',
    'auth-email':
      'Adresse utilisée pour vous connecter à Loyer Manager.',
    'history-retention':
      'Durée de conservation du journal (24 mois par défaut). Mettez 0 pour ne jamais effacer automatiquement les anciennes entrées.',
    'history-purge':
      'Efface tout le journal. Action définitive : exportez d\'abord en CSV si vous souhaitez garder une trace.',
    'history-filter':
      'Affiche seulement certains types d\'événements : envoi de mail, brouillon, import bancaire, export de quittance…',
    'history-refresh':
      'Recharge la liste depuis le serveur, par exemple après un envoi de mail ou un import.',
    'btn-delete-account':
      'Supprime votre compte et toutes les données. Une sauvegarde vous est proposée avant confirmation.',
    'btn-delete-data':
      'Efface loyers, paiements et modèles personnalisés, sans supprimer votre compte. Une exportation est proposée au préalable.',
    'btn-clear-smtp':
      'Efface les paramètres d\'envoi mail enregistrés. Si Gmail ou Outlook est connecté, l\'envoi passera par ce compte.',
    'btn-test-smtp':
      'Vérifie que le serveur mail répond et accepte votre identifiant. Aucun e-mail n\'est envoyé. Laissez le mot de passe vide pour utiliser celui déjà enregistré.',
    'payment-status':
      'Indique d\'où vient le paiement : saisi à la main, importé depuis la banque, ou marqué comme vérifié. Cela n\'influence pas les calculs.',
    'payments-list':
      'Tous vos paiements. L\'icône crayon ouvre la fiche de modification. Le menu Type permet de changer rapidement virement, espèce, nature… Les montants négatifs correspondent à un remboursement au locataire.',
    'payments-csv':
      'Importez le fichier CSV exporté depuis votre banque, ou déposez-le n\'importe où sur la page. L\'application repère les encaissements du locataire grâce aux noms configurés dans Paramètres. Les doublons sont ignorés.',
    'payments-demo-csv':
      'Uniquement en mode démo : téléchargez un faux relevé bancaire, puis importez-le comme un vrai fichier CSV pour tester la sélection des lignes.',
    'payments-manual':
      'Ajoutez un paiement un par un : date, montant, type (virement, espèce…). Un montant négatif = remboursement au locataire.',
    'settings-auto-save':
      'Vos paramètres se sauvegardent automatiquement toutes les 30 secondes. Le bouton Enregistrer en bas à droite force une sauvegarde immédiate.',
    'settings-lease':
      'Date de début du bail et jour habituel de paiement du loyer (souvent le 1er du mois). Sert au calcul des retards et des statuts.',
    'settings-bailleur':
      'Vos coordonnées de propriétaire. Elles apparaissent sur les quittances et dans les e-mails.',
    'settings-locataire':
      'Coordonnées du locataire, reprises sur les quittances et les e-mails.',
    'settings-signature':
      'Image de votre signature (photo ou scan, max. 5 Mo). Elle est placée en bas de la quittance. Vous pouvez revenir à la signature par défaut.',
    'settings-emitters':
      'Pour l\'import bancaire : le nom du locataire tel que vous le connaissez, puis les mots à chercher dans le libellé de la banque (un par ligne, ex. DUPONT ou LOYER).',
    'settings-prices':
      'Montant du loyer et des charges, avec la date à partir de laquelle chaque palier s\'applique. Le total sert aux calculs du tableau de bord et aux quittances.',
    'settings-mail':
      'Adresses e-mail en copie (À, CC, CCI) et texte de signature pour vos messages.',
    'settings-templates':
      'Modèles de quittance et de mail enregistrés sur le serveur. Les modèles « complet » et « court » sont fournis prêts à l\'emploi ; dupliquez-les pour créer votre propre version.',
    'settings-mail-oauth':
      'Connectez Gmail ou Outlook pour envoyer un e-mail avec la quittance en pièce jointe, ou l\'enregistrer en brouillon dans votre messagerie.',
    'settings-mail-smtp':
      'Envoi direct par votre hébergeur mail (OVH, Free, Orange…), sans passer par Gmail ou Outlook. Port 587 avec sécurité TLS est le plus courant.',
    'settings-data':
      'Clé technique réservée aux cas particuliers (première installation ou configuration avancée). En usage normal, connectez-vous avec votre compte.',
    'settings-backup-json':
      'Télécharge ou restaure un fichier contenant vos paramètres et paiements. Vous pouvez aussi déposer un fichier .json sur la page. Pour une sauvegarde complète chiffrée, utilisez Mon compte.',
    'settings-account':
      'Déconnexion, changement de mot de passe, export ou import du profil complet, suppression des données ou du compte.',
    'auth-passphrase':
      'Mot de passe de connexion à Loyer Manager. Privilégiez une phrase longue et facile à retenir (8 caractères minimum). Distinct du mot de passe de sauvegarde.',
    'auth-backup-restore':
      'Restaure une sauvegarde exportée depuis Mon compte. Saisissez le mot de passe de sauvegarde choisi lors de l\'export, puis créez ou reconnectez votre compte.',
    'mail-period':
      'Le mois ou la période choisi en haut de page détermine le contenu du mail et de la quittance jointe.',
    'mail-edit':
      'Personnalisez l\'objet et le corps du message. Les mots-clés à droite (période, montant, locataire…) sont remplacés automatiquement.',
    'quittance-period':
      'Le mois ou la période choisi en haut de page détermine la quittance affichée et exportée.',
    'quittance-edit':
      'Les modèles de base sont protégés : dupliquez-les pour créer le vôtre. L\'enregistrement se fait en revenant à l\'aperçu.',
    'quittance-export':
      'PDF pour envoyer ou imprimer, Word (DOCX) pour modifier, HTML pour une page web. « Exporter plusieurs… » génère un fichier pour toute une plage de mois.',
    'batch-quittance-export':
      'Choisissez une plage de mois : un seul fichier PDF, Word ou HTML sera créé avec une quittance par mois. Au-delà de 24 mois, l\'opération peut prendre du temps.',
    'quittance-mail':
      'Brouillon : prépare le mail dans Gmail ou Outlook pour relecture. Envoyer : envoi immédiat. EML + PDF : fichier à ouvrir dans votre messagerie.',
    'history-activity-log':
      'Retrace les envois de mail, imports bancaires et exports de quittances. Filtrez, exportez en CSV ou effacez le journal.',
    'privacy':
      'Vos données (loyers, paiements, journal) restent sur votre serveur. Pas de publicité ni de suivi. Cookie de session uniquement pendant votre connexion.',
    'csv-import-modal':
      'Cochez les lignes à enregistrer. Les doublons déjà présents apparaissent grisés. Validez avec « Importer la sélection ».',
    'payment-form-modal':
      'Date et montant du paiement (négatif = remboursement). Choisissez le type : virement, espèce, nature… L\'émetteur correspond au nom du locataire configuré dans Paramètres.'
  };

  /** Échappe texte popover aide. */
  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Retourne TEXTS[id] pour popover. */
  function getText(id) {
    return TEXTS[id] || '';
  }

  /** Ferme popover ouvert et reset aria-expanded. */
  function closePopover() {
    var trigger = openTriggerEl;
    if (openPopoverEl && openPopoverEl.parentNode) {
      openPopoverEl.parentNode.removeChild(openPopoverEl);
    }
    if (trigger) {
      trigger.setAttribute('aria-expanded', 'false');
      trigger.removeAttribute('aria-controls');
      if (typeof trigger.focus === 'function') trigger.focus();
    }
    openPopoverEl = null;
    openTriggerEl = null;
  }

  /** Positionne popover sous le trigger (viewport aware). */
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

  /** Crée et affiche popover pour .help-trigger. */
  function openPopover(trigger, textOverride) {
    var id = trigger.getAttribute('data-help-id');
    var text = textOverride || trigger.getAttribute('data-help') || getText(id);
    if (!text) return;

    closePopover();

    var popover = document.createElement('div');
    popover.className = 'help-popover';
    popover.setAttribute('role', 'dialog');
    popover.setAttribute('aria-modal', 'false');
    popover.setAttribute('aria-label', 'Aide contextuelle');
    popover.id = 'help-popover-' + (id || 'custom');
    popover.innerHTML =
      '<p class="help-popover-text">' + escapeHtml(text) + '</p>' +
      '<button type="button" class="help-popover-close" aria-label="Fermer l\'aide">×</button>';

    document.body.appendChild(popover);
    positionPopover(popover, trigger);

    trigger.setAttribute('aria-expanded', 'true');
    trigger.setAttribute('aria-controls', popover.id);
    openPopoverEl = popover;
    openTriggerEl = trigger;

    var closeBtn = popover.querySelector('.help-popover-close');
    closeBtn.addEventListener('click', closePopover);
    closeBtn.focus();
  }

  /** Génère HTML bouton ? (usage dynamique rare). */
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

  /** Marque triggers déjà bound (data-help-bound). */
  function bindHelpTriggers(root) {
    (root || document).querySelectorAll('.help-trigger:not([data-help-bound])').forEach(function (btn) {
      btn.setAttribute('data-help-bound', '1');
      var id = btn.getAttribute('data-help-id');
      if (id && HELP_LABELS[id]) {
        btn.setAttribute('aria-label', HELP_LABELS[id]);
      } else if (!btn.getAttribute('aria-label')) {
        btn.setAttribute('aria-label', 'Afficher l\'aide');
      }
    });
  }

  /** aria-selected sur onglets navigation. */
  function updateTabAccessibility(activePanelId) {
    document.querySelectorAll('nav.tabs [role="tab"]').forEach(function (tab) {
      var selected = tab.getAttribute('data-panel') === activePanelId;
      tab.setAttribute('aria-selected', selected ? 'true' : 'false');
      tab.tabIndex = selected ? 0 : -1;
    });
  }

  /** Délégation clic ? légende statuts, Escape, clavier inline. */
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

      var statusBadge = e.target.closest('.period-legend-badge[data-status-tip]');
      if (statusBadge) {
        e.preventDefault();
        e.stopPropagation();
        if (openTriggerEl === statusBadge) closePopover();
        else openPopover(statusBadge, statusBadge.getAttribute('data-status-tip'));
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
      if (e.key === 'Enter' || e.key === ' ') {
        var inline = e.target.closest('.help-inline-trigger');
        if (inline) {
          e.preventDefault();
          if (openTriggerEl === inline) closePopover();
          else openPopover(inline);
        }
      }
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

  /** Bascule onglet Aide et scroll vers section. */
  function openHelpPanel(sectionId) {
    if (showPanelFn) showPanelFn('panel-help');
    window.setTimeout(function () {
      var el = sectionId ? document.getElementById(sectionId) : null;
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }, 150);
  }

  /** Init aide : bind triggers + navigation aide. */
  function init(showPanel) {
    showPanelFn = showPanel;
    bindHelpTriggers();
    bindEvents();
  }

  /** Re-bind triggers après render DOM dynamique. */
  function refresh() {
    bindHelpTriggers();
  }

  global.LoyerHelp = {
    TEXTS: TEXTS,
    HELP_LABELS: HELP_LABELS,
    init: init,
    refresh: refresh,
    closePopover: closePopover,
    helpTriggerHtml: helpTriggerHtml,
    updateTabAccessibility: updateTabAccessibility,
    openHelpPanel: openHelpPanel
  };
})(window);
