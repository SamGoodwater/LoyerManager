/**
 * Bibliothèque de modèles quittance / mail (multi-fichiers + registre JSON).
 */
(function (global) {
  'use strict';

  var SYSTEM_ID = '_system';
  var SYSTEM_LABEL = 'Modèle par défaut (système)';
  var LEGACY_ID = 'principal';
  var PROTECTED_NAME = 'Modèle principal';

  var SYSTEM_DEFAULT_KEYS = {
    quittance: { body: 'templates/quittance.html' },
    mail: { body: 'templates/mail.html', subject: 'templates/mail-subject.txt' }
  };

  function slugify(name) {
    var s = String(name || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64);
    if (!s || s === SYSTEM_ID || s === LEGACY_ID) {
      s = 'modele-' + Date.now();
    }
    return s;
  }

  function isSystemId(id) {
    return id === SYSTEM_ID;
  }

  function isProtectedId(id) {
    return id === LEGACY_ID;
  }

  function ensureProtectedInRegistry(settings) {
    if (!settings || !settings.templates) return;
    var t = settings.templates;

    function hasPrincipal(list) {
      for (var i = 0; i < list.length; i++) {
        if (list[i] && list[i].id === LEGACY_ID) return true;
      }
      return false;
    }

    if (!hasPrincipal(t.quittances)) {
      t.quittances.unshift({ id: LEGACY_ID, name: PROTECTED_NAME });
    }
    if (!hasPrincipal(t.mails)) {
      t.mails.unshift({ id: LEGACY_ID, name: PROTECTED_NAME });
    }
    if (t.defaultQuittanceId === SYSTEM_ID || !t.defaultQuittanceId) {
      t.defaultQuittanceId = LEGACY_ID;
    }
    if (t.defaultMailId === SYSTEM_ID || !t.defaultMailId) {
      t.defaultMailId = LEGACY_ID;
    }
  }

  function getDefaultContent(type, part) {
    part = part || 'body';
    var keys = SYSTEM_DEFAULT_KEYS[type];
    if (!keys) return '';
    var path = part === 'subject' ? keys.subject : keys.body;
    if (path && global.LOYER_TEMPLATE_DEFAULTS && global.LOYER_TEMPLATE_DEFAULTS[path]) {
      return global.LOYER_TEMPLATE_DEFAULTS[path];
    }
    return '';
  }

  function normalizeRegistry(settings) {
    if (!settings) return;
    if (!settings.templates) {
      settings.templates = {
        defaultQuittanceId: LEGACY_ID,
        defaultMailId: LEGACY_ID,
        quittances: [{ id: LEGACY_ID, name: 'Modèle principal' }],
        mails: [{ id: LEGACY_ID, name: 'Modèle principal' }]
      };
    }
    var t = settings.templates;
    if (!Array.isArray(t.quittances)) t.quittances = [];
    if (!Array.isArray(t.mails)) t.mails = [];
    if (!t.defaultQuittanceId) {
      t.defaultQuittanceId = t.quittances.length ? t.quittances[0].id : LEGACY_ID;
    }
    if (!t.defaultMailId) {
      t.defaultMailId = t.mails.length ? t.mails[0].id : LEGACY_ID;
    }
    ensureProtectedInRegistry(settings);
  }

  function findEntry(settings, type, id) {
    normalizeRegistry(settings);
    var list = type === 'quittance' ? settings.templates.quittances : settings.templates.mails;
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function getDefaultId(settings, type) {
    normalizeRegistry(settings);
    return type === 'quittance'
      ? settings.templates.defaultQuittanceId
      : settings.templates.defaultMailId;
  }

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
        name: isProtectedId(entry.id) ? PROTECTED_NAME : entry.name || entry.id,
        isProtected: isProtectedId(entry.id),
        isDefault: entry.id === defaultId
      });
    });

    return items;
  }

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
        settings.templates.defaultQuittanceId !== LEGACY_ID
      ) {
        settings.templates.defaultQuittanceId = LEGACY_ID;
        changed = true;
      }
      if (
        !findEntry(settings, 'mail', settings.templates.defaultMailId) &&
        settings.templates.defaultMailId !== LEGACY_ID
      ) {
        settings.templates.defaultMailId = LEGACY_ID;
        changed = true;
      }

      return { settings: settings, changed: changed };
    });
  }

  function load(type, id, part) {
    part = part || 'body';
    if (isSystemId(id)) {
      return Promise.resolve(getDefaultContent(type, part));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.resolve(getDefaultContent(type, part));
    }
    return global.LoyerServerApi.readTemplateFile(type, id, part).then(function (text) {
      if (text && text.trim()) return text;
      return getDefaultContent(type, part);
    });
  }

  function loadQuittance(id) {
    return load('quittance', id, 'body');
  }

  function loadMail(id) {
    return Promise.all([load('mail', id, 'body'), load('mail', id, 'subject')]).then(function (parts) {
      return { body: parts[0], subject: parts[1] };
    });
  }

  function saveQuittance(id, html) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Le modèle principal ne peut pas être modifié directement.'));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Serveur indisponible.'));
    }
    return global.LoyerServerApi.writeTemplateFile('quittance', id, html, 'body');
  }

  function saveMail(id, body, subject) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Le modèle principal ne peut pas être modifié directement.'));
    }
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.reject(new Error('Serveur indisponible.'));
    }
    return global.LoyerServerApi.writeMailTemplate(id, body, subject);
  }

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
      settings.templates[defaultKey] = LEGACY_ID;
    }
    return settings;
  }

  function addToRegistry(settings, type, id, name) {
    normalizeRegistry(settings);
    if (findEntry(settings, type, id)) {
      return settings;
    }
    var list = type === 'quittance' ? settings.templates.quittances : settings.templates.mails;
    list.push({ id: id, name: name || id });
    return settings;
  }

  function setDefault(settings, type, id) {
    normalizeRegistry(settings);
    if (type === 'quittance') {
      settings.templates.defaultQuittanceId = id;
    } else {
      settings.templates.defaultMailId = id;
    }
    return settings;
  }

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

  function remove(settings, type, id) {
    if (isSystemId(id) || isProtectedId(id)) {
      return Promise.reject(new Error('Le modèle principal ne peut pas être supprimé.'));
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
    PROTECTED_NAME: PROTECTED_NAME,
    slugify: slugify,
    isSystemId: isSystemId,
    isProtectedId: isProtectedId,
    ensureProtectedInRegistry: ensureProtectedInRegistry,
    getDefaultContent: getDefaultContent,
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
