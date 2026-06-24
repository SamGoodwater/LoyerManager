/**
 * Client HTTP pour api.php.
 */
(function (global) {
  'use strict';

  var API_URL = 'api.php';
  var API_KEY_STORAGE = 'loyerManagerApiKey';
  var active = false;
  var apiKey = '';
  var authRequired = false;
  var lastStatus = null;

  /** True si protocol http/https. */
  function isHttpContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  /** Lit api_key sessionStorage. */
  function loadStoredApiKey() {
    try {
      apiKey = sessionStorage.getItem(API_KEY_STORAGE) || '';
    } catch (e) {
      apiKey = '';
    }
    return apiKey;
  }

  /** Écrit api_key sessionStorage. */
  function saveStoredApiKey(key) {
    apiKey = key || '';
    try {
      if (apiKey) sessionStorage.setItem(API_KEY_STORAGE, apiKey);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
      /* ignore */
    }
  }

  /** Getter clé API stockée. */
  function getStoredApiKey() {
    return apiKey || loadStoredApiKey();
  }

  /** Construit URL api.php?action=… avec params. */
  function buildUrl(action, params) {
    var parts = ['action=' + encodeURIComponent(action)];
    if (params) {
      Object.keys(params).forEach(function (key) {
        parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
      });
    }
    if (apiKey) {
      parts.push('key=' + encodeURIComponent(apiKey));
    }
    return API_URL + '?' + parts.join('&');
  }

  /** fetch JSON générique ; gère 401 needsLogin. */
  function request(action, method, body, params, contentType) {
    var headers = {};
    if (body != null) {
      headers['Content-Type'] = contentType || (typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json');
    }
    if (apiKey) {
      headers['X-API-Key'] = apiKey;
    }
    return fetch(buildUrl(action, params), {
      method: method || 'GET',
      headers: headers,
      body: body != null ? body : undefined,
      cache: 'no-store',
      credentials: 'same-origin'
    }).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Réponse serveur invalide' };
      }).then(function (data) {
        if (!res.ok || !data || !data.ok) {
          var msg = (data && data.error) || ('Erreur HTTP ' + res.status);
          if (res.status === 401 && data && (data.needsLogin || data.needsSetup)) {
            if (global.LoyerAuth) {
              global.LoyerAuth.redirectToLogin(!!data.needsSetup);
            }
          }
          throw new Error(msg);
        }
        return data;
      });
    });
  }

  /** GET config : authRequired, version. */
  function fetchConfig() {
    if (!isHttpContext()) {
      return Promise.resolve({ ok: false, authRequired: false });
    }
    return fetch(API_URL + '?action=config', { cache: 'no-store', credentials: 'same-origin' })
      .then(function (res) {
        return res.json();
      })
      .catch(function () {
        return { ok: false, authRequired: false };
      });
  }

  /** Probe serveur ; initialise clé API si besoin. */
  function detect(options) {
    options = options || {};
    if (options.apiKey != null) {
      saveStoredApiKey(options.apiKey);
    } else {
      loadStoredApiKey();
    }
    if (!isHttpContext()) {
      active = false;
      return Promise.resolve(false);
    }
    return request('status', 'GET')
      .then(function (data) {
        active = true;
        lastStatus = data;
        if (data && data.authRequired != null) {
          authRequired = !!data.authRequired;
        }
        return true;
      })
      .catch(function () {
        active = false;
        return false;
      });
  }

  /** GET action=data (loyer-data.json). */
  function readData() {
    return request('data', 'GET').then(function (data) {
      return data.content || '';
    });
  }

  /** POST action=data corps JSON texte. */
  function writeData(jsonText) {
    return request('data', 'POST', jsonText);
  }

  /** GET templates liste ids par type. */
  function listTemplates(type) {
    return request('templates', 'GET', null, { type: type }).then(function (data) {
      return data.items || [];
    });
  }

  /** GET template contenu (html ou subject). */
  function readTemplateFile(type, id, part) {
    return request('template', 'GET', null, {
      type: type,
      id: id,
      part: part || 'body'
    }).then(function (data) {
      return data.content || '';
    });
  }

  /** POST template contenu partiel. */
  function writeTemplateFile(type, id, content, part) {
    return request('template', 'POST', content || '', {
      type: type,
      id: id,
      part: part || 'body'
    });
  }

  /** POST corps + sujet mail atomique. */
  function writeMailTemplate(id, body, subject) {
    return request(
      'template',
      'POST',
      JSON.stringify({ body: body || '', subject: subject || '' }),
      { type: 'mail', id: id },
      'application/json; charset=utf-8'
    );
  }

  /** DELETE template par id. */
  function deleteTemplateFile(type, id) {
    return request('template', 'DELETE', null, { type: type, id: id });
  }

  /** GET oauth-status connexions mail. */
  function getOAuthStatus() {
    return request('oauth-status', 'GET');
  }

  /** GET redirect oauth-start mail. */
  function startOAuth(provider) {
    window.location.href = buildUrl('oauth-start', { provider: provider });
  }

  /** POST oauth-disconnect provider. */
  function disconnectOAuth(provider) {
    return request('oauth-disconnect', 'POST', JSON.stringify({ provider: provider }));
  }

  /** POST oauth-set-active compte expéditeur. */
  function setActiveOAuth(provider, email) {
    return request('oauth-set-active', 'POST', JSON.stringify({ provider: provider, email: email }));
  }

  /** POST send-mail avec PDF base64. */
  function sendMail(payload) {
    return request('send-mail', 'POST', JSON.stringify(payload));
  }

  /** POST save-mail-draft Gmail/Outlook. */
  function saveMailDraft(payload) {
    return request('save-mail-draft', 'POST', JSON.stringify(payload));
  }

  /** POST log-export événement export. */
  function logExport(eventType, summary, metadata, status, errorMessage) {
    if (!active) return Promise.resolve();
    return request(
      'log-export',
      'POST',
      JSON.stringify({
        eventType: eventType,
        summary: summary,
        metadata: metadata || null,
        status: status || 'success',
        errorMessage: errorMessage || null
      })
    ).catch(function () {
      return null;
    });
  }

  /** POST log-csv-import après import CSV. */
  function logCsvImport(summary, metadata) {
    if (!active) return Promise.resolve();
    return request(
      'log-csv-import',
      'POST',
      JSON.stringify({ summary: summary, metadata: metadata || null })
    ).catch(function () {
      return null;
    });
  }

  /** GET activity-log paginé filtré. */
  function fetchActivityLog(params) {
    return request('activity-log', 'GET', null, params || {});
  }

  /** POST purge journal (+ rétention auto). */
  function purgeActivityLog(options) {
    return request('activity-log', 'DELETE', JSON.stringify(options || {}));
  }

  /** GET app-settings (rétention historique). */
  function fetchAppSettings() {
    return request('app-settings', 'GET');
  }

  /** POST app-settings. */
  function saveAppSettings(body) {
    return request('app-settings', 'POST', JSON.stringify(body || {}));
  }

  /** Télécharge export CSV journal. */
  function downloadActivityCsv(params) {
    var url = buildUrl('activity-log', Object.assign({ format: 'csv' }, params || {}));
    window.open(url, '_blank');
  }

  /** GET status diagnostic serveur. */
  function getLastStatus() {
    return lastStatus;
  }

  /** GET mail-transport-status OAuth/SMTP. */
  function getMailTransportStatus() {
    return request('mail-transport-status', 'GET');
  }

  /** GET smtp-settings (sans mot de passe). */
  function getSmtpSettings() {
    return request('smtp-settings', 'GET').then(function (data) {
      return data.smtp || {};
    });
  }

  /** POST smtp-settings. */
  function saveSmtpSettings(body) {
    return request('smtp-settings', 'POST', JSON.stringify(body || {})).then(function (data) {
      return data.smtp || {};
    });
  }

  /** POST test connexion SMTP (sans enregistrer). */
  function testSmtpSettings(body) {
    var payload = Object.assign({}, body || {}, { test: true });
    return request('smtp-settings', 'POST', JSON.stringify(payload)).then(function (data) {
      return data.message || 'Connexion SMTP réussie.';
    });
  }

  /** POST clear SMTP. */
  function clearSmtpSettings() {
    return request('smtp-settings', 'POST', JSON.stringify({ clear: true })).then(function (data) {
      return data.smtp || {};
    });
  }

  /** POST export profil complet scellé (mot de passe de sauvegarde). */
  function exportProfileBackup(backupPassword) {
    return request('profile-export', 'POST', JSON.stringify({ backupPassword: backupPassword || '' })).then(function (data) {
      return data.profile || {};
    });
  }

  /** POST import profil complet ou legacy JSON. */
  function importProfileBackup(payload) {
    return request('profile-import', 'POST', JSON.stringify(payload || {}));
  }

  /** POST réinitialise données métier et modèles personnalisés. */
  function resetProfileData() {
    return request('profile-reset-data', 'POST', JSON.stringify({}));
  }

  /** POST auth-logout. */
  function logoutSession() {
    return fetch(API_URL + '?action=auth-logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: '{}'
    }).then(function (res) {
      return res.json();
    });
  }

  global.LoyerServerApi = {
    detect: detect,
    fetchConfig: fetchConfig,
    isActive: function () {
      return active;
    },
    isHttpContext: isHttpContext,
    isAuthRequired: function () {
      return authRequired;
    },
    readData: readData,
    writeData: writeData,
    listTemplates: listTemplates,
    readTemplateFile: readTemplateFile,
    writeTemplateFile: writeTemplateFile,
    writeMailTemplate: writeMailTemplate,
    deleteTemplateFile: deleteTemplateFile,
    setApiKey: saveStoredApiKey,
    getStoredApiKey: getStoredApiKey,
    loadStoredApiKey: loadStoredApiKey,
    getOAuthStatus: getOAuthStatus,
    startOAuth: startOAuth,
    disconnectOAuth: disconnectOAuth,
    setActiveOAuth: setActiveOAuth,
    sendMail: sendMail,
    saveMailDraft: saveMailDraft,
    logExport: logExport,
    logCsvImport: logCsvImport,
    fetchActivityLog: fetchActivityLog,
    purgeActivityLog: purgeActivityLog,
    fetchAppSettings: fetchAppSettings,
    saveAppSettings: saveAppSettings,
    downloadActivityCsv: downloadActivityCsv,
    getLastStatus: getLastStatus,
    buildUrl: buildUrl,
    getMailTransportStatus: getMailTransportStatus,
    getSmtpSettings: getSmtpSettings,
    saveSmtpSettings: saveSmtpSettings,
    testSmtpSettings: testSmtpSettings,
    clearSmtpSettings: clearSmtpSettings,
    exportProfileBackup: exportProfileBackup,
    importProfileBackup: importProfileBackup,
    resetProfileData: resetProfileData,
    logoutSession: logoutSession
  };
})(window);
