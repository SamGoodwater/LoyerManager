/** Paramètres, clé API, formulaires. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Affiche/masque le bloc clé API legacy. */
  function updateServerApiKeyBlock(show) {
    var block = App.$('#server-api-key-block');
    var input = App.$('#set-server-api-key');
    if (!block) return;
    if (show) {
      block.classList.remove('hidden');
      if (input && global.LoyerServerApi && global.LoyerServerApi.getStoredApiKey) {
        input.value = global.LoyerServerApi.getStoredApiKey();
      }
    } else {
      block.classList.add('hidden');
    }
  }

  /** Enregistre api_key en sessionStorage et reconnecte le store. */
  function saveServerApiKey() {
    var input = App.$('#set-server-api-key');
    var key = input ? String(input.value || '').trim() : '';
    if (!key) {
      LoyerNotify.warn('Entrez la clé d\'accès fournie par l\'administrateur.');
      return;
    }
    App.showLoading();
    LoyerStore.reconnectServer(key)
      .then(function (result) {
        App.state.data = result.data;
        App.renderAll();
        App.initTemplatesUi();
        App.updateDataFileStatus();
        App.updateSaveStatusBadge('saved');
        LoyerNotify.success('Connecté — données chargées.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Clé refusée.');
        App.updateSaveStatusBadge('needs-api-key');
      })
      .finally(hideLoading);
  }

  /** Aperçu image signature bailleur dans Paramètres. */
  function renderSignaturePreview() {
    var wrap = App.$('#signature-preview');
    var btnRemove = App.$('#btn-remove-signature');
    if (!wrap) return;
    var img = App.state.data.settings.bailleur.signatureImage;
    if (img) {
      wrap.innerHTML = '<img src="' + img + '" alt="Aperçu signature" class="signature-preview-img">';
      if (btnRemove) btnRemove.classList.remove('hidden');
    } else {
      wrap.innerHTML = '<p class="empty-msg" style="padding:0.5rem 0">Aucune image de signature</p>';
      if (btnRemove) btnRemove.classList.add('hidden');
    }
  }

  /** Reconstruit tout le formulaire Paramètres depuis state.data. */
  function renderSettings() {
    var s = App.state.data.settings;
    App.$('#set-lease-start').value = s.leaseStart;
    App.$('#set-rent-day').value = s.rentDueDay;
    App.$('#set-bailleur-name').value = s.bailleur.name;
    App.$('#set-bailleur-street').value = s.bailleur.street;
    App.$('#set-bailleur-cp').value = s.bailleur.postalCode;
    App.$('#set-bailleur-city').value = s.bailleur.city;
    App.$('#set-loc-name').value = s.locataire.name;
    App.$('#set-loc-street').value = s.locataire.street;
    App.$('#set-loc-cp').value = s.locataire.postalCode;
    App.$('#set-loc-city').value = s.locataire.city;
    App.$('#set-mail-signature').value = s.mail.signature || '';

    App.renderSignaturePreview();
    App.renderTemplateRegistry();

    App.updateDataFileStatus();

    App.$('#emitters-list').innerHTML = (s.emitterProfiles || s.emitters.map(function (name) {
      return { name: name, patterns: [] };
    }))
      .map(function (profile, i) {
        return (
          '<div class="emitter-profile">' +
          '<div class="form-row"><label>Nom affiché</label>' +
          '<input type="text" class="emitter-name" data-index="' + i + '" value="' + App.escapeHtml(profile.name) + '"></div>' +
          '<div class="form-row"><label>Motifs dans le libellé bancaire</label>' +
          '<textarea class="emitter-patterns" data-index="' + i + '" rows="3" placeholder="Jean Dupont">' +
          App.escapeHtml((profile.patterns || []).join('\n')) +
          '</textarea></div>' +
          '<button type="button" class="btn btn-danger btn-rm-emitter" data-index="' + i + '">Supprimer</button></div>'
        );
      })
      .join('');

    App.$('#prices-list').innerHTML = s.priceHistory
      .map(function (p, i) {
        var charges = p.charges != null ? p.charges : 0;
        var total = (Number(p.amount) || 0) + (Number(charges) || 0);
        return (
          '<div class="price-tier" style="margin-bottom:0.75rem;padding-bottom:0.75rem;border-bottom:1px solid var(--slate-200)">' +
          '<div class="grid-2" style="align-items:end;margin-bottom:0.5rem">' +
          '<div class="form-row"><label>À partir du</label>' +
          '<input type="date" class="price-from" data-index="' + i + '" value="' + p.from + '"></div>' +
          '<div class="form-row"><label class="price-total-label" data-index="' + i + '">Total mensuel : ' +
          LoyerCalc.formatCurrency(total) +
          '</label></div></div>' +
          '<div class="grid-2" style="align-items:end">' +
          '<div class="form-row"><label>Loyer hors charges (€)</label>' +
          '<input type="number" step="0.01" min="0" class="price-amount" data-index="' + i + '" value="' + p.amount + '"></div>' +
          '<div class="form-row" style="flex-direction:row;gap:0.5rem;align-items:flex-end">' +
          '<div style="flex:1"><label>Charges locatives (€)</label>' +
          '<input type="number" step="0.01" min="0" class="price-charges" data-index="' + i + '" value="' + charges + '"></div>' +
          '<button type="button" class="btn btn-danger btn-rm-price" data-index="' + i + '">×</button></div></div></div>'
        );
      })
      .join('');

    App.$('#recipients-list').innerHTML = s.mail.recipients
      .map(function (r, i) {
        return (
          '<div class="grid-2" style="align-items:end;margin-bottom:0.5rem">' +
          '<div class="form-row"><label>Email</label>' +
          '<input type="email" class="recipient-email" data-index="' + i + '" value="' + App.escapeHtml(r.email) + '"></div>' +
          '<div class="form-row" style="flex-direction:row;gap:0.5rem;align-items:flex-end">' +
          '<div style="flex:1"><label>Type</label>' +
          '<select class="recipient-type" data-index="' + i + '">' +
          '<option value="to"' + (r.type === 'to' ? ' selected' : '') + '>À</option>' +
          '<option value="cc"' + (r.type === 'cc' ? ' selected' : '') + '>CC</option>' +
          '<option value="bcc"' + (r.type === 'bcc' ? ' selected' : '') + '>CCI</option></select></div>' +
          '<button type="button" class="btn btn-danger btn-rm-recipient" data-index="' + i + '">×</button></div></div>'
        );
      })
      .join('');

    renderAccountPanel();
    renderSmtpSettingsForm();
    App.refreshSettingsNav();
  }

  /** Ligne statut compte + formulaire changement passphrase. */
  function renderAccountPanel() {
    var line = App.$('#account-status-line');
    var changeBlock = App.$('#account-change-passphrase');
    if (!line || !global.LoyerAuth) return;
    global.LoyerAuth.fetchAuthStatus().then(function (status) {
      if (!status || !status.user) {
        line.textContent = 'Non connecté';
        if (changeBlock) changeBlock.classList.add('hidden');
        return;
      }
      var label = status.user.email;
      if (status.user.provider === 'google') label += ' (Google)';
      else if (status.user.provider === 'microsoft') label += ' (Microsoft)';
      else label += ' (compte local)';
      line.textContent = 'Connecté en tant que ' + label;
      if (changeBlock) {
        changeBlock.classList.toggle('hidden', status.user.provider !== 'local');
      }
      if (global.LoyerHelp && global.LoyerHelp.refresh) {
        global.LoyerHelp.refresh();
      }
      if (global.LoyerAuth && global.LoyerAuth.updateHeaderAuthUi) {
        global.LoyerAuth.updateHeaderAuthUi();
      }
    });
  }

  /** Soumet auth-change-password pour compte local. */
  function handleChangePassphrase(e) {
    e.preventDefault();
    if (!global.LoyerAuth) return;
    var current = App.$('#account-current-passphrase').value;
    var next = App.$('#account-new-passphrase').value;
    var confirm = App.$('#account-confirm-passphrase').value;
    if (next !== confirm) {
      LoyerNotify.error('Les deux nouvelles passphrases ne correspondent pas.');
      return;
    }
    global.LoyerAuth.changePassphrase(current, next)
      .then(function () {
        App.$('#form-change-passphrase').reset();
        LoyerNotify.success('Passphrase modifiée.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Modification impossible.');
      });
  }

  /** Déconnexion session puis redirection login.html. */
  function performLogout() {
    var chain = global.LoyerAuth
      ? global.LoyerAuth.performLogout()
      : global.LoyerServerApi.logoutSession().then(function () {
          location.replace('login.html');
        });
    return chain.catch(function (err) {
      LoyerNotify.error(err.message || 'Déconnexion impossible.');
    });
  }

  /** Flux confirmation, export optionnel, suppression compte + reset complet. */
  function handleDeleteAccount() {
    if (!global.LoyerAuth) return;
    var isLocal = false;
    global.LoyerAuth.fetchAuthStatus()
      .then(function (status) {
        if (!status || !status.user) {
          throw new Error('Aucun compte connecté.');
        }
        isLocal = status.user.provider === 'local';
        return LoyerNotify.confirm(
          'Supprimer votre compte et réinitialiser toutes vos données ? Cette action efface les loyers, virements, modèles personnalisés, OAuth mail, SMTP et historique.',
          { confirmLabel: 'Continuer', danger: true }
        );
      })
      .then(function (ok) {
        if (!ok) return null;
        return LoyerNotify.confirm(
          'Télécharger une sauvegarde complète (JSON + paramètres serveur : OAuth mail, SMTP, historique) avant suppression ?',
          { confirmLabel: 'Oui, exporter', cancelLabel: 'Non, supprimer sans exporter' }
        ).then(function (wantExport) {
          return { wantExport: !!wantExport };
        });
      })
      .then(function (state) {
        if (!state) return null;
        if (isLocal) {
          return LoyerNotify.prompt('Saisissez votre passphrase pour confirmer la suppression du compte.', {
            inputType: 'password',
            placeholder: 'Passphrase',
            confirmLabel: 'Supprimer'
          }).then(function (password) {
            if (password === null) return null;
            return { wantExport: state.wantExport, password: password };
          });
        }
        return { wantExport: state.wantExport, password: '' };
      })
      .then(function (payload) {
        if (!payload) return;
        App.collectSettingsFromForm();
        var chain = Promise.resolve();
        if (payload.wantExport) {
          chain = LoyerStore.exportProfile(App.state.data).then(function () {
            LoyerNotify.success('Sauvegarde téléchargée.');
          });
        }
        return chain.then(function () {
          return global.LoyerAuth.deleteAccount(payload.password, { resetAllData: true });
        });
      })
      .then(function (result) {
        if (!result) return;
        localStorage.removeItem(LoyerStore.STORAGE_KEY);
        location.replace('login.html?setup=1');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Suppression du compte impossible.');
      });
  }

  /** Charge statut et champs SMTP depuis l'API. */
  function renderSmtpSettingsForm() {
    if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) return;
    global.LoyerServerApi.getSmtpSettings().then(function (smtp) {
      var statusLine = App.$('#smtp-status-line');
      if (statusLine) {
        statusLine.textContent = smtp.configured
          ? 'SMTP actif : ' + smtp.fromEmail + ' via ' + smtp.host
          : 'Aucune configuration SMTP enregistrée.';
      }
      var host = App.$('#set-smtp-host');
      if (host) host.value = smtp.host || '';
      var port = App.$('#set-smtp-port');
      if (port) port.value = smtp.port || 587;
      var enc = App.$('#set-smtp-encryption');
      if (enc) enc.value = smtp.encryption || 'tls';
      var user = App.$('#set-smtp-username');
      if (user) user.value = smtp.username || '';
      var from = App.$('#set-smtp-from-email');
      if (from) from.value = smtp.fromEmail || '';
      var fromName = App.$('#set-smtp-from-name');
      if (fromName) fromName.value = smtp.fromName || '';
      var pwd = App.$('#set-smtp-password');
      if (pwd) pwd.value = '';
    }).catch(function () {
      /* ignore */
    });
  }

  /** Lit les champs SMTP du formulaire Paramètres. */
  function collectSmtpFromForm() {
    return {
      host: App.$('#set-smtp-host') ? App.$('#set-smtp-host').value.trim() : '',
      port: App.$('#set-smtp-port') ? parseInt(App.$('#set-smtp-port').value, 10) : 587,
      encryption: App.$('#set-smtp-encryption') ? App.$('#set-smtp-encryption').value : 'tls',
      username: App.$('#set-smtp-username') ? App.$('#set-smtp-username').value.trim() : '',
      password: App.$('#set-smtp-password') ? App.$('#set-smtp-password').value : '',
      fromEmail: App.$('#set-smtp-from-email') ? App.$('#set-smtp-from-email').value.trim() : '',
      fromName: App.$('#set-smtp-from-name') ? App.$('#set-smtp-from-name').value.trim() : ''
    };
  }

  /** Sérialise bailleur, locataire, loyers, émetteurs, mail… */
  function collectSettingsFromForm() {
    var s = App.state.data.settings;
    s.leaseStart = App.$('#set-lease-start').value;
    s.rentDueDay = parseInt(App.$('#set-rent-day').value, 10) || 1;
    s.bailleur.name = App.$('#set-bailleur-name').value.trim();
    s.bailleur.street = App.$('#set-bailleur-street').value.trim();
    s.bailleur.postalCode = App.$('#set-bailleur-cp').value.trim();
    s.bailleur.city = App.$('#set-bailleur-city').value.trim();
    s.locataire.name = App.$('#set-loc-name').value.trim();
    s.locataire.street = App.$('#set-loc-street').value.trim();
    s.locataire.postalCode = App.$('#set-loc-cp').value.trim();
    s.locataire.city = App.$('#set-loc-city').value.trim();
    s.mail.signature = App.$('#set-mail-signature').value;

    s.emitterProfiles = [];
    App.$$('.emitter-name').forEach(function (inp) {
      var i = inp.dataset.index;
      var patternsInp = App.$('.emitter-patterns[data-index="' + i + '"]');
      var name = inp.value.trim();
      if (!name) return;
      var patterns = patternsInp
        ? patternsInp.value.split(/\r?\n/).map(function (line) {
            return line.trim();
          }).filter(Boolean)
        : [];
      s.emitterProfiles.push({ name: name, patterns: patterns });
    });
    if (!s.emitterProfiles.length) {
      s.emitterProfiles.push({ name: 'Locataire', patterns: [] });
    }
    s.emitters = s.emitterProfiles.map(function (profile) {
      return profile.name;
    });

    s.priceHistory = [];
    App.$$('.price-from').forEach(function (inp) {
      var i = inp.dataset.index;
      var amountInp = App.$('.price-amount[data-index="' + i + '"]');
      var chargesInp = App.$('.price-charges[data-index="' + i + '"]');
      if (inp.value && amountInp) {
        s.priceHistory.push({
          from: inp.value,
          amount: parseFloat(amountInp.value) || 0,
          charges: chargesInp ? parseFloat(chargesInp.value) || 0 : 0
        });
      }
    });
    s.priceHistory.sort(function (a, b) {
      return LoyerCalc.parseDate(a.from) - LoyerCalc.parseDate(b.from);
    });

    s.mail.recipients = [];
    App.$$('.recipient-email').forEach(function (inp) {
      var i = inp.dataset.index;
      var typeSel = App.$('.recipient-type[data-index="' + i + '"]');
      if (inp.value.trim()) {
        s.mail.recipients.push({ email: inp.value.trim(), type: typeSel ? typeSel.value : 'to' });
      }
    });
    if (!s.mail.recipients.length) {
      s.mail.recipients.push({ email: '', type: 'to' });
    }
  }

  App.updateServerApiKeyBlock = updateServerApiKeyBlock;
  App.saveServerApiKey = saveServerApiKey;
  App.renderSignaturePreview = renderSignaturePreview;
  App.renderSettings = renderSettings;

  var settingsNavObserver = null;

  /** Met en surbrillance le lien actif du sommaire paramètres. */
  function setActiveSettingsNavLink(activeLink) {
    document.querySelectorAll('.settings-nav-link').forEach(function (link) {
      var selected = link === activeLink;
      link.classList.toggle('is-active', selected);
      if (selected) link.setAttribute('aria-current', 'true');
      else link.removeAttribute('aria-current');
    });
  }

  /** Affiche ou masque les entrées du sommaire selon les sections visibles. */
  function refreshSettingsNav() {
    var dataNavItem = document.querySelector('[data-settings-nav-item="settings-data-section"]');
    var dataSection = document.getElementById('settings-data-section');
    if (dataNavItem && dataSection) {
      dataNavItem.classList.toggle('hidden', dataSection.classList.contains('hidden'));
    }
  }

  /** Défile vers une section paramètres (utilisé par l'aide intégrée). */
  function scrollToSettingsSection(id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    var link = document.querySelector('.settings-nav-link[href="#' + id + '"]');
    if (link) setActiveSettingsNavLink(link);
  }

  /** Sommaire latéral : navigation et surbrillance au défilement. */
  function bindSettingsNav() {
    var nav = document.querySelector('.settings-nav');
    if (!nav) return;

    var links = nav.querySelectorAll('.settings-nav-link');
    var sections = [];

    links.forEach(function (link) {
      var id = (link.getAttribute('href') || '').replace(/^#/, '');
      if (!id) return;
      var section = document.getElementById(id);
      if (!section) return;
      sections.push({ link: link, section: section });
      link.addEventListener('click', function (e) {
        e.preventDefault();
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        setActiveSettingsNavLink(link);
      });
    });

    if (settingsNavObserver) {
      settingsNavObserver.disconnect();
      settingsNavObserver = null;
    }

    if ('IntersectionObserver' in window && sections.length) {
      settingsNavObserver = new IntersectionObserver(
        function (entries) {
          var visible = entries.filter(function (entry) {
            return entry.isIntersecting;
          });
          if (!visible.length) return;
          visible.sort(function (a, b) {
            return b.intersectionRatio - a.intersectionRatio;
          });
          var match = nav.querySelector('[href="#' + visible[0].target.id + '"]');
          if (match) setActiveSettingsNavLink(match);
        },
        { root: null, rootMargin: '-15% 0px -55% 0px', threshold: [0, 0.15, 0.4] }
      );
      sections.forEach(function (item) {
        settingsNavObserver.observe(item.section);
      });
    }

    refreshSettingsNav();
  }

  App.refreshSettingsNav = refreshSettingsNav;
  App.scrollToSettingsSection = scrollToSettingsSection;
  App.collectSettingsFromForm = collectSettingsFromForm;

  var settingsDirty = false;
  var autoSaveTimer = null;
  var AUTO_SAVE_INTERVAL_MS = 30000;

  /** Marque paramètres modifiés pour auto-save. */
  function markSettingsDirty() {
    settingsDirty = true;
    var fab = App.$('#btn-save-settings');
    if (fab) fab.classList.add('fab-save-dirty');
  }

  /** Réinitialise l'indicateur dirty après sauvegarde. */
  function clearSettingsDirty() {
    settingsDirty = false;
    var fab = App.$('#btn-save-settings');
    if (fab) fab.classList.remove('fab-save-dirty');
  }

  /** True si l'élément déclenche l'auto-save paramètres. */
  function isSettingsAutoSaveTarget(el) {
    if (!el || !el.closest) return false;
    if (el.closest('#settings-mail-smtp')) return false;
    if (el.closest('#settings-account')) return false;
    if (el.closest('#settings-backup-json')) return false;
    if (el.closest('#settings-data-section')) return false;
    if (el.type === 'file' || el.tagName === 'BUTTON') return false;
    return el.closest('#panel-settings') !== null;
  }

  /** Persiste settings via store ; option silent pour auto-save. */
  function saveSettings(options) {
    options = options || {};
    App.collectSettingsFromForm();
    App.persist();
    clearSettingsDirty();
    var fab = App.$('#btn-save-settings');
    if (fab) {
      fab.title = options.manual
        ? 'Enregistrer les paramètres'
        : 'Sauvegarde automatique active — cliquez pour enregistrer maintenant';
    }
    if (options.refresh) App.renderAll();
    if (options.notify && global.LoyerNotify) {
      LoyerNotify.success('Paramètres enregistrés.');
    }
  }

  /** Sauvegarde immédiate si formulaire modifié (sortie onglet). */
  function flushSettingsIfDirty(silent) {
    if (!settingsDirty) return;
    saveSettings({ manual: !!silent, refresh: false, notify: false });
  }

  /** Timer 30 s : sauvegarde automatique si dirty. */
  function startSettingsAutoSave() {
    if (autoSaveTimer) return;
    autoSaveTimer = setInterval(function () {
      if (settingsDirty) flushSettingsIfDirty(true);
    }, AUTO_SAVE_INTERVAL_MS);
  }

  /** input/change sur champs paramètres → markSettingsDirty. */
  function bindSettingsAutoSave() {
    var panel = App.$('#panel-settings');
    if (!panel) return;
    panel.addEventListener(
      'input',
      function (e) {
        if (isSettingsAutoSaveTarget(e.target)) markSettingsDirty();
      },
      true
    );
    panel.addEventListener(
      'change',
      function (e) {
        if (isSettingsAutoSaveTarget(e.target)) markSettingsDirty();
      },
      true
    );
    window.addEventListener('beforeunload', function () {
      if (!settingsDirty) return;
      App.collectSettingsFromForm();
      App.persist();
    });
    startSettingsAutoSave();
  }

  App.flushSettingsIfDirty = flushSettingsIfDirty;
  App.markSettingsDirty = markSettingsDirty;

  /** Tous les écouteurs onglet Paramètres (compte, SMTP, listes). */
  function bindSettingsEvents() {
    bindSettingsAutoSave();
    bindSettingsNav();
    App.$('#btn-save-settings').addEventListener('click', function () {
      saveSettings({ manual: true, refresh: true, notify: true });
    });
    App.$('#set-signature-image').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!file.type.match(/^image\/(png|jpe?g|webp|gif)$/i)) {
        LoyerNotify.warn('Choisissez une image PNG, JPG, WebP ou GIF.');
        e.target.value = '';
        return;
      }
      if (file.size > App.SIGNATURE_IMAGE_MAX_BYTES) {
        LoyerNotify.warn('Image trop volumineuse (maximum 5 Mo).');
        e.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        App.state.data.settings.bailleur.signatureImage = reader.result;
        App.persist();
        App.renderSignaturePreview();
        LoyerNotify.success('Signature enregistrée. Régénérez la quittance pour l\'afficher.');
      };
      reader.onerror = function () {
        LoyerNotify.error('Impossible de lire l\'image.');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    App.$('#btn-remove-signature').addEventListener('click', function () {
      App.state.data.settings.bailleur.signatureImage = '';
      App.persist();
      App.renderSignaturePreview();
      LoyerNotify.info('Signature image supprimée.');
    });

    App.$('#btn-restore-signature').addEventListener('click', function () {
      if (typeof DEFAULT_SIGNATURE_IMAGE === 'undefined' || !DEFAULT_SIGNATURE_IMAGE) {
        LoyerNotify.error('Signature par défaut indisponible.');
        return;
      }
      App.state.data.settings.bailleur.signatureImage = DEFAULT_SIGNATURE_IMAGE;
      App.persist();
      App.renderSignaturePreview();
      LoyerNotify.success('Signature par défaut restaurée. Régénérez la quittance.');
    });

    App.$('#btn-add-emitter').addEventListener('click', function () {
      App.collectSettingsFromForm();
      if (!App.state.data.settings.emitterProfiles) App.state.data.settings.emitterProfiles = [];
      App.state.data.settings.emitterProfiles.push({ name: '', patterns: [] });
      markSettingsDirty();
      App.renderSettings();
    });
    App.$('#emitters-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-emitter')) {
        App.collectSettingsFromForm();
        App.state.data.settings.emitterProfiles.splice(parseInt(e.target.dataset.index, 10), 1);
        if (!App.state.data.settings.emitterProfiles.length) {
          App.state.data.settings.emitterProfiles.push({ name: 'Locataire', patterns: [] });
        }
        markSettingsDirty();
        App.renderSettings();
      }
    });

    App.$('#btn-add-price').addEventListener('click', function () {
      App.collectSettingsFromForm();
      App.state.data.settings.priceHistory.push({
        from: LoyerCalc.formatDateISO(new Date()),
        amount: 0,
        charges: 0
      });
      markSettingsDirty();
      App.renderSettings();
    });
    App.$('#prices-list').addEventListener('input', function (e) {
      if (
        e.target.classList.contains('price-amount') ||
        e.target.classList.contains('price-charges')
      ) {
        App.$$('.price-total-label').forEach(function (label) {
          var i = label.dataset.index;
          var amountInp = App.$('.price-amount[data-index="' + i + '"]');
          var chargesInp = App.$('.price-charges[data-index="' + i + '"]');
          var amount = amountInp ? parseFloat(amountInp.value) || 0 : 0;
          var charges = chargesInp ? parseFloat(chargesInp.value) || 0 : 0;
          label.textContent = 'Total mensuel : ' + LoyerCalc.formatCurrency(amount + charges);
        });
      }
    });
    App.$('#prices-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-price')) {
        App.collectSettingsFromForm();
        App.state.data.settings.priceHistory.splice(parseInt(e.target.dataset.index, 10), 1);
        markSettingsDirty();
        App.renderSettings();
      }
    });

    App.$('#btn-add-recipient').addEventListener('click', function () {
      App.collectSettingsFromForm();
      App.state.data.settings.mail.recipients.push({ email: '', type: 'to' });
      markSettingsDirty();
      App.renderSettings();
    });
    App.$('#recipients-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-recipient')) {
        App.collectSettingsFromForm();
        App.state.data.settings.mail.recipients.splice(parseInt(e.target.dataset.index, 10), 1);
        markSettingsDirty();
        App.renderSettings();
      }
    });

    App.bindIf('#btn-export-json', function (el) {
      el.addEventListener('click', function () {
        App.collectSettingsFromForm();
        App.persist();
        clearSettingsDirty();
        var d = new Date();
        var stamp = d.toISOString().slice(0, 10);
        LoyerStore.exportJson(App.state.data, 'loyer-data-' + stamp + '.json');
        LoyerNotify.success('Données exportées (JSON).');
      });
    });

    App.bindIf('#import-settings-json', function (el) {
      el.addEventListener('change', function (e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        LoyerStore.previewLoyerDataImport(file)
          .then(function (preview) {
            var s = preview.summary;
            var msg =
              'Fichier valide.\n\n' +
              'Bailleur : ' + s.bailleur + '\n' +
              'Locataire : ' + s.locataire + '\n' +
              'Début location : ' + s.leaseStart + '\n' +
              'Virements : ' + s.payments + '\n' +
              'Paliers loyer : ' + s.priceTiers + '\n\n' +
              'Remplacer vos données actuelles par ce fichier ?';
            return LoyerNotify.confirm(msg, { confirmLabel: 'Importer', danger: true }).then(function (ok) {
              if (!ok) return null;
              return preview;
            });
          })
          .then(function (preview) {
            if (!preview) return null;
            return LoyerStore.importLoyerData(preview.data);
          })
          .then(function (data) {
            if (!data) return;
            App.state.data = data;
            App.renderAll();
            App.updateDataFileStatus();
            clearSettingsDirty();
            if (global.LoyerMailOAuth) global.LoyerMailOAuth.refreshTransport();
            LoyerNotify.success('Données importées et enregistrées.');
          })
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Import JSON impossible.');
          });
      });
    });

    App.bindIf('#btn-export-profile', function (el) {
      el.addEventListener('click', function () {
        App.collectSettingsFromForm();
        App.persist();
        clearSettingsDirty();
        LoyerStore.exportProfile(App.state.data)
          .then(function () {
            LoyerNotify.success('Profil exporté (fichier chiffré — conservez le mot de passe de sauvegarde).');
          })
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Export impossible.');
          });
      });
    });

    var btnSaveApiKey = App.$('#btn-save-api-key');
    if (btnSaveApiKey) {
      btnSaveApiKey.addEventListener('click', saveServerApiKey);
    }
    var apiKeyInput = App.$('#set-server-api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') App.saveServerApiKey();
      });
    }

    App.$('#import-profile').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) App.importJsonFile(file);
      e.target.value = '';
    });
    App.$('#btn-delete-data').addEventListener('click', function () {
      LoyerNotify.confirm(
        'Supprimer toutes vos données loyer (virements, paramètres, modèles personnalisés) ? Cette action est irréversible.',
        { confirmLabel: 'Continuer', danger: true }
      ).then(function (ok) {
        if (!ok) return null;
        return LoyerNotify.confirm(
          'Exporter une sauvegarde complète avant suppression ?',
          { confirmLabel: 'Oui, exporter', cancelLabel: 'Non, supprimer sans exporter' }
        ).then(function (wantExport) {
          return { wantExport: !!wantExport };
        });
      }).then(function (state) {
        if (!state) return;
        App.collectSettingsFromForm();
        var chain = Promise.resolve();
        if (state.wantExport) {
          chain = LoyerStore.exportProfile(App.state.data).then(function () {
            LoyerNotify.success('Sauvegarde téléchargée.');
          });
        }
        return chain.then(function () {
          return LoyerStore.reset();
        });
      }).then(function (data) {
        if (!data) return;
        App.state.data = data;
        App.persist();
        App.renderAll();
        App.updateDataFileStatus();
        if (global.LoyerMailOAuth) global.LoyerMailOAuth.refreshTransport();
        renderSmtpSettingsForm();
        LoyerNotify.success('Données réinitialisées.');
      }).catch(function (err) {
        LoyerNotify.error(err.message || 'Réinitialisation impossible.');
      });
    });
    App.$('#btn-delete-account').addEventListener('click', handleDeleteAccount);
    App.bindIf('#form-change-passphrase', function (el) {
      el.addEventListener('submit', handleChangePassphrase);
    });

    App.bindIf('#btn-test-smtp', function (el) {
      el.addEventListener('click', function () {
        if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) return;
        var payload = collectSmtpFromForm();
        if (!payload.host) {
          LoyerNotify.warn('Renseignez au minimum le serveur SMTP.');
          return;
        }
        el.disabled = true;
        global.LoyerServerApi.testSmtpSettings(payload)
          .then(function (message) {
            LoyerNotify.success(message || 'Connexion SMTP réussie.');
          })
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Test SMTP impossible.');
          })
          .finally(function () {
            el.disabled = false;
          });
      });
    });

    App.bindIf('#btn-save-smtp', function (el) {
      el.addEventListener('click', function () {
        if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) return;
        global.LoyerServerApi.saveSmtpSettings(collectSmtpFromForm())
          .then(function () {
            renderSmtpSettingsForm();
            if (global.LoyerMailOAuth) global.LoyerMailOAuth.refreshTransport();
            LoyerNotify.success('Configuration SMTP enregistrée.');
          })
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Enregistrement SMTP impossible.');
          });
      });
    });

    App.bindIf('#btn-clear-smtp', function (el) {
      el.addEventListener('click', function () {
        LoyerNotify.confirm('Supprimer la configuration SMTP ?', { confirmLabel: 'Supprimer', danger: true }).then(function (ok) {
          if (!ok) return;
          global.LoyerServerApi.clearSmtpSettings()
            .then(function () {
              renderSmtpSettingsForm();
              if (global.LoyerMailOAuth) global.LoyerMailOAuth.refreshTransport();
              LoyerNotify.info('Configuration SMTP supprimée.');
            })
            .catch(function (err) {
              LoyerNotify.error(err.message || 'Suppression impossible.');
            });
        });
      });
    });

    App.bindIf('#btn-logout', function (el) {
      el.addEventListener('click', performLogout);
    });
    App.bindIf('#btn-header-logout', function (el) {
      el.addEventListener('click', performLogout);
    });
  }

  App.bindSettingsEvents = bindSettingsEvents;
})(window);
