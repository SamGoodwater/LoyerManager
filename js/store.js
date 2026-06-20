/**
 * Persistance via api.php (serveur) + miroir localStorage.
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'loyerManagerData';
  var DATA_FILE_NAME = 'loyer-data.json';
  var DATA_FILE_PATH = 'data/' + DATA_FILE_NAME;

  var writeTimer = null;
  var saveStatus = 'unknown';
  var saveStatusListeners = [];
  var pendingMailMigration = null;
  var serverMode = false;
  var serverAuthRequired = false;

  function setSaveStatus(status) {
    saveStatus = status;
    saveStatusListeners.forEach(function (fn) {
      fn(status);
    });
  }

  function onSaveStatusChange(fn) {
    if (typeof fn === 'function') saveStatusListeners.push(fn);
  }

  function getSaveStatus() {
    return saveStatus;
  }

  function CorruptDataFileError(rawText, parseError) {
    this.name = 'CorruptDataFileError';
    this.rawText = rawText || '';
    this.parseError = parseError || '';
    this.message = 'Le fichier loyer-data.json est corrompu.';
  }

  function usesServerStorage() {
    return serverMode;
  }

  function isHttpContext() {
    return global.LoyerServerApi && global.LoyerServerApi.isHttpContext && global.LoyerServerApi.isHttpContext();
  }

  function detectServerBackend() {
    if (!global.LoyerServerApi) return Promise.resolve(false);
    var api = global.LoyerServerApi;
    api.loadStoredApiKey();
    return api.fetchConfig().then(function (cfg) {
      if (cfg && cfg.ok && cfg.authRequired != null) {
        serverAuthRequired = !!cfg.authRequired;
      }
      return api.detect();
    }).then(function (ok) {
      serverMode = !!ok;
      return serverMode;
    });
  }

  function isServerAuthRequired() {
    if (global.LoyerServerApi && global.LoyerServerApi.isAuthRequired) {
      return global.LoyerServerApi.isAuthRequired();
    }
    return serverAuthRequired;
  }

  function reconnectServer(apiKey) {
    if (!global.LoyerServerApi) {
      return Promise.reject(new Error('API serveur indisponible.'));
    }
    if (apiKey != null) {
      global.LoyerServerApi.setApiKey(apiKey);
    }
    return detectServerBackend().then(function (isServer) {
      if (!isServer) {
        setSaveStatus('needs-api-key');
        return Promise.reject(new Error('Connexion refusée — vérifiez la clé API.'));
      }
      return initFromServer();
    });
  }

  function createDefaultData() {
    return {
      version: 1,
      settings: {
        leaseStart: '2024-01-01',
        rentDueDay: 1,
        emitters: ['Locataire exemple'],
        emitterProfiles: [
          {
            name: 'Locataire exemple',
            patterns: ['LOCATAIRE EXEMPLE', 'VIR LOYER']
          }
        ],
        priceHistory: [{ from: '2024-01-01', amount: 650 }],
        bailleur: {
          name: '',
          street: '',
          postalCode: '',
          city: '',
          signatureImage: ''
        },
        locataire: {
          name: '',
          street: '',
          postalCode: '',
          city: ''
        },
        mail: {
          recipients: [{ email: '', type: 'to' }],
          signature: ''
        }
      },
      payments: []
    };
  }

  function normalizeEmitterProfiles(settings) {
    if (!settings) return;
    if (global.LoyerCsvImport && global.LoyerCsvImport.defaultEmitterProfiles) {
      if (!settings.emitterProfiles || !settings.emitterProfiles.length) {
        if (settings.emitters && settings.emitters.length) {
          settings.emitterProfiles = settings.emitters.map(function (name) {
            return { name: name, patterns: [] };
          });
        } else {
          settings.emitterProfiles = global.LoyerCsvImport.defaultEmitterProfiles();
        }
      }
    } else if (!settings.emitterProfiles) {
      settings.emitterProfiles = (settings.emitters || []).map(function (name) {
        return { name: name, patterns: [] };
      });
    }

    settings.emitterProfiles = (settings.emitterProfiles || [])
      .map(function (profile) {
        return {
          name: String(profile.name || '').trim(),
          patterns: (profile.patterns || [])
            .map(function (pattern) {
              return String(pattern || '').trim();
            })
            .filter(Boolean)
        };
      })
      .filter(function (profile) {
        return profile.name;
      });

    if (!settings.emitterProfiles.length) {
      settings.emitterProfiles = [{ name: 'Locataire', patterns: [] }];
    }

    if (global.LoyerCsvImport && global.LoyerCsvImport.defaultEmitterProfiles) {
      var defs = global.LoyerCsvImport.defaultEmitterProfiles();
      settings.emitterProfiles = settings.emitterProfiles.map(function (profile) {
        if (profile.patterns && profile.patterns.length) return profile;
        var def = defs.find(function (d) {
          return (
            String(d.name || '').trim().toLowerCase() ===
            String(profile.name || '').trim().toLowerCase()
          );
        });
        if (def) return { name: profile.name, patterns: def.patterns.slice() };
        return profile;
      });
      var anyPattern = settings.emitterProfiles.some(function (p) {
        return p.patterns && p.patterns.length;
      });
      if (!anyPattern && defs.length) {
        settings.emitterProfiles = defs.slice();
      }
    }

    settings.emitters = settings.emitterProfiles.map(function (profile) {
      return profile.name;
    });
  }

  function normalizeData(raw) {
    var data = raw && typeof raw === 'object' ? raw : createDefaultData();
    if (!data.version) data.version = 1;
    if (!data.settings) data.settings = createDefaultData().settings;
    if (!Array.isArray(data.payments)) data.payments = [];
    if (!Array.isArray(data.settings.emitters)) data.settings.emitters = [];
    normalizeEmitterProfiles(data.settings);
    if (!Array.isArray(data.settings.priceHistory)) data.settings.priceHistory = [];
    if (!data.settings.bailleur) data.settings.bailleur = createDefaultData().settings.bailleur;
    if (data.settings.bailleur.signatureImage === undefined) {
      data.settings.bailleur.signatureImage = '';
    }
    if (!data.settings.locataire) data.settings.locataire = createDefaultData().settings.locataire;
    if (!data.settings.mail) data.settings.mail = createDefaultData().settings.mail;
    if (!Array.isArray(data.settings.mail.recipients)) {
      data.settings.mail.recipients = [{ email: '', type: 'to' }];
    }
    if (data.settings.mail.signature === undefined) {
      data.settings.mail.signature = '';
    }
    if (data.settings.mail.body || data.settings.mail.subject) {
      pendingMailMigration = {
        body: data.settings.mail.body || '',
        subject: data.settings.mail.subject || ''
      };
    }
    if (data.settings.mail.subject !== undefined) {
      delete data.settings.mail.subject;
    }
    if (data.settings.mail.body !== undefined) {
      delete data.settings.mail.body;
    }
    data.payments.forEach(function (p) {
      normalizePayment(p);
    });
    if (global.LoyerTemplateManager) {
      global.LoyerTemplateManager.normalizeRegistry(data.settings);
    }
    return data;
  }

  function normalizePayment(p) {
    if (!p.id) {
      p.id = global.LoyerCalc ? global.LoyerCalc.generateId() : 'p_' + Date.now();
    }
    if (p.bankLabel === undefined || p.bankLabel === null) p.bankLabel = '';
    if (p.bankRef === undefined || p.bankRef === null) p.bankRef = '';
    if (p.comment === undefined || p.comment === null) p.comment = '';
    if (!p.status) {
      p.status = p.bankRef || p.bankLabel ? 'importé' : 'manuel';
    }
    return p;
  }

  function serialize(data) {
    return JSON.stringify(normalizeData(data), null, 2);
  }

  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeData(JSON.parse(raw));
    } catch (e) {
      console.warn('Erreur lecture localStorage', e);
    }
    return null;
  }

  function saveToLocalStorage(data) {
    localStorage.setItem(STORAGE_KEY, serialize(data));
  }

  function isEmptyData(data) {
    if (!data) return true;
    if (data.payments && data.payments.length > 0) return false;
    var b = data.settings && data.settings.bailleur;
    return !(b && b.name);
  }

  function applyDefaultSignatureIfEmpty(bailleur) {
    if (bailleur && !bailleur.signatureImage && global.DEFAULT_SIGNATURE_IMAGE) {
      bailleur.signatureImage = global.DEFAULT_SIGNATURE_IMAGE;
    }
  }

  function getEmbeddedSeed() {
    if (global.LOYER_SEED_DATA) {
      var data = normalizeData(global.LOYER_SEED_DATA);
      applyDefaultSignatureIfEmpty(data.settings.bailleur);
      return data;
    }
    return null;
  }

  function createFreshData() {
    var data = createDefaultData();
    applyDefaultSignatureIfEmpty(data.settings.bailleur);
    return normalizeData(data);
  }

  function loadFallbackData() {
    try {
      var stored = loadFromLocalStorage();
      if (stored && !isEmptyData(stored)) {
        applyDefaultSignatureIfEmpty(stored.settings.bailleur);
        return stored;
      }
    } catch (e) {
      console.warn('Données locales invalides.', e);
      localStorage.removeItem(STORAGE_KEY);
    }
    var seed = getEmbeddedSeed();
    if (seed) return seed;
    return createFreshData();
  }

  function requireServerApi() {
    if (!serverMode || !global.LoyerServerApi) {
      return Promise.reject(new Error('Serveur indisponible — ouvrez l\'application via http:// et vérifiez api.php.'));
    }
    return Promise.resolve(global.LoyerServerApi);
  }

  function parseFileContent(text) {
    if (!text || !text.trim()) {
      return { ok: true, empty: true, data: createFreshData() };
    }
    try {
      var parsed = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, raw: text, error: 'Structure JSON invalide' };
      }
      return { ok: true, empty: false, data: normalizeData(parsed) };
    } catch (e) {
      return { ok: false, raw: text, error: e.message || 'JSON illisible' };
    }
  }

  function readBackendRaw() {
    return requireServerApi().then(function (api) {
      return api.readData();
    });
  }

  function loadDataFromBackend() {
    return readBackendRaw()
      .then(function (text) {
        return parseFileContent(text);
      })
      .catch(function (err) {
        if (err && err.name === 'CorruptDataFileError') throw err;
        throw err;
      })
      .then(function (result) {
        if (!result.ok) {
          throw new CorruptDataFileError(result.raw, result.error);
        }

        if (result.empty) {
          var initial = loadFromLocalStorage();
          if (!initial || isEmptyData(initial)) {
            initial = createFreshData();
          } else {
            applyDefaultSignatureIfEmpty(initial.settings.bailleur);
          }
          result.data = initial;
          result.created = true;
        } else {
          applyDefaultSignatureIfEmpty(result.data.settings.bailleur);
          result.created = false;
        }

        saveToLocalStorage(result.data);

        if (result.created) {
          return saveNow(result.data).then(function (saved) {
            return { data: saved, created: true };
          });
        }

        return { data: result.data, created: false };
      });
  }

  function writeToBackend(data, immediate) {
    if (!serverMode || !global.LoyerServerApi) return Promise.resolve(false);

    function doWrite() {
      return global.LoyerServerApi.writeData(serialize(data))
        .then(function () {
          setSaveStatus('saved');
          return true;
        })
        .catch(function (err) {
          console.warn('Écriture serveur échouée', err);
          setSaveStatus('error');
          return false;
        });
    }

    if (immediate) {
      if (writeTimer) {
        clearTimeout(writeTimer);
        writeTimer = null;
      }
      return doWrite();
    }

    return new Promise(function (resolve) {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(function () {
        writeTimer = null;
        doWrite().then(resolve);
      }, 250);
    });
  }

  function save(data) {
    var normalized = normalizeData(data);
    saveToLocalStorage(normalized);
    if (serverMode) {
      setSaveStatus('pending');
      writeToBackend(normalized, false).then(function (ok) {
        if (ok) setSaveStatus('saved');
      });
    } else {
      setSaveStatus('offline');
    }
    return normalized;
  }

  function saveNow(data) {
    var normalized = normalizeData(data);
    saveToLocalStorage(normalized);
    if (!serverMode) {
      setSaveStatus('offline');
      return Promise.reject(new Error('Serveur indisponible — impossible d\'enregistrer sur le disque.'));
    }
    setSaveStatus('pending');
    return writeToBackend(normalized, true).then(function (ok) {
      if (!ok) {
        setSaveStatus('error');
        return Promise.reject(new Error('Impossible d\'écrire dans data/loyer-data.json.'));
      }
      setSaveStatus('saved');
      return normalized;
    });
  }

  function initFromServer() {
    return loadDataFromBackend()
      .then(function (out) {
        if (!serverMode || !global.LoyerTemplateManager) {
          return out;
        }
        return global.LoyerTemplateManager.syncRegistryFromDisk(out.data.settings).then(function (result) {
          if (result.changed) {
            out.data.settings = result.settings;
            saveToLocalStorage(out.data);
            return saveNow(out.data).then(function () {
              return out;
            });
          }
          return out;
        });
      })
      .then(function (out) {
        return migrateMailBodyFromData(out.data).then(function () {
          out.mode = 'server';
          setSaveStatus('saved');
          return out;
        });
      });
  }

  function initOfflineFallback(mode) {
    var fallback = loadFallbackData();
    saveToLocalStorage(fallback);
    setSaveStatus('offline');
    return {
      data: fallback,
      created: false,
      mode: mode || 'offline',
      offline: true
    };
  }

  function init() {
    return detectServerBackend().then(function (isServer) {
      if (isServer) {
        return initFromServer();
      }

      if (isHttpContext()) {
        if (isServerAuthRequired()) {
          var pendingData = loadFallbackData();
          saveToLocalStorage(pendingData);
          setSaveStatus('needs-api-key');
          return {
            data: pendingData,
            created: false,
            mode: 'server-auth',
            needsApiKey: true
          };
        }
        return initOfflineFallback('server-offline');
      }

      return initOfflineFallback('offline');
    });
  }

  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    var data = createFreshData();
    return saveNow(data).catch(function () {
      return save(data);
    });
  }

  function recreateAfterCorruption() {
    localStorage.removeItem(STORAGE_KEY);
    var data = createFreshData();
    return saveNow(data).catch(function () {
      return save(data);
    });
  }

  function downloadTextFile(content, filename) {
    var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadCorruptBackup(rawText) {
    downloadTextFile(rawText || '', 'loyer-data.corrompu.json');
  }

  function exportJson(data) {
    downloadTextFile(serialize(data), DATA_FILE_NAME);
  }

  function importJson(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          resolve(save(JSON.parse(reader.result)));
        } catch (e) {
          reject(new Error('Fichier JSON invalide'));
        }
      };
      reader.onerror = function () {
        reject(new Error('Impossible de lire le fichier'));
      };
      reader.readAsText(file);
    });
  }

  function reloadSeed() {
    var seed = getEmbeddedSeed() || createFreshData();
    return saveNow(seed).catch(function () {
      return save(seed);
    });
  }

  function migrateMailBodyFromData(data) {
    var mail = pendingMailMigration;
    pendingMailMigration = null;
    if (!mail || (!mail.body && !mail.subject)) {
      return Promise.resolve(false);
    }
    if (!serverMode || !global.LoyerTemplateManager) {
      return Promise.resolve(false);
    }
    var tm = global.LoyerTemplateManager;
    var id = tm.LEGACY_ID;
    var htmlBody = '';
    var subject = '';

    if (mail.body && String(mail.body).trim()) {
      htmlBody = String(mail.body)
        .split(/\r?\n\r?\n/)
        .map(function (block) {
          return '<p>' + block.replace(/\r?\n/g, '<br>') + '</p>';
        })
        .join('');
    }
    if (mail.subject && String(mail.subject).trim()) {
      subject = String(mail.subject)
        .replace(/\{mois\}/gi, '{{mois}}')
        .replace(/\{annee\}/gi, '{{annee}}')
        .replace(/\{bailleur\}/gi, '{{bailleur}}');
    }

    return tm
      .loadMail(id)
      .then(function (existing) {
        return tm.saveMail(
          id,
          htmlBody || existing.body,
          subject || existing.subject
        );
      })
      .then(function () {
        tm.addToRegistry(data.settings, 'mail', id, 'Modèle principal');
        if (data) saveToLocalStorage(normalizeData(data));
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  function getStoragePath() {
    return DATA_FILE_PATH;
  }

  global.LoyerStore = {
    STORAGE_KEY: STORAGE_KEY,
    CorruptDataFileError: CorruptDataFileError,
    normalizePayment: normalizePayment,
    createDefaultData: createDefaultData,
    normalizeData: normalizeData,
    load: loadFromLocalStorage,
    loadFallbackData: loadFallbackData,
    init: init,
    save: save,
    saveNow: saveNow,
    reset: reset,
    recreateAfterCorruption: recreateAfterCorruption,
    downloadCorruptBackup: downloadCorruptBackup,
    exportJson: exportJson,
    importJson: importJson,
    reloadSeed: reloadSeed,
    onSaveStatusChange: onSaveStatusChange,
    getSaveStatus: getSaveStatus,
    migrateMailBodyFromData: migrateMailBodyFromData,
    usesServerStorage: usesServerStorage,
    isServerAuthRequired: isServerAuthRequired,
    reconnectServer: reconnectServer,
    getStoragePath: getStoragePath
  };
})(window);
