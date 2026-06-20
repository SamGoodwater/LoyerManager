/**
 * Chargement, enregistrement et remplissage des modèles HTML.
 */
(function (global) {
  'use strict';

  var RAW_HTML_KEYS = ['signatureHtml'];

  var PLACEHOLDER_CATALOG = {
    quittance: [
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
      { key: '{{paiement}}', label: 'Montant reçu (formaté)' },
      { key: '{{attendu}}', label: 'Montant attendu (formaté)' },
      { key: '{{date}}', label: 'Début de période' },
      { key: '{{datePlusUnMois}}', label: 'Fin de période' },
      { key: '{{listePaiements}}', label: 'Liste des virements (HTML/texte)' },
      { key: '{{texteSolde}}', label: 'Texte solde / reste dû' },
      { key: '{{dateDuJour}}', label: 'Date du jour' },
      { key: '{{lieu}}', label: 'Lieu (ville bailleur)' },
      { key: '{{signatureHtml}}', label: 'Signature (image HTML)' }
    ],
    mail: [
      { key: '{{mois}}', label: 'Mois' },
      { key: '{{moisText}}', label: 'Mois en toutes lettres' },
      { key: '{{annee}}', label: 'Année' },
      { key: '{{bailleur}}', label: 'Nom du bailleur' },
      { key: '{{locataire}}', label: 'Nom du locataire' },
      { key: '{{signature}}', label: 'Signature texte (paramètres)' }
    ]
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

  function fillTemplate(template, data) {
    if (!template) return '';
    var html = template.replace(/\{\{signatureHtml\}\}/g, data.signatureHtml || '');
    return html.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, function (_, key) {
      if (key === 'signatureHtml') return '';
      var val = getNestedValue(data, key);
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

  function buildMailData(settings, year, month) {
    var bailleurName = settings.bailleur && settings.bailleur.name ? settings.bailleur.name : '';
    var locataireName = settings.locataire && settings.locataire.name ? settings.locataire.name : '';
    var moisText = global.LoyerCalc ? global.LoyerCalc.formatMonthLong(year, month) : '';
    var mois = global.LoyerCalc ? global.LoyerCalc.MONTH_NAMES[month - 1] : '';
    return {
      mois: mois,
      moisText: moisText,
      annee: String(year),
      bailleur: bailleurName,
      locataire: locataireName,
      signature: (settings.mail && settings.mail.signature) || ''
    };
  }

  function loadFilledMail(settings, year, month, mailId) {
    mailId = mailId || resolveDefaultId('mail', settings);
    return Promise.all([loadTemplate('mail', mailId, 'subject'), loadTemplate('mail', mailId, 'body')]).then(
      function (parts) {
        var subjectTpl = parts[0];
        var bodyTpl = parts[1];
        var data = buildMailData(settings, year, month);
        return {
          subject: fillTemplate(subjectTpl, data).replace(/\s+/g, ' ').trim(),
          bodyHtml: fillTemplate(bodyTpl, data),
          data: data
        };
      }
    );
  }

  function htmlToPlainText(html) {
    var div = document.createElement('div');
    div.innerHTML = html || '';
    return (div.textContent || div.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
  }

  function getPlaceholderCatalog(type) {
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
