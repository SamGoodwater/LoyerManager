/**
 * Persistance via api.php (serveur) + miroir localStorage.
 *
 * Schéma loyer-data.json (champ version) :
 * - v1 : settings, payments ; mail.body/subject legacy ; pas de monthNotes ni payment.tag
 * - v2 : monthNotes, payment.tag, emitterProfiles cohérents ; mail.body/subject retirés (→ templates)
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'loyerManagerData';
  var DATA_FILE_NAME = 'loyer-data.json';
  var DATA_FILE_PATH = 'data/' + DATA_FILE_NAME;
  /** Version du schéma loyer-data.json — incrémenter à chaque migration incompatible. */
  var LOYER_DATA_VERSION = 2;

  var writeTimer = null;
  var saveStatus = 'unknown';
  var saveStatusListeners = [];
  var pendingMailMigration = null;
  var migrationPending = false;
  var migrationNoticePending = false;
  var serverMode = false;
  var serverAuthRequired = false;

  /** Définit set save status. */
  function setSaveStatus(status) {
    saveStatus = status;
    saveStatusListeners.forEach(function (fn) {
      fn(status);
    });
  }

  /** on save status change. */
  function onSaveStatusChange(fn) {
    if (typeof fn === 'function') saveStatusListeners.push(fn);
  }

  /** Statut UI sauvegarde : saved, pending, error, needs-api-key. */
  function getSaveStatus() {
    return saveStatus;
  }

  /** corrupt data file error. */
  function CorruptDataFileError(rawText, parseError) {
    this.name = 'CorruptDataFileError';
    this.rawText = rawText || '';
    this.parseError = parseError || '';
    this.message = 'Vos données semblent endommagées.';
  }

  /** uses server storage. */
  function usesServerStorage() {
    return serverMode;
  }

  /** True si protocol http/https (requis pour api.php). */
  function isHttpContext() {
    return global.LoyerServerApi && global.LoyerServerApi.isHttpContext && global.LoyerServerApi.isHttpContext();
  }

  /** detect server backend. */
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

  /** True si le serveur exige une session ou clé API. */
  function isServerAuthRequired() {
    if (global.LoyerServerApi && global.LoyerServerApi.isAuthRequired) {
      return global.LoyerServerApi.isAuthRequired();
    }
    return serverAuthRequired;
  }

  /** reconnect server. */
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

  /** Crée create default data. */
  function createDefaultData() {
    return {
      version: LOYER_DATA_VERSION,
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
        priceHistory: [{ from: '2024-01-01', amount: 580, charges: 70 }],
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
      payments: [],
      monthNotes: {}
    };
  }

  /** normalize emitter profiles. */
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

  /** v1 → v2 : notes mensuelles, tags paiement, statuts import, profils émetteurs. */
  function migrateV1ToV2(data) {
    if (!data.monthNotes || typeof data.monthNotes !== 'object' || Array.isArray(data.monthNotes)) {
      data.monthNotes = {};
    }
    (data.payments || []).forEach(function (p) {
      if (p && p.status === 'importe') {
        p.status = 'importé';
      }
      normalizePayment(p);
    });
    if (data.settings) {
      normalizeEmitterProfiles(data.settings);
    }
  }

  /** Applique les migrations séquentielles jusqu'à LOYER_DATA_VERSION. */
  function runMigrations(data) {
    var version = Number(data.version) || 1;
    if (version >= LOYER_DATA_VERSION) {
      return false;
    }
    while (version < LOYER_DATA_VERSION) {
      if (version === 1) {
        migrateV1ToV2(data);
        version = 2;
      } else {
        version = LOYER_DATA_VERSION;
      }
    }
    data.version = LOYER_DATA_VERSION;
    return true;
  }

  /** True si une migration vient d'être appliquée (consommé après chargement). */
  function consumeMigrationPending() {
    var v = migrationPending;
    migrationPending = false;
    return v;
  }

  /** Message utilisateur après migration (consommé une fois). */
  function consumeMigrationNotice() {
    var v = migrationNoticePending;
    migrationNoticePending = false;
    return v;
  }

  /** Normalise le JSON métier (schéma, migrations légères). */
  function normalizeData(raw) {
    var data = raw && typeof raw === 'object' ? raw : createDefaultData();
    var sourceVersion = Number(data.version) || 1;
    if (!data.version) {
      data.version = sourceVersion;
    }
    if (!data.settings) data.settings = createDefaultData().settings;
    if (!Array.isArray(data.payments)) data.payments = [];
    if (!data.monthNotes || typeof data.monthNotes !== 'object') data.monthNotes = {};
    if (!Array.isArray(data.settings.emitters)) data.settings.emitters = [];
    normalizeEmitterProfiles(data.settings);
    if (!Array.isArray(data.settings.priceHistory)) data.settings.priceHistory = [];
    data.settings.priceHistory = data.settings.priceHistory.map(function (p) {
      return {
        from: p && p.from ? String(p.from) : '',
        amount: p && p.amount != null ? Number(p.amount) || 0 : 0,
        charges: p && p.charges != null ? Number(p.charges) || 0 : 0
      };
    });
    if (!data.settings.bailleur) data.settings.bailleur = createDefaultData().settings.bailleur;
    if (data.settings.bailleur.signatureImage === undefined) {
      data.settings.bailleur.signatureImage = '';
    }
    if (!data.settings.locataire) data.settings.locataire = createDefaultData().settings.locataire;
    if (!data.settings.mail) data.settings.mail = createDefaultData().settings.mail;
    if (!Array.isArray(data.settings.mail.recipients)) {
      data.settings.mail.recipients = [{ email: '', type: 'to' }];
    }
    data.settings.mail.recipients = data.settings.mail.recipients.map(function (r) {
      var type = r && r.type ? String(r.type).toLowerCase() : 'to';
      if (type !== 'to' && type !== 'cc' && type !== 'bcc') {
        type = 'to';
      }
      return { email: r && r.email != null ? String(r.email) : '', type: type };
    });
    if (data.settings.mail.signature === undefined) {
      data.settings.mail.signature = '';
    }
    if (data.settings.mail.body || data.settings.mail.subject) {
      pendingMailMigration = {
        body: data.settings.mail.body || '',
        subject: data.settings.mail.subject || ''
      };
      migrationPending = true;
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
    if (runMigrations(data)) {
      migrationPending = true;
      migrationNoticePending = true;
    } else if (sourceVersion < LOYER_DATA_VERSION) {
      data.version = LOYER_DATA_VERSION;
      migrationPending = true;
      migrationNoticePending = true;
    }
    return data;
  }

  /** normalize payment. */
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
    if (global.LoyerPaymentTags) {
      p.tag = global.LoyerPaymentTags.normalizeTag(p.tag);
    } else if (!p.tag) {
      p.tag = 'virement';
    }
    if (p.amount != null) p.amount = Number(p.amount) || 0;
    return p;
  }

  /** Commentaire interne d'un mois (clé YYYY-MM). */
  function getMonthNote(data, year, month) {
    if (!data || !data.monthNotes || !global.LoyerCalc) return '';
    return data.monthNotes[global.LoyerCalc.monthKey(year, month)] || '';
  }

  /** Enregistre ou supprime le commentaire interne d'un mois. */
  function setMonthNote(data, year, month, text) {
    if (!data || !global.LoyerCalc) return;
    if (!data.monthNotes) data.monthNotes = {};
    var key = global.LoyerCalc.monthKey(year, month);
    text = String(text || '').trim();
    if (text) data.monthNotes[key] = text;
    else delete data.monthNotes[key];
  }

  /** serialize. */
  function serialize(data) {
    return JSON.stringify(normalizeData(data), null, 2);
  }

  /** Charge load from local storage. */
  function loadFromLocalStorage() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return normalizeData(JSON.parse(raw));
    } catch (e) {
      console.warn('Erreur lecture localStorage', e);
    }
    return null;
  }

  /** Miroir JSON local (cache navigateur, pas source de vérité). */
  function saveToLocalStorage(data) {
    localStorage.setItem(STORAGE_KEY, serialize(data));
  }

  /** apply default signature if empty. */
  function applyDefaultSignatureIfEmpty(bailleur) {
    if (bailleur && !bailleur.signatureImage && global.DEFAULT_SIGNATURE_IMAGE) {
      bailleur.signatureImage = global.DEFAULT_SIGNATURE_IMAGE;
    }
  }

  /** Crée create fresh data. */
  function createFreshData() {
    var data = createDefaultData();
    applyDefaultSignatureIfEmpty(data.settings.bailleur);
    return normalizeData(data);
  }

  /** require server api. */
  function requireServerApi() {
    if (!serverMode || !global.LoyerServerApi) {
      return Promise.reject(new Error('Connexion au serveur impossible.'));
    }
    return Promise.resolve(global.LoyerServerApi);
  }

  /** Parse JSON profil ; lève CorruptDataFileError si invalide. */
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

  /** read backend raw. */
  function readBackendRaw() {
    return requireServerApi().then(function (api) {
      return api.readData();
    });
  }

  /** Charge loyer-data.json via api.php ; gère corruption et seed. */
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
          localStorage.removeItem(STORAGE_KEY);
          var initial = createFreshData();
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

  /** Persiste le JSON avec debounce et statut UI. */
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

    // Debounce 250 ms : évite de saturer api.php lors de saisies rapides
    return new Promise(function (resolve) {
      if (writeTimer) clearTimeout(writeTimer);
      writeTimer = setTimeout(function () {
        writeTimer = null;
        doWrite().then(resolve);
      }, 250);
    });
  }

  /** Normalise, cache localStorage et planifie écriture serveur debounced. */
  function save(data) {
    var normalized = normalizeData(data);
    saveToLocalStorage(normalized);
    if (serverMode) {
      setSaveStatus('pending');
      writeToBackend(normalized, false).then(function (ok) {
        if (ok) setSaveStatus('saved');
      });
    } else {
      setSaveStatus('error');
    }
    return normalized;
  }

  /** Sauvegarde immédiate ; échoue si serveur requis injoignable. */
  function saveNow(data) {
    var normalized = normalizeData(data);
    saveToLocalStorage(normalized);
    if (!serverMode) {
      setSaveStatus('error');
      return Promise.reject(new Error('Serveur indisponible — impossible d\'enregistrer sur le disque.'));
    }
    setSaveStatus('pending');
    return writeToBackend(normalized, true).then(function (ok) {
      if (!ok) {
        setSaveStatus('error');
        return Promise.reject(new Error('Impossible d\'enregistrer vos données.'));
      }
      setSaveStatus('saved');
      return normalized;
    });
  }

  /** Enregistre sur le serveur si migration ou sync modèles l'a modifié. */
  function persistDataIfNeeded(out, extraDirty) {
    var needsSave = consumeMigrationPending() || !!extraDirty;
    if (!needsSave) {
      return Promise.resolve(out);
    }
    saveToLocalStorage(out.data);
    return saveNow(out.data).then(function () {
      if (consumeMigrationNotice() && global.LoyerNotify) {
        global.LoyerNotify.info('Fichier de données mis à jour au format actuel.');
      }
      return out;
    });
  }

  /** Initialise init from server. */
  function initFromServer() {
    return loadDataFromBackend()
      .then(function (out) {
        if (!serverMode || !global.LoyerTemplateManager) {
          return persistDataIfNeeded(out, false);
        }
        return global.LoyerTemplateManager.syncRegistryFromDisk(out.data.settings).then(function (result) {
          if (result.changed) {
            out.data.settings = result.settings;
          }
          return persistDataIfNeeded(out, result.changed);
        });
      })
      .then(function (out) {
        return migrateMailBodyFromData(out.data).then(function (mailMigrated) {
          if (mailMigrated) {
            migrationPending = true;
            return persistDataIfNeeded(out, true);
          }
          return out;
        });
      })
      .then(function (out) {
        out.mode = 'server';
        setSaveStatus('saved');
        return out;
      });
  }

  /** Bootstrap store : détection serveur, chargement données. */
  function init() {
    if (!isHttpContext()) {
      return Promise.reject(new Error('Ouvrez l\'application via son adresse web (http ou https).'));
    }
    return detectServerBackend().then(function (isServer) {
      if (isServer) {
        return initFromServer();
      }
      if (isServerAuthRequired()) {
        setSaveStatus('needs-api-key');
        return {
          data: createFreshData(),
          created: false,
          mode: 'server-auth',
          needsApiKey: true
        };
      }
      return Promise.reject(new Error('Connexion au serveur impossible.'));
    });
  }

  /** reset données métier (serveur + local). */
  function reset() {
    localStorage.removeItem(STORAGE_KEY);
    if (serverMode && global.LoyerServerApi && global.LoyerServerApi.resetProfileData) {
      return global.LoyerServerApi.resetProfileData()
        .then(function () {
          return loadDataFromBackend();
        })
        .then(function (out) {
          return persistDataIfNeeded(out, false);
        })
        .then(function (out) {
          return out.data;
        });
    }
    var data = createFreshData();
    return saveNow(data).catch(function () {
      return save(data);
    });
  }

  /** recreate after corruption. */
  function recreateAfterCorruption() {
    localStorage.removeItem(STORAGE_KEY);
    var data = createFreshData();
    return saveNow(data).catch(function () {
      return save(data);
    });
  }

  /** download text file. */
  function downloadTextFile(content, filename) {
    var blob = new Blob([content], { type: 'application/json;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** download corrupt backup. */
  function downloadCorruptBackup(rawText) {
    downloadTextFile(rawText || '', 'loyer-data.corrompu.json');
  }

  /** Exporte export json. */
  function exportJson(data, filename) {
    downloadTextFile(serialize(data), filename || DATA_FILE_NAME);
  }

  /** True si export v2 chiffré (mot de passe de sauvegarde). */
  function isSealedProfileExport(obj) {
    return !!(
      obj &&
      obj.profileExportVersion >= 2 &&
      obj.security &&
      obj.security.sealed
    );
  }

  /** True si objet export complet profil (v1 en clair ou v2 scellé). */
  function isFullProfileExport(obj) {
    return isSealedProfileExport(obj) || !!(obj && obj.profileExportVersion && obj.loyerData);
  }

  /** True si legacy loyer-data.json seul. */
  function isLegacyLoyerData(obj) {
    return !!(obj && obj.settings && (obj.payments || Array.isArray(obj.payments)));
  }

  /** Demande et confirme le mot de passe de sauvegarde à l'export. */
  function promptBackupExportPassword() {
    if (!global.LoyerNotify || !global.LoyerNotify.prompt) {
      return Promise.reject(new Error('Interface indisponible.'));
    }
    return global.LoyerNotify.prompt(
      'Choisissez un mot de passe de sauvegarde pour chiffrer le fichier exporté. Conservez-le — il sera requis pour restaurer.',
      {
        inputType: 'password',
        placeholder: 'Mot de passe de sauvegarde (min. 8 caractères)',
        confirmLabel: 'Continuer'
      }
    ).then(function (pwd) {
      if (pwd === null) return Promise.reject(new Error('Export annulé.'));
      if (!pwd || pwd.length < 8) {
        return Promise.reject(new Error('Le mot de passe de sauvegarde doit contenir au moins 8 caractères.'));
      }
      return global.LoyerNotify.prompt('Confirmez le mot de passe de sauvegarde.', {
        inputType: 'password',
        placeholder: 'Confirmer',
        confirmLabel: 'Exporter'
      }).then(function (pwd2) {
        if (pwd2 === null) return Promise.reject(new Error('Export annulé.'));
        if (pwd !== pwd2) {
          return Promise.reject(new Error('Les mots de passe de sauvegarde ne correspondent pas.'));
        }
        return pwd;
      });
    });
  }

  /** Demande le mot de passe de sauvegarde pour un import v2. */
  function promptBackupImportPassword() {
    if (!global.LoyerNotify || !global.LoyerNotify.prompt) {
      return Promise.reject(new Error('Interface indisponible.'));
    }
    return global.LoyerNotify.prompt(
      'Ce fichier est chiffré. Saisissez le mot de passe de sauvegarde choisi à l\'export.',
      {
        inputType: 'password',
        placeholder: 'Mot de passe de sauvegarde',
        confirmLabel: 'Importer'
      }
    ).then(function (pwd) {
      if (pwd === null) return Promise.reject(new Error('Import annulé.'));
      if (!pwd) return Promise.reject(new Error('Mot de passe de sauvegarde requis.'));
      return pwd;
    });
  }

  /** Exporte export profile (JSON métier + SQLite si serveur). */
  function exportProfile(data) {
    var d = new Date();
    var stamp = d.toISOString().slice(0, 10);
    var filename = 'loyer-profil-' + stamp + '.json';
    if (serverMode && global.LoyerServerApi && global.LoyerServerApi.exportProfileBackup) {
      return promptBackupExportPassword().then(function (backupPassword) {
        return global.LoyerServerApi.exportProfileBackup(backupPassword).then(function (profile) {
          downloadTextFile(JSON.stringify(profile, null, 2), filename);
        });
      });
    }
    exportJson(data, filename);
    return Promise.resolve();
  }

  /** Importe fichier profil (complet ou legacy JSON). */
  function importProfileFile(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          if (!isFullProfileExport(parsed) && !isLegacyLoyerData(parsed)) {
            reject(new Error('Format de sauvegarde non reconnu.'));
            return;
          }
          if (serverMode && global.LoyerServerApi && global.LoyerServerApi.importProfileBackup) {
            var chain = Promise.resolve(null);
            if (isSealedProfileExport(parsed)) {
              chain = promptBackupImportPassword();
            }
            chain
              .then(function (backupPassword) {
                var payload = isSealedProfileExport(parsed)
                  ? { profile: parsed, backupPassword: backupPassword }
                  : parsed;
                return global.LoyerServerApi.importProfileBackup(payload);
              })
              .then(function () {
                return loadDataFromBackend();
              })
              .then(function (out) {
                return persistDataIfNeeded(out, false);
              })
              .then(function (out) {
                resolve(out.data);
              })
              .catch(reject);
            return;
          }
          if (isSealedProfileExport(parsed)) {
            reject(new Error('Cette sauvegarde chiffrée nécessite le serveur Loyer Manager pour être importée.'));
            return;
          }
          reject(new Error('Import impossible sans connexion au serveur.'));
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

  /** Importe import json (legacy — préférer importProfileFile). */
  function importJson(file) {
    return importProfileFile(file);
  }

  /** Résumé lisible d'un jeu de données importable. */
  function describeLoyerDataImport(data) {
    var s = data.settings || {};
    var bailleur = (s.bailleur && s.bailleur.name) || '—';
    var locataire = (s.locataire && s.locataire.name) || '—';
    var payments = Array.isArray(data.payments) ? data.payments.length : 0;
    var tiers = s.priceHistory && s.priceHistory.length ? s.priceHistory.length : 0;
    return {
      bailleur: bailleur,
      locataire: locataire,
      payments: payments,
      priceTiers: tiers,
      leaseStart: s.leaseStart || '—',
    };
  }

  /** Valide un objet JSON candidat (loyer-data ou export profil v1 métier). */
  function parseLoyerDataImportCandidate(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'Structure JSON invalide.' };
    }
    if (isSealedProfileExport(parsed)) {
      return {
        ok: false,
        error:
          'Sauvegarde chiffrée — utilisez Paramètres → Mon compte → Importer un profil (mot de passe de sauvegarde requis).',
      };
    }
    var loyerData = null;
    if (isFullProfileExport(parsed) && parsed.loyerData && isLegacyLoyerData(parsed.loyerData)) {
      loyerData = parsed.loyerData;
    } else if (isLegacyLoyerData(parsed)) {
      loyerData = parsed;
    } else {
      return {
        ok: false,
        error: 'Format non reconnu. Attendu : loyer-data.json (paramètres + virements).',
      };
    }
    var data = normalizeData(loyerData);
    return {
      ok: true,
      data: data,
      summary: describeLoyerDataImport(data),
    };
  }

  /** Lit un fichier JSON, valide le format loyer-data sans l'appliquer. */
  function previewLoyerDataImport(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var parsed = JSON.parse(reader.result);
          var preview = parseLoyerDataImportCandidate(parsed);
          if (!preview.ok) {
            reject(new Error(preview.error));
            return;
          }
          resolve(preview);
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

  /** Enregistre des données loyer-data validées sur le serveur. */
  function importLoyerData(data) {
    if (!serverMode) {
      return Promise.reject(new Error('Connexion au serveur impossible.'));
    }
    var chain = Promise.resolve(data);
    if (global.LoyerTemplateManager) {
      chain = global.LoyerTemplateManager.syncRegistryFromDisk(data.settings).then(function (result) {
        if (result.changed) {
          data.settings = result.settings;
        }
        return data;
      });
    }
    return chain.then(function (normalized) {
      consumeMigrationPending();
      consumeMigrationNotice();
      return saveNow(normalized);
    });
  }

  /** migrate mail body from data. */
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
        .replace(/\{bailleur\}/gi, '{{bailleur.name}}');
    }

    if (!htmlBody && !subject) {
      return Promise.resolve(false);
    }

    return tm
      .createFrom(data.settings, 'mail', tm.COMPLET_ID, 'Modèle migré (ancien JSON)')
      .then(function (created) {
        return tm.loadMail(created.id).then(function (existing) {
          return tm.saveMail(
            created.id,
            htmlBody || existing.body,
            subject || existing.subject
          );
        });
      })
      .then(function () {
        if (data) saveToLocalStorage(normalizeData(data));
        return true;
      })
      .catch(function () {
        return false;
      });
  }

  /** Chemin affiché data/loyer-data.json (indicateur UI). */
  function getStoragePath() {
    return DATA_FILE_PATH;
  }

  global.LoyerStore = {
    STORAGE_KEY: STORAGE_KEY,
    LOYER_DATA_VERSION: LOYER_DATA_VERSION,
    CorruptDataFileError: CorruptDataFileError,
    normalizePayment: normalizePayment,
    getMonthNote: getMonthNote,
    setMonthNote: setMonthNote,
    createDefaultData: createDefaultData,
    normalizeData: normalizeData,
    load: loadFromLocalStorage,
    init: init,
    save: save,
    saveNow: saveNow,
    reset: reset,
    recreateAfterCorruption: recreateAfterCorruption,
    downloadCorruptBackup: downloadCorruptBackup,
    exportJson: exportJson,
    exportProfile: exportProfile,
    importProfileFile: importProfileFile,
    previewLoyerDataImport: previewLoyerDataImport,
    importLoyerData: importLoyerData,
    importJson: importJson,
    onSaveStatusChange: onSaveStatusChange,
    getSaveStatus: getSaveStatus,
    migrateMailBodyFromData: migrateMailBodyFromData,
    usesServerStorage: usesServerStorage,
    isServerAuthRequired: isServerAuthRequired,
    reconnectServer: reconnectServer,
    getStoragePath: getStoragePath
  };
})(window);
