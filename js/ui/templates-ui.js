/** Registre et édition des modèles quittance/mail. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Insère du texte à la position curseur d'un input. */
  function insertAtInputCursor(input, text) {
    if (!input) return;
    var start = input.selectionStart != null ? input.selectionStart : input.value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
  }

  /** Liste cliquable des mots-clés pour quittance ou mail. */
  function renderPlaceholderSidebar(listId, type) {
    var ul = App.$(listId);
    if (!ul) return;
    ul.innerHTML = LoyerTemplates.getPlaceholderCatalog(type)
      .map(function (item) {
        return (
          '<li><button type="button" class="placeholder-sidebar-btn" data-placeholder-key="' +
          App.escapeHtml(item.key) +
          '" title="' +
          App.escapeHtml(item.label) +
          '"><code>' +
          App.escapeHtml(item.key) +
          '</code><span class="placeholder-sidebar-label">' +
          App.escapeHtml(item.label) +
          '</span></button></li>'
        );
      })
      .join('');
  }

  /** Rafraîchit les deux sidebars mots-clés. */
  function refreshTemplatePlaceholderSidebars() {
    App.renderPlaceholderSidebar('#quittance-placeholder-list', 'quittance');
    App.renderPlaceholderSidebar('#mail-placeholder-list', 'mail');
  }

  /** Clic mot-clé → insertion dans l'éditeur Quill ou sujet. */
  function bindPlaceholderSidebar(listId, editorId, options) {
    options = options || {};
    var ul = App.$(listId);
    if (!ul || ul.dataset.bound) return;
    ul.dataset.bound = '1';
    ul.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-placeholder-key]');
      if (!btn) return;
      var key = btn.getAttribute('data-placeholder-key');
      if (!key) return;

      if (options.subjectInputId) {
        var subjectInp = App.$(options.subjectInputId);
        if (subjectInp && document.activeElement === subjectInp) {
          App.insertAtInputCursor(subjectInp, key);
          App.state.mailUi.mailSubjectRaw = subjectInp.value;
          return;
        }
      }

      var ed = LoyerEditor.get(editorId);
      if (ed) {
        ed.focus();
        ed.insertText(key);
      }
    });
  }

  /** Classes CSS layout aperçu vs édition (sidebar visible). */
  function setTemplateLayoutPreview(layoutId, isPreview) {
    var layout = App.$(layoutId);
    if (layout) layout.classList.toggle('is-preview', !!isPreview);
  }

  /** Active/désactive édition Quill ; masque la barre d'outils en lecture seule. */
  function setEditorReadOnly(editorId, readOnly) {
    var ed = LoyerEditor.get(editorId);
    if (!ed || !ed.quill) return;
    ed.quill.enable(!readOnly);
    var host = ed.quill.container.closest('.quill-editor-host') || ed.quill.container.parentElement;
    if (host) host.classList.toggle('is-readonly', !!readOnly);
    var card = ed.quill.container.closest('.template-editor-card');
    if (card) card.classList.toggle('is-readonly', !!readOnly);
  }

  /** Copie input objet mail vers state template. */
  function syncMailSubjectFromForm() {
    var inp = App.$('#set-mail-subject-template');
    if (inp) App.state.mailUi.mailSubjectRaw = inp.value;
  }

  /** Indique que le modèle quittance a été modifié. */
  function markQuittanceDirty() {
    if (!App.isQuittanceTemplateEditable()) return;
    App.state.quittanceUi.dirty = true;
  }

  /** Indique que le modèle mail a été modifié. */
  function markMailDirty() {
    if (!App.isMailTemplateEditable()) return;
    App.state.mailUi.dirty = true;
  }

  /** Récupère HTML brut depuis Quill quittance. */
  function captureQuittanceEditorRaw() {
    var ed = LoyerEditor.get('template-quittance');
    if (ed) App.state.quittanceUi.raw = ed.getHtml();
  }

  /** Récupère HTML brut depuis Quill mail. */
  function captureMailEditorRaw() {
    App.syncMailSubjectFromForm();
    var ed = LoyerEditor.get('template-mail');
    if (ed) App.state.mailUi.raw = ed.getHtml();
  }

  /** Sauvegarde modèle sur disque si dirty avant changement. */
  function flushTemplateEditsIfNeeded(type) {
    var ui = type === 'quittance' ? App.state.quittanceUi : App.state.mailUi;
    if (ui.mode !== 'edit' || !ui.dirty) {
      return Promise.resolve();
    }
    if (type === 'quittance') {
      if (!App.isQuittanceTemplateEditable()) {
        ui.dirty = false;
        return Promise.resolve();
      }
      return App.saveQuittanceTemplateFromTab({ silent: true });
    }
    if (!App.isMailTemplateEditable()) {
      ui.dirty = false;
      return Promise.resolve();
    }
    return App.saveMailTemplateFromTab({ silent: true });
  }

  /** Exécute une action après flush des types modèles demandés. */
  function withTemplatesSaved(types, work) {
    types = types || ['quittance', 'mail'];
    var chain = Promise.resolve();
    types.forEach(function (type) {
      chain = chain.then(function () {
        return App.flushTemplateEditsIfNeeded(type);
      });
    });
    return chain.then(work);
  }

  /** Charge contenu HTML dans l'éditeur quittance. */
  function loadQuittanceTemplateEditor(content) {
    App.state.quittanceUi.raw = content;
    var ed = LoyerEditor.get('template-quittance');
    if (ed) ed.setHtml(content);
  }

  /** Charge contenu HTML dans l'éditeur mail. */
  function loadMailTemplateEditor(content) {
    App.state.mailUi.raw = content;
    var ed = LoyerEditor.get('template-mail');
    if (ed) ed.setHtml(content);
  }

  /** Liste des entrées registre pour quittance ou mail. */
  function getTemplateItems(type) {
    return LoyerTemplateManager.listMerged(App.state.data.settings, type);
  }

  /** Options <select> des modèles disponibles. */
  function fillTemplateSelect(selectId, type, selectedId) {
    var sel = App.$(selectId);
    if (!sel) return;
    var items = App.getTemplateItems(type);
    sel.innerHTML = items
      .map(function (item) {
        var label = item.name + (item.isDefault ? ' (défaut)' : '');
        return (
          '<option value="' +
          App.escapeHtml(item.id) +
          '"' +
          (item.id === selectedId ? ' selected' : '') +
          '>' +
          App.escapeHtml(label) +
          '</option>'
        );
      })
      .join('');
  }

  /** Tableau modèles dans Paramètres (actions, défaut). */
  function renderTemplateRegistry() {
    App.fillTemplateSelect('#sel-default-quittance', 'quittance', LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance'));
    App.fillTemplateSelect('#sel-default-mail', 'mail', LoyerTemplateManager.getDefaultId(App.state.data.settings, 'mail'));
    App.fillTemplateSelect('#sel-quittance-template', 'quittance', App.state.quittanceUi.selectedId);
    App.fillTemplateSelect('#sel-mail-template', 'mail', App.state.mailUi.selectedId);

    function renderList(listId, type) {
      var ul = App.$(listId);
      if (!ul) return;
      var defaultId = LoyerTemplateManager.getDefaultId(App.state.data.settings, type);
      var items = App.getTemplateItems(type);
      ul.innerHTML = items
        .map(function (item) {
          var badges = '';
          if (item.isProtected) {
            badges += ' <span class="template-protected-badge">Modèle de base</span>';
          }
          if (item.id === defaultId) {
            badges += ' <span class="template-default-badge">Défaut</span>';
          }
          var canDelete = !item.isProtected && item.id !== defaultId;
          return (
            '<li class="template-registry-item">' +
            '<span class="template-registry-name">' +
            App.escapeHtml(item.name) +
            badges +
            '</span>' +
            '<span class="template-registry-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm btn-edit-template" data-type="' +
            type +
            '" data-id="' +
            App.escapeHtml(item.id) +
            '">' +
            (item.isProtected ? 'Aperçu' : 'Modifier') +
            '</button>' +
            (canDelete
              ? '<button type="button" class="btn btn-danger btn-sm btn-del-template" data-type="' +
                type +
                '" data-id="' +
                App.escapeHtml(item.id) +
                '">Supprimer</button>'
              : '') +
            '</span></li>'
          );
        })
        .join('');
    }

    renderList('#quittance-templates-list', 'quittance');
    renderList('#mail-templates-list', 'mail');
  }

  /** Charge modèle quittance par id (API + éditeur). */
  function loadQuittanceTemplateById(id) {
    App.state.quittanceUi.selectedId = id;
    return LoyerTemplateManager.loadQuittance(id).then(function (content) {
      App.loadQuittanceTemplateEditor(content);
      App.state.quittanceUi.dirty = false;
      App.fillTemplateSelect('#sel-quittance-template', 'quittance', id);
      App.updateTemplateEditControls('quittance');
      if (App.state.quittanceUi.mode === 'edit' && !App.isQuittanceTemplateEditable()) {
        return App.applyQuittanceTabMode('preview');
      }
    });
  }

  /** Charge modèle mail par id (corps + sujet). */
  function loadMailTemplateById(id) {
    App.state.mailUi.selectedId = id;
    return LoyerTemplateManager.loadMail(id).then(function (parts) {
      App.state.mailUi.mailSubjectRaw = parts.subject || '';
      App.loadMailTemplateEditor(parts.body || '');
      var subjectInp = App.$('#set-mail-subject-template');
      if (subjectInp) subjectInp.value = App.state.mailUi.mailSubjectRaw;
      App.state.mailUi.dirty = false;
      App.fillTemplateSelect('#sel-mail-template', 'mail', id);
      App.updateTemplateEditControls('mail');
      if (App.state.mailUi.mode === 'edit' && !App.isMailTemplateEditable()) {
        return App.applyMailTabMode('preview');
      }
    });
  }

  /** Initialisation selects, registre, sidebars mots-clés. */
  function initTemplatesUi() {
    if (!App.state.quittanceUi.selectedId) {
      App.state.quittanceUi.selectedId = LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
    }
    if (!App.state.mailUi.selectedId) {
      App.state.mailUi.selectedId = LoyerTemplateManager.getDefaultId(App.state.data.settings, 'mail');
    }

    App.refreshTemplatePlaceholderSidebars();
    App.bindPlaceholderSidebar('#quittance-placeholder-list', 'template-quittance');
    App.bindPlaceholderSidebar('#mail-placeholder-list', 'template-mail', {
      subjectInputId: 'set-mail-subject-template'
    });

    return Promise.all([App.loadQuittanceTemplateById(App.state.quittanceUi.selectedId), App.loadMailTemplateById(App.state.mailUi.selectedId)])
      .then(function () {
        App.renderTemplateRegistry();
        App.applyQuittanceTabMode(App.state.quittanceUi.mode);
        App.applyMailTabMode(App.state.mailUi.mode);
        App.updateTemplateEditControls('quittance');
        App.updateTemplateEditControls('mail');
        if (App.state.quittanceUi.pendingEditId) {
          var qId = App.state.quittanceUi.pendingEditId;
          App.state.quittanceUi.pendingEditId = null;
          return App.loadQuittanceTemplateById(qId).then(function () {
            App.applyQuittanceTabMode(App.isTemplateEditable(qId) ? 'edit' : 'preview');
          });
        }
        if (App.state.mailUi.pendingEditId) {
          var mId = App.state.mailUi.pendingEditId;
          App.state.mailUi.pendingEditId = null;
          return App.loadMailTemplateById(mId).then(function () {
            App.applyMailTabMode(App.isTemplateEditable(mId) ? 'edit' : 'preview');
          });
        }
      })
      .then(function () {
        if (global.LoyerHelp) LoyerHelp.refresh();
      });
  }

  /** False pour les modèles de base complet/court (lecture seule). */
  function isTemplateEditable(id) {
    return !LoyerTemplateManager.isProtectedId(id) && !LoyerTemplateManager.isSystemId(id);
  }

  /** True si le modèle quittance courant est éditable. */
  function isQuittanceTemplateEditable() {
    return App.isTemplateEditable(App.state.quittanceUi.selectedId);
  }

  /** True si le modèle mail courant est éditable. */
  function isMailTemplateEditable() {
    return App.isTemplateEditable(App.state.mailUi.selectedId);
  }

  /** Active/désactive boutons selon éditabilité. */
  function updateTemplateEditControls(type) {
    var editable = type === 'quittance' ? App.isQuittanceTemplateEditable() : App.isMailTemplateEditable();
    var editBtn = App.$(type === 'quittance' ? '#btn-quittance-tab-edit' : '#btn-mail-tab-edit');
    var hint = App.$(type === 'quittance' ? '#quittance-template-readonly-hint' : '#mail-template-readonly-hint');
    if (editBtn) {
      editBtn.disabled = !editable;
      editBtn.title = editable ? '' : 'Les modèles complet et court sont en lecture seule — dupliquez-les pour les modifier.';
    }
    if (hint) {
      hint.classList.toggle('hidden', editable);
    }
  }

  /** Libellé affiché (nom registre ou id). */
  function getTemplateDisplayName(type, id) {
    var entry = LoyerTemplateManager.findEntry(App.state.data.settings, type, id);
    return entry ? entry.name : id;
  }

  /** Écrit modèle quittance sur le serveur. */
  function saveQuittanceTemplateFromTab(options) {
    options = options || {};
    App.captureQuittanceEditorRaw();
    var id = App.state.quittanceUi.selectedId;
    if (!App.isTemplateEditable(id)) {
      return Promise.reject(new Error('Les modèles complet et court ne peuvent pas être modifiés. Utilisez « Nouveau modèle… » ou « Importer modèle ».'));
    }
    return LoyerTemplateManager.saveQuittance(id, App.state.quittanceUi.raw).then(function () {
      App.state.quittanceUi.dirty = false;
      if (!options.silent) {
        LoyerNotify.success('Modèle quittance enregistré.');
      }
    });
  }

  /** Écrit corps + sujet mail sur le serveur. */
  function saveMailTemplateFromTab(options) {
    options = options || {};
    App.captureMailEditorRaw();
    var id = App.state.mailUi.selectedId;
    if (!App.isTemplateEditable(id)) {
      return Promise.reject(new Error('Les modèles complet et court ne peuvent pas être modifiés. Utilisez « Nouveau modèle… » ou « Importer modèle ».'));
    }
    return LoyerTemplateManager.saveMail(id, App.state.mailUi.raw, App.state.mailUi.mailSubjectRaw).then(function () {
      App.state.mailUi.dirty = false;
      if (!options.silent) {
        LoyerNotify.success('Modèle mail enregistré.');
      }
    });
  }

  /** Télécharge .html ou .json d'un modèle. */
  function exportTemplateById(type, id) {
    if (type === 'quittance') {
      return LoyerTemplateManager.loadQuittance(id).then(function (body) {
        LoyerTemplateIo.exportQuittanceTemplate(App.getTemplateDisplayName(type, id), body);
        LoyerNotify.success('Modèle quittance exporté.');
      });
    }
    return LoyerTemplateManager.loadMail(id).then(function (parts) {
      LoyerTemplateIo.exportMailTemplate(App.getTemplateDisplayName(type, id), parts.subject, parts.body);
      LoyerNotify.success('Modèle mail exporté.');
    });
  }

  /** Export du modèle sélectionné dans l'onglet actif. */
  function exportTemplateFromTab(type) {
    return App.flushTemplateEditsIfNeeded(type).then(function () {
      if (type === 'quittance') {
        return App.exportTemplateById('quittance', App.state.quittanceUi.selectedId);
      }
      return App.exportTemplateById('mail', App.state.mailUi.selectedId);
    });
  }

  /** Export depuis la liste Paramètres → Modèles. */
  function exportTemplateFromSettings(type) {
    var selectId = type === 'quittance' ? '#sel-default-quittance' : '#sel-default-mail';
    var sel = App.$(selectId);
    var id = sel && sel.value ? sel.value : LoyerTemplateManager.getDefaultId(App.state.data.settings, type);
    return App.exportTemplateById(type, id);
  }

  /** Import fichier → nouveau modèle (jamais écrase les modèles de base). */
  function importTemplateAsNew(type, file) {
    if (!file) return Promise.resolve();
    var defaultName = LoyerTemplateIo.templateNameFromFilename(file.name);
    return LoyerTemplateIo.readTemplateFile(type, file)
      .then(function (parsed) {
        return App.promptNewTemplateName(type, defaultName, { confirmLabel: 'Importer' }).then(function (name) {
          if (!name) return;
          return LoyerTemplateManager.createFrom(
            App.state.data.settings,
            type,
            LoyerTemplateManager.COMPLET_ID,
            name
          ).then(function (created) {
            var savePromise =
              type === 'mail'
                ? LoyerTemplateManager.saveMail(
                    created.id,
                    parsed.body,
                    parsed.subject != null ? parsed.subject : ''
                  )
                : LoyerTemplateManager.saveQuittance(created.id, parsed.body);
            return savePromise.then(function () {
              App.persist();
              App.renderTemplateRegistry();
              if (type === 'quittance') {
                return App.loadQuittanceTemplateById(created.id).then(function () {
                  App.showPanel('panel-quittance');
                  App.applyQuittanceTabMode('edit');
                  LoyerNotify.success('Modèle « ' + created.name + ' » importé.');
                });
              }
              return App.loadMailTemplateById(created.id).then(function () {
                App.showPanel('panel-mail');
                App.applyMailTabMode('edit');
                LoyerNotify.success('Modèle « ' + created.name + ' » importé.');
              });
            });
          });
        });
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Import impossible.');
      });
  }

  /** input[type=file] import modèle par type. */
  function bindTemplateImportInput(inputId, type) {
    App.bindIf(inputId, function (el) {
      el.addEventListener('change', function (e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        App.importTemplateAsNew(type, file);
      });
    });
  }

  /** Boîte de dialogue nom pour nouveau modèle. */
  function promptNewTemplateName(type, defaultName, options) {
    options = options || {};
    return LoyerNotify.prompt('Nom du nouveau modèle :', {
      placeholder: type === 'quittance' ? 'Ex. Relance 2025' : 'Ex. Mail relance',
      defaultValue: defaultName || '',
      confirmLabel: options.confirmLabel || 'Créer'
    });
  }

  /** Duplique le contenu courant en nouveau modèle. */
  function createTemplateFromCurrent(type) {
    if (type === 'quittance') App.captureQuittanceEditorRaw();
    else App.captureMailEditorRaw();
    var ui = type === 'quittance' ? App.state.quittanceUi : App.state.mailUi;
    var body = ui.raw;
    var subject = ui.mailSubjectRaw;
    return App.promptNewTemplateName(type).then(function (name) {
      if (!name) return;
      return LoyerTemplateManager.createFrom(App.state.data.settings, type, ui.selectedId, name).then(function (created) {
        var savePromise =
          type === 'mail'
            ? LoyerTemplateManager.saveMail(created.id, body, subject)
            : LoyerTemplateManager.saveQuittance(created.id, body);
        return savePromise.then(function () {
          App.persist();
          App.renderTemplateRegistry();
          if (type === 'quittance') {
            return App.loadQuittanceTemplateById(created.id).then(function () {
              App.applyQuittanceTabMode('edit');
              LoyerNotify.success('Modèle « ' + created.name + ' » créé.');
            });
          }
          return App.loadMailTemplateById(created.id).then(function () {
            App.applyMailTabMode('edit');
            LoyerNotify.success('Modèle « ' + created.name + ' » créé.');
          });
        });
      });
    });
  }

  /** Définit modèle par défaut quittance ou mail. */
  function setTemplateDefault(type, id) {
    LoyerTemplateManager.setDefault(App.state.data.settings, type, id);
    App.persist();
    App.renderTemplateRegistry();
    LoyerNotify.success('Modèle par défaut mis à jour.');
  }

  /** Confirme perte modifications non enregistrées. */
  function confirmDiscardTemplateDirty(ui, onProceed) {
    if (!ui.dirty || ui.mode !== 'edit') {
      onProceed();
      return;
    }
    var editable =
      ui === App.state.quittanceUi ? App.isQuittanceTemplateEditable() : App.isMailTemplateEditable();
    if (!editable) {
      ui.dirty = false;
      onProceed();
      return;
    }
    var saveFn = ui === App.state.quittanceUi ? saveQuittanceTemplateFromTab : saveMailTemplateFromTab;
    saveFn({ silent: true })
      .then(onProceed)
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Enregistrement impossible.');
      });
  }

  /** Change modèle actif quittance (avec flush). */
  function switchQuittanceTemplate(id) {
    App.confirmDiscardTemplateDirty(App.state.quittanceUi, function () {
      App.loadQuittanceTemplateById(id).then(function () {
        App.applyQuittanceTabMode(App.state.quittanceUi.mode);
      });
    });
  }

  /** Change modèle actif mail (avec flush). */
  function switchMailTemplate(id) {
    App.confirmDiscardTemplateDirty(App.state.mailUi, function () {
      App.loadMailTemplateById(id).then(function () {
        App.applyMailTabMode(App.state.mailUi.mode);
      });
    });
  }

  /** Passe en mode édition pour un modèle quittance. */
  function openQuittanceEditor(templateId) {
    App.state.quittanceUi.pendingEditId = templateId || App.state.quittanceUi.selectedId;
    App.showPanel('panel-quittance');
  }

  /** Passe en mode édition pour un modèle mail. */
  function openMailEditor(templateId) {
    App.state.mailUi.pendingEditId = templateId || App.state.mailUi.selectedId;
    App.showPanel('panel-mail');
  }

  /** Crée variante à partir du modèle système. */
  function createNewTemplateFromDefault(type) {
    var sourceId = LoyerTemplateManager.COMPLET_ID;
    return App.promptNewTemplateName(type).then(function (name) {
      if (!name) return;
      return LoyerTemplateManager.createFrom(App.state.data.settings, type, sourceId, name).then(function (created) {
        App.persist();
        App.renderTemplateRegistry();
        if (type === 'quittance') {
          return App.loadQuittanceTemplateById(created.id).then(function () {
            App.openQuittanceEditor(created.id);
            LoyerNotify.success('Modèle « ' + created.name + ' » créé à partir du modèle complet.');
          });
        }
        return App.loadMailTemplateById(created.id).then(function () {
          App.openMailEditor(created.id);
          LoyerNotify.success('Modèle « ' + created.name + ' » créé à partir du modèle complet.');
        });
      });
    }).catch(function (err) {
      LoyerNotify.error(err.message || 'Création du modèle impossible.');
    });
  }

  /** Assistant nouveau modèle quittance. */
  function openNewQuittanceFromSystem() {
    App.createNewTemplateFromDefault('quittance');
  }

  /** Assistant nouveau modèle mail. */
  function openNewMailFromSystem() {
    App.createNewTemplateFromDefault('mail');
  }

  /** Supprime modèle (confirmation) ; bascule défaut si besoin. */
  function deleteTemplate(type, id) {
    LoyerNotify.confirm('Supprimer ce modèle ? Cette action est irréversible.', {
      confirmLabel: 'Supprimer',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      LoyerTemplateManager.remove(App.state.data.settings, type, id)
        .then(function () {
          App.persist();
          App.renderTemplateRegistry();
          if (type === 'quittance') {
            var nextId = LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
            return App.loadQuittanceTemplateById(nextId).then(function () {
              App.applyQuittanceTabMode(App.state.quittanceUi.mode);
            });
          }
          var nextMailId = LoyerTemplateManager.getDefaultId(App.state.data.settings, 'mail');
          return App.loadMailTemplateById(nextMailId).then(function () {
            App.applyMailTabMode(App.state.mailUi.mode);
          });
        })
        .then(function () {
          LoyerNotify.success('Modèle supprimé.');
        })
        .catch(function (err) {
          LoyerNotify.error(err.message || 'Suppression impossible.');
        });
    });
  }

  App.insertAtInputCursor = insertAtInputCursor;
  App.renderPlaceholderSidebar = renderPlaceholderSidebar;
  App.refreshTemplatePlaceholderSidebars = refreshTemplatePlaceholderSidebars;
  App.bindPlaceholderSidebar = bindPlaceholderSidebar;
  App.setTemplateLayoutPreview = setTemplateLayoutPreview;
  App.setEditorReadOnly = setEditorReadOnly;
  App.syncMailSubjectFromForm = syncMailSubjectFromForm;
  App.markQuittanceDirty = markQuittanceDirty;
  App.markMailDirty = markMailDirty;
  App.captureQuittanceEditorRaw = captureQuittanceEditorRaw;
  App.captureMailEditorRaw = captureMailEditorRaw;
  App.loadQuittanceTemplateEditor = loadQuittanceTemplateEditor;
  App.loadMailTemplateEditor = loadMailTemplateEditor;
  App.getTemplateItems = getTemplateItems;
  App.fillTemplateSelect = fillTemplateSelect;
  App.renderTemplateRegistry = renderTemplateRegistry;
  App.loadQuittanceTemplateById = loadQuittanceTemplateById;
  App.loadMailTemplateById = loadMailTemplateById;
  App.initTemplatesUi = initTemplatesUi;
  App.isTemplateEditable = isTemplateEditable;
  App.isQuittanceTemplateEditable = isQuittanceTemplateEditable;
  App.isMailTemplateEditable = isMailTemplateEditable;
  App.updateTemplateEditControls = updateTemplateEditControls;
  App.getTemplateDisplayName = getTemplateDisplayName;
  App.saveQuittanceTemplateFromTab = saveQuittanceTemplateFromTab;
  App.saveMailTemplateFromTab = saveMailTemplateFromTab;
  App.exportTemplateById = exportTemplateById;
  App.flushTemplateEditsIfNeeded = flushTemplateEditsIfNeeded;
  App.withTemplatesSaved = withTemplatesSaved;
  App.exportTemplateFromTab = exportTemplateFromTab;
  App.exportTemplateFromSettings = exportTemplateFromSettings;
  App.importTemplateAsNew = importTemplateAsNew;
  App.bindTemplateImportInput = bindTemplateImportInput;
  App.promptNewTemplateName = promptNewTemplateName;
  App.createTemplateFromCurrent = createTemplateFromCurrent;
  App.setTemplateDefault = setTemplateDefault;
  App.confirmDiscardTemplateDirty = confirmDiscardTemplateDirty;
  App.switchQuittanceTemplate = switchQuittanceTemplate;
  App.switchMailTemplate = switchMailTemplate;
  App.openQuittanceEditor = openQuittanceEditor;
  App.openMailEditor = openMailEditor;
  App.createNewTemplateFromDefault = createNewTemplateFromDefault;
  App.openNewQuittanceFromSystem = openNewQuittanceFromSystem;
  App.openNewMailFromSystem = openNewMailFromSystem;
  App.deleteTemplate = deleteTemplate;

  /** Écouteurs création, import, export, défaut, suppression. */
  function bindTemplatesEvents() {
    App.bindIf('#sel-quittance-template', function (el) {
      el.addEventListener('change', function () {
        App.switchQuittanceTemplate(this.value);
      });
    });
    App.bindIf('#sel-mail-template', function (el) {
      el.addEventListener('change', function () {
        App.switchMailTemplate(this.value);
      });
    });
    App.bindIf('#sel-default-quittance', function (el) {
      el.addEventListener('change', function () {
        App.setTemplateDefault('quittance', this.value);
      });
    });
    App.bindIf('#sel-default-mail', function (el) {
      el.addEventListener('change', function () {
        App.setTemplateDefault('mail', this.value);
      });
    });

    App.bindIf('#btn-quittance-tab-edit', function (el) {
      el.addEventListener('click', function () {
        App.captureQuittanceEditorRaw();
        App.applyQuittanceTabMode('edit');
      });
    });
    App.bindIf('#btn-quittance-tab-preview', function (el) {
      el.addEventListener('click', function () {
        App.captureQuittanceEditorRaw();
        App.applyQuittanceTabMode('preview');
      });
    });
    App.bindIf('#btn-mail-tab-edit', function (el) {
      el.addEventListener('click', function () {
        App.captureMailEditorRaw();
        App.applyMailTabMode('edit');
      });
    });
    App.bindIf('#btn-mail-tab-preview', function (el) {
      el.addEventListener('click', function () {
        App.captureMailEditorRaw();
        App.applyMailTabMode('preview');
      });
    });

    App.bindIf('#btn-quittance-export-template', function (el) {
      el.addEventListener('click', function () {
        App.exportTemplateFromTab('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    App.bindIf('#btn-quittance-new', function (el) {
      el.addEventListener('click', function () {
        App.createTemplateFromCurrent('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Création impossible.');
        });
      });
    });
    App.bindIf('#btn-quittance-set-default', function (el) {
      el.addEventListener('click', function () {
        App.setTemplateDefault('quittance', App.state.quittanceUi.selectedId);
      });
    });

    App.bindIf('#btn-mail-export-template', function (el) {
      el.addEventListener('click', function () {
        App.exportTemplateFromTab('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    App.bindIf('#btn-mail-new', function (el) {
      el.addEventListener('click', function () {
        App.createTemplateFromCurrent('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Création impossible.');
        });
      });
    });
    App.bindIf('#btn-mail-set-default', function (el) {
      el.addEventListener('click', function () {
        App.setTemplateDefault('mail', App.state.mailUi.selectedId);
      });
    });

    App.bindIf('#btn-new-quittance-template', function (el) {
      el.addEventListener('click', openNewQuittanceFromSystem);
    });
    App.bindIf('#btn-new-mail-template', function (el) {
      el.addEventListener('click', openNewMailFromSystem);
    });
    App.bindIf('#btn-settings-export-quittance', function (el) {
      el.addEventListener('click', function () {
        App.exportTemplateFromSettings('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    App.bindIf('#btn-settings-export-mail', function (el) {
      el.addEventListener('click', function () {
        App.exportTemplateFromSettings('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    App.bindTemplateImportInput('#import-quittance-template-tab', 'quittance');
    App.bindTemplateImportInput('#import-mail-template-tab', 'mail');
    App.bindTemplateImportInput('#import-quittance-template-settings', 'quittance');
    App.bindTemplateImportInput('#import-mail-template-settings', 'mail');

    var quittanceList = App.$('#quittance-templates-list');
    if (quittanceList) {
      quittanceList.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-edit-template');
        var delBtn = e.target.closest('.btn-del-template');
        if (editBtn && editBtn.dataset.type === 'quittance') {
          App.openQuittanceEditor(editBtn.dataset.id);
        }
        if (delBtn && delBtn.dataset.type === 'quittance') {
          App.deleteTemplate('quittance', delBtn.dataset.id);
        }
      });
    }
    var mailList = App.$('#mail-templates-list');
    if (mailList) {
      mailList.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-edit-template');
        var delBtn = e.target.closest('.btn-del-template');
        if (editBtn && editBtn.dataset.type === 'mail') {
          App.openMailEditor(editBtn.dataset.id);
        }
        if (delBtn && delBtn.dataset.type === 'mail') {
          App.deleteTemplate('mail', delBtn.dataset.id);
        }
      });
    }

    App.bindIf('#set-mail-subject-template', function (el) {
      el.addEventListener('input', function () {
        App.state.mailUi.mailSubjectRaw = this.value;
        App.markMailDirty();
      });
    });

    var qTplEd = LoyerEditor.get('template-quittance');
    if (qTplEd && qTplEd.quill) {
      qTplEd.quill.on('text-change', function () {
        if (App.state.quittanceUi.mode === 'edit') App.markQuittanceDirty();
      });
    }
    var mTplEd = LoyerEditor.get('template-mail');
    if (mTplEd && mTplEd.quill) {
      mTplEd.quill.on('text-change', function () {
        if (App.state.mailUi.mode === 'edit') App.markMailDirty();
      });
    }
  }

  App.bindTemplatesEvents = bindTemplatesEvents;
})(window);
