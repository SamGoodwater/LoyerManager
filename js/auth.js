/**
 * Authentification session (compte local + OAuth Google/Microsoft).
 */
(function (global) {
  'use strict';

  var API_URL = 'api.php';
  var cachedStatus = null;

  /** Requête fetch JSON vers api.php ; propage needsSetup/needsLogin. */
  function fetchJson(url, options) {
    options = options || {};
    options.credentials = 'same-origin';
    options.cache = 'no-store';
    return fetch(url, options).then(function (res) {
      return res.json().catch(function () {
        return { ok: false, error: 'Réponse serveur invalide' };
      }).then(function (data) {
        if (!res.ok || !data || !data.ok) {
          var err = new Error((data && data.error) || 'Erreur HTTP ' + res.status);
          err.needsSetup = data && data.needsSetup;
          err.needsLogin = data && data.needsLogin;
          throw err;
        }
        return data;
      });
    });
  }

  /** Interroge auth-status et met en cache le résultat. */
  function fetchAuthStatus() {
    return fetchJson(API_URL + '?action=auth-status').then(function (data) {
      cachedStatus = data;
      if (data.demo && global.LoyerDemoUi && global.LoyerDemoUi.applyDemoUi) {
        global.LoyerDemoUi.applyDemoUi(data);
      }
      return data;
    });
  }

  /** Dernier statut auth en cache (sans requête réseau). */
  function getCachedStatus() {
    return cachedStatus;
  }

  /** True si une session active est connue côté client. */
  function isAuthenticated() {
    return !!(cachedStatus && cachedStatus.authenticated);
  }

  /** True si aucun compte utilisateur n'existe encore. */
  function needsSetup() {
    return !!(cachedStatus && cachedStatus.needsSetup);
  }

  /** POST auth-login (e-mail + passphrase). */
  function loginLocal(email, password) {
    return fetchJson(API_URL + '?action=auth-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
  }

  /** POST auth-setup — création du premier compte local. */
  function setupLocal(email, password) {
    return fetchJson(API_URL + '?action=auth-setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, password: password })
    });
  }

  /** GET état restauration en attente (initiation). */
  function fetchPendingBackup() {
    return fetchJson(API_URL + '?action=auth-pending-backup');
  }

  /** POST valide sauvegarde chiffrée et la met en session (initiation). */
  function prepareBackupImport(profile, backupPassword) {
    return fetchJson(API_URL + '?action=auth-prepare-backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile, backupPassword: backupPassword })
    });
  }

  /** Libellé lisible du compte source d'une sauvegarde. */
  function formatSourceAccount(sourceAccount) {
    if (!sourceAccount || !sourceAccount.email) return '';
    var provider = sourceAccount.provider || 'local';
    var label = provider === 'google' ? 'Google' : provider === 'microsoft' ? 'Microsoft' : 'compte local';
    return sourceAccount.email + ' (' + label + ')';
  }

  /** POST auth-logout et invalidation du cache. */
  function logout() {
    return fetchJson(API_URL + '?action=auth-logout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    }).then(function () {
      cachedStatus = null;
      try {
        if (global.LoyerStore && global.LoyerStore.STORAGE_KEY) {
          localStorage.removeItem(global.LoyerStore.STORAGE_KEY);
        }
      } catch (e) {
        /* ignore */
      }
    });
  }

  /** POST auth-delete-account (passphrase si compte local). */
  function deleteAccount(password, options) {
    options = options || {};
    return fetchJson(API_URL + '?action=auth-delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password: password || '',
        resetAllData: !!options.resetAllData
      })
    }).then(function () {
      cachedStatus = null;
    });
  }

  /** POST auth-change-password pour compte local. */
  function changePassphrase(currentPassword, newPassword) {
    return fetchJson(API_URL + '?action=auth-change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ currentPassword: currentPassword, newPassword: newPassword })
    });
  }

  /** Déconnexion puis redirection login.html. */
  function performLogout() {
    return logout().then(function () {
      location.replace('login.html');
    });
  }

  /** Affiche ou masque le bouton déconnexion du header. */
  function updateHeaderAuthUi() {
    var btn = document.getElementById('btn-header-logout');
    if (!btn) return Promise.resolve();
    return fetchAuthStatus()
      .then(function (status) {
        btn.classList.toggle('hidden', !status.authenticated);
      })
      .catch(function () {
        btn.classList.add('hidden');
      });
  }

  /** Liste lisible des fournisseurs OAuth activés. */
  function oauthProviderNames(oauth) {
    var names = [];
    if (oauth.google) names.push('Google');
    if (oauth.microsoft) names.push('Microsoft');
    return names;
  }

  /** Affiche/masque les boutons Google/Microsoft sur login.html. */
  function applyLoginOAuthUi(oauth, oauthBlock, btnGoogle, btnMicrosoft) {
    var hasGoogle = !!(oauth && oauth.google);
    var hasMicrosoft = !!(oauth && oauth.microsoft);
    if (oauthBlock) {
      oauthBlock.classList.toggle('hidden', !hasGoogle && !hasMicrosoft);
    }
    if (btnGoogle) {
      btnGoogle.classList.toggle('hidden', !hasGoogle);
      btnGoogle.disabled = !hasGoogle;
    }
    if (btnMicrosoft) {
      btnMicrosoft.classList.toggle('hidden', !hasMicrosoft);
      btnMicrosoft.disabled = !hasMicrosoft;
    }
  }

  /** Libellé affichable d'un provider OAuth. */
  function providerLabel(provider) {
    return provider === 'google' ? 'Google' : provider === 'microsoft' ? 'Microsoft' : provider;
  }

  /** Redirige vers auth-oauth-start pour connexion identité. */
  function startOAuthLogin(provider) {
    var oauth = (cachedStatus && cachedStatus.oauthLogin) || {};
    if (!oauth[provider]) {
      var msg = 'La connexion ' + providerLabel(provider) + ' n\'est pas disponible sur ce serveur.';
      if (global.LoyerNotify) {
        global.LoyerNotify.error(msg);
      } else {
        var errorEl = document.getElementById('login-error');
        if (errorEl) {
          errorEl.textContent = msg;
          errorEl.classList.remove('hidden');
        }
      }
      return;
    }
    window.location.href = API_URL + '?action=auth-oauth-start&provider=' + encodeURIComponent(provider);
  }

  /** location.replace vers login.html (option ?setup=1). */
  function redirectToLogin(setup) {
    var url = 'login.html';
    if (setup) url += '?setup=1';
    location.replace(url);
  }

  /** Toast après redirect OAuth/auth si une sauvegarde a été restaurée (index.html). */
  function handleProfileImportedReturn() {
    var params = new URLSearchParams(location.search);
    if (params.get('profile_imported') !== '1') return false;
    params.delete('profile_imported');
    var qs = params.toString();
    var newUrl = location.pathname + (qs ? '?' + qs : '') + location.hash;
    if (history.replaceState) {
      history.replaceState(null, '', newUrl);
    }
    if (global.LoyerNotify) {
      global.LoyerNotify.success('Profil restauré depuis votre sauvegarde.');
    }
    return true;
  }

  /** True si l'app tourne sous http(s) (pas file://). */
  function isHttpContext() {
    return location.protocol === 'http:' || location.protocol === 'https:';
  }

  /** Garde index.html : redirige vers login si non connecté. */
  function ensureAuthenticated() {
    if (location.pathname.indexOf('login.html') !== -1) {
      return Promise.resolve(cachedStatus || {});
    }
    if (!isHttpContext()) {
      return Promise.reject(new Error('Ouvrez l\'application via son adresse web (http ou https).'));
    }
    return fetchAuthStatus().then(function (status) {
      if (status.demo) {
        return status;
      }
      if (status.authenticated) {
        return status;
      }
      if (status.needsSetup) {
        redirectToLogin(true);
        return Promise.reject(new Error('Configuration requise'));
      }
      redirectToLogin(false);
      return Promise.reject(new Error('Connexion requise'));
    });
  }

  /** Initialise login.html : formulaire, OAuth, aide contextuelle. */
  function initLoginPage() {
    var params = new URLSearchParams(location.search);
    var isSetupMode = params.get('setup') === '1';
    var setupHasDataOnServer = false;
    var errorMsg = params.get('error');

    var subtitle = document.getElementById('login-subtitle');
    var setupHint = document.getElementById('login-setup-hint');
    var submitBtn = document.getElementById('btn-login-submit');
    var errorEl = document.getElementById('login-error');
    var oauthBlock = document.getElementById('login-oauth-block');
    var btnGoogle = document.getElementById('btn-login-google');
    var btnMicrosoft = document.getElementById('btn-login-microsoft');
    var backupBlock = document.getElementById('login-backup-block');
    var backupPending = document.getElementById('login-backup-pending');
    var backupForm = document.getElementById('login-backup-form');
    var backupNextHint = document.getElementById('login-backup-next-hint');
    var backupFile = document.getElementById('login-backup-file');
    var backupPassword = document.getElementById('login-backup-password');
    var btnBackupPrepare = document.getElementById('btn-login-backup-prepare');
    var passwordInput = document.getElementById('login-password');
    var passwordConfirmRow = document.getElementById('login-password-confirm-row');
    var passwordConfirmInput = document.getElementById('login-password-confirm');

    function applySetupModeUi() {
      if (passwordConfirmRow) passwordConfirmRow.classList.remove('hidden');
      if (passwordConfirmInput) {
        passwordConfirmInput.disabled = false;
        passwordConfirmInput.required = true;
      }
      if (passwordInput) passwordInput.autocomplete = 'new-password';
    }

    function showBackupPending(sourceAccount, expiresIn) {
      if (!backupPending) return;
      var src = formatSourceAccount(sourceAccount);
      var mins = expiresIn > 0 ? Math.max(1, Math.ceil(expiresIn / 60)) : 15;
      backupPending.innerHTML =
        '<strong>Sauvegarde prête à être restaurée</strong>' +
        (src ? 'Exportée depuis ' + src + '. ' : '') +
        'Valable encore ' + mins + ' min — créez votre compte pour finaliser.';
      backupPending.classList.remove('hidden');
      if (backupForm) backupForm.classList.add('hidden');
      if (backupNextHint) backupNextHint.classList.remove('hidden');
    }

    function refreshPendingBackup() {
      if (!isSetupMode || !backupBlock) return Promise.resolve();
      return fetchPendingBackup()
        .then(function (data) {
          if (data.pending) {
            showBackupPending(data.sourceAccount, data.expiresIn || 0);
          }
        })
        .catch(function () {
          /* ignore */
        });
    }

    if (errorMsg) {
      errorEl.textContent = decodeURIComponent(errorMsg);
      errorEl.classList.remove('hidden');
    }

    fetchAuthStatus().then(function (status) {
      if (status.demo) {
        location.replace('index.html');
        return;
      }
      if (status.serverBlocked && errorEl) {
        errorEl.textContent = 'Connexion indisponible : le serveur n\'est pas correctement configuré.';
        errorEl.classList.remove('hidden');
        var form = document.getElementById('form-login');
        if (form) form.classList.add('hidden');
        if (oauthBlock) oauthBlock.classList.add('hidden');
        if (backupBlock) backupBlock.classList.add('hidden');
        if (subtitle) subtitle.textContent = 'Contactez l\'administrateur du serveur.';
        return;
      }
      if (status.authenticated) {
        location.replace('index.html');
        return;
      }
      isSetupMode = isSetupMode || status.needsSetup;
      setupHasDataOnServer = !!status.hasData;
      if (isSetupMode) {
        var oauthNames = oauthProviderNames(status.oauthLogin || {});
        if (subtitle) {
          if (status.hasData) {
            subtitle.textContent = 'Créez un compte pour sécuriser l\'accès à vos données.';
          } else if (oauthNames.length) {
            subtitle.textContent =
              'Première utilisation — créez votre compte ou connectez-vous avec ' +
              oauthNames.join(' / ') +
              '.';
          } else {
            subtitle.textContent = 'Première utilisation — créez votre compte administrateur.';
          }
        }
        if (submitBtn) submitBtn.textContent = 'Créer mon compte';
        if (setupHint) setupHint.classList.remove('hidden');
        applySetupModeUi();
        if (backupBlock) backupBlock.classList.remove('hidden');
        document.title = 'Configuration — Loyer Manager';
        refreshPendingBackup();
      }

      applyLoginOAuthUi(status.oauthLogin || {}, oauthBlock, btnGoogle, btnMicrosoft);
    });

    document.getElementById('form-login').addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;
      if (isSetupMode) {
        var passwordConfirm = passwordConfirmInput ? passwordConfirmInput.value : '';
        if (password !== passwordConfirm) {
          if (global.LoyerNotify) {
            global.LoyerNotify.warn('Les deux passphrases ne correspondent pas.');
          } else if (errorEl) {
            errorEl.textContent = 'Les deux passphrases ne correspondent pas.';
            errorEl.classList.remove('hidden');
          }
          if (passwordConfirmInput) passwordConfirmInput.focus();
          return;
        }
      }
      var action = isSetupMode ? setupLocal(email, password) : loginLocal(email, password);
      action
        .then(function (data) {
          if (isSetupMode && !setupHasDataOnServer && !(data && data.profileImported)) {
            try {
              if (global.LoyerStore && global.LoyerStore.STORAGE_KEY) {
                localStorage.removeItem(global.LoyerStore.STORAGE_KEY);
              }
            } catch (e) {
              /* ignore */
            }
          }
          if (isSetupMode && data && data.profileImported && global.LoyerNotify) {
            global.LoyerNotify.success('Profil restauré depuis votre sauvegarde.');
          }
          location.replace('index.html');
        })
        .catch(function (err) {
          if (global.LoyerNotify) {
            global.LoyerNotify.error(err.message || 'Connexion impossible.');
          } else if (errorEl) {
            errorEl.textContent = err.message || 'Connexion impossible.';
            errorEl.classList.remove('hidden');
          }
        });
    });

    if (btnBackupPrepare) {
      btnBackupPrepare.addEventListener('click', function () {
        var file = backupFile && backupFile.files && backupFile.files[0];
        var pwd = backupPassword ? backupPassword.value : '';
        if (!file) {
          if (global.LoyerNotify) global.LoyerNotify.warn('Choisissez un fichier de sauvegarde.');
          return;
        }
        if (!pwd || pwd.length < 8) {
          if (global.LoyerNotify) global.LoyerNotify.warn('Mot de passe de sauvegarde requis (8 caractères minimum).');
          return;
        }
        btnBackupPrepare.disabled = true;
        var reader = new FileReader();
        reader.onload = function () {
          var profile;
          try {
            profile = JSON.parse(reader.result);
          } catch (e) {
            btnBackupPrepare.disabled = false;
            if (global.LoyerNotify) global.LoyerNotify.error('Fichier JSON invalide.');
            return;
          }
          prepareBackupImport(profile, pwd)
            .then(function (data) {
              showBackupPending(data.sourceAccount, data.expiresIn || 900);
              if (global.LoyerNotify) {
                global.LoyerNotify.success('Sauvegarde validée — créez votre compte pour restaurer les données.');
              }
            })
            .catch(function (err) {
              if (global.LoyerNotify) {
                global.LoyerNotify.error(err.message || 'Restauration impossible.');
              } else if (errorEl) {
                errorEl.textContent = err.message || 'Restauration impossible.';
                errorEl.classList.remove('hidden');
              }
            })
            .then(function () {
              btnBackupPrepare.disabled = false;
            });
        };
        reader.onerror = function () {
          btnBackupPrepare.disabled = false;
          if (global.LoyerNotify) global.LoyerNotify.error('Impossible de lire le fichier.');
        };
        reader.readAsText(file);
      });
    }

    [btnGoogle, btnMicrosoft].forEach(function (btn) {
      if (!btn) return;
      btn.addEventListener('click', function () {
        startOAuthLogin(btn.dataset.provider);
      });
    });

    if (global.LoyerHelp && global.LoyerHelp.init) {
      global.LoyerHelp.init();
    }
  }

  if (document.getElementById('login-main')) {
    document.addEventListener('DOMContentLoaded', initLoginPage);
  }

  global.LoyerAuth = {
    fetchAuthStatus: fetchAuthStatus,
    getCachedStatus: getCachedStatus,
    isAuthenticated: isAuthenticated,
    needsSetup: needsSetup,
    ensureAuthenticated: ensureAuthenticated,
    loginLocal: loginLocal,
    setupLocal: setupLocal,
    logout: logout,
    deleteAccount: deleteAccount,
    changePassphrase: changePassphrase,
    performLogout: performLogout,
    updateHeaderAuthUi: updateHeaderAuthUi,
    startOAuthLogin: startOAuthLogin,
    redirectToLogin: redirectToLogin,
    fetchPendingBackup: fetchPendingBackup,
    prepareBackupImport: prepareBackupImport,
    formatSourceAccount: formatSourceAccount,
    handleProfileImportedReturn: handleProfileImportedReturn,
    isDemoMode: function () {
      return !!(cachedStatus && cachedStatus.demo);
    }
  };
})(window);
