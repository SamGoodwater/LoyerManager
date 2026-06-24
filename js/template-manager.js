/**
 * Bibliothèque de modèles quittance / mail (multi-fichiers + registre JSON).
 */
(function (global) {
  'use strict';

  var SYSTEM_ID = '_system';
  var SYSTEM_LABEL = 'Modèle par défaut (système)';
  /** @deprecated Ancien id — migré vers complet */
  var LEGACY_ID = 'principal';
  var COMPLET_ID = 'complet';
  var COURT_ID = 'court';
  var DEFAULT_PROTECTED_ID = COMPLET_ID;

  var PROTECTED_NAMES = {
    complet: 'Modèle complet',
    court: 'Modèle court',
    principal: 'Modèle complet'
  };

  var PROTECTED_IDS = [COMPLET_ID, COURT_ID, LEGACY_ID];

  /** Normalise chaîne en identifiant fichier. */
  function slugify(name) {
    var s = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!s || s === SYSTEM_ID || PROTECTED_IDS.indexOf(s) !== -1) {
      s = 'modele-' + Date.now();
    }
    return s;
  }

  /** True si id réservé système (_system). */
  function isSystemId(id) {
    return id === SYSTEM_ID;
  }

  /** True si modèle de base (complet, court ou legacy principal) — lecture seule, non supprimable. */
  function isProtectedId(id) {
    return PROTECTED_IDS.indexOf(id) !== -1;
  }

  /** Libellé affiché d'un modèle protégé. */
  function getProtectedName(id) {
    if (id === LEGACY_ID) {
      return PROTECTED_NAMES[COMPLET_ID];
    }
    return PROTECTED_NAMES[id] || id;
  }

  /** Renomme l'entrée legacy principal → complet dans une liste registre. */
  function migratePrincipalInList(list) {
    var seenComplet = false;
    var out = [];
    list.forEach(function (entry) {
      if (!entry || !entry.id) return;
      var id = entry.id === LEGACY_ID ? COMPLET_ID : entry.id;
      if (id === COMPLET_ID) {
        if (seenComplet) return;
        seenComplet = true;
        out.push({ id: COMPLET_ID, name: PROTECTED_NAMES[COMPLET_ID] });
        return;
      }
      if (isProtectedId(id)) {
        out.push({ id: id, name: getProtectedName(id) });
        return;
      }
      out.push(entry);
    });
    return out;
  }

  /** Garantit modèles complet + court dans le registre ; migre principal. */
  function ensureProtectedInRegistry(settings) {
    if (!settings || !settings.templates) return;
    var t = settings.templates;

    t.quittances = migratePrincipalInList(t.quittances || []);
    t.mails = migratePrincipalInList(t.mails || []);

    function hasId(list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === id) return true;
      }
      return false;
    }

    if (!hasId(t.quittances, COMPLET_ID)) {
      t.quittances.unshift({ id: COMPLET_ID, name: PROTECTED_NAMES[COMPLET_ID] });
    }
    if (!hasId(t.quittances, COURT_ID)) {
      t.quittances.unshift({ id: COURT_ID, name: PROTECTED_NAMES[COURT_ID] });
    }
    if (!hasId(t.mails, COMPLET_ID)) {
      t.mails.unshift({ id: COMPLET_ID, name: PROTECTED_NAMES[COMPLET_ID] });
    }
    if (!hasId(t.mails, COURT_ID)) {
      t.mails.unshift({ id: COURT_ID, name: PROTECTED_NAMES[COURT_ID] });
    }

    if (!t.defaultQuittanceId || t.defaultQuittanceId === LEGACY_ID || t.defaultQuittanceId === SYSTEM_ID) {
      t.defaultQuittanceId = COMPLET_ID;
    }
    if (!t.defaultMailId || t.defaultMailId === LEGACY_ID || t.defaultMailId === SYSTEM_ID) {
      t.defaultMailId = COMPLET_ID;
    }
  }

  /** Valide structure settings.templates (quittances, mails). */
  function normalizeRegistry(settings) {
    if (!settings) return;
    if (!settings.templates) {
      settings.templates = {
        defaultQuittanceId: COMPLET_ID,
        defaultMailId: COMPLET_ID,
        quittances: [
          { id: COMPLET_ID, name: PROTECTED_NAMES[COMPLET_ID] },
          { id: COURT_ID, name: PROTECTED_NAMES[COURT_ID] }
        ],
        mails: [
          { id: COMPLET_ID, name: PROTECTED_NAMES[COMPLET_ID] },
          { id: COURT_ID, name: PROTECTED_NAMES[COURT_ID] }
        ]
      };
    }
    var t = settings.templates;
    if (!Array.isArray(t.quittances)) t.quittances = [];
    if (!Array.isArray(t.mails)) t.mails = [];
    if (!t.defaultQuittanceId) {
      t.defaultQuittanceId = COMPLET_ID;
    }
    if (!t.defaultMailId) {
      t.defaultMailId = COMPLET_ID;
    }
    ensureProtectedInRegistry(settings);
  }

  /** find entry. */
  function findEntry(settings, type, id) {
    normalizeRegistry(settings);
    var list = type === 'quittance' ? settings.templates.quittances : settings.templates.mails;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /** Id modèle par défaut quittance ou mail. */
  function getDefaultId(settings, type) {
    normalizeRegistry(settings);
    return type === 'quittance'
      ? settings.templates.defaultQuittanceId
      : settings.templates.defaultMailId;
  }

  /** list merged. */
  function listMerged(settings, type) {
    normalizeRegistry(settings);
    var registry = type === 'quittance' ? settings.templates.quittances : settings.templates.mails;
    var defaultId = getDefaultId(settings, type);
    var byId = {};
    var items = [];

    registry.forEach(function (entry) {
      if (!entry || !entry.id || byId[entry.id]) return;
      byId[entry.id] = true;
      items.push({
        id: entry.id,
        name: isProtectedId(entry.id) ? getProtectedName(entry.id) : entry.name || entry.id,
        isProtected: isProtectedId(entry.id),
        isDefault: entry.id === defaultId
      });
    });

    return items;
  }

  /** sync registry from disk. */
  function syncRegistryFromDisk(settings) {
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.resolve({ settings: settings, changed: false });
    }
    normalizeRegistry(settings);
    return Promise.all([
      global.LoyerServerApi.listTemplates('quittance'),
      global.LoyerServerApi.listTemplates('mail')
    ]).then(function (results) {
      var qDisk = results[0] || [];
      var mDisk = results[1] || [];
      var changed = false;

      function mergeDisk(list, diskItems) {
        var ids = {};
        list.forEach(function (e) {
          ids[e.id] = true;
        });
        diskItems.forEach(function (d) {
          if (!d.id || ids[d.id]) return;
          list.push({ id: d.id, name: 'Modèle (' + d.id + ')' });
          ids[d.id] = true;
          changed = true;
        });
      }

      mergeDisk(settings.templates.quittances, qDisk);
      mergeDisk(settings.templates.mails, mDisk);

      if (
        !findEntry(settings, 'quittance', settings.templates.defaultQuittanceId) &&
        settings.templates.defaultQuittanceId !== COMPLET_ID
      ) {
        settings.templates.defaultQuittanceId = COMPLET_ID;
        changed = true;
      }
      if (
        !findEntry(settings, 'mail', settings.templates.defaultMailId) &&
        settings.templates.defaultMailId !== COMPLET_ID
      ) {
        settings.templates.defaultMailId = COMPLET_ID;
        changed = true;
      }

      return { settings: settings, changed: changed };
    });
  }

  /** Charge load. */
  function load(type, id, part) {
    part = part || 'body';
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Connexion au serveur requise pour charger les modèles.'));
    }
    if (isSystemId(id)) {
      id = COMPLET_ID;
    }
    return global.LoyerServerApi.readTemplateFile(type, id, part).then(function (text) {
      if (!text || !String(text).trim()) {
        return Promise.reject(new Error('Modèle introuvable sur le serveur.'));
      }
      return text;
    });
  }

  /** Charge load quittance. */
  function loadQuittance(id) {
    return load('quittance', id, 'body');
  }

  /** Charge load mail. */
  function loadMail(id) {
    return Promise.all([load('mail', id, 'body'), load('mail', id, 'subject')]).then(function (parts) {
      return { body: parts[0], subject: parts[1] };
    });
  }

  /** Sauvegarde modèle quittance (registre + fichier). */
  function saveQuittance(id, html) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Les modèles complet et court ne peuvent pas être modifiés directement.'));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Serveur indisponible.'));
    }
    return global.LoyerServerApi.writeTemplateFile('quittance', id, html, 'body');
  }

  /** Sauvegarde modèle mail corps + sujet. */
  function saveMail(id, body, subject) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Les modèles complet et court ne peuvent pas être modifiés directement.'));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Serveur indisponible.'));
    }
    return global.LoyerServerApi.writeMailTemplate(id, body, subject);
  }

  /** remove from registry. */
  function removeFromRegistry(settings, type, id) {
    if (isProtectedId(id)) {
      return settings;
    }
    normalizeRegistry(settings);
    var key = type === 'quittance' ? 'quittances' : 'mails';
    var defaultKey = type === 'quittance' ? 'defaultQuittanceId' : 'defaultMailId';
    settings.templates[key] = settings.templates[key].filter(function (e) {
      return e.id !== id;
    });
    ensureProtectedInRegistry(settings);
    if (settings.templates[defaultKey] === id) {
      settings.templates[defaultKey] = COMPLET_ID;
    }
    return settings;
  }

  /** add to registry. */
  function addToRegistry(settings, type, id, name) {
    normalizeRegistry(settings);
    if (findEntry(settings, type, id)) {
      return settings;
    }
    var list = type === 'quittance' ? settings.templates.quittances : settings.templates.mails;
    list.push({ id: id, name: name || id });
    return settings;
  }

  /** Définit set default. */
  function setDefault(settings, type, id) {
    normalizeRegistry(settings);
    if (type === 'quittance') {
      settings.templates.defaultQuittanceId = id;
    } else {
      settings.templates.defaultMailId = id;
    }
    return settings;
  }

  /** Crée entrée + fichiers vides pour nouveau modèle. */
  function createFrom(settings, type, sourceId, newName) {
    var id = slugify(newName);
    var name = String(newName || '').trim() || id;
    return load(type, sourceId, 'body').then(function (body) {
      if (type === 'mail') {
        return load(type, sourceId, 'subject').then(function (subject) {
          return saveMail(id, body, subject).then(function () {
            addToRegistry(settings, type, id, name);
            return { id: id, name: name, body: body, subject: subject };
          });
        });
      }
      return saveQuittance(id, body).then(function () {
        addToRegistry(settings, type, id, name);
        return { id: id, name: name, body: body };
      });
    });
  }

  /** Retire entrée registre (fichiers gérés par API). */
  function remove(settings, type, id) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Les modèles complet et court ne peuvent pas être supprimés.'));
    }
    normalizeRegistry(settings);
    if (getDefaultId(settings, type) === id) {
      return Promise.reject(new Error('Choisissez un autre modèle par défaut avant de supprimer celui-ci.'));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Serveur indisponible.'));
    }
    return global.LoyerServerApi.deleteTemplateFile(type, id).then(function () {
      removeFromRegistry(settings, type, id);
      return settings;
    });
  }

  global.LoyerTemplateManager = {
    SYSTEM_ID: SYSTEM_ID,
    SYSTEM_LABEL: SYSTEM_LABEL,
    LEGACY_ID: LEGACY_ID,
    COMPLET_ID: COMPLET_ID,
    COURT_ID: COURT_ID,
    DEFAULT_PROTECTED_ID: DEFAULT_PROTECTED_ID,
    PROTECTED_NAMES: PROTECTED_NAMES,
    slugify: slugify,
    isSystemId: isSystemId,
    isProtectedId: isProtectedId,
    getProtectedName: getProtectedName,
    ensureProtectedInRegistry: ensureProtectedInRegistry,
    normalizeRegistry: normalizeRegistry,
    listMerged: listMerged,
    syncRegistryFromDisk: syncRegistryFromDisk,
    getDefaultId: getDefaultId,
    findEntry: findEntry,
    load: load,
    loadQuittance: loadQuittance,
    loadMail: loadMail,
    saveQuittance: saveQuittance,
    saveMail: saveMail,
    createFrom: createFrom,
    setDefault: setDefault,
    addToRegistry: addToRegistry,
    remove: remove
  };
})(window);
