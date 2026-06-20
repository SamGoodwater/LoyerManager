/**
 * Client HTTP pour api.php (mode serveur).
 */
(function (global) {
  'use strict';

  var API_URL = 'api.php';
  var API_KEY_STORAGE = 'loyerManagerApiKey';
  var active = false;
  var apiKey = '';
  var authRequired = false;

  function isHttpContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  function loadStoredApiKey() {
    try {
      apiKey = sessionStorage.getItem(API_KEY_STORAGE) || '';
    } catch (e) {
      apiKey = '';
    }
    return apiKey;
  }

  function saveStoredApiKey(key) {
    apiKey = key || '';
    try {
      if (apiKey) sessionStorage.setItem(API_KEY_STORAGE, apiKey);
      else sessionStorage.removeItem(API_KEY_STORAGE);
    } catch (e) {
      /* ignore */
    }
  }

  function getStoredApiKey() {
    return apiKey || loadStoredApiKey();
  }

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
          throw new Error(msg);
        }
        return data;
      });
    });
  }

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

  function readData() {
    return request('data', 'GET').then(function (data) {
      return data.content || '';
    });
  }

  function writeData(jsonText) {
    return request('data', 'POST', jsonText);
  }

  function listTemplates(type) {
    return request('templates', 'GET', null, { type: type }).then(function (data) {
      return data.items || [];
    });
  }

  function readTemplateFile(type, id, part) {
    return request('template', 'GET', null, {
      type: type,
      id: id,
      part: part || 'body'
    }).then(function (data) {
      return data.content || '';
    });
  }

  function writeTemplateFile(type, id, content, part) {
    return request('template', 'POST', content || '', {
      type: type,
      id: id,
      part: part || 'body'
    });
  }

  function writeMailTemplate(id, body, subject) {
    return request(
      'template',
      'POST',
      JSON.stringify({ body: body || '', subject: subject || '' }),
      { type: 'mail', id: id },
      'application/json; charset=utf-8'
    );
  }

  function deleteTemplateFile(type, id) {
    return request('template', 'DELETE', null, { type: type, id: id });
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
    loadStoredApiKey: loadStoredApiKey
  };
})(window);
