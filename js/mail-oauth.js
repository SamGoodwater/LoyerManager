/**
 * Connexion OAuth Gmail / Outlook (Paramètres) + statut SMTP.
 */
(function (global) {
  'use strict';

  var cachedStatus = null;
  var cachedTransport = null;

  /** Échappe HTML pour panneau statut OAuth. */
  function escapeHtml(s) {
    if (global.LoyerCalc && global.LoyerCalc.escapeHtml) return global.LoyerCalc.escapeHtml(s);
    var d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  /** Libellé Gmail ou Outlook. */
  function providerLabel(provider) {
    return provider === 'google' ? 'Gmail' : provider === 'microsoft' ? 'Outlook' : provider;
  }

  /** Lit ?oauth=success|error depuis URL retour. */
  function parseOAuthQuery() {
    var hash = location.hash || '';
    var qIndex = hash.indexOf('?');
    if (qIndex === -1) return {};
    var qs = hash.slice(qIndex + 1);
    var out = {};
    qs.split('&').forEach(function (part) {
      var kv = part.split('=');
      if (kv[0]) out[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '');
    });
    return out;
  }

  /** Nettoie paramètres OAuth de l'URL (history.replaceState). */
  function clearOAuthQuery() {
    var hash = location.hash || '';
    var qIndex = hash.indexOf('?');
    if (qIndex !== -1) {
      location.hash = hash.slice(0, qIndex);
    }
  }

  /** Toast succès/erreur après redirect OAuth mail. */
  function handleOAuthReturn() {
    var q = parseOAuthQuery();
    if (q.oauth_ok === '1') {
      clearOAuthQuery();
      if (global.LoyerNotify) global.LoyerNotify.success('Compte mail connecté.');
      return true;
    }
    if (q.oauth_error) {
      clearOAuthQuery();
      if (global.LoyerNotify) global.LoyerNotify.error(decodeURIComponent(q.oauth_error));
      return true;
    }
    return false;
  }

  /** GET oauth-status : connexions et compte actif. */
  function fetchStatus() {
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      cachedStatus = null;
      cachedTransport = null;
      return Promise.resolve(null);
    }
    return global.LoyerServerApi.getOAuthStatus().then(function (data) {
      cachedStatus = data;
      cachedTransport = data.mailTransport || null;
      return data;
    });
  }

  /** Met à jour hints envoi/brouillon et boutons mail. */
  function refreshTransport() {
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      return Promise.resolve(null);
    }
    return global.LoyerServerApi.getMailTransportStatus().then(function (data) {
      cachedTransport = data;
      if (data.oauth) cachedStatus = Object.assign({}, cachedStatus || {}, data.oauth);
      updateMailSendButton();
      return data;
    });
  }

  /** Dernier statut OAuth mail en cache. */
  function getCachedStatus() {
    return cachedStatus;
  }

  /** True si OAuth ou SMTP configuré pour envoi. */
  function isMailSendReady() {
    if (cachedTransport && cachedTransport.sendReady) return true;
    if (!cachedStatus || !cachedStatus.active) return false;
    return !!cachedStatus.encryptionConfigured;
  }

  /** True si OAuth Gmail/Outlook prêt pour brouillon. */
  function isMailDraftReady() {
    if (cachedTransport && cachedTransport.draftReady) return true;
    if (!cachedStatus || !cachedStatus.active) return false;
    return !!cachedStatus.encryptionConfigured;
  }

  /** Message sous bouton Envoyer selon transport. */
  function mailSendHintText() {
    if (isMailSendReady()) return '';
    if (cachedTransport && cachedTransport.smtpReady) return '';
    if (cachedTransport && cachedTransport.smtp && cachedTransport.smtp.configured) return '';
    return 'Connectez Gmail/Outlook ou configurez le SMTP dans Paramètres pour activer l\'envoi direct.';
  }

  /** Message sous bouton Brouillon selon OAuth. */
  function mailDraftHintText() {
    if (isMailDraftReady()) return '';
    return 'Connectez Gmail ou Outlook dans Paramètres pour enregistrer un brouillon dans votre boîte mail.';
  }

  /** HTML panneau connexion/déconnexion comptes mail. */
  function renderStatusPanel(container) {
    if (!container) return Promise.resolve();
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
      container.innerHTML = '<p class="field-hint">Connexion au serveur requise.</p>';
      return Promise.resolve();
    }
    return fetchStatus().then(function (status) {
      if (!status) {
        container.innerHTML = '<p class="field-hint">Impossible de lire le statut OAuth.</p>';
        return;
      }
      var active = status.active;
      var html = '';
      if (!status.encryptionConfigured) {
        html +=
          '<p class="field-hint field-hint-warn">L\'envoi Gmail n\'est pas encore configuré sur ce serveur.</p>';
      }
      if (active) {
        html +=
          '<p class="oauth-active-status"><strong>Expéditeur OAuth actif :</strong> ' +
          escapeHtml(active.email) +
          ' (' +
          escapeHtml(providerLabel(active.provider)) +
          ')</p>';
      } else {
        html += '<p class="field-hint">Aucun compte Gmail connecté.</p>';
      }
      if (cachedTransport && cachedTransport.smtpReady) {
        html +=
          '<p class="field-hint"><strong>SMTP actif :</strong> ' +
          escapeHtml(cachedTransport.smtp.fromEmail) +
          ' via ' +
          escapeHtml(cachedTransport.smtp.host) +
          '</p>';
      }
      ['google', 'microsoft'].forEach(function (p) {
        var block = status.providers[p] || {};
        if (!block.enabled) {
          return;
        }
        html += '<div class="oauth-provider-row">';
        html += '<span class="oauth-provider-name">' + escapeHtml(providerLabel(p)) + '</span>';
        if (block.connected) {
          html +=
            '<span class="oauth-connected-email">' +
            escapeHtml(block.email) +
            (active && active.provider === p && active.email === block.email ? ' (actif)' : '') +
            '</span>';
          html +=
            '<button type="button" class="btn btn-secondary btn-sm oauth-disconnect" data-provider="' +
            p +
            '">Déconnecter</button>';
          if (!(active && active.provider === p && active.email === block.email)) {
            html +=
              '<button type="button" class="btn btn-secondary btn-sm oauth-set-active" data-provider="' +
              p +
              '" data-email="' +
              String(block.email).replace(/"/g, '&quot;') +
              '">Utiliser</button>';
          }
        } else {
          html +=
            '<button type="button" class="btn btn-sm oauth-connect" data-provider="' +
            p +
            '">Connecter</button>';
        }
        html += '</div>';
      });
      container.innerHTML = html;
    });
  }

  /** Boutons connecter, déconnecter, utiliser compte actif. */
  function bindPanel(container) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var connect = e.target.closest('.oauth-connect');
      var disconnect = e.target.closest('.oauth-disconnect');
      var setActive = e.target.closest('.oauth-set-active');
      if (connect) {
        window.location.href = global.LoyerServerApi.buildUrl('oauth-start', {
          provider: connect.dataset.provider,
          purpose: 'mail'
        });
        return;
      }
      if (disconnect) {
        global.LoyerServerApi.disconnectOAuth(disconnect.dataset.provider)
          .then(function () {
            return fetchStatus();
          })
          .then(function () {
            renderStatusPanel(container);
            updateMailSendButton();
            if (global.LoyerNotify) global.LoyerNotify.success('Compte déconnecté.');
          })
          .catch(function (err) {
            if (global.LoyerNotify) global.LoyerNotify.error(err.message);
          });
        return;
      }
      if (setActive) {
        global.LoyerServerApi.setActiveOAuth(setActive.dataset.provider, setActive.dataset.email)
          .then(function () {
            cachedStatus = arguments[0] || cachedStatus;
            return renderStatusPanel(container);
          })
          .then(updateMailSendButton)
          .catch(function (err) {
            if (global.LoyerNotify) global.LoyerNotify.error(err.message);
          });
      }
    });
  }

  /** Active/désactive boutons mail selon transport. */
  function updateMailSendButton() {
    var btn = document.getElementById('btn-mail-send');
    var draftBtn = document.getElementById('btn-mail-draft');
    var hint = document.getElementById('mail-send-hint');
    var draftHint = document.getElementById('mail-draft-hint');
    if (btn) {
      btn.disabled = !isMailSendReady();
    }
    if (draftBtn) {
      draftBtn.disabled = !isMailDraftReady();
    }
    if (hint) {
      var text = mailSendHintText();
      hint.textContent = text;
      hint.classList.toggle('hidden', !text);
    }
    if (draftHint) {
      var draftText = mailDraftHintText();
      draftHint.textContent = draftText;
      draftHint.classList.toggle('hidden', !draftText);
    }
  }

  /** Init panneau OAuth mail Paramètres + retour callback. */
  function init() {
    handleOAuthReturn();
    var panel = document.getElementById('oauth-status-panel');
    bindPanel(panel);
    return fetchStatus().then(function () {
      if (panel) return renderStatusPanel(panel);
    }).then(updateMailSendButton);
  }

  global.LoyerMailOAuth = {
    init: init,
    fetchStatus: fetchStatus,
    refreshTransport: refreshTransport,
    getCachedStatus: getCachedStatus,
    isMailSendReady: isMailSendReady,
    isMailDraftReady: isMailDraftReady,
    renderStatusPanel: renderStatusPanel,
    updateMailSendButton: updateMailSendButton
  };
})(window);
