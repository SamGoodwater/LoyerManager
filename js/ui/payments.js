/** Paiements, import CSV, modale paiement. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Classe CSS normalisée à partir du libellé statut origine. */
  function paymentStatusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s.indexOf('import') !== -1) return 'importe';
    if (s.indexOf('verif') !== -1) return 'verifie';
    return 'manuel';
  }

  /** Badge HTML pour la colonne statut d'un paiement. */
  function renderPaymentStatusBadge(status) {
    var label = status || '—';
    if (!status) {
      return '<span class="payment-status payment-status-empty">—</span>';
    }
    return (
      '<span class="payment-status payment-status-' +
      App.paymentStatusClass(status) +
      '">' +
      App.escapeHtml(label) +
      '</span>'
    );
  }

  /** Badge HTML pour le tag type de paiement. */
  function renderPaymentTagBadge(tag) {
    var id = global.LoyerPaymentTags.normalizeTag(tag);
    var label = global.LoyerPaymentTags.getTagLabel(id);
    return (
      '<span class="payment-tag payment-tag-' +
      id +
      '">' +
      App.escapeHtml(label) +
      '</span>'
    );
  }

  /** Bouton rond icône en début de ligne (tableaux mois / paiements). */
  function renderRowIconButton(options) {
    options = options || {};
    var extraClass = options.extraClass || '';
    var icon = options.icon || 'fa-pen-clip';
    var label = options.label || '';
    var attrs = options.attrs || '';
    return (
      '<button type="button" class="btn-row-icon ' +
      extraClass +
      '" aria-label="' +
      App.escapeHtml(label) +
      '" title="' +
      App.escapeHtml(label) +
      '" ' +
      attrs +
      '><i class="fa-solid ' +
      icon +
      '" aria-hidden="true"></i></button>'
    );
  }

  /** Select inline pour changer le type de paiement. */
  function renderPaymentTagSelect(p) {
    var id = global.LoyerPaymentTags.normalizeTag(p.tag);
    var opts = global.LoyerPaymentTags.TAGS.map(function (t) {
      return (
        '<option value="' +
        t.id +
        '"' +
        (t.id === id ? ' selected' : '') +
        '>' +
        App.escapeHtml(t.label) +
        '</option>'
      );
    }).join('');
    return (
      '<select class="payment-tag-select payment-tag-select-' +
      id +
      '" data-payment-id="' +
      App.escapeHtml(p.id) +
      '" aria-label="Type de paiement">' +
      opts +
      '</select>'
    );
  }

  /** Génère les <td> d'une ligne paiement (tableaux dashboard et liste). */
  function renderPaymentRowCells(p, options) {
    options = options || {};
    function cell(label, className, html, title) {
      var attrs = '';
      if (options.dataLabels && label) {
        attrs += ' data-label="' + App.escapeHtml(label) + '"';
      }
      if (className) attrs += ' class="' + className + '"';
      if (title) attrs += ' title="' + App.escapeHtml(title) + '"';
      return '<td' + attrs + '>' + html + '</td>';
    }
    var typeHtml = options.tagAsSelect
      ? App.renderPaymentTagSelect(p)
      : App.renderPaymentTagBadge(p.tag);
    var html =
      cell('Date', '', p.date) +
      cell('Type', 'col-pay-type', typeHtml) +
      cell(
        'Montant',
        'num' + (Number(p.amount) < 0 ? ' num-negative' : ''),
        App.fmt(p.amount)
      ) +
      cell('Émetteur', '', App.escapeHtml(p.emitter));
    if (!options.compact) {
      html +=
        cell('Libellé bancaire', 'payment-label', App.escapeHtml(p.bankLabel || '—'), p.bankLabel) +
        cell('Réf.', 'payment-ref col-pay-ref', App.escapeHtml(p.bankRef || '—'), p.bankRef);
    }
    html +=
      cell('Statut', '', App.renderPaymentStatusBadge(p.status)) +
      cell('Commentaire', 'payment-comment col-pay-comment', App.escapeHtml(p.comment || '—'), p.comment);
    return html;
  }

  /** Remplit le <select> émetteur de la modale virement. */
  function populateEmitterSelect() {
    var emitters = App.state.data.settings.emitters;
    var emitterSel = App.$('#pay-emitter');
    if (!emitterSel) return;
    emitterSel.innerHTML = emitters
      .map(function (e) {
        return '<option value="' + App.escapeHtml(e) + '">' + App.escapeHtml(e) + '</option>';
      })
      .join('');
  }

  /** Remplit le <select> tag de la modale paiement. */
  function populateTagSelect(selected) {
    var tagSel = App.$('#pay-tag');
    if (!tagSel || !global.LoyerPaymentTags) return;
    tagSel.innerHTML = global.LoyerPaymentTags.TAGS.map(function (t) {
      return (
        '<option value="' +
        t.id +
        '">' +
        App.escapeHtml(t.label) +
        '</option>'
      );
    }).join('');
    tagSel.value = global.LoyerPaymentTags.normalizeTag(selected);
  }

  /** Ouvre la modale création/édition paiement avec valeurs préremplies. */
  function openPaymentModal(payment, context) {
    context = context ? Object.assign({}, context) : {};
    var monthModal = App.$('#modal-month-detail');
    if (monthModal && !monthModal.classList.contains('hidden') && App.state.monthDetail) {
      context.suspendedMonthDetail = true;
      monthModal.classList.add('hidden');
    }
    App.populateEmitterSelect();
    App.populateTagSelect(payment ? payment.tag : global.LoyerPaymentTags.DEFAULT_TAG);
    App.state.paymentModalContext = context;
    App.state.editingPaymentId = payment ? payment.id : null;
    App.$('#modal-payment-title').textContent = payment ? 'Modifier le paiement' : 'Nouveau paiement';
    App.$('#pay-date').value =
      payment && payment.date
        ? payment.date
        : context && context.presetDate
          ? context.presetDate
          : LoyerCalc.formatDateISO(new Date());
    App.$('#pay-emitter').value = payment ? payment.emitter : App.state.data.settings.emitters[0] || '';
    App.$('#pay-amount').value = payment ? payment.amount : '';
    App.$('#pay-bank-label').value = payment ? payment.bankLabel || '' : '';
    App.$('#pay-bank-ref').value = payment ? payment.bankRef || '' : '';
    App.$('#pay-status').value = payment ? payment.status || 'manuel' : 'manuel';
    App.$('#pay-comment').value = payment ? payment.comment || '' : '';
    App.$('#modal-payment').classList.remove('hidden');
    if (global.LoyerReportExport) global.LoyerReportExport.syncPaymentReportButton();
    App.$('#pay-date').focus();
  }

  /** Ferme la modale et réinitialise le formulaire. */
  function closePaymentModal() {
    var ctx = App.state.paymentModalContext;
    App.state.editingPaymentId = null;
    App.state.paymentModalContext = null;
    App.$('#modal-payment').classList.add('hidden');
    App.$('#form-payment').reset();
    if (global.LoyerReportExport) global.LoyerReportExport.syncPaymentReportButton();
    if (ctx && ctx.suspendedMonthDetail && App.state.monthDetail) {
      App.$('#modal-month-detail').classList.remove('hidden');
    }
  }

  /** Lit les critères filtres depuis le DOM. */
  function readPaymentFilterCriteria() {
    var amountModeEl = App.$('#pay-filter-amount-mode');
    var amountMode = amountModeEl ? amountModeEl.value : 'all';
    return {
      search: App.$('#pay-filter-search') ? App.$('#pay-filter-search').value.trim() : '',
      year: App.$('#pay-filter-year') ? App.$('#pay-filter-year').value : '',
      month: App.$('#pay-filter-month') ? App.$('#pay-filter-month').value : '',
      tag: App.$('#pay-filter-tag') ? App.$('#pay-filter-tag').value : '',
      amountMode: amountMode,
      amountExact: App.$('#pay-filter-amount-exact') ? App.$('#pay-filter-amount-exact').value.trim() : '',
      sort: App.$('#pay-filter-sort') ? App.$('#pay-filter-sort').value : 'date-desc'
    };
  }

  /** Remplit les listes année du filtre paiements. */
  function populatePaymentFilterYears() {
    var yearSel = App.$('#pay-filter-year');
    if (!yearSel) return;
    var years = {};
    (App.state.data.payments || []).forEach(function (p) {
      var y = String(p.date || '').slice(0, 4);
      if (y) years[y] = true;
    });
    var list = Object.keys(years).sort();
    var current = yearSel.value;
    yearSel.innerHTML =
      '<option value="">Toutes</option>' +
      list
        .map(function (y) {
          return '<option value="' + y + '">' + y + '</option>';
        })
        .join('');
    if (current && years[current]) yearSel.value = current;
  }

  /** Applique filtres et rafraîchit le tableau Paiements. */
  function applyPaymentFilters() {
    var criteria = readPaymentFilterCriteria();
    App.state.paymentFilters = criteria;
    if (global.LoyerPaymentFilters) global.LoyerPaymentFilters.saveCriteria(criteria);
    App.renderPayments();
  }

  /** Rafraîchit le tableau complet de l'onglet Paiements. */
  function renderPayments() {
    App.populateEmitterSelect();
    populatePaymentFilterYears();
    var criteria =
      App.state.paymentFilters ||
      (global.LoyerPaymentFilters ? global.LoyerPaymentFilters.loadCriteria() : readPaymentFilterCriteria());
    App.state.paymentFilters = criteria;

    if (App.$('#pay-filter-search')) App.$('#pay-filter-search').value = criteria.search || '';
    if (App.$('#pay-filter-year')) App.$('#pay-filter-year').value = criteria.year || '';
    if (App.$('#pay-filter-month')) App.$('#pay-filter-month').value = criteria.month || '';
    if (App.$('#pay-filter-tag')) App.$('#pay-filter-tag').value = criteria.tag || '';
    if (App.$('#pay-filter-amount-mode')) App.$('#pay-filter-amount-mode').value = criteria.amountMode || 'all';
    if (App.$('#pay-filter-amount-exact')) {
      App.$('#pay-filter-amount-exact').value = criteria.amountExact || '';
      App.$('#pay-filter-amount-exact').classList.toggle(
        'hidden',
        criteria.amountMode !== 'exact'
      );
    }
    if (App.$('#pay-filter-sort')) App.$('#pay-filter-sort').value = criteria.sort || 'date-desc';

    var sorted = global.LoyerPaymentFilters
      ? global.LoyerPaymentFilters.filterAndSort(App.state.data.payments, criteria)
      : App.state.data.payments.slice();

    var hint = App.$('#payments-filter-hint');
    if (hint) {
      hint.textContent =
        sorted.length +
        ' paiement(s) affiché(s) sur ' +
        App.state.data.payments.length +
        '.';
    }

    App.$('#payments-table tbody').innerHTML = sorted
      .map(function (p) {
        return (
          '<tr data-payment-id="' +
          App.escapeHtml(p.id) +
          '">' +
          '<td class="col-row-action">' +
          App.renderRowIconButton({
            extraClass: 'btn-edit-pay-icon',
            label: 'Modifier le paiement',
            attrs: 'data-id="' + App.escapeHtml(p.id) + '"'
          }) +
          '</td>' +
          App.renderPaymentRowCells(p, { tagAsSelect: true }) +
          '<td class="inline-actions">' +
          '<button type="button" class="btn btn-danger btn-del-pay" data-id="' +
          p.id +
          '"><i class="fa-solid fa-trash" aria-hidden="true"></i>Suppr.</button>' +
          '</td></tr>'
        );
      })
      .join('') || '<tr><td colspan="10" class="empty-msg">Aucun paiement enregistré</td></tr>';
  }

  /** Met à jour le tag d'un paiement depuis le select inline. */
  function setPaymentTag(paymentId, tag, selectEl) {
    var idx = App.state.data.payments.findIndex(function (p) {
      return p.id === paymentId;
    });
    if (idx < 0) return;
    var normalized = global.LoyerPaymentTags.normalizeTag(tag);
    App.state.data.payments[idx] = LoyerStore.normalizePayment(
      Object.assign({}, App.state.data.payments[idx], { tag: normalized })
    );
    App.persist();
    if (selectEl) {
      selectEl.className = 'payment-tag-select payment-tag-select-' + normalized;
    }
    LoyerNotify.success('Type modifié.');
  }

  /** Ferme la modale prévisualisation import CSV. */
  function closeCsvImportModal() {
    App.state.csvImportItems = [];
    App.$('#modal-csv-import').classList.add('hidden');
    App.$('#csv-import-table tbody').innerHTML = '';
    App.$('#import-csv').value = '';
  }

  /** Table HTML des lignes CSV détectées avec cases à cocher et doublons. */
  function renderCsvImportTable() {
    var items = App.state.csvImportItems;
    var tbody = App.$('#csv-import-table tbody');
    var newCount = items.filter(function (item) {
      return !item.duplicate;
    }).length;
    var dupCount = items.length - newCount;
    var selectedCount = items.filter(function (item) {
      return item.selected && !item.duplicate;
    }).length;

    App.$('#csv-import-summary').textContent =
      items.length +
      ' paiement(s) reconnu(s) dans le CSV — ' +
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
          '<td class="num">' + App.fmt(item.amount) + '</td>' +
          '<td>' + App.escapeHtml(item.emitterName) + '</td>' +
          '<td class="csv-label" title="' + App.escapeHtml(item.label) + '">' + App.escapeHtml(item.label) + '</td>' +
          '<td class="csv-ref">' + App.escapeHtml(item.bankRef || '—') + '</td>' +
          '<td>' + App.escapeHtml(status) + '</td></tr>'
        );
      })
      .join('');

    var selectAll = App.$('#csv-import-select-all');
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

  /** Parse le CSV, détecte virements locataire, ouvre la modale. */
  function openCsvImportModal(csvText) {
    var preview = LoyerCsvImport.buildImportPreview(csvText, App.state.data.settings, App.state.data.payments);
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
    App.state.csvImportItems = preview.items;
    App.renderCsvImportTable();
    App.$('#modal-csv-import').classList.remove('hidden');
  }

  /** Lit un File CSV en texte (UTF-8 ou ISO-8859-1). */
  function readCsvFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = LoyerCsvImport.decodeCsvBuffer(reader.result);
      App.openCsvImportModal(text);
    };
    reader.onerror = function () {
      LoyerNotify.error('Impossible de lire le fichier CSV.');
    };
    reader.readAsArrayBuffer(file);
  }

  /** Importe un profil JSON (complet ou legacy). */
  function importJsonFile(file) {
    return LoyerStore.importProfileFile(file)
      .then(function (data) {
        var chain = Promise.resolve(data);
        if (global.LoyerTemplateManager) {
          chain = global.LoyerTemplateManager.syncRegistryFromDisk(data.settings).then(function (result) {
            if (result.changed) {
              data.settings = result.settings;
              return LoyerStore.saveNow(data).then(function () {
                return data;
              });
            }
            return data;
          });
        }
        return chain;
      })
      .then(function (data) {
        App.state.data = data;
        App.renderAll();
        App.updateDataFileStatus();
        if (global.LoyerMailOAuth) global.LoyerMailOAuth.refreshTransport();
        LoyerNotify.success('Données importées.');
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Import JSON impossible.');
      });
  }

  /** Retourne csv, json ou unknown selon extension/MIME. */
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

  /** Route fichiers déposés vers import CSV ou profil JSON. */
  function handleDroppedImportFiles(fileList) {
    if (!fileList || !fileList.length) return;
    var jsonFile = null;
    var csvFile = null;
    for (var i = 0; i < fileList.length; i++) {
      var kind = App.classifyImportFile(fileList[i]);
      if (kind === 'json') jsonFile = fileList[i];
      else if (kind === 'csv') csvFile = fileList[i];
    }
    if (jsonFile && csvFile) {
      LoyerNotify.warn('Déposez un seul fichier à la fois (.json ou .csv).');
      return;
    }
    if (jsonFile) {
      App.importJsonFile(jsonFile);
      return;
    }
    if (csvFile) {
      App.readCsvFile(csvFile);
      return;
    }
    LoyerNotify.warn('Fichier non reconnu. Déposez un .json (données) ou un .csv (relevé bancaire).');
  }

  /** Overlay glisser-déposer global + zone cible. */
  function bindFileDropImport() {
    var overlay = App.$('#file-drop-overlay');
    if (!overlay) return;

    var dragDepth = 0;

    function isAppReady() {
      var loading = App.$('#app-loading');
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
        App.handleDroppedImportFiles(e.dataTransfer.files);
      },
      false
    );

    window.addEventListener('dragend', hideDropOverlay, false);
  }

  App.renderRowIconButton = renderRowIconButton;
  App.renderPaymentTagSelect = renderPaymentTagSelect;
  App.setPaymentTag = setPaymentTag;
  App.paymentStatusClass = paymentStatusClass;
  App.renderPaymentStatusBadge = renderPaymentStatusBadge;
  App.renderPaymentRowCells = renderPaymentRowCells;
  App.renderPaymentTagBadge = renderPaymentTagBadge;
  App.populateTagSelect = populateTagSelect;
  App.readPaymentFilterCriteria = readPaymentFilterCriteria;
  App.applyPaymentFilters = applyPaymentFilters;
  App.populateEmitterSelect = populateEmitterSelect;
  App.openPaymentModal = openPaymentModal;
  App.closePaymentModal = closePaymentModal;
  App.renderPayments = renderPayments;
  App.closeCsvImportModal = closeCsvImportModal;
  App.renderCsvImportTable = renderCsvImportTable;
  App.openCsvImportModal = openCsvImportModal;
  App.readCsvFile = readCsvFile;
  App.importJsonFile = importJsonFile;
  App.classifyImportFile = classifyImportFile;
  App.handleDroppedImportFiles = handleDroppedImportFiles;
  App.bindFileDropImport = bindFileDropImport;

  /** Télécharge le relevé CSV fictif (mode démo uniquement). */
  function downloadDemoCsvSample() {
    fetch('demo/releve-bancaire.demo.csv')
      .then(function (res) {
        if (!res.ok) throw new Error('not found');
        return res.text();
      })
      .then(function (text) {
        var blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'releve-bancaire.demo.csv';
        a.click();
        URL.revokeObjectURL(a.href);
        LoyerNotify.success('Relevé de démonstration téléchargé — importez-le via « Importer CSV ».');
      })
      .catch(function () {
        LoyerNotify.error('Impossible de télécharger le relevé bancaire de démonstration.');
      });
  }

  /** Boutons ajout, suppression globale, modale, import CSV. */
  function bindPaymentsEvents() {
    App.$('#form-payment').addEventListener('submit', function (e) {
      e.preventDefault();
      var payment = {
        id: App.state.editingPaymentId || LoyerCalc.generateId(),
        date: App.$('#pay-date').value,
        emitter: App.$('#pay-emitter').value,
        amount: parseFloat(App.$('#pay-amount').value),
        tag: App.$('#pay-tag') ? App.$('#pay-tag').value : global.LoyerPaymentTags.DEFAULT_TAG,
        bankLabel: App.$('#pay-bank-label').value.trim(),
        bankRef: App.$('#pay-bank-ref').value.trim(),
        status: App.$('#pay-status').value || 'manuel',
        comment: App.$('#pay-comment').value.trim()
      };
      if (
        !payment.date ||
        !payment.emitter ||
        payment.amount === 0 ||
        isNaN(payment.amount)
      ) {
        LoyerNotify.warn('Date, émetteur et montant non nul requis.');
        return;
      }
      if (App.state.editingPaymentId) {
        var idx = App.state.data.payments.findIndex(function (p) {
          return p.id === App.state.editingPaymentId;
        });
        if (idx >= 0) App.state.data.payments[idx] = LoyerStore.normalizePayment(payment);
      } else {
        App.state.data.payments.push(LoyerStore.normalizePayment(payment));
      }
      var wasEdit = !!App.state.editingPaymentId;
      var ctx = App.state.paymentModalContext;
      App.persist();
      App.closePaymentModal();
      App.renderAll();
      if (ctx && typeof ctx.onSaved === 'function') ctx.onSaved();
      LoyerNotify.success(wasEdit ? 'Paiement modifié.' : 'Paiement enregistré.');
    });

    App.$('#btn-add-payment').addEventListener('click', function () {
      App.openPaymentModal(null);
    });

    App.$$('[data-modal-close]').forEach(function (el) {
      el.addEventListener('click', closePaymentModal);
    });

    App.$$('[data-csv-modal-close]').forEach(function (el) {
      el.addEventListener('click', closeCsvImportModal);
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (!App.$('#modal-csv-import').classList.contains('hidden')) App.closeCsvImportModal();
      else if (!App.$('#modal-month-detail').classList.contains('hidden') && App.closeMonthDetailModal) {
        App.closeMonthDetailModal();
      } else if (!App.$('#modal-payment').classList.contains('hidden')) App.closePaymentModal();
    });

    App.$('#import-csv').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) App.readCsvFile(file);
    });

    App.bindIf('#btn-demo-csv-download', function (el) {
      el.addEventListener('click', downloadDemoCsvSample);
    });

    App.$('#csv-import-table').addEventListener('change', function (e) {
      var check = e.target.closest('.csv-import-check');
      if (!check) return;
      var item = App.state.csvImportItems[parseInt(check.dataset.index, 10)];
      if (item && !item.duplicate) item.selected = check.checked;
      App.renderCsvImportTable();
    });

    App.$('#csv-import-select-all').addEventListener('change', function () {
      var checked = this.checked;
      App.state.csvImportItems.forEach(function (item) {
        if (!item.duplicate) item.selected = checked;
      });
      App.renderCsvImportTable();
    });

    App.$('#btn-csv-import-confirm').addEventListener('click', function () {
      var toImport = LoyerCsvImport.itemsToPayments(App.state.csvImportItems);
      if (!toImport.length) {
        LoyerNotify.warn('Aucun paiement sélectionné à importer.');
        return;
      }
      App.state.data.payments = App.state.data.payments.concat(
        toImport.map(function (p) {
          return LoyerStore.normalizePayment(p);
        })
      );
      App.persist();
      App.closeCsvImportModal();
      App.renderAll();
      LoyerNotify.success(toImport.length + ' paiement(s) importé(s).');
      var csvName = App.$('#import-csv') && App.$('#import-csv').files && App.$('#import-csv').files[0]
        ? App.$('#import-csv').files[0].name
        : '';
      if (global.LoyerServerApi && global.LoyerServerApi.isActive()) {
        global.LoyerServerApi.logCsvImport(
          'Import CSV : ' + toImport.length + ' paiement(s)',
          { count: toImport.length, filename: csvName }
        ).then(function () {
          if (global.LoyerActivityLog) global.LoyerActivityLog.loadAndRender();
        });
      }
    });

    App.bindIf('#pay-filter-apply', function (el) {
      el.addEventListener('click', applyPaymentFilters);
    });

    App.bindIf('#pay-filter-reset', function (el) {
      el.addEventListener('click', function () {
        App.state.paymentFilters = global.LoyerPaymentFilters.defaultCriteria();
        global.LoyerPaymentFilters.saveCriteria(App.state.paymentFilters);
        App.renderPayments();
      });
    });

    ['pay-filter-search', 'pay-filter-year', 'pay-filter-month', 'pay-filter-tag', 'pay-filter-sort'].forEach(
      function (id) {
        App.bindIf('#' + id, function (el) {
          el.addEventListener('change', applyPaymentFilters);
          if (id === 'pay-filter-search') {
            el.addEventListener('input', applyPaymentFilters);
          }
        });
      }
    );

    App.bindIf('#pay-filter-amount-mode', function (el) {
      el.addEventListener('change', function () {
        var exact = App.$('#pay-filter-amount-exact');
        if (exact) exact.classList.toggle('hidden', el.value !== 'exact');
        applyPaymentFilters();
      });
    });

    App.bindIf('#pay-filter-amount-exact', function (el) {
      el.addEventListener('change', applyPaymentFilters);
    });

    App.$('#payments-table').addEventListener('change', function (e) {
      var tagSel = e.target.closest('.payment-tag-select');
      if (!tagSel) return;
      App.setPaymentTag(tagSel.dataset.paymentId, tagSel.value, tagSel);
    });

    App.$('#payments-table').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-edit-pay-icon');
      var delBtn = e.target.closest('.btn-del-pay');
      if (editBtn) {
        var pEdit = App.state.data.payments.find(function (x) {
          return x.id === editBtn.dataset.id;
        });
        if (pEdit) App.openPaymentModal(pEdit);
      }
      if (delBtn) {
        LoyerNotify.confirm('Supprimer ce paiement ?', {
          confirmLabel: 'Supprimer',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          App.state.data.payments = App.state.data.payments.filter(function (x) {
            return x.id !== delBtn.dataset.id;
          });
          App.persist();
          App.renderAll();
          LoyerNotify.success('Paiement supprimé.');
        });
      }
    });
  }

  App.bindPaymentsEvents = bindPaymentsEvents;
})(window);
