/**
 * Chargement, enregistrement et remplissage des modèles HTML.
 */
(function (global) {
  'use strict';

  var RAW_HTML_KEYS = ['signatureHtml'];

  var SHARED_PLACEHOLDER_ITEMS = [
    { key: '{{bailleur.name}}', label: 'Nom du bailleur' },
    { key: '{{bailleur.street}}', label: 'Rue du bailleur' },
    { key: '{{bailleur.postalCode}}', label: 'Code postal bailleur' },
    { key: '{{bailleur.city}}', label: 'Ville du bailleur' },
    { key: '{{locataire.name}}', label: 'Nom du locataire' },
    { key: '{{locataire.street}}', label: 'Rue du locataire' },
    { key: '{{locataire.postalCode}}', label: 'Code postal locataire' },
    { key: '{{locataire.city}}', label: 'Ville du locataire' },
    { key: '{{moisText}}', label: 'Mois en toutes lettres' },
    { key: '{{mois}}', label: 'Mois (nom)' },
    { key: '{{annee}}', label: 'Année' },
    { key: '{{moisDebutText}}', label: 'Premier mois sélectionné' },
    { key: '{{moisFinText}}', label: 'Dernier mois sélectionné' },
    { key: '{{moisDebut}}', label: 'Mois début (nom)' },
    { key: '{{moisFin}}', label: 'Mois fin (nom)' },
    { key: '{{anneeDebut}}', label: 'Année début' },
    { key: '{{anneeFin}}', label: 'Année fin' },
    { key: '{{periodeText}}', label: 'Période (mois ou plage)' },
    { key: '{{periode}}', label: 'Alias période' },
    { key: '{{periodeNbMois}}', label: 'Nombre de mois (plage)' },
    { key: '{{texteQuittancesJointes}}', label: 'Phrase pièce jointe (mail)' },
    { key: '{{paiement}}', label: 'Montant reçu (formaté)' },
    { key: '{{attendu}}', label: 'Montant attendu (formaté)' },
    { key: '{{date}}', label: 'Début de période' },
    { key: '{{datePlusUnMois}}', label: 'Fin de période' },
    { key: '{{listePaiements}}', label: 'Liste des virements (HTML/texte)' },
    { key: '{{texteSolde}}', label: 'Texte solde / reste dû' },
    { key: '{{dateDuJour}}', label: 'Date du jour' },
    { key: '{{lieu}}', label: 'Lieu (ville bailleur)' },
    { key: '{{signatureHtml}}', label: 'Signature (image HTML)' },
    { key: '{{signature}}', label: 'Signature texte (paramètres)' }
  ];

  var PLACEHOLDER_CATALOG = {
    quittance: SHARED_PLACEHOLDER_ITEMS,
    mail: SHARED_PLACEHOLDER_ITEMS
  };

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getNestedValue(data, keyPath) {
    var parts = keyPath.split('.');
    var val = data;
    for (var i = 0; i < parts.length; i++) {
      val = val && val[parts[i]] !== undefined ? val[parts[i]] : '';
    }
    return val;
  }

  function resolveTemplateValue(data, key) {
    var val = getNestedValue(data, key);
    if ((key === 'bailleur' || key === 'locataire') && val && typeof val === 'object' && val.name !== undefined) {
      return val.name;
    }
    return val;
  }

  function fillTemplate(template, data) {
    if (!template) return '';
    var html = template.replace(/\{\{signatureHtml\}\}/g, data.signatureHtml || '');
    return html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, function (_, key) {
      if (key === 'signatureHtml') return '';
      var val = resolveTemplateValue(data, key);
      if (RAW_HTML_KEYS.indexOf(key) !== -1) return val || '';
      return escapeHtml(val);
    });
  }

  function resolveDefaultId(type, settings) {
    if (global.LoyerTemplateManager && settings) {
      return global.LoyerTemplateManager.getDefaultId(settings, type);
    }
    return global.LoyerTemplateManager ? global.LoyerTemplateManager.LEGACY_ID : 'principal';
  }

  function getDefaultContent(type, part) {
    part = part || 'body';
    if (global.LoyerTemplateManager) {
      return global.LoyerTemplateManager.getDefaultContent(type, part);
    }
    return '';
  }

  function loadTemplate(type, id, part) {
    part = part || 'body';
    if (global.LoyerTemplateManager) {
      return global.LoyerTemplateManager.load(type, id, part);
    }
    return Promise.resolve(getDefaultContent(type, part));
  }

  function saveTemplate(type, id, content, subject) {
    if (!global.LoyerTemplateManager) {
      return Promise.reject(new Error('Gestionnaire de modèles indisponible.'));
    }
    if (type === 'mail') {
      return global.LoyerTemplateManager.saveMail(id, content, subject);
    }
    return global.LoyerTemplateManager.saveQuittance(id, content);
  }

  function resetTemplate(type, id) {
    var content = getDefaultContent(type, 'body');
    if (type === 'mail') {
      var subject = getDefaultContent('mail', 'subject');
      return saveTemplate('mail', id, content, subject).then(function () {
        return { body: content, subject: subject };
      });
    }
    return saveTemplate('quittance', id, content).then(function () {
      return content;
    });
  }

  function buildMailData(data, year, month, periodCtx) {
    var settings = data.settings || data;
    periodCtx = periodCtx || {
      isRange: false,
      fromYear: year,
      fromMonth: month,
      toYear: year,
      toMonth: month
    };
    var base = global.LoyerCalc
      ? global.LoyerCalc.buildQuittanceData(data, year, month)
      : {
          bailleur: settings.bailleur || {},
          locataire: settings.locataire || {},
          moisText: global.LoyerCalc ? global.LoyerCalc.formatMonthLong(year, month) : '',
          mois: global.LoyerCalc ? global.LoyerCalc.MONTH_NAMES[month - 1] : '',
          annee: String(year)
        };
    base.signature = (settings.mail && settings.mail.signature) || '';

    var fromY = periodCtx.fromYear;
    var fromM = periodCtx.fromMonth;
    var toY = periodCtx.toYear;
    var toM = periodCtx.toMonth;
    base.moisDebutText = global.LoyerCalc.formatMonthLong(fromY, fromM);
    base.moisFinText = global.LoyerCalc.formatMonthLong(toY, toM);
    base.moisDebut = global.LoyerCalc.MONTH_NAMES[fromM - 1];
    base.moisFin = global.LoyerCalc.MONTH_NAMES[toM - 1];
    base.anneeDebut = String(fromY);
    base.anneeFin = String(toY);

    if (periodCtx.isRange) {
      var months = global.LoyerCalc.listMonthsInRange(fromY, fromM, toY, toM, data);
      base.periodeNbMois = String(months.length);
      base.periodeText = base.moisDebutText + ' → ' + base.moisFinText;
      base.texteQuittancesJointes =
        'les quittances de loyer pour la période du ' +
        base.moisDebutText +
        ' au ' +
        base.moisFinText +
        ' (' +
        months.length +
        ' mois)';
    } else {
      base.periodeNbMois = '1';
      base.periodeText = base.moisText;
      base.moisDebutText = base.moisText;
      base.moisFinText = base.moisText;
      base.moisDebut = base.mois;
      base.moisFin = base.mois;
      base.anneeDebut = base.annee;
      base.anneeFin = base.annee;
      base.texteQuittancesJointes = 'la quittance de loyer pour ' + base.moisText;
    }
    base.periode = base.periodeText;
    return base;
  }

  function loadFilledMail(data, year, month, mailId, periodCtx) {
    var settings = data.settings || data;
    mailId = mailId || resolveDefaultId('mail', settings);
    return Promise.all([loadTemplate('mail', mailId, 'subject'), loadTemplate('mail', mailId, 'body')]).then(
      function (parts) {
        var subjectTpl = parts[0];
        var bodyTpl = parts[1];
        var fillData = buildMailData(data, year, month, periodCtx);
        return {
          subject: fillTemplate(subjectTpl, fillData).replace(/\s+/g, ' ').trim(),
          bodyHtml: fillTemplate(bodyTpl, fillData),
          data: fillData
        };
      }
    );
  }

  function htmlToPlainText(html) {
    if (!html) return '';
    var div = document.createElement('div');
    div.innerHTML = html;

    var blockTags = {
      P: 1,
      DIV: 1,
      H1: 1,
      H2: 1,
      H3: 1,
      H4: 1,
      LI: 1,
      TR: 1,
      BLOCKQUOTE: 1
    };

    function walk(node, parts) {
      if (!node) return;
      if (node.nodeType === 3) {
        parts.push(node.textContent);
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName;
      if (tag === 'BR') {
        parts.push('\n');
        return;
      }
      if (tag === 'STRONG' || tag === 'B') {
        parts.push('**');
        for (var i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], parts);
        parts.push('**');
        return;
      }
      if (tag === 'EM' || tag === 'I') {
        parts.push('_');
        for (var j = 0; j < node.childNodes.length; j++) walk(node.childNodes[j], parts);
        parts.push('_');
        return;
      }
      for (var k = 0; k < node.childNodes.length; k++) {
        walk(node.childNodes[k], parts);
      }
      if (blockTags[tag]) {
        parts.push('\n\n');
      }
    }

    var chunks = [];
    walk(div, chunks);
    return chunks
      .join('')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n[ \t]+/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function getPlaceholderCatalog(type) {
    if (type === 'quittance' || type === 'mail') {
      return SHARED_PLACEHOLDER_ITEMS.slice();
    }
    return PLACEHOLDER_CATALOG[type] ? PLACEHOLDER_CATALOG[type].slice() : [];
  }

  global.LoyerTemplates = {
    fillTemplate: fillTemplate,
    loadTemplate: loadTemplate,
    saveTemplate: saveTemplate,
    resetTemplate: resetTemplate,
    getDefaultContent: getDefaultContent,
    resolveDefaultId: resolveDefaultId,
    buildMailData: buildMailData,
    loadFilledMail: loadFilledMail,
    htmlToPlainText: htmlToPlainText,
    getPlaceholderCatalog: getPlaceholderCatalog,
    PLACEHOLDER_CATALOG: PLACEHOLDER_CATALOG
  };
})(window);
