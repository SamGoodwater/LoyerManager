/**
 * Application principale — navigation et écrans.
 */
(function (global) {
  'use strict';

  var SIGNATURE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

  var state = {
    data: null,
    selectedYear: new Date().getFullYear(),
    selectedMonth: new Date().getMonth() + 1,
    period: {
      rangeUiOpen: false,
      fromYear: new Date().getFullYear(),
      fromMonth: new Date().getMonth() + 1,
      toYear: new Date().getFullYear(),
      toMonth: new Date().getMonth() + 1
    },
    focusYear: new Date().getFullYear(),
    focusMonth: new Date().getMonth() + 1,
    dashboardChartYear: new Date().getFullYear(),
    editingPaymentId: null,
    csvImportItems: [],
    quittanceUi: {
      selectedId: null,
      mode: 'preview',
      raw: '',
      dirty: false,
      pendingEditId: null
    },
    mailUi: {
      selectedId: null,
      mode: 'preview',
      raw: '',
      mailSubjectRaw: '',
      dirty: false,
      pendingEditId: null
    }
  };

  function $(sel) {
    return document.querySelector(sel);
  }

  function $$(sel) {
    return document.querySelectorAll(sel);
  }

  function bindIf(id, fn) {
    var el = $(id);
    if (el) fn(el);
  }

  function fmt(n) {
    return LoyerCalc.formatCurrency(n);
  }

  function persist() {
    state.data = LoyerStore.save(state.data);
    updateDataFileStatus();
    updateSaveStatusBadge(LoyerStore.getSaveStatus());
  }

  function showLoading() {
    var el = $('#app-loading');
    if (el) el.classList.remove('hidden');
  }

  function hideLoading() {
    var el = $('#app-loading');
    if (el) el.classList.add('hidden');
  }

  function updateSaveStatusBadge(status) {
    var badge = $('#save-status-badge');
    if (!badge) return;

    badge.classList.remove('hidden');
    badge.classList.remove(
      'save-status-saved',
      'save-status-pending',
      'save-status-needs-setup',
      'save-status-local',
      'save-status-error'
    );

    if (status === 'saved') {
      badge.textContent = 'Enregistré';
      badge.classList.add('save-status-saved');
      badge.title = 'Dernière modification enregistrée sur le serveur (data/ et templates/)';
      badge.disabled = false;
      return;
    }

    if (status === 'pending') {
      badge.textContent = 'Enregistrement…';
      badge.classList.add('save-status-pending');
      badge.title = 'Écriture en cours via api.php';
      badge.disabled = true;
      return;
    }

    if (status === 'error') {
      badge.textContent = 'Erreur de sauvegarde';
      badge.classList.add('save-status-error');
      badge.title = 'Cliquez pour ouvrir Paramètres → Données';
      badge.disabled = false;
      return;
    }

    if (status === 'needs-api-key') {
      badge.textContent = 'Clé API requise';
      badge.classList.add('save-status-needs-setup');
      badge.title = 'Cliquez pour saisir la clé API (Paramètres → Données)';
      badge.disabled = false;
      return;
    }

    if (status === 'offline') {
      badge.textContent = 'Serveur indisponible';
      badge.classList.add('save-status-local');
      badge.title = 'Données en cache local uniquement — vérifiez nginx et api.php';
      badge.disabled = false;
      return;
    }

    badge.textContent = 'Sauvegarde';
    badge.classList.add('save-status-local');
    badge.title = 'État de la sauvegarde';
    badge.disabled = false;
  }

  function openSettingsDataSection() {
    showPanel('panel-settings');
    var el = $('#settings-data-section');
    if (el && el.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  function bindSaveStatusEvents() {
    var badge = $('#save-status-badge');
    if (badge) {
      badge.addEventListener('click', function () {
        var status = LoyerStore.getSaveStatus();
        if (status === 'error' || status === 'needs-api-key' || status === 'offline') {
          openSettingsDataSection();
        }
      });
    }
    LoyerStore.onSaveStatusChange(updateSaveStatusBadge);
  }

  function applyInitResult(result) {
    if (!result) return;
    updateDataFileStatus();
    updateSaveStatusBadge(LoyerStore.getSaveStatus());
    if (result.needsApiKey) {
      LoyerNotify.warn('Clé API requise — renseignez-la dans Paramètres → Données.');
      openSettingsDataSection();
    } else if (result.offline) {
      LoyerNotify.warn('Serveur indisponible — données affichées depuis le cache local.');
    }
  }

  function insertAtInputCursor(input, text) {
    if (!input) return;
    var start = input.selectionStart != null ? input.selectionStart : input.value.length;
    var end = input.selectionEnd != null ? input.selectionEnd : input.value.length;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var pos = start + text.length;
    input.setSelectionRange(pos, pos);
    input.focus();
  }

  function renderPlaceholderSidebar(listId, type) {
    var ul = $(listId);
    if (!ul) return;
    ul.innerHTML = LoyerTemplates.getPlaceholderCatalog(type)
      .map(function (item) {
        return (
          '<li><button type="button" class="placeholder-sidebar-btn" data-placeholder-key="' +
          escapeHtml(item.key) +
          '" title="' +
          escapeHtml(item.label) +
          '"><code>' +
          escapeHtml(item.key) +
          '</code><span class="placeholder-sidebar-label">' +
          escapeHtml(item.label) +
          '</span></button></li>'
        );
      })
      .join('');
  }

  function refreshTemplatePlaceholderSidebars() {
    renderPlaceholderSidebar('#quittance-placeholder-list', 'quittance');
    renderPlaceholderSidebar('#mail-placeholder-list', 'mail');
  }

  function bindPlaceholderSidebar(listId, editorId, options) {
    options = options || {};
    var ul = $(listId);
    if (!ul || ul.dataset.bound) return;
    ul.dataset.bound = '1';
    ul.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-placeholder-key]');
      if (!btn) return;
      var key = btn.getAttribute('data-placeholder-key');
      if (!key) return;

      if (options.subjectInputId) {
        var subjectInp = $(options.subjectInputId);
        if (subjectInp && document.activeElement === subjectInp) {
          insertAtInputCursor(subjectInp, key);
          state.mailUi.mailSubjectRaw = subjectInp.value;
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

  function setTemplateLayoutPreview(layoutId, isPreview) {
    var layout = $(layoutId);
    if (layout) layout.classList.toggle('is-preview', !!isPreview);
  }

  function setEditorReadOnly(editorId, readOnly) {
    var ed = LoyerEditor.get(editorId);
    if (!ed || !ed.quill) return;
    ed.quill.enable(!readOnly);
    var host = document.getElementById(ed.quill.container.parentNode.id || '');
    var card = ed.quill.container.closest('.template-editor-card');
    if (card) card.classList.toggle('is-readonly', !!readOnly);
  }

  function syncMailSubjectFromForm() {
    var inp = $('#set-mail-subject-template');
    if (inp) state.mailUi.mailSubjectRaw = inp.value;
  }

  function markQuittanceDirty() {
    if (!isQuittanceTemplateEditable()) return;
    state.quittanceUi.dirty = true;
  }

  function markMailDirty() {
    if (!isMailTemplateEditable()) return;
    state.mailUi.dirty = true;
  }

  function captureQuittanceEditorRaw() {
    var ed = LoyerEditor.get('template-quittance');
    if (ed) state.quittanceUi.raw = ed.getHtml();
  }

  function captureMailEditorRaw() {
    syncMailSubjectFromForm();
    var ed = LoyerEditor.get('template-mail');
    if (ed) state.mailUi.raw = ed.getHtml();
  }

  function flushTemplateEditsIfNeeded(type) {
    var ui = type === 'quittance' ? state.quittanceUi : state.mailUi;
    if (ui.mode !== 'edit' || !ui.dirty) {
      return Promise.resolve();
    }
    if (type === 'quittance') {
      if (!isQuittanceTemplateEditable()) {
        ui.dirty = false;
        return Promise.resolve();
      }
      return saveQuittanceTemplateFromTab({ silent: true });
    }
    if (!isMailTemplateEditable()) {
      ui.dirty = false;
      return Promise.resolve();
    }
    return saveMailTemplateFromTab({ silent: true });
  }

  function withTemplatesSaved(types, work) {
    types = types || ['quittance', 'mail'];
    var chain = Promise.resolve();
    types.forEach(function (type) {
      chain = chain.then(function () {
        return flushTemplateEditsIfNeeded(type);
      });
    });
    return chain.then(work);
  }

  function loadQuittanceTemplateEditor(content) {
    state.quittanceUi.raw = content;
    var ed = LoyerEditor.get('template-quittance');
    if (ed) ed.setHtml(content);
  }

  function loadMailTemplateEditor(content) {
    state.mailUi.raw = content;
    var ed = LoyerEditor.get('template-mail');
    if (ed) ed.setHtml(content);
  }

  function getTemplateItems(type) {
    return LoyerTemplateManager.listMerged(state.data.settings, type);
  }

  function fillTemplateSelect(selectId, type, selectedId) {
    var sel = $(selectId);
    if (!sel) return;
    var items = getTemplateItems(type);
    sel.innerHTML = items
      .map(function (item) {
        var label = item.name + (item.isDefault ? ' (défaut)' : '');
        return (
          '<option value="' +
          escapeHtml(item.id) +
          '"' +
          (item.id === selectedId ? ' selected' : '') +
          '>' +
          escapeHtml(label) +
          '</option>'
        );
      })
      .join('');
  }

  function renderTemplateRegistry() {
    fillTemplateSelect('#sel-default-quittance', 'quittance', LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance'));
    fillTemplateSelect('#sel-default-mail', 'mail', LoyerTemplateManager.getDefaultId(state.data.settings, 'mail'));
    fillTemplateSelect('#sel-quittance-template', 'quittance', state.quittanceUi.selectedId);
    fillTemplateSelect('#sel-mail-template', 'mail', state.mailUi.selectedId);

    function renderList(listId, type) {
      var ul = $(listId);
      if (!ul) return;
      var defaultId = LoyerTemplateManager.getDefaultId(state.data.settings, type);
      var items = getTemplateItems(type);
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
            escapeHtml(item.name) +
            badges +
            '</span>' +
            '<span class="template-registry-actions">' +
            '<button type="button" class="btn btn-secondary btn-sm btn-edit-template" data-type="' +
            type +
            '" data-id="' +
            escapeHtml(item.id) +
            '">' +
            (item.isProtected ? 'Aperçu' : 'Modifier') +
            '</button>' +
            (canDelete
              ? '<button type="button" class="btn btn-danger btn-sm btn-del-template" data-type="' +
                type +
                '" data-id="' +
                escapeHtml(item.id) +
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

  function loadQuittanceTemplateById(id) {
    state.quittanceUi.selectedId = id;
    return LoyerTemplateManager.loadQuittance(id).then(function (content) {
      loadQuittanceTemplateEditor(content);
      state.quittanceUi.dirty = false;
      fillTemplateSelect('#sel-quittance-template', 'quittance', id);
      updateTemplateEditControls('quittance');
      if (state.quittanceUi.mode === 'edit' && !isQuittanceTemplateEditable()) {
        return applyQuittanceTabMode('preview');
      }
    });
  }

  function loadMailTemplateById(id) {
    state.mailUi.selectedId = id;
    return LoyerTemplateManager.loadMail(id).then(function (parts) {
      state.mailUi.mailSubjectRaw = parts.subject || '';
      loadMailTemplateEditor(parts.body || '');
      var subjectInp = $('#set-mail-subject-template');
      if (subjectInp) subjectInp.value = state.mailUi.mailSubjectRaw;
      state.mailUi.dirty = false;
      fillTemplateSelect('#sel-mail-template', 'mail', id);
      updateTemplateEditControls('mail');
      if (state.mailUi.mode === 'edit' && !isMailTemplateEditable()) {
        return applyMailTabMode('preview');
      }
    });
  }

  function applyQuittanceTabMode(mode) {
    var apply = function () {
      state.quittanceUi.mode = mode;
      $$('#panel-quittance .template-mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      var previewWrap = $('#quittance-preview-wrap');
      var editWrap = $('#quittance-edit-wrap');
      if (mode === 'preview') {
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (editWrap) editWrap.classList.add('hidden');
        renderQuittancePreview();
        return;
      }
      if (previewWrap) previewWrap.classList.add('hidden');
      if (editWrap) editWrap.classList.remove('hidden');
      loadQuittanceTemplateEditor(state.quittanceUi.raw);
      setEditorReadOnly('template-quittance', !isQuittanceTemplateEditable());
      setTemplateLayoutPreview('#quittance-template-layout', false);
      updateTemplateEditControls('quittance');
      refreshTemplatePlaceholderSidebars();
    };

    if (mode === 'preview' && state.quittanceUi.mode === 'edit' && state.quittanceUi.dirty && isQuittanceTemplateEditable()) {
      return saveQuittanceTemplateFromTab({ silent: true })
        .then(apply)
        .catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
    }
    if (mode === 'preview' && state.quittanceUi.mode === 'edit' && state.quittanceUi.dirty) {
      state.quittanceUi.dirty = false;
    }
    if (mode === 'edit' && !isQuittanceTemplateEditable()) {
      LoyerNotify.info('Le modèle principal est en lecture seule. Dupliquez-le pour le modifier.');
      mode = 'preview';
    }
    apply();
    return Promise.resolve();
  }

  function renderQuittancePreview() {
    var id = state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
    var ctx = getExportPeriodContext();
    var hint = $('#quittance-preview-hint');
    if (ctx.isRange) {
      if (hint) {
        hint.textContent =
          LoyerCalc.listMonthsInRange(ctx.fromYear, ctx.fromMonth, ctx.toYear, ctx.toMonth, state.data).length +
          ' quittances seront générées à l\'export (PDF, DOCX, HTML, mail).';
        hint.classList.remove('hidden');
      }
      return LoyerQuittance.renderBatchPreview(
        state.data,
        ctx.fromYear,
        ctx.fromMonth,
        ctx.toYear,
        ctx.toMonth,
        id
      ).catch(function (err) {
        console.error(err);
        LoyerNotify.error('Impossible de générer les quittances.');
      });
    }
    if (hint) hint.classList.add('hidden');
    return LoyerQuittance.render(state.data, state.selectedYear, state.selectedMonth, id).catch(function (err) {
      console.error(err);
      LoyerNotify.error('Impossible de générer la quittance.');
    });
  }

  function applyMailTabMode(mode) {
    var apply = function () {
      state.mailUi.mode = mode;
      $$('#panel-mail .template-mode-btn').forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.mode === mode);
      });
      var previewWrap = $('#mail-tab-preview-wrap');
      var editWrap = $('#mail-tab-edit-wrap');
      if (mode === 'preview') {
        if (previewWrap) previewWrap.classList.remove('hidden');
        if (editWrap) editWrap.classList.add('hidden');
        renderMailPreview();
        return;
      }
      if (previewWrap) previewWrap.classList.add('hidden');
      if (editWrap) editWrap.classList.remove('hidden');
      syncMailSubjectFromForm();
      loadMailTemplateEditor(state.mailUi.raw);
      var subjectInp = $('#set-mail-subject-template');
      if (subjectInp) {
        subjectInp.readOnly = !isMailTemplateEditable();
        subjectInp.value = state.mailUi.mailSubjectRaw;
      }
      setEditorReadOnly('template-mail', !isMailTemplateEditable());
      setTemplateLayoutPreview('#mail-template-layout', false);
      updateTemplateEditControls('mail');
      refreshTemplatePlaceholderSidebars();
    };

    if (mode === 'preview' && state.mailUi.mode === 'edit' && state.mailUi.dirty && isMailTemplateEditable()) {
      return saveMailTemplateFromTab({ silent: true })
        .then(apply)
        .catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
    }
    if (mode === 'preview' && state.mailUi.mode === 'edit' && state.mailUi.dirty) {
      state.mailUi.dirty = false;
    }
    if (mode === 'edit' && !isMailTemplateEditable()) {
      LoyerNotify.info('Le modèle principal est en lecture seule. Dupliquez-le pour le modifier.');
      mode = 'preview';
    }
    apply();
    return Promise.resolve();
  }

  function renderMailPreview() {
    var id = state.mailUi.selectedId || LoyerTemplateManager.getDefaultId(state.data.settings, 'mail');
    var ctx = getExportPeriodContext();
    var refYear = ctx.isRange ? ctx.toYear : state.selectedYear;
    var refMonth = ctx.isRange ? ctx.toMonth : state.selectedMonth;
    var hint = $('#mail-preview-hint');
    if (hint) {
      if (ctx.isRange) {
        hint.textContent =
          'Mail rédigé pour la période — le PDF joint contiendra ' +
          LoyerCalc.listMonthsInRange(ctx.fromYear, ctx.fromMonth, ctx.toYear, ctx.toMonth, state.data).length +
          ' quittance(s).';
        hint.classList.remove('hidden');
      } else {
        hint.classList.add('hidden');
      }
    }
    return LoyerTemplates.loadFilledMail(state.data, refYear, refMonth, id, ctx).then(function (filled) {
      var subjectInp = $('#mail-preview-subject');
      if (subjectInp) subjectInp.value = filled.subject;
      var previewEd = LoyerEditor.get('mail-preview');
      if (previewEd) {
        previewEd.setHtml(filled.bodyHtml);
        setEditorReadOnly('mail-preview', true);
      }
    });
  }

  function initTemplatesUi() {
    if (!state.quittanceUi.selectedId) {
      state.quittanceUi.selectedId = LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
    }
    if (!state.mailUi.selectedId) {
      state.mailUi.selectedId = LoyerTemplateManager.getDefaultId(state.data.settings, 'mail');
    }

    refreshTemplatePlaceholderSidebars();
    bindPlaceholderSidebar('#quittance-placeholder-list', 'template-quittance');
    bindPlaceholderSidebar('#mail-placeholder-list', 'template-mail', {
      subjectInputId: 'set-mail-subject-template'
    });

    return Promise.all([loadQuittanceTemplateById(state.quittanceUi.selectedId), loadMailTemplateById(state.mailUi.selectedId)])
      .then(function () {
        renderTemplateRegistry();
        applyQuittanceTabMode(state.quittanceUi.mode);
        applyMailTabMode(state.mailUi.mode);
        updateTemplateEditControls('quittance');
        updateTemplateEditControls('mail');
        if (state.quittanceUi.pendingEditId) {
          var qId = state.quittanceUi.pendingEditId;
          state.quittanceUi.pendingEditId = null;
          return loadQuittanceTemplateById(qId).then(function () {
            applyQuittanceTabMode(isTemplateEditable(qId) ? 'edit' : 'preview');
          });
        }
        if (state.mailUi.pendingEditId) {
          var mId = state.mailUi.pendingEditId;
          state.mailUi.pendingEditId = null;
          return loadMailTemplateById(mId).then(function () {
            applyMailTabMode(isTemplateEditable(mId) ? 'edit' : 'preview');
          });
        }
      })
      .then(function () {
        if (global.LoyerHelp) LoyerHelp.refresh();
      });
  }

  function isTemplateEditable(id) {
    return !LoyerTemplateManager.isProtectedId(id) && !LoyerTemplateManager.isSystemId(id);
  }

  function isQuittanceTemplateEditable() {
    return isTemplateEditable(state.quittanceUi.selectedId);
  }

  function isMailTemplateEditable() {
    return isTemplateEditable(state.mailUi.selectedId);
  }

  function updateTemplateEditControls(type) {
    var editable = type === 'quittance' ? isQuittanceTemplateEditable() : isMailTemplateEditable();
    var editBtn = $(type === 'quittance' ? '#btn-quittance-tab-edit' : '#btn-mail-tab-edit');
    var hint = $(type === 'quittance' ? '#quittance-template-readonly-hint' : '#mail-template-readonly-hint');
    if (editBtn) {
      editBtn.disabled = !editable;
      editBtn.title = editable ? '' : 'Le modèle principal est en lecture seule — dupliquez-le pour le modifier.';
    }
    if (hint) {
      hint.classList.toggle('hidden', editable);
    }
  }

  function getTemplateDisplayName(type, id) {
    var entry = LoyerTemplateManager.findEntry(state.data.settings, type, id);
    return entry ? entry.name : id;
  }

  function saveQuittanceTemplateFromTab(options) {
    options = options || {};
    captureQuittanceEditorRaw();
    var id = state.quittanceUi.selectedId;
    if (!isTemplateEditable(id)) {
      return Promise.reject(new Error('Le modèle principal ne peut pas être modifié. Utilisez « Nouveau modèle… » ou « Importer modèle ».'));
    }
    return LoyerTemplateManager.saveQuittance(id, state.quittanceUi.raw).then(function () {
      state.quittanceUi.dirty = false;
      if (!options.silent) {
        LoyerNotify.success('Modèle quittance enregistré.');
      }
    });
  }

  function saveMailTemplateFromTab(options) {
    options = options || {};
    captureMailEditorRaw();
    var id = state.mailUi.selectedId;
    if (!isTemplateEditable(id)) {
      return Promise.reject(new Error('Le modèle principal ne peut pas être modifié. Utilisez « Nouveau modèle… » ou « Importer modèle ».'));
    }
    return LoyerTemplateManager.saveMail(id, state.mailUi.raw, state.mailUi.mailSubjectRaw).then(function () {
      state.mailUi.dirty = false;
      if (!options.silent) {
        LoyerNotify.success('Modèle mail enregistré.');
      }
    });
  }

  function exportTemplateById(type, id) {
    if (type === 'quittance') {
      return LoyerTemplateManager.loadQuittance(id).then(function (body) {
        LoyerTemplateIo.exportQuittanceTemplate(getTemplateDisplayName(type, id), body);
        LoyerNotify.success('Modèle quittance exporté.');
      });
    }
    return LoyerTemplateManager.loadMail(id).then(function (parts) {
      LoyerTemplateIo.exportMailTemplate(getTemplateDisplayName(type, id), parts.subject, parts.body);
      LoyerNotify.success('Modèle mail exporté.');
    });
  }

  function exportTemplateFromTab(type) {
    return flushTemplateEditsIfNeeded(type).then(function () {
      if (type === 'quittance') {
        return exportTemplateById('quittance', state.quittanceUi.selectedId);
      }
      return exportTemplateById('mail', state.mailUi.selectedId);
    });
  }

  function exportTemplateFromSettings(type) {
    var selectId = type === 'quittance' ? '#sel-default-quittance' : '#sel-default-mail';
    var sel = $(selectId);
    var id = sel && sel.value ? sel.value : LoyerTemplateManager.getDefaultId(state.data.settings, type);
    return exportTemplateById(type, id);
  }

  function importTemplateAsNew(type, file) {
    if (!file) return Promise.resolve();
    var defaultName = LoyerTemplateIo.templateNameFromFilename(file.name);
    return LoyerTemplateIo.readTemplateFile(type, file)
      .then(function (parsed) {
        return promptNewTemplateName(type, defaultName, { confirmLabel: 'Importer' }).then(function (name) {
          if (!name) return;
          return LoyerTemplateManager.createFrom(
            state.data.settings,
            type,
            LoyerTemplateManager.LEGACY_ID,
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
              persist();
              renderTemplateRegistry();
              if (type === 'quittance') {
                return loadQuittanceTemplateById(created.id).then(function () {
                  showPanel('panel-quittance');
                  applyQuittanceTabMode('edit');
                  LoyerNotify.success('Modèle « ' + created.name + ' » importé.');
                });
              }
              return loadMailTemplateById(created.id).then(function () {
                showPanel('panel-mail');
                applyMailTabMode('edit');
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

  function bindTemplateImportInput(inputId, type) {
    bindIf(inputId, function (el) {
      el.addEventListener('change', function (e) {
        var file = e.target.files[0];
        e.target.value = '';
        if (!file) return;
        importTemplateAsNew(type, file);
      });
    });
  }

  function promptNewTemplateName(type, defaultName, options) {
    options = options || {};
    return LoyerNotify.prompt('Nom du nouveau modèle :', {
      placeholder: type === 'quittance' ? 'Ex. Relance 2025' : 'Ex. Mail relance',
      defaultValue: defaultName || '',
      confirmLabel: options.confirmLabel || 'Créer'
    });
  }

  function createTemplateFromCurrent(type) {
    if (type === 'quittance') captureQuittanceEditorRaw();
    else captureMailEditorRaw();
    var ui = type === 'quittance' ? state.quittanceUi : state.mailUi;
    var body = ui.raw;
    var subject = ui.mailSubjectRaw;
    return promptNewTemplateName(type).then(function (name) {
      if (!name) return;
      return LoyerTemplateManager.createFrom(state.data.settings, type, ui.selectedId, name).then(function (created) {
        var savePromise =
          type === 'mail'
            ? LoyerTemplateManager.saveMail(created.id, body, subject)
            : LoyerTemplateManager.saveQuittance(created.id, body);
        return savePromise.then(function () {
          persist();
          renderTemplateRegistry();
          if (type === 'quittance') {
            return loadQuittanceTemplateById(created.id).then(function () {
              applyQuittanceTabMode('edit');
              LoyerNotify.success('Modèle « ' + created.name + ' » créé.');
            });
          }
          return loadMailTemplateById(created.id).then(function () {
            applyMailTabMode('edit');
            LoyerNotify.success('Modèle « ' + created.name + ' » créé.');
          });
        });
      });
    });
  }

  function setTemplateDefault(type, id) {
    LoyerTemplateManager.setDefault(state.data.settings, type, id);
    persist();
    renderTemplateRegistry();
    LoyerNotify.success('Modèle par défaut mis à jour.');
  }

  function confirmDiscardTemplateDirty(ui, onProceed) {
    if (!ui.dirty || ui.mode !== 'edit') {
      onProceed();
      return;
    }
    var editable =
      ui === state.quittanceUi ? isQuittanceTemplateEditable() : isMailTemplateEditable();
    if (!editable) {
      ui.dirty = false;
      onProceed();
      return;
    }
    var saveFn = ui === state.quittanceUi ? saveQuittanceTemplateFromTab : saveMailTemplateFromTab;
    saveFn({ silent: true })
      .then(onProceed)
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Enregistrement impossible.');
      });
  }

  function switchQuittanceTemplate(id) {
    confirmDiscardTemplateDirty(state.quittanceUi, function () {
      loadQuittanceTemplateById(id).then(function () {
        applyQuittanceTabMode(state.quittanceUi.mode);
      });
    });
  }

  function switchMailTemplate(id) {
    confirmDiscardTemplateDirty(state.mailUi, function () {
      loadMailTemplateById(id).then(function () {
        applyMailTabMode(state.mailUi.mode);
      });
    });
  }

  function openQuittanceEditor(templateId) {
    state.quittanceUi.pendingEditId = templateId || state.quittanceUi.selectedId;
    showPanel('panel-quittance');
  }

  function openMailEditor(templateId) {
    state.mailUi.pendingEditId = templateId || state.mailUi.selectedId;
    showPanel('panel-mail');
  }

  function createNewTemplateFromDefault(type) {
    var sourceId = LoyerTemplateManager.LEGACY_ID;
    return promptNewTemplateName(type).then(function (name) {
      if (!name) return;
      return LoyerTemplateManager.createFrom(state.data.settings, type, sourceId, name).then(function (created) {
        persist();
        renderTemplateRegistry();
        if (type === 'quittance') {
          return loadQuittanceTemplateById(created.id).then(function () {
            openQuittanceEditor(created.id);
            LoyerNotify.success('Modèle « ' + created.name + ' » créé à partir du modèle principal.');
          });
        }
        return loadMailTemplateById(created.id).then(function () {
          openMailEditor(created.id);
          LoyerNotify.success('Modèle « ' + created.name + ' » créé à partir du modèle principal.');
        });
      });
    }).catch(function (err) {
      LoyerNotify.error(err.message || 'Création du modèle impossible.');
    });
  }

  function openNewQuittanceFromSystem() {
    createNewTemplateFromDefault('quittance');
  }

  function openNewMailFromSystem() {
    createNewTemplateFromDefault('mail');
  }

  function deleteTemplate(type, id) {
    LoyerNotify.confirm('Supprimer ce modèle ? Cette action est irréversible.', {
      confirmLabel: 'Supprimer',
      danger: true
    }).then(function (ok) {
      if (!ok) return;
      LoyerTemplateManager.remove(state.data.settings, type, id)
        .then(function () {
          persist();
          renderTemplateRegistry();
          if (type === 'quittance') {
            var nextId = LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
            return loadQuittanceTemplateById(nextId).then(function () {
              applyQuittanceTabMode(state.quittanceUi.mode);
            });
          }
          var nextMailId = LoyerTemplateManager.getDefaultId(state.data.settings, 'mail');
          return loadMailTemplateById(nextMailId).then(function () {
            applyMailTabMode(state.mailUi.mode);
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

  function updateServerApiKeyBlock(show) {
    var block = $('#server-api-key-block');
    var input = $('#set-server-api-key');
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

  function saveServerApiKey() {
    var input = $('#set-server-api-key');
    var key = input ? String(input.value || '').trim() : '';
    if (!key) {
      LoyerNotify.warn('Entrez la clé API définie dans config.php.');
      return;
    }
    showLoading();
    LoyerStore.reconnectServer(key)
      .then(function (result) {
        state.data = result.data;
        renderAll();
        initTemplatesUi();
        updateDataFileStatus();
        updateSaveStatusBadge('saved');
        LoyerNotify.success('Connecté au serveur — données chargées.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Clé API refusée.');
        updateSaveStatusBadge('needs-api-key');
      })
      .finally(hideLoading);
  }

  function updateDataFileStatus() {
    var el = $('#data-file-status');
    var intro = $('#settings-data-intro');
    if (!el) return;

    if (LoyerStore.usesServerStorage && LoyerStore.usesServerStorage()) {
      el.textContent =
        'Mode serveur actif — ' + LoyerStore.getStoragePath() + ' et templates/ via api.php.';
      el.className = 'data-file-status data-file-status-ok';
      if (intro) {
        intro.innerHTML =
          'Les données et modèles sont enregistrés sur le serveur via <strong>api.php</strong>. Utilisez les boutons ci-dessous pour exporter ou importer une copie JSON.';
      }
      updateServerApiKeyBlock(false);
      return;
    }

    if (global.LoyerServerApi && global.LoyerServerApi.isHttpContext && global.LoyerServerApi.isHttpContext()) {
      if (LoyerStore.isServerAuthRequired && LoyerStore.isServerAuthRequired()) {
        el.textContent =
          'Le serveur exige une clé API — saisissez-la ci-dessous pour accéder à vos données.';
        el.className = 'data-file-status data-file-status-warn';
        if (intro) {
          intro.innerHTML =
            'Définissez <code>api_key</code> dans <code>config.php</code> côté serveur, puis entrez la même clé ici.';
        }
        updateServerApiKeyBlock(true);
        return;
      }
      el.textContent =
        'Serveur injoignable — cache local uniquement. Vérifiez nginx, php-fpm et api.php.';
      el.className = 'data-file-status data-file-status-warn';
      if (intro) {
        intro.innerHTML =
          'Ouvrez l\'application via <strong>http://</strong> (pas file://). Les modifications ne seront pas persistées tant que le serveur ne répond pas.';
      }
      updateServerApiKeyBlock(false);
      return;
    }

    el.textContent =
      'Mode hors ligne — ouvrez l\'application via un serveur web (http://localhost/).';
    el.className = 'data-file-status data-file-status-warn';
    if (intro) {
      intro.innerHTML = 'La sauvegarde sur disque nécessite nginx + PHP (api.php).';
    }
    updateServerApiKeyBlock(false);
  }

  function handleCorruptFile(err) {
    return LoyerNotify.corruptFileDialog(
      'Le fichier loyer-data.json est corrompu et ne peut pas être lu.',
      err.parseError
    ).then(function (action) {
      if (action === 'download') {
        LoyerStore.downloadCorruptBackup(err.rawText);
        LoyerNotify.info('Copie du fichier corrompu téléchargée dans vos Téléchargements.');
        return handleCorruptFile(err);
      }
      if (action === 'reset') {
        LoyerStore.downloadCorruptBackup(err.rawText);
        return LoyerStore.recreateAfterCorruption().then(function (data) {
          state.data = data;
          renderAll();
          updateDataFileStatus();
          updateSaveStatusBadge('saved');
          LoyerNotify.success('Fichier recréé. Une copie du fichier corrompu a été téléchargée.');
        });
      }
      state.data = LoyerStore.loadFallbackData();
      renderAll();
      updateDataFileStatus();
      updateSaveStatusBadge(LoyerStore.getSaveStatus());
      LoyerNotify.warn('Fichier non réinitialisé — données en cache local uniquement.');
    });
  }

  function showPanel(id) {
    $$('.panel').forEach(function (p) {
      p.classList.toggle('active', p.id === id);
    });
    $$('.tabs button').forEach(function (b) {
      b.classList.toggle('active', b.dataset.panel === id);
    });
    var fab = $('#btn-save-settings');
    if (fab) {
      fab.classList.toggle('fab-visible', id === 'panel-settings');
    }
    if (global.LoyerHelp) {
      LoyerHelp.updateTabAccessibility(id);
      LoyerHelp.closePopover();
    }
    if (id === 'panel-quittance') {
      if (state.quittanceUi.pendingEditId) {
        var qPending = state.quittanceUi.pendingEditId;
        state.quittanceUi.pendingEditId = null;
        loadQuittanceTemplateById(qPending).then(function () {
          applyQuittanceTabMode(isTemplateEditable(qPending) ? 'edit' : 'preview');
        });
      } else if (state.quittanceUi.mode === 'preview') {
        renderQuittancePreview();
      }
    }
    if (id === 'panel-mail') {
      if (state.mailUi.pendingEditId) {
        var mPending = state.mailUi.pendingEditId;
        state.mailUi.pendingEditId = null;
        loadMailTemplateById(mPending).then(function () {
          applyMailTabMode(isTemplateEditable(mPending) ? 'edit' : 'preview');
        });
      } else if (state.mailUi.mode === 'preview') {
        renderMailPreview();
      }
    }
    if (id === 'panel-settings') {
      renderTemplateRegistry();
    }
    updatePeriodBarVisibility(id);
    updateHeaderSelection();
  }

  var PERIOD_PANELS = ['panel-dashboard', 'panel-quittance', 'panel-mail'];

  function syncPeriodBoundsToMonth() {
    state.period.fromYear = state.selectedYear;
    state.period.fromMonth = state.selectedMonth;
    state.period.toYear = state.selectedYear;
    state.period.toMonth = state.selectedMonth;
  }

  function getActivePanelId() {
    var p = $('.panel.active');
    return p ? p.id : 'panel-dashboard';
  }

  function getMonthlyRows() {
    return LoyerCalc.computeMonthlyRows(state.data);
  }

  function getDashboardSelectionRows(allRows) {
    allRows = allRows || getMonthlyRows();
    if (!global.LoyerPeriod) return allRows;
    var keys = LoyerPeriod.getFilterKeys();
    return allRows.filter(function (r) {
      return keys.indexOf(r.key) !== -1;
    });
  }

  function getPeriodDisplayLabel() {
    if (global.LoyerPeriod) return LoyerPeriod.formatPeriodLabel();
    return LoyerCalc.formatMonthLong(state.selectedYear, state.selectedMonth);
  }

  function getExportPeriodContext() {
    if (!isRangeActive()) {
      return {
        isRange: false,
        fromYear: state.selectedYear,
        fromMonth: state.selectedMonth,
        toYear: state.selectedYear,
        toMonth: state.selectedMonth
      };
    }
    var period = state.period;
    var fromKey = LoyerCalc.monthKey(period.fromYear, period.fromMonth);
    var toKey = LoyerCalc.monthKey(period.toYear, period.toMonth);
    if (fromKey <= toKey) {
      return {
        isRange: true,
        fromYear: period.fromYear,
        fromMonth: period.fromMonth,
        toYear: period.toYear,
        toMonth: period.toMonth
      };
    }
    return {
      isRange: true,
      fromYear: period.toYear,
      fromMonth: period.toMonth,
      toYear: period.fromYear,
      toMonth: period.fromMonth
    };
  }

  function updatePeriodTabLabels() {
    var label = getPeriodDisplayLabel();
    var qLabel = $('#quittance-period-label');
    var mLabel = $('#mail-period-label');
    if (qLabel) qLabel.textContent = label;
    if (mLabel) mLabel.textContent = label;
    var dashLabel = $('#dash-period-label');
    if (dashLabel) dashLabel.textContent = label;
    updateHeaderSelection();
  }

  function updateHeaderSelection() {
    var wrap = $('#header-selection');
    var text = $('#header-selection-text');
    if (!wrap || !text) return;
    var panel = getActivePanelId();
    var show = PERIOD_PANELS.indexOf(panel) !== -1;
    wrap.classList.toggle('hidden', !show);
    if (!show) return;
    var rangeActive = global.LoyerPeriod && LoyerPeriod.isRangeActive();
    var periodLabel = getPeriodDisplayLabel();
    if (rangeActive && panel === 'panel-dashboard') {
      text.textContent =
        periodLabel + ' · Détail : ' + LoyerCalc.formatMonthLong(state.focusYear, state.focusMonth);
    } else {
      text.textContent = periodLabel;
    }
  }

  function updatePeriodBarVisibility(panelId) {
    var bar = $('#period-bar');
    if (!bar) return;
    var show = PERIOD_PANELS.indexOf(panelId) !== -1;
    bar.classList.toggle('hidden', !show);
    if (show && global.LoyerPeriod) {
      LoyerPeriod.setCompactMode(false);
      LoyerPeriod.refresh();
    }
  }

  function initPeriodPicker() {
    if (!global.LoyerPeriod) return;
    syncPeriodBoundsToMonth();
    LoyerPeriod.init({
      mountEl: $('#period-picker-mount'),
      getState: function () {
        return state;
      },
      getRows: getMonthlyRows,
      callbacks: {
        onSelectMonth: function (year, month) {
          setSelectedPeriod(year, month);
        },
        onToggleRangeUi: function () {
          state.period.rangeUiOpen = !state.period.rangeUiOpen;
          if (state.period.rangeUiOpen) {
            state.period.fromYear = state.selectedYear;
            state.period.fromMonth = state.selectedMonth;
            state.period.toYear = state.selectedYear;
            state.period.toMonth = state.selectedMonth;
          }
          LoyerPeriod.refresh();
          onPeriodChanged();
        },
        onSetRange: function (fromY, fromM, toY, toM) {
          state.period.rangeUiOpen = true;
          state.period.fromYear = fromY;
          state.period.fromMonth = fromM;
          state.period.toYear = toY;
          state.period.toMonth = toM;
          var fromKey = LoyerCalc.monthKey(fromY, fromM);
          var toKey = LoyerCalc.monthKey(toY, toM);
          var target = toKey >= fromKey ? { year: toY, month: toM } : { year: fromY, month: fromM };
          setSelectedPeriod(target.year, target.month, { keepRange: true });
        }
      }
    });
  }

  function onPeriodChanged() {
    updatePeriodTabLabels();
    if (global.LoyerPeriod) LoyerPeriod.refresh();
    renderDashboard();
    var panel = getActivePanelId();
    if (panel === 'panel-quittance' && state.quittanceUi.mode === 'preview') {
      renderQuittancePreview();
    }
    if (panel === 'panel-mail' && state.mailUi.mode === 'preview') {
      renderMailPreview();
    }
  }

  function setSelectedPeriod(year, month, options) {
    options = options || {};
    state.selectedYear = year;
    state.selectedMonth = month;
    state.focusYear = year;
    state.focusMonth = month;
    if (!options.keepRange) {
      state.period.rangeUiOpen = false;
      syncPeriodBoundsToMonth();
    }
    if (!options.skipRender) onPeriodChanged();
  }

  function isRangeActive() {
    return global.LoyerPeriod && LoyerPeriod.isRangeActive();
  }

  function isRowInPeriodRange(row) {
    if (!isRangeActive()) return false;
    var fromKey = LoyerCalc.monthKey(state.period.fromYear, state.period.fromMonth);
    var toKey = LoyerCalc.monthKey(state.period.toYear, state.period.toMonth);
    if (fromKey > toKey) {
      var t = fromKey;
      fromKey = toKey;
      toKey = t;
    }
    return row.key >= fromKey && row.key <= toKey;
  }

  function isRowFocused(row) {
    return row.year === state.focusYear && row.month === state.focusMonth;
  }

  function setFocusMonth(year, month) {
    state.focusYear = year;
    state.focusMonth = month;
    renderDashboard();
  }

  function handleDashboardMonthClick(year, month) {
    if (isRangeActive()) {
      setFocusMonth(year, month);
    } else {
      setSelectedPeriod(year, month);
    }
  }

  function selectMonth(year, month) {
    handleDashboardMonthClick(year, month);
  }

  function getDashboardChartYear(allRows) {
    var years = LoyerCalc.getAvailableYears(allRows);
    if (!years.length) return state.dashboardChartYear;
    if (years.indexOf(state.dashboardChartYear) === -1) {
      state.dashboardChartYear = years[years.length - 1];
    }
    return state.dashboardChartYear;
  }

  function shiftDashboardChartYear(delta, allRows) {
    var years = LoyerCalc.getAvailableYears(allRows);
    if (!years.length) return;
    var idx = years.indexOf(state.dashboardChartYear);
    if (idx === -1) idx = years.length - 1;
    var next = idx + delta;
    if (next < 0 || next >= years.length) return;
    state.dashboardChartYear = years[next];
    renderDashboard();
  }

  function renderMonthStatusBadge(status) {
    return (
      '<span class="month-status month-status-' +
      status +
      '">' +
      escapeHtml(LoyerCalc.getMonthStatusLabel(status)) +
      '</span>'
    );
  }

  function heatmapCellHtml(row, year, month, status, extraClass) {
    var statusLabel = LoyerCalc.getMonthStatusLabel(status);
    var monthLabel = LoyerCalc.formatMonthLong(year, month);
    var title =
      monthLabel +
      '\nStatut : ' +
      statusLabel +
      '\nAttendu : ' +
      fmt(row.attendu) +
      '\nReçu : ' +
      fmt(row.recu);
    return (
      '<button type="button" class="heatmap-btn month-status-' +
      status +
      extraClass +
      '" data-year="' +
      year +
      '" data-month="' +
      month +
      '" data-status="' +
      status +
      '" title="' +
      escapeHtml(title) +
      '" aria-label="' +
      escapeHtml(monthLabel + ', ' + statusLabel) +
      '">' +
      '<span class="heatmap-cell-tip" role="tooltip">' +
      '<strong>' +
      escapeHtml(statusLabel) +
      '</strong><span>' +
      escapeHtml(monthLabel) +
      '</span></span></button>'
    );
  }

  function renderDashboardHeatmap(rows) {
    var el = $('#dashboard-heatmap');
    if (!el) return;

    var years = LoyerCalc.getAvailableYears(rows);
    if (!years.length) {
      el.innerHTML = '<p class="empty-msg">Aucune donnée</p>';
      return;
    }

    var rowByKey = {};
    rows.forEach(function (r) {
      rowByKey[r.key] = r;
    });
    var settings = state.data.settings || {};
    var statusOpts = { rentDueDay: settings.rentDueDay };

    var monthHeaders = LoyerCalc.MONTH_NAMES.map(function (name) {
      return '<div class="heatmap-col-label">' + name.slice(0, 3) + '</div>';
    }).join('');

    var body = years
      .map(function (year) {
        var cells = '<div class="heatmap-row-label">' + year + '</div>';
        for (var m = 1; m <= 12; m++) {
          var key = LoyerCalc.monthKey(year, m);
          var row = rowByKey[key];
          if (!row) {
            cells += '<div class="heatmap-cell heatmap-empty" aria-hidden="true"></div>';
            continue;
          }
          var status = LoyerCalc.getMonthStatus(row, statusOpts);
          var extra = '';
          if (isRowInPeriodRange(row)) extra += ' heatmap-in-range';
          if (isRowFocused(row)) extra += ' heatmap-focused';
          cells += '<div class="heatmap-cell">' + heatmapCellHtml(row, year, m, status, extra) + '</div>';
        }
        return cells;
      })
      .join('');

    el.innerHTML =
      '<div class="heatmap-grid"><div class="heatmap-corner"></div>' +
      monthHeaders +
      body +
      '</div>';
  }

  function refreshSelectors() {
    if (global.LoyerPeriod) LoyerPeriod.refresh();
    updatePeriodTabLabels();
  }

  function renderDashboard() {
    var allRows = getMonthlyRows();
    var selectionRows = getDashboardSelectionRows(allRows);
    var rangeActive = global.LoyerPeriod && LoyerPeriod.isRangeActive();
    var periodLabel = getPeriodDisplayLabel();
    var settings = state.data.settings || {};
    var statusOpts = { rentDueDay: settings.rentDueDay };
    var kpis = LoyerCalc.computeKpisForRows(state.data, selectionRows);
    var yearly = LoyerCalc.computeYearlySummary(allRows);

    updatePeriodTabLabels();
    if (global.LoyerPeriod) LoyerPeriod.refresh();

    var kpiEl = $('#dash-kpis');
    if (kpiEl) {
      var taux =
        kpis.tauxRecouvrement != null ? Math.round(kpis.tauxRecouvrement * 100) + ' %' : '—';
      var soldeClass = kpis.soldeADate >= 0 ? 'positive' : 'negative';
      var kpiScope = rangeActive ? 'Période' : 'Mois';
      kpiEl.innerHTML =
        '<div class="stat-box"><div class="label">Solde fin de période</div><div class="value ' +
        soldeClass +
        '">' +
        fmt(kpis.soldeADate) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Recouvrement (' +
        kpiScope +
        ')</div><div class="value">' +
        taux +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Mois partiels / impayés</div><div class="value">' +
        kpis.moisProblematiques +
        '</div></div>' +
        (kpis.retardMoyenJours != null
          ? '<div class="stat-box"><div class="label">Retard moyen</div><div class="value">' +
            kpis.retardMoyenJours +
            ' j</div></div>'
          : '');
    }

    $('#yearly-table tbody').innerHTML = yearly
      .map(function (y) {
        var diffClass = y.difference >= 0 ? 'positive' : 'negative';
        return (
          '<tr><td>' + y.year + '</td>' +
          '<td class="num">' + fmt(y.attendu) + '</td>' +
          '<td class="num">' + fmt(y.recu) + '</td>' +
          '<td class="num ' + diffClass + '">' + fmt(y.difference) + '</td>' +
          '<td class="num">' + fmt(y.soldeCumule) + '</td></tr>'
        );
      })
      .join('') || '<tr><td colspan="5" class="empty-msg">Aucune donnée</td></tr>';

    $('#monthly-table tbody').innerHTML = selectionRows
      .map(function (r) {
        var diffClass = r.difference >= 0 ? 'positive' : 'negative';
        var classes = 'row-clickable';
        if (rangeActive && isRowInPeriodRange(r)) classes += ' row-in-range';
        if (isRowFocused(r)) {
          classes += rangeActive ? ' row-focused' : ' row-selected';
        }
        var status = LoyerCalc.getMonthStatus(r, statusOpts);
        var delay = LoyerCalc.getPaymentDelayDays(state.data, r.year, r.month);
        var delayHint =
          delay != null && delay > 0
            ? ' <span class="month-delay-hint" title="Retard de paiement">+' +
              delay +
              ' j</span>'
            : '';
        return (
          '<tr class="' +
          classes +
          '" data-year="' +
          r.year +
          '" data-month="' +
          r.month +
          '" role="button" tabindex="0">' +
          '<td>' +
          LoyerCalc.formatMonthLong(r.year, r.month) +
          delayHint +
          '</td>' +
          '<td>' +
          renderMonthStatusBadge(status) +
          '</td>' +
          '<td class="num">' +
          fmt(r.attendu) +
          '</td>' +
          '<td class="num">' +
          fmt(r.recu) +
          '</td>' +
          '<td class="num ' +
          diffClass +
          '">' +
          fmt(r.difference) +
          '</td>' +
          '<td class="num">' +
          fmt(r.soldeCumule) +
          '</td></tr>'
        );
      })
      .join('') ||
      '<tr><td colspan="6" class="empty-msg">Aucune donnée pour cette période</td></tr>';

    var tableHint = $('#dash-table-hint');
    if (tableHint) {
      tableHint.textContent = rangeActive
        ? selectionRows.length + ' mois dans la plage — cliquez une ligne pour le détail virements.'
        : 'Cliquez sur une ligne pour sélectionner un mois.';
    }

    var focusLabel = LoyerCalc.formatMonthLong(state.focusYear, state.focusMonth);
    var paymentsLabel = $('#dash-payments-label');
    if (paymentsLabel) {
      paymentsLabel.textContent = rangeActive ? focusLabel : periodLabel;
    }

    var paymentsHint = $('#dash-payments-hint');
    if (paymentsHint) {
      paymentsHint.textContent = rangeActive
        ? 'Virements reçus pour ce mois (période : ' + periodLabel + ').'
        : 'Virements reçus ce mois-ci.';
    }

    var focusDetail = LoyerCalc.getMonthDetail(state.data, state.focusYear, state.focusMonth);
    if (rangeActive) {
      if (focusDetail.row) {
        $('#month-stats').innerHTML =
          '<div class="stat-box"><div class="label">Attendu (' +
          focusLabel +
          ')</div><div class="value">' +
          fmt(focusDetail.row.attendu) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Reçu</div><div class="value">' +
          fmt(focusDetail.row.recu) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Différence</div><div class="value ' +
          (focusDetail.row.difference >= 0 ? 'positive' : 'negative') +
          '">' +
          fmt(focusDetail.row.difference) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Solde cumulé</div><div class="value">' +
          fmt(focusDetail.row.soldeCumule) +
          '</div></div>';
      } else {
        $('#month-stats').innerHTML = '<p class="empty-msg">Mois hors période de location.</p>';
      }
    } else if (focusDetail.row) {
      $('#month-stats').innerHTML =
        '<div class="stat-box"><div class="label">Attendu</div><div class="value">' +
        fmt(focusDetail.row.attendu) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Reçu</div><div class="value">' +
        fmt(focusDetail.row.recu) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Différence</div><div class="value ' +
        (focusDetail.row.difference >= 0 ? 'positive' : 'negative') +
        '">' +
        fmt(focusDetail.row.difference) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Solde cumulé</div><div class="value">' +
        fmt(focusDetail.row.soldeCumule) +
        '</div></div>';
    } else {
      $('#month-stats').innerHTML = '<p class="empty-msg">Mois hors période de location.</p>';
    }

    var dashPayments = focusDetail.payments || [];

    $('#payments-month-table tbody').innerHTML = dashPayments
      .map(function (p) {
        return '<tr>' + renderPaymentRowCells(p, { dataLabels: true }) + '</tr>';
      })
      .join('') ||
      '<tr class="payments-empty-row"><td colspan="7" class="empty-msg">Aucun virement ce mois</td></tr>';

    var canvasStack = $('#chart-monthly-stack');
    var canvasYear = $('#chart-yearly-bar');
    var canvasLine = $('#chart-balance');
    var stackLabel = $('#dash-chart-stack-label');
    var yearLabel = $('#dash-chart-year-label');
    var balanceLabel = $('#dash-chart-balance-label');
    var balanceHint = $('#dash-chart-balance-hint');
    if (stackLabel) stackLabel.textContent = periodLabel;
    var chartYear = getDashboardChartYear(allRows);
    if (yearLabel) yearLabel.textContent = String(chartYear);
    if (balanceLabel) balanceLabel.textContent = rangeActive ? 'Solde cumulé — ' + periodLabel : 'Solde cumulé';
    if (balanceHint) {
      balanceHint.textContent = rangeActive
        ? 'Solde cumulé sur les mois de la plage sélectionnée.'
        : 'Solde cumulé jusqu\'au mois sélectionné.';
    }

    var balanceRows = rangeActive
      ? selectionRows
      : allRows.filter(function (r) {
          var key = LoyerCalc.monthKey(r.year, r.month);
          var sel = LoyerCalc.monthKey(state.selectedYear, state.selectedMonth);
          return key <= sel;
        });

    var yearRows = allRows.filter(function (r) {
      return r.year === chartYear;
    });

    if (canvasStack && typeof Chart !== 'undefined') {
      LoyerCharts.renderMonthlyStackedBar(canvasStack, selectionRows, periodLabel);
      LoyerCharts.renderYearlyBar(canvasYear, yearRows, String(chartYear));
      LoyerCharts.renderBalanceLine(canvasLine, balanceRows, periodLabel);
    }

    var years = LoyerCalc.getAvailableYears(allRows);
    var yearIdx = years.indexOf(chartYear);
    var prevBtn = $('#btn-chart-year-prev');
    var nextBtn = $('#btn-chart-year-next');
    if (prevBtn) prevBtn.disabled = yearIdx <= 0;
    if (nextBtn) nextBtn.disabled = yearIdx === -1 || yearIdx >= years.length - 1;

    renderDashboardHeatmap(allRows);
  }

  function populateBatchExportSelects() {
    var rows = getMonthlyRows();
    var years = LoyerCalc.getAvailableYears(rows);
    if (!years.length) years = [new Date().getFullYear()];

    var monthOpts = LoyerCalc.MONTH_NAMES.map(function (name, i) {
      return '<option value="' + (i + 1) + '">' + name + '</option>';
    }).join('');
    var yearOpts = years
      .map(function (y) {
        return '<option value="' + y + '">' + y + '</option>';
      })
      .join('');

    ['batch-from-month', 'batch-to-month'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.innerHTML = monthOpts;
    });
    ['batch-from-year', 'batch-to-year'].forEach(function (id) {
      var el = $('#' + id);
      if (el) el.innerHTML = yearOpts;
    });

    var first = rows[0];
    var last = rows[rows.length - 1];
    if (first) {
      $('#batch-from-month').value = String(first.month);
      $('#batch-from-year').value = String(first.year);
    }
    $('#batch-to-month').value = String(state.selectedMonth);
    $('#batch-to-year').value = String(state.selectedYear);
    updateBatchExportSummary();
  }

  function updateBatchExportSummary() {
    var summary = $('#batch-export-summary');
    if (!summary) return;
    var fromM = parseInt($('#batch-from-month').value, 10);
    var fromY = parseInt($('#batch-from-year').value, 10);
    var toM = parseInt($('#batch-to-month').value, 10);
    var toY = parseInt($('#batch-to-year').value, 10);
    var months = LoyerCalc.listMonthsInRange(fromY, fromM, toY, toM, state.data);
    if (!months.length) {
      summary.textContent = 'Plage invalide ou hors période de bail.';
      return;
    }
    summary.textContent =
      months.length +
      ' quittance(s) seront générées (' +
      LoyerCalc.formatMonthLong(months[0].year, months[0].month) +
      ' → ' +
      LoyerCalc.formatMonthLong(months[months.length - 1].year, months[months.length - 1].month) +
      ').';
    if (months.length > 24) {
      summary.textContent += ' Attention : export volumineux, cela peut prendre du temps.';
    }
  }

  function openBatchExportModal() {
    populateBatchExportSelects();
    $('#modal-batch-quittance').classList.remove('hidden');
  }

  function closeBatchExportModal() {
    $('#modal-batch-quittance').classList.add('hidden');
  }

  function runBatchExport(format) {
    var fromM = parseInt($('#batch-from-month').value, 10);
    var fromY = parseInt($('#batch-from-year').value, 10);
    var toM = parseInt($('#batch-to-month').value, 10);
    var toY = parseInt($('#batch-to-year').value, 10);
    var months = LoyerCalc.listMonthsInRange(fromY, fromM, toY, toM, state.data);
    if (!months.length) {
      LoyerNotify.warn('Plage invalide ou hors période de bail.');
      return;
    }
    if (months.length > 24) {
      LoyerNotify.warn('Export de ' + months.length + ' mois — patientez…');
    } else {
      LoyerNotify.info('Génération en cours…');
    }
    var templateId =
      state.quittanceUi.selectedId ||
      LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
    flushTemplateEditsIfNeeded('quittance')
      .then(function () {
        return LoyerQuittance.exportBatch(
          state.data,
          fromY,
          fromM,
          toY,
          toM,
          templateId,
          format
        );
      })
      .then(function () {
        closeBatchExportModal();
        LoyerNotify.success('Export groupé terminé.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Export impossible.');
      });
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function paymentStatusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s.indexOf('import') !== -1) return 'importe';
    if (s.indexOf('verif') !== -1) return 'verifie';
    return 'manuel';
  }

  function renderPaymentStatusBadge(status) {
    var label = status || '—';
    if (!status) {
      return '<span class="payment-status payment-status-empty">—</span>';
    }
    return (
      '<span class="payment-status payment-status-' +
      paymentStatusClass(status) +
      '">' +
      escapeHtml(label) +
      '</span>'
    );
  }

  function renderPaymentRowCells(p, options) {
    options = options || {};
    function cell(label, className, html, title) {
      var attrs = '';
      if (options.dataLabels && label) {
        attrs += ' data-label="' + escapeHtml(label) + '"';
      }
      if (className) attrs += ' class="' + className + '"';
      if (title) attrs += ' title="' + escapeHtml(title) + '"';
      return '<td' + attrs + '>' + html + '</td>';
    }
    return (
      cell('Date', '', p.date) +
      cell('Émetteur', '', escapeHtml(p.emitter)) +
      cell('Montant', 'num', fmt(p.amount)) +
      cell('Libellé bancaire', 'payment-label', escapeHtml(p.bankLabel || '—'), p.bankLabel) +
      cell('Réf.', 'payment-ref col-pay-ref', escapeHtml(p.bankRef || '—'), p.bankRef) +
      cell('Statut', '', renderPaymentStatusBadge(p.status)) +
      cell('Commentaire', 'payment-comment col-pay-comment', escapeHtml(p.comment || '—'), p.comment)
    );
  }

  function populateEmitterSelect() {
    var emitters = state.data.settings.emitters;
    var emitterSel = $('#pay-emitter');
    if (!emitterSel) return;
    emitterSel.innerHTML = emitters
      .map(function (e) {
        return '<option value="' + escapeHtml(e) + '">' + escapeHtml(e) + '</option>';
      })
      .join('');
  }

  function openPaymentModal(payment) {
    populateEmitterSelect();
    state.editingPaymentId = payment ? payment.id : null;
    $('#modal-payment-title').textContent = payment ? 'Modifier le virement' : 'Nouveau virement';
    $('#pay-date').value = payment ? payment.date : LoyerCalc.formatDateISO(new Date());
    $('#pay-emitter').value = payment ? payment.emitter : state.data.settings.emitters[0] || '';
    $('#pay-amount').value = payment ? payment.amount : '';
    $('#pay-bank-label').value = payment ? payment.bankLabel || '' : '';
    $('#pay-bank-ref').value = payment ? payment.bankRef || '' : '';
    $('#pay-status').value = payment ? payment.status || 'manuel' : 'manuel';
    $('#pay-comment').value = payment ? payment.comment || '' : '';
    $('#modal-payment').classList.remove('hidden');
    $('#pay-date').focus();
  }

  function closePaymentModal() {
    state.editingPaymentId = null;
    $('#modal-payment').classList.add('hidden');
    $('#form-payment').reset();
  }

  function renderPayments() {
    populateEmitterSelect();
    var sorted = state.data.payments.slice().sort(function (a, b) {
      return LoyerCalc.parseDate(b.date) - LoyerCalc.parseDate(a.date);
    });

    $('#payments-table tbody').innerHTML = sorted
      .map(function (p) {
        return (
          '<tr>' +
          renderPaymentRowCells(p) +
          '<td class="inline-actions">' +
          '<button type="button" class="btn btn-secondary btn-edit-pay" data-id="' +
          p.id +
          '">Modifier</button>' +
          '<button type="button" class="btn btn-danger btn-del-pay" data-id="' +
          p.id +
          '">Suppr.</button>' +
          '</td></tr>'
        );
      })
      .join('') || '<tr><td colspan="8" class="empty-msg">Aucun virement enregistré</td></tr>';
  }

  function renderSignaturePreview() {
    var wrap = $('#signature-preview');
    var btnRemove = $('#btn-remove-signature');
    if (!wrap) return;
    var img = state.data.settings.bailleur.signatureImage;
    if (img) {
      wrap.innerHTML = '<img src="' + img + '" alt="Aperçu signature" class="signature-preview-img">';
      if (btnRemove) btnRemove.classList.remove('hidden');
    } else {
      wrap.innerHTML = '<p class="empty-msg" style="padding:0.5rem 0">Aucune image de signature</p>';
      if (btnRemove) btnRemove.classList.add('hidden');
    }
  }

  function renderSettings() {
    var s = state.data.settings;
    $('#set-lease-start').value = s.leaseStart;
    $('#set-rent-day').value = s.rentDueDay;
    $('#set-bailleur-name').value = s.bailleur.name;
    $('#set-bailleur-street').value = s.bailleur.street;
    $('#set-bailleur-cp').value = s.bailleur.postalCode;
    $('#set-bailleur-city').value = s.bailleur.city;
    $('#set-loc-name').value = s.locataire.name;
    $('#set-loc-street').value = s.locataire.street;
    $('#set-loc-cp').value = s.locataire.postalCode;
    $('#set-loc-city').value = s.locataire.city;
    $('#set-mail-signature').value = s.mail.signature || '';

    renderSignaturePreview();
    renderTemplateRegistry();

    updateDataFileStatus();

    $('#emitters-list').innerHTML = (s.emitterProfiles || s.emitters.map(function (name) {
      return { name: name, patterns: [] };
    }))
      .map(function (profile, i) {
        return (
          '<div class="emitter-profile">' +
          '<div class="form-row"><label>Nom affiché</label>' +
          '<input type="text" class="emitter-name" data-index="' + i + '" value="' + escapeHtml(profile.name) + '"></div>' +
          '<div class="form-row"><label>Motifs dans le libellé bancaire</label>' +
          '<textarea class="emitter-patterns" data-index="' + i + '" rows="3" placeholder="Jean Dupont">' +
          escapeHtml((profile.patterns || []).join('\n')) +
          '</textarea></div>' +
          '<button type="button" class="btn btn-danger btn-rm-emitter" data-index="' + i + '">Supprimer</button></div>'
        );
      })
      .join('');

    $('#prices-list').innerHTML = s.priceHistory
      .map(function (p, i) {
        return (
          '<div class="grid-2" style="align-items:end;margin-bottom:0.5rem">' +
          '<div class="form-row"><label>À partir du</label>' +
          '<input type="date" class="price-from" data-index="' + i + '" value="' + p.from + '"></div>' +
          '<div class="form-row" style="flex-direction:row;gap:0.5rem;align-items:flex-end">' +
          '<div style="flex:1"><label>Montant (€)</label>' +
          '<input type="number" step="0.01" min="0" class="price-amount" data-index="' + i + '" value="' + p.amount + '"></div>' +
          '<button type="button" class="btn btn-danger btn-rm-price" data-index="' + i + '">×</button></div></div>'
        );
      })
      .join('');

    $('#recipients-list').innerHTML = s.mail.recipients
      .map(function (r, i) {
        return (
          '<div class="grid-2" style="align-items:end;margin-bottom:0.5rem">' +
          '<div class="form-row"><label>Email</label>' +
          '<input type="email" class="recipient-email" data-index="' + i + '" value="' + escapeHtml(r.email) + '"></div>' +
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
  }

  function closeCsvImportModal() {
    state.csvImportItems = [];
    $('#modal-csv-import').classList.add('hidden');
    $('#csv-import-table tbody').innerHTML = '';
    $('#import-csv').value = '';
  }

  function renderCsvImportTable() {
    var items = state.csvImportItems;
    var tbody = $('#csv-import-table tbody');
    var newCount = items.filter(function (item) {
      return !item.duplicate;
    }).length;
    var dupCount = items.length - newCount;
    var selectedCount = items.filter(function (item) {
      return item.selected && !item.duplicate;
    }).length;

    $('#csv-import-summary').textContent =
      items.length +
      ' virement(s) reconnu(s) dans le CSV — ' +
      newCount +
      ' nouveau(x), ' +
      dupCount +
      ' doublon(s) détecté(s). ' +
      selectedCount +
      ' sélectionné(s) pour import.';

    tbody.innerHTML = items
      .map(function (item, index) {
        var status = item.duplicate
          ? item.duplicateReason || 'Doublon'
          : 'Nouveau';
        var rowClass = item.duplicate ? 'csv-row-duplicate' : '';
        return (
          '<tr class="' + rowClass + '">' +
          '<td class="col-check">' +
          '<input type="checkbox" class="csv-import-check" data-index="' + index + '"' +
          (item.selected && !item.duplicate ? ' checked' : '') +
          (item.duplicate ? ' disabled' : '') +
          '></td>' +
          '<td>' + item.date + '</td>' +
          '<td class="num">' + fmt(item.amount) + '</td>' +
          '<td>' + escapeHtml(item.emitterName) + '</td>' +
          '<td class="csv-label" title="' + escapeHtml(item.label) + '">' + escapeHtml(item.label) + '</td>' +
          '<td class="csv-ref">' + escapeHtml(item.bankRef || '—') + '</td>' +
          '<td>' + escapeHtml(status) + '</td></tr>'
        );
      })
      .join('');

    var selectAll = $('#csv-import-select-all');
    if (selectAll) {
      var selectable = items.filter(function (item) {
        return !item.duplicate;
      });
      selectAll.checked =
        selectable.length > 0 &&
        selectable.every(function (item) {
          return item.selected;
        });
      selectAll.indeterminate =
        selectable.some(function (item) {
          return item.selected;
        }) &&
        !selectAll.checked;
    }
  }

  function openCsvImportModal(csvText) {
    var preview = LoyerCsvImport.buildImportPreview(csvText, state.data.settings, state.data.payments);
    if (preview.error) {
      LoyerNotify.error(preview.error);
      return;
    }
    if (!preview.items.length) {
      var stats = preview.stats || {};
      var detail =
        stats.csvCredits != null
          ? stats.csvCredits + ' crédit(s) trouvé(s) dans le CSV, aucun ne correspond aux motifs bancaires.'
          : 'Aucun crédit reconnu dans le CSV.';
      LoyerNotify.warn(detail + ' Vérifiez Paramètres → Émetteurs.');
      return;
    }
    state.csvImportItems = preview.items;
    renderCsvImportTable();
    $('#modal-csv-import').classList.remove('hidden');
  }

  function readCsvFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = LoyerCsvImport.decodeCsvBuffer(reader.result);
      openCsvImportModal(text);
    };
    reader.onerror = function () {
      LoyerNotify.error('Impossible de lire le fichier CSV.');
    };
    reader.readAsArrayBuffer(file);
  }

  function importJsonFile(file) {
    return LoyerStore.importJson(file)
      .then(function (data) {
        state.data = data;
        renderAll();
        LoyerNotify.success('Données importées.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Import JSON impossible.');
      });
  }

  function classifyImportFile(file) {
    var name = String(file.name || '').toLowerCase();
    var type = String(file.type || '').toLowerCase();
    if (name.endsWith('.json') || type === 'application/json') {
      return 'json';
    }
    if (
      name.endsWith('.csv') ||
      type === 'text/csv' ||
      type === 'application/csv' ||
      type === 'application/vnd.ms-excel'
    ) {
      return 'csv';
    }
    return null;
  }

  function handleDroppedImportFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var jsonFile = null;
    var csvFile = null;
    for (var i = 0; i < fileList.length; i++) {
      var kind = classifyImportFile(fileList[i]);
      if (kind === 'json') jsonFile = fileList[i];
      else if (kind === 'csv') csvFile = fileList[i];
    }
    if (jsonFile && csvFile) {
      LoyerNotify.warn('Déposez un seul fichier à la fois (.json ou .csv).');
      return;
    }
    if (jsonFile) {
      importJsonFile(jsonFile);
      return;
    }
    if (csvFile) {
      readCsvFile(csvFile);
      return;
    }
    LoyerNotify.warn('Fichier non reconnu. Déposez un .json (données) ou un .csv (relevé bancaire).');
  }

  function bindFileDropImport() {
    var overlay = $('#file-drop-overlay');
    if (!overlay) return;

    var dragDepth = 0;

    function isAppReady() {
      var loading = $('#app-loading');
      return !loading || loading.classList.contains('hidden');
    }

    function dragHasFiles(e) {
      var types = e.dataTransfer && e.dataTransfer.types;
      if (!types) return false;
      for (var i = 0; i < types.length; i++) {
        if (types[i] === 'Files') return true;
      }
      return false;
    }

    function showDropOverlay() {
      overlay.classList.remove('hidden');
      overlay.setAttribute('aria-hidden', 'false');
    }

    function hideDropOverlay() {
      dragDepth = 0;
      overlay.classList.add('hidden');
      overlay.setAttribute('aria-hidden', 'true');
    }

    window.addEventListener(
      'dragenter',
      function (e) {
        if (!isAppReady() || !dragHasFiles(e)) return;
        e.preventDefault();
        dragDepth += 1;
        showDropOverlay();
      },
      false
    );

    window.addEventListener(
      'dragover',
      function (e) {
        if (!isAppReady() || !dragHasFiles(e)) return;
        e.preventDefault();
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
      },
      false
    );

    window.addEventListener(
      'dragleave',
      function (e) {
        if (!dragHasFiles(e)) return;
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) hideDropOverlay();
      },
      false
    );

    window.addEventListener(
      'drop',
      function (e) {
        if (!isAppReady() || !dragHasFiles(e)) return;
        e.preventDefault();
        hideDropOverlay();
        handleDroppedImportFiles(e.dataTransfer.files);
      },
      false
    );

    window.addEventListener('dragend', hideDropOverlay, false);
  }

  function renderQuittance() {
    if (state.quittanceUi.mode === 'preview') {
      return renderQuittancePreview();
    }
    return Promise.resolve();
  }

  function getQuittanceExportEl() {
    return LoyerQuittance.getExportElement();
  }

  function getQuittanceExportFilename(ctx) {
    if (ctx.isRange) {
      return LoyerQuittance.getBatchFilename(
        LoyerCalc.monthKey(ctx.fromYear, ctx.fromMonth),
        LoyerCalc.monthKey(ctx.toYear, ctx.toMonth)
      );
    }
    return LoyerQuittance.getFilename(state.selectedYear, state.selectedMonth);
  }

  function exportQuittanceFormat(format) {
    var ctx = getExportPeriodContext();
    var id = state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
    return renderQuittancePreview().then(function () {
      var fn = getQuittanceExportFilename(ctx);
      if (format === 'pdf') {
        if (ctx.isRange) {
          return LoyerQuittance.exportBatch(
            state.data,
            ctx.fromYear,
            ctx.fromMonth,
            ctx.toYear,
            ctx.toMonth,
            id,
            'pdf'
          );
        }
        return LoyerExport.exportPdf(getQuittanceExportEl(), fn);
      }
      if (ctx.isRange) {
        return LoyerQuittance.exportBatch(
          state.data,
          ctx.fromYear,
          ctx.fromMonth,
          ctx.toYear,
          ctx.toMonth,
          id,
          format
        );
      }
      if (format === 'docx') return LoyerExport.exportDocx(getQuittanceExportEl(), fn);
      return LoyerExport.exportHtml(getQuittanceExportEl(), fn);
    });
  }

  function prepareMailAction(mode) {
    var mailId = state.mailUi.selectedId || LoyerTemplateManager.getDefaultId(state.data.settings, 'mail');
    var qId = state.quittanceUi.selectedId || LoyerTemplateManager.getDefaultId(state.data.settings, 'quittance');
    var ctx = getExportPeriodContext();
    return renderQuittancePreview().then(function () {
      return LoyerMail.prepareMail(
        mode,
        state.data,
        state.selectedYear,
        state.selectedMonth,
        getQuittanceExportEl(),
        mailId,
        ctx,
        qId
      );
    });
  }

  function renderAll() {
    renderDashboard();
    renderPayments();
    renderSettings();
    renderQuittance();
  }

  function collectSettingsFromForm() {
    var s = state.data.settings;
    s.leaseStart = $('#set-lease-start').value;
    s.rentDueDay = parseInt($('#set-rent-day').value, 10) || 1;
    s.bailleur.name = $('#set-bailleur-name').value.trim();
    s.bailleur.street = $('#set-bailleur-street').value.trim();
    s.bailleur.postalCode = $('#set-bailleur-cp').value.trim();
    s.bailleur.city = $('#set-bailleur-city').value.trim();
    s.locataire.name = $('#set-loc-name').value.trim();
    s.locataire.street = $('#set-loc-street').value.trim();
    s.locataire.postalCode = $('#set-loc-cp').value.trim();
    s.locataire.city = $('#set-loc-city').value.trim();
    s.mail.signature = $('#set-mail-signature').value;

    s.emitterProfiles = [];
    $$('.emitter-name').forEach(function (inp) {
      var i = inp.dataset.index;
      var patternsInp = $('.emitter-patterns[data-index="' + i + '"]');
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
    $$('.price-from').forEach(function (inp) {
      var i = inp.dataset.index;
      var amountInp = $('.price-amount[data-index="' + i + '"]');
      if (inp.value && amountInp) {
        s.priceHistory.push({ from: inp.value, amount: parseFloat(amountInp.value) || 0 });
      }
    });
    s.priceHistory.sort(function (a, b) {
      return LoyerCalc.parseDate(a.from) - LoyerCalc.parseDate(b.from);
    });

    s.mail.recipients = [];
    $$('.recipient-email').forEach(function (inp) {
      var i = inp.dataset.index;
      var typeSel = $('.recipient-type[data-index="' + i + '"]');
      if (inp.value.trim()) {
        s.mail.recipients.push({ email: inp.value.trim(), type: typeSel ? typeSel.value : 'to' });
      }
    });
    if (!s.mail.recipients.length) {
      s.mail.recipients.push({ email: '', type: 'to' });
    }
  }

  function bindEvents() {
    bindFileDropImport();
    var mainContent = $('#main-content');
    var brandHome = $('#app-brand-home');
    if (brandHome) {
      brandHome.addEventListener('click', function (e) {
        e.preventDefault();
        showPanel('panel-dashboard');
        if (mainContent && mainContent.scrollIntoView) {
          mainContent.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    }

    $$('.tabs button').forEach(function (btn) {
      btn.addEventListener('click', function () {
        showPanel(btn.dataset.panel);
      });
    });

    initPeriodPicker();
    updatePeriodBarVisibility('panel-dashboard');

    bindIf('#btn-print-report', function (el) {
      el.addEventListener('click', function () {
        window.print();
      });
    });

    $('#monthly-table').addEventListener('click', function (e) {
      var row = e.target.closest('tr[data-month]');
      if (!row) return;
      handleDashboardMonthClick(parseInt(row.dataset.year, 10), parseInt(row.dataset.month, 10));
    });

    bindIf('#dashboard-heatmap', function (el) {
      el.addEventListener('click', function (e) {
        var btn = e.target.closest('.heatmap-btn');
        if (!btn) return;
        handleDashboardMonthClick(parseInt(btn.dataset.year, 10), parseInt(btn.dataset.month, 10));
      });
    });

    bindIf('#btn-chart-year-prev', function (el) {
      el.addEventListener('click', function () {
        shiftDashboardChartYear(-1, getMonthlyRows());
      });
    });

    bindIf('#btn-chart-year-next', function (el) {
      el.addEventListener('click', function () {
        shiftDashboardChartYear(1, getMonthlyRows());
      });
    });

    bindIf('#btn-export-batch', function (el) {
      el.addEventListener('click', openBatchExportModal);
    });

    ['batch-from-month', 'batch-from-year', 'batch-to-month', 'batch-to-year'].forEach(function (id) {
      bindIf('#' + id, function (el) {
        el.addEventListener('change', updateBatchExportSummary);
      });
    });

    $$('[data-batch-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeBatchExportModal);
    });

    bindIf('#btn-batch-export-pdf', function (el) {
      el.addEventListener('click', function () {
        runBatchExport('pdf');
      });
    });
    bindIf('#btn-batch-export-docx', function (el) {
      el.addEventListener('click', function () {
        runBatchExport('docx');
      });
    });
    bindIf('#btn-batch-export-html', function (el) {
      el.addEventListener('click', function () {
        runBatchExport('html');
      });
    });

    $('#monthly-table').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest('tr[data-month]');
      if (!row) return;
      e.preventDefault();
      handleDashboardMonthClick(parseInt(row.dataset.year, 10), parseInt(row.dataset.month, 10));
    });

    $('#form-payment').addEventListener('submit', function (e) {
      e.preventDefault();
      var payment = {
        id: state.editingPaymentId || LoyerCalc.generateId(),
        date: $('#pay-date').value,
        emitter: $('#pay-emitter').value,
        amount: parseFloat($('#pay-amount').value),
        bankLabel: $('#pay-bank-label').value.trim(),
        bankRef: $('#pay-bank-ref').value.trim(),
        status: $('#pay-status').value || 'manuel',
        comment: $('#pay-comment').value.trim()
      };
      if (!payment.date || !payment.emitter || !(payment.amount > 0)) {
        LoyerNotify.warn('Veuillez remplir tous les champs correctement.');
        return;
      }
      if (state.editingPaymentId) {
        var idx = state.data.payments.findIndex(function (p) {
          return p.id === state.editingPaymentId;
        });
        if (idx >= 0) state.data.payments[idx] = LoyerStore.normalizePayment(payment);
      } else {
        state.data.payments.push(LoyerStore.normalizePayment(payment));
      }
      var wasEdit = !!state.editingPaymentId;
      persist();
      closePaymentModal();
      renderAll();
      LoyerNotify.success(wasEdit ? 'Virement modifié.' : 'Virement enregistré.');
    });

    $('#btn-add-payment').addEventListener('click', function () {
      openPaymentModal(null);
    });

    $('#btn-clear-payments').addEventListener('click', function () {
      if (!state.data.payments.length) {
        LoyerNotify.info('Aucun virement à supprimer.');
        return;
      }
      LoyerNotify.confirm('Supprimer tous les virements enregistrés ?', {
        confirmLabel: 'Tout supprimer',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        state.data.payments = [];
        persist();
        renderAll();
        LoyerNotify.success('Tous les virements ont été supprimés.');
      });
    });

    $$('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', closePaymentModal);
    });

    $$('[data-csv-modal-close]').forEach(function (el) {
      el.addEventListener('click', closeCsvImportModal);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!$('#modal-csv-import').classList.contains('hidden')) closeCsvImportModal();
      else if (!$('#modal-payment').classList.contains('hidden')) closePaymentModal();
    });

    $('#import-csv').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) readCsvFile(file);
    });

    $('#csv-import-table').addEventListener('change', function (e) {
      var check = e.target.closest('.csv-import-check');
      if (!check) return;
      var item = state.csvImportItems[parseInt(check.dataset.index, 10)];
      if (item && !item.duplicate) item.selected = check.checked;
      renderCsvImportTable();
    });

    $('#csv-import-select-all').addEventListener('change', function () {
      var checked = this.checked;
      state.csvImportItems.forEach(function (item) {
        if (!item.duplicate) item.selected = checked;
      });
      renderCsvImportTable();
    });

    $('#btn-csv-import-confirm').addEventListener('click', function () {
      var toImport = LoyerCsvImport.itemsToPayments(state.csvImportItems);
      if (!toImport.length) {
        LoyerNotify.warn('Aucun virement sélectionné à importer.');
        return;
      }
      state.data.payments = state.data.payments.concat(
        toImport.map(function (p) {
          return LoyerStore.normalizePayment(p);
        })
      );
      persist();
      closeCsvImportModal();
      renderAll();
      LoyerNotify.success(toImport.length + ' virement(s) importé(s).');
    });

    $('#payments-table').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-edit-pay');
      var delBtn = e.target.closest('.btn-del-pay');
      if (editBtn) {
        var p = state.data.payments.find(function (x) {
          return x.id === editBtn.dataset.id;
        });
        if (p) openPaymentModal(p);
      }
      if (delBtn) {
        LoyerNotify.confirm('Supprimer ce virement ?', {
          confirmLabel: 'Supprimer',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          state.data.payments = state.data.payments.filter(function (x) {
            return x.id !== delBtn.dataset.id;
          });
          persist();
          renderAll();
          LoyerNotify.success('Virement supprimé.');
        });
      }
    });

    $('#btn-save-settings').addEventListener('click', function () {
      collectSettingsFromForm();
      persist();
      renderAll();
      LoyerNotify.success('Paramètres enregistrés.');
    });

    bindIf('#sel-quittance-template', function (el) {
      el.addEventListener('change', function () {
        switchQuittanceTemplate(this.value);
      });
    });
    bindIf('#sel-mail-template', function (el) {
      el.addEventListener('change', function () {
        switchMailTemplate(this.value);
      });
    });
    bindIf('#sel-default-quittance', function (el) {
      el.addEventListener('change', function () {
        setTemplateDefault('quittance', this.value);
      });
    });
    bindIf('#sel-default-mail', function (el) {
      el.addEventListener('change', function () {
        setTemplateDefault('mail', this.value);
      });
    });

    bindIf('#btn-quittance-tab-edit', function (el) {
      el.addEventListener('click', function () {
        captureQuittanceEditorRaw();
        applyQuittanceTabMode('edit');
      });
    });
    bindIf('#btn-quittance-tab-preview', function (el) {
      el.addEventListener('click', function () {
        captureQuittanceEditorRaw();
        applyQuittanceTabMode('preview');
      });
    });
    bindIf('#btn-mail-tab-edit', function (el) {
      el.addEventListener('click', function () {
        captureMailEditorRaw();
        applyMailTabMode('edit');
      });
    });
    bindIf('#btn-mail-tab-preview', function (el) {
      el.addEventListener('click', function () {
        captureMailEditorRaw();
        applyMailTabMode('preview');
      });
    });

    bindIf('#btn-quittance-export-template', function (el) {
      el.addEventListener('click', function () {
        exportTemplateFromTab('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    bindIf('#btn-quittance-new', function (el) {
      el.addEventListener('click', function () {
        createTemplateFromCurrent('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Création impossible.');
        });
      });
    });
    bindIf('#btn-quittance-set-default', function (el) {
      el.addEventListener('click', function () {
        setTemplateDefault('quittance', state.quittanceUi.selectedId);
      });
    });

    bindIf('#btn-mail-export-template', function (el) {
      el.addEventListener('click', function () {
        exportTemplateFromTab('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    bindIf('#btn-mail-new', function (el) {
      el.addEventListener('click', function () {
        createTemplateFromCurrent('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Création impossible.');
        });
      });
    });
    bindIf('#btn-mail-set-default', function (el) {
      el.addEventListener('click', function () {
        setTemplateDefault('mail', state.mailUi.selectedId);
      });
    });

    bindIf('#btn-new-quittance-template', function (el) {
      el.addEventListener('click', openNewQuittanceFromSystem);
    });
    bindIf('#btn-new-mail-template', function (el) {
      el.addEventListener('click', openNewMailFromSystem);
    });
    bindIf('#btn-settings-export-quittance', function (el) {
      el.addEventListener('click', function () {
        exportTemplateFromSettings('quittance').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    bindIf('#btn-settings-export-mail', function (el) {
      el.addEventListener('click', function () {
        exportTemplateFromSettings('mail').catch(function (err) {
          LoyerNotify.error(err.message || 'Export impossible.');
        });
      });
    });
    bindTemplateImportInput('#import-quittance-template-tab', 'quittance');
    bindTemplateImportInput('#import-mail-template-tab', 'mail');
    bindTemplateImportInput('#import-quittance-template-settings', 'quittance');
    bindTemplateImportInput('#import-mail-template-settings', 'mail');

    var quittanceList = $('#quittance-templates-list');
    if (quittanceList) {
      quittanceList.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-edit-template');
        var delBtn = e.target.closest('.btn-del-template');
        if (editBtn && editBtn.dataset.type === 'quittance') {
          openQuittanceEditor(editBtn.dataset.id);
        }
        if (delBtn && delBtn.dataset.type === 'quittance') {
          deleteTemplate('quittance', delBtn.dataset.id);
        }
      });
    }
    var mailList = $('#mail-templates-list');
    if (mailList) {
      mailList.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-edit-template');
        var delBtn = e.target.closest('.btn-del-template');
        if (editBtn && editBtn.dataset.type === 'mail') {
          openMailEditor(editBtn.dataset.id);
        }
        if (delBtn && delBtn.dataset.type === 'mail') {
          deleteTemplate('mail', delBtn.dataset.id);
        }
      });
    }

    bindIf('#set-mail-subject-template', function (el) {
      el.addEventListener('input', function () {
        state.mailUi.mailSubjectRaw = this.value;
        markMailDirty();
      });
    });

    var qTplEd = LoyerEditor.get('template-quittance');
    if (qTplEd && qTplEd.quill) {
      qTplEd.quill.on('text-change', function () {
        if (state.quittanceUi.mode === 'edit') markQuittanceDirty();
      });
    }
    var mTplEd = LoyerEditor.get('template-mail');
    if (mTplEd && mTplEd.quill) {
      mTplEd.quill.on('text-change', function () {
        if (state.mailUi.mode === 'edit') markMailDirty();
      });
    }

    $('#set-signature-image').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (!file) return;
      if (!file.type.match(/^image\//)) {
        LoyerNotify.warn('Choisissez une image (PNG, JPG, WebP ou GIF).');
        e.target.value = '';
        return;
      }
      if (file.size > SIGNATURE_IMAGE_MAX_BYTES) {
        LoyerNotify.warn('Image trop volumineuse (maximum 5 Mo).');
        e.target.value = '';
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        state.data.settings.bailleur.signatureImage = reader.result;
        persist();
        renderSignaturePreview();
        LoyerNotify.success('Signature enregistrée. Régénérez la quittance pour l\'afficher.');
      };
      reader.onerror = function () {
        LoyerNotify.error('Impossible de lire l\'image.');
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    $('#btn-remove-signature').addEventListener('click', function () {
      state.data.settings.bailleur.signatureImage = '';
      persist();
      renderSignaturePreview();
      LoyerNotify.info('Signature image supprimée.');
    });

    $('#btn-restore-signature').addEventListener('click', function () {
      if (typeof DEFAULT_SIGNATURE_IMAGE === 'undefined' || !DEFAULT_SIGNATURE_IMAGE) {
        LoyerNotify.error('Signature par défaut indisponible.');
        return;
      }
      state.data.settings.bailleur.signatureImage = DEFAULT_SIGNATURE_IMAGE;
      persist();
      renderSignaturePreview();
      LoyerNotify.success('Signature par défaut restaurée. Régénérez la quittance.');
    });

    $('#btn-add-emitter').addEventListener('click', function () {
      collectSettingsFromForm();
      if (!state.data.settings.emitterProfiles) state.data.settings.emitterProfiles = [];
      state.data.settings.emitterProfiles.push({ name: '', patterns: [] });
      renderSettings();
    });
    $('#emitters-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-emitter')) {
        collectSettingsFromForm();
        state.data.settings.emitterProfiles.splice(parseInt(e.target.dataset.index, 10), 1);
        if (!state.data.settings.emitterProfiles.length) {
          state.data.settings.emitterProfiles.push({ name: 'Locataire', patterns: [] });
        }
        renderSettings();
      }
    });

    $('#btn-add-price').addEventListener('click', function () {
      state.data.settings.priceHistory.push({
        from: LoyerCalc.formatDateISO(new Date()),
        amount: 0
      });
      renderSettings();
    });
    $('#prices-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-price')) {
        state.data.settings.priceHistory.splice(parseInt(e.target.dataset.index, 10), 1);
        renderSettings();
      }
    });

    $('#btn-add-recipient').addEventListener('click', function () {
      state.data.settings.mail.recipients.push({ email: '', type: 'to' });
      renderSettings();
    });
    $('#recipients-list').addEventListener('click', function (e) {
      if (e.target.classList.contains('btn-rm-recipient')) {
        state.data.settings.mail.recipients.splice(parseInt(e.target.dataset.index, 10), 1);
        renderSettings();
      }
    });

    $('#btn-export-json').addEventListener('click', function () {
      collectSettingsFromForm();
      persist();
      LoyerStore.exportJson(state.data);
      LoyerNotify.success('Copie JSON téléchargée.');
    });

    var btnSaveApiKey = $('#btn-save-api-key');
    if (btnSaveApiKey) {
      btnSaveApiKey.addEventListener('click', saveServerApiKey);
    }
    var apiKeyInput = $('#set-server-api-key');
    if (apiKeyInput) {
      apiKeyInput.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') saveServerApiKey();
      });
    }

    $('#import-json').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) importJsonFile(file);
      e.target.value = '';
    });
    $('#btn-reset-data').addEventListener('click', function () {
      LoyerNotify.confirm('Réinitialiser toutes les données ? Cette action est irréversible.', {
        confirmLabel: 'Réinitialiser',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        state.data = LoyerStore.reset();
        renderAll();
        updateDataFileStatus();
        LoyerNotify.success('Données réinitialisées.');
      });
    });
    $('#btn-load-seed').addEventListener('click', function () {
      LoyerNotify.confirm('Recharger les données par défaut ? Les modifications non exportées seront perdues.', {
        confirmLabel: 'Recharger'
      }).then(function (ok) {
        if (!ok) return;
        LoyerStore.reloadSeed()
          .then(function (data) {
            if (!data.settings.bailleur.signatureImage && typeof DEFAULT_SIGNATURE_IMAGE !== 'undefined') {
              data.settings.bailleur.signatureImage = DEFAULT_SIGNATURE_IMAGE;
            }
            return LoyerStore.saveNow(data).catch(function () {
              return LoyerStore.save(data);
            });
          })
          .then(function (data) {
            state.data = data;
            renderAll();
            updateDataFileStatus();
            LoyerNotify.success('Données rechargées.');
          })
          .catch(function () {
            LoyerNotify.error('Impossible de recharger les données.');
          });
      });
    });

    bindIf('#btn-refresh-quittance', function (el) {
      el.addEventListener('click', function () {
        flushTemplateEditsIfNeeded('quittance')
          .then(renderQuittancePreview)
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Enregistrement impossible.');
          });
      });
    });
    bindIf('#btn-refresh-mail', function (el) {
      el.addEventListener('click', function () {
        flushTemplateEditsIfNeeded('mail')
          .then(renderMailPreview)
          .catch(function (err) {
            LoyerNotify.error(err.message || 'Enregistrement impossible.');
          });
      });
    });

    bindIf('#btn-mail-eml', function (el) {
      el.addEventListener('click', function () {
        withTemplatesSaved(['mail', 'quittance'], function () {
          return prepareMailAction('eml');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });
    bindIf('#btn-mail-nav', function (el) {
      el.addEventListener('click', function () {
        withTemplatesSaved(['mail', 'quittance'], function () {
          return prepareMailAction('mailto');
        }).catch(function (err) {
          LoyerNotify.error('Erreur : ' + err.message);
        });
      });
    });

    bindIf('#btn-export-pdf', function (el) {
      el.addEventListener('click', function () {
        withTemplatesSaved(['quittance'], function () {
          return exportQuittanceFormat('pdf');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
    bindIf('#btn-export-docx', function (el) {
      el.addEventListener('click', function () {
        withTemplatesSaved(['quittance'], function () {
          return exportQuittanceFormat('docx');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
    bindIf('#btn-export-html', function (el) {
      el.addEventListener('click', function () {
        withTemplatesSaved(['quittance'], function () {
          return exportQuittanceFormat('html');
        }).catch(function (err) {
          LoyerNotify.error(err.message || 'Enregistrement impossible.');
        });
      });
    });
  }

  function finishInit() {
    LoyerEditor.init();
    bindEvents();
    bindSaveStatusEvents();
    if (global.LOYER_SITE_META) {
      var ghLink = $('#footer-github-link');
      if (ghLink && global.LOYER_SITE_META.githubUrl) {
        ghLink.href = global.LOYER_SITE_META.githubUrl;
      }
    }
    if (global.LoyerHelp) LoyerHelp.init(showPanel);
    renderAll();
    initTemplatesUi();
    showPanel('panel-dashboard');
  }

  function init() {
    showLoading();
    LoyerStore.init()
      .then(function (result) {
        state.data = result.data;
        finishInit();
        applyInitResult(result);
        if (result.mode === 'server' && result.created) {
          LoyerNotify.success('Données et modèles initialisés sur le serveur.');
        }
      })
      .catch(function (err) {
        if (err && err.name === 'CorruptDataFileError') {
          state.data = LoyerStore.loadFallbackData();
          finishInit();
          applyInitResult({});
          hideLoading();
          handleCorruptFile(err);
          return;
        }
        console.error(err);
        state.data = LoyerStore.loadFallbackData();
        persist();
        finishInit();
        applyInitResult({ offline: true });
        LoyerNotify.error('Erreur au chargement des données.');
      })
      .finally(function () {
        hideLoading();
      });
  }

  document.addEventListener('DOMContentLoaded', init);
})(window);
