/**
 * Aide contextuelle : infobulles, popovers et navigation vers l'onglet Aide.
 */
(function (global) {
  'use strict';

  var showPanelFn = null;
  var openPopoverEl = null;
  var openTriggerEl = null;

  var TEXTS = {
    'period-bar':
      'Sélection partagée entre Tableau de bord, Quittance et Mail. Flèches = mois précédent/suivant. Bouton « Période » = plage Du→Au (« Mois unique » pour revenir). Timeline : clic sur un mois ; en mode période, le 1er clic fixe la fin, les suivants ajustent le début ou la fin selon la position. Survol = détail du mois.',
    'period-status':
      'Statuts affichés sur la timeline et la heatmap : Payé (loyer complet), En avance (trop-perçu), Partiel, Impayé, En cours (échéance pas encore dépassée). Survolez un badge ou un mois pour le détail.',
    'dash-period':
      'Même barre de période que ci-dessus (sous le menu). Le mois choisi filtre les tableaux et graphiques ci-dessous. En mode période, le détail virements et le récap mensuel suivent le mois cliqué dans la heatmap.',
    'dash-kpis':
      'Indicateurs de l\'année en cours : solde cumulé (avance ou dette), taux de recouvrement, nombre de mois partiels ou impayés, retard moyen de paiement.',
    'dash-month-stats':
      'En mode période (plage Du→Au), détail du mois sélectionné dans la heatmap : statut, montants attendus/reçus et solde pour ce mois.',
    'dash-heatmap':
      'Chaque case = un mois coloré selon le statut (payé, partiel, impayé…). Survol = détail ; clic = sélectionner ce mois pour le tableau et les virements (la plage reste active).',
    'dash-print':
      'Imprime le tableau de bord (KPIs, tableaux, heatmap). Les graphiques sont masqués à l\'impression car ils ne s\'exportent pas bien en papier.',
    'dash-monthly-table':
      'Pour chaque mois : statut (payé, partiel, impayé…), total dû (loyer + charges), reçu, différence et solde cumulé. Survolez la colonne « Total dû » pour le détail loyer/charges.',
    'dash-payments-month':
      'Virements reçus pour le mois sélectionné. Si la liste est vide, vérifiez l\'onglet Virements (import CSV ou saisie manuelle).',
    'dash-charts':
      'Graphique empilé : part reçue vs reste dû par mois. Courbe de solde cumulé : vert = avance locataire, rouge = dette. Les flèches ‹ › changent l\'année du graphique annuel.',
    'dash-balance-chart':
      'Courbe du solde cumulé sur toute la période du bail. Utile pour visualiser l\'évolution de la dette ou de l\'avance locataire dans le temps.',
    'header-selection':
      'En mode période, indique le mois « focus » cliqué dans la heatmap ou la timeline. Les tableaux de détail et virements du tableau de bord suivent ce mois.',
    'template-mode':
      'Aperçu du mois : rendu avec les données réelles du mois sélectionné. Édition du modèle : modifie le HTML (quittance) ou le corps/objet (mail) ; enregistrement automatique en revenant à l\'aperçu.',
    'placeholder-keywords':
      'Variables remplacées à l\'export ({{paiement}}, {{bailleur.name}}, {{periodeText}}…). Cliquez un mot-clé pour l\'insérer à la position du curseur dans l\'éditeur.',
    'auth-oauth-login':
      'Connexion sans passphrase : utilise votre compte Google ou Microsoft existant. Le compte doit correspondre à l\'e-mail enregistré sur cette instance (sauf première création de compte).',
    'auth-email':
      'Adresse e-mail de connexion à Loyer Manager. Elle sert d\'identifiant pour le compte local et les messages d\'erreur.',
    'history-retention':
      'Durée de conservation du journal (défaut 24 mois). 0 = illimité. Les entrées plus anciennes sont supprimées automatiquement lors de l\'enregistrement.',
    'history-purge':
      'Efface tout le journal d\'activité — irréversible. Préférez l\'export CSV avant purge pour conserver une trace (RGPD).',
    'history-filter':
      'Filtre la liste par type d\'événement : mail envoyé, brouillon, import CSV, export PDF/DOCX.',
    'history-refresh':
      'Recharge la liste depuis le serveur. Utile après un envoi mail ou import CSV.',
    'btn-delete-account':
      'Supprime le compte d\'accès et réinitialise toutes les données. Une sauvegarde chiffrée (mot de passe de sauvegarde) vous est proposée avant suppression.',
    'btn-delete-data':
      'Efface loyers, virements et modèles personnalisés. Une exportation complète vous est proposée au préalable. Le compte utilisateur est conservé.',
    'btn-clear-smtp':
      'Efface la configuration SMTP enregistrée (mot de passe chiffré inclus). L\'envoi passera par OAuth si connecté, sinon il faudra reconfigurer.',
    'btn-test-smtp':
      'Vérifie la connexion au serveur SMTP et l\'authentification avec les valeurs du formulaire (sans envoyer de mail). Mot de passe vide = mot de passe déjà enregistré.',
    'payment-status':
      'Manuel = saisi à la main. Importé = détecté via CSV. Vérifié = marqué comme contrôlé. Le statut n\'affecte pas les calculs.',
    'dash-yearly':
      'Récapitulatif année par année : total dû (loyer + charges), reçu, différence et solde cumulé — utile pour faire le point sur une année complète.',
    'payments-list':
      'Tous vos virements enregistrés. Modifiez ou supprimez une ligne via la colonne Actions. Le statut indique l\'origine (import CSV ou saisie manuelle).',
    'payments-csv':
      'Importez un CSV exporté depuis votre banque (relevé de compte), ou glissez-déposez le fichier n\'importe où sur la page. L\'application repère les virements du locataire grâce aux émetteurs configurés. Les doublons sont exclus.',
    'payments-demo-csv':
      'En mode démonstration uniquement : téléchargez le relevé bancaire fictif, puis importez-le comme un export banque. Environ une dizaine de virements locataire seront proposés à l\'insertion (mai 2026 et mois suivants absents des données initiales). Les lignes déjà enregistrées apparaissent comme doublons ; salaire, assurance et autres opérations sont ignorées.',
    'payments-manual':
      'Ajoutez un virement un par un si vous n\'avez pas de fichier CSV, ou pour corriger une saisie.',
    'settings-auto-save':
      'Les paramètres (hors SMTP et Mon compte) sont enregistrés automatiquement toutes les 30 secondes après modification, à la sortie de l\'onglet Paramètres et avant fermeture de la page. Le bouton flottant Enregistrer force une sauvegarde immédiate.',
    'settings-lease':
      'Date de début du bail et jour habituel du virement (souvent le 1er, 5 ou 10). Ces valeurs servent aux calculs du tableau de bord et aux statuts « en cours » / retard.',
    'settings-bailleur':
      'Vos coordonnées en tant que propriétaire. Elles apparaissent sur la quittance et dans les mails via les mots-clés {{bailleur.*}}.',
    'settings-locataire':
      'Coordonnées du locataire. Elles apparaissent sur la quittance et dans les mails via les mots-clés {{locataire.*}}.',
    'settings-signature':
      'Scan ou photo de votre signature (PNG, JPG, WebP ou GIF, max. 5 Mo). Placée en bas de la quittance (mot-clé {{signatureHtml}}). Vous pouvez restaurer la signature par défaut.',
    'settings-emitters':
      'Pour l\'import CSV : nom du locataire tel qu\'affiché dans l\'app, puis motifs à chercher dans le libellé bancaire (un par ligne, ex. DUPONT ou LOYER). La référence bancaire extraite évite les doublons.',
    'settings-prices':
      'Loyer hors charges et charges locatives par palier, avec date d\'application. Le total (loyer + charges) détermine le montant attendu chaque mois. Les quittances détaillent cette répartition (cf. service-public.fr/particuliers/vosdroits/R31936).',
    'settings-mail':
      'Destinataires des e-mails (À, CC, CCI) et signature texte (mot-clé {{signature}}). Le corps et l\'objet se modifient dans l\'onglet Mail.',
    'settings-templates':
      'Modèles enregistrés sur le serveur. Les modèles <strong>complet</strong> et <strong>court</strong> sont fournis en lecture seule (aperçu et export). Dupliquez-les via « + Nouveau modèle » ou importez un fichier pour créer une variante. Édition dans les onglets Quittance et Mail.',
    'settings-mail-oauth':
      'Connectez Gmail ou Outlook pour envoyer un mail avec la quittance PDF jointe, ou l\'enregistrer en brouillon dans votre messagerie. Si le compte était connecté avant une mise à jour, déconnectez puis reconnectez pour activer les brouillons. Connexion mail distincte de votre compte Loyer Manager.',
    'settings-mail-smtp':
      'Alternative sans OAuth : serveur SMTP (OVH, Free, Orange…). Port 587 + TLS est le cas le plus courant. Mot de passe SMTP chiffré sur le serveur. Pas de brouillon dans la boîte mail — utilisez EML + PDF. Si Gmail/Outlook OAuth est connecté, OAuth est prioritaire à l\'envoi.',
    'settings-data':
      'Clé d\'accès technique (legacy) : affichée uniquement si aucun compte utilisateur n\'existe encore ou si l\'administrateur l\'a configurée. Une fois connecté via login.html, la session PHP protège l\'API.',
    'settings-backup-json':
      'Exporte ou importe le fichier <code>loyer-data.json</code> (paramètres, virements, registre des modèles). L\'import vérifie le format puis affiche un résumé avant remplacement. Les sauvegardes chiffrées (export profil v2) passent par <strong>Mon compte</strong>. Glisser-déposer un <code>.json</code> sur la page fonctionne aussi.',
    'settings-account':
      'Déconnexion, changement de passphrase (compte local), export/import du profil complet (JSON métier + OAuth mail, SMTP, historique SQLite), suppression des données ou du compte utilisateur.',
    'auth-passphrase':
      'Votre secret de connexion, idéalement une phrase longue et mémorable (plusieurs mots). Privilégiez la longueur plutôt que la complexité : majuscule, chiffre ou caractère spécial ne sont pas obligatoires. Minimum 8 caractères. Distinct du mot de passe de sauvegarde utilisé pour chiffrer les exports.',
    'auth-backup-restore':
      'Importe une sauvegarde exportée depuis Mon compte (format v2 chiffré). Saisissez le mot de passe de sauvegarde choisi à l\'export, puis créez votre compte (local ou Google/Microsoft). L\'identité OAuth prouve qui vous êtes ; le mot de passe de sauvegarde protège le fichier volé. Les tokens OAuth mail/SMTP ne sont restaurés que si le serveur utilise la même encryption_key.',
    'mail-period':
      'Mois ou période via la barre sous le menu (timeline incluse). En plage, le mail utilise {{periodeText}} et le PDF joint contient toutes les quittances de la période.',
    'mail-edit':
      'Mots-clés : {{periodeText}}, {{moisDebutText}}, {{moisFinText}}, {{texteQuittancesJointes}}, {{paiement}}, etc. En plage, {{periodeText}} affiche « janvier 2025 → juin 2025 ». Panneau Mots-clés à droite en mode édition.',
    'quittance-period':
      'Mois ou période via la barre sous le menu. En plage, l\'aperçu et les exports PDF/DOCX/HTML génèrent une quittance par mois.',
    'quittance-edit':
      'Les modèles complet et court sont en lecture seule. Dupliquez-les via « Nouveau modèle… » ou importez un .html. Les modèles personnalisés s\'éditent normalement ; enregistrement automatique en revenant à l\'aperçu. Panneau Mots-clés à droite.',
    'quittance-export':
      'PDF (envoi courant), DOCX (Word), HTML (page web) pour le mois ou la période sélectionnée. « Exporter plusieurs… » ouvre une plage manuelle distincte.',
    'batch-quittance-export':
      'Plage Du/Au (intersectée avec la période de bail). Le modèle sélectionné dans l\'onglet Quittance est utilisé. Au-delà de 24 mois, l\'export peut être lent.',
    'quittance-mail':
      'Brouillon : mail + PDF dans Gmail/Outlook (relecture avant envoi). Envoyer : envoi immédiat (OAuth ou SMTP). EML + PDF : fichier à ouvrir dans votre messagerie. mailto : ouvre le client mail sans pièce jointe automatique.',
    'history-activity-log':
      'Journal : mails envoyés, brouillons créés, imports CSV, exports PDF/DOCX. Filtrez par type, exportez en CSV ou purgez (RGPD). Conservation réglable (défaut 24 mois, 0 = illimité).',
    'privacy':
      'Données : loyers, journal d\'activité, tokens OAuth chiffrés. Pas de publicité ni de tracking. Cookie de session PHP à la connexion. Export ou purge depuis Historique et Mon compte.',
    'csv-import-modal':
      'Cochez les virements à importer. Les doublons (même référence bancaire ou montant+date) sont grisés. « Tout sélectionner » ignore les doublons. Validez avec « Importer la sélection ».',
    'payment-form-modal':
      'Date et montant reçus. L\'émetteur doit correspondre à un nom configuré dans Paramètres. Libellé et référence bancaire optionnels ; la référence évite les doublons à l\'import CSV.'
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
    if (openPopoverEl && openPopoverEl.parentNode) {
      openPopoverEl.parentNode.removeChild(openPopoverEl);
    }
    if (openTriggerEl) {
      openTriggerEl.setAttribute('aria-expanded', 'false');
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
      if (!btn.getAttribute('aria-label') && btn.getAttribute('data-help-id')) {
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
    init: init,
    refresh: refresh,
    closePopover: closePopover,
    helpTriggerHtml: helpTriggerHtml,
    updateTabAccessibility: updateTabAccessibility,
    openHelpPanel: openHelpPanel
  };
})(window);
