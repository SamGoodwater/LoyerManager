/** Virements, import CSV, modale paiement. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Classe CSS normalisée à partir du libellé statut virement. */
  function paymentStatusClass(status) {
    var s = String(status || '').toLowerCase();
    if (s.indexOf('import') !== -1) return 'importe';
    if (s.indexOf('verif') !== -1) return 'verifie';
    return 'manuel';
  }

  /** Badge HTML pour la colonne statut d'un virement. */
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

  /** Génère les <td> d'une ligne virement (tableaux dashboard et liste). */
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
    return (
      cell('Date', '', p.date) +
      cell('Émetteur', '', App.escapeHtml(p.emitter)) +
      cell('Montant', 'num', App.fmt(p.amount)) +
      cell('Libellé bancaire', 'payment-label', App.escapeHtml(p.bankLabel || '—'), p.bankLabel) +
      cell('Réf.', 'payment-ref col-pay-ref', App.escapeHtml(p.bankRef || '—'), p.bankRef) +
      cell('Statut', '', App.renderPaymentStatusBadge(p.status)) +
      cell('Commentaire', 'payment-comment col-pay-comment', App.escapeHtml(p.comment || '—'), p.comment)
    );
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

  /** Ouvre la modale création/édition virement avec valeurs préremplies. */
  function openPaymentModal(payment) {
    App.populateEmitterSelect();
    App.state.editingPaymentId = payment ? payment.id : null;
    App.$('#modal-payment-title').textContent = payment ? 'Modifier le virement' : 'Nouveau virement';
    App.$('#pay-date').value = payment ? payment.date : LoyerCalc.formatDateISO(new Date());
    App.$('#pay-emitter').value = payment ? payment.emitter : App.state.data.settings.emitters[0] || '';
    App.$('#pay-amount').value = payment ? payment.amount : '';
    App.$('#pay-bank-label').value = payment ? payment.bankLabel || '' : '';
    App.$('#pay-bank-ref').value = payment ? payment.bankRef || '' : '';
    App.$('#pay-status').value = payment ? payment.status || 'manuel' : 'manuel';
    App.$('#pay-comment').value = payment ? payment.comment || '' : '';
    App.$('#modal-payment').classList.remove('hidden');
    App.$('#pay-date').focus();
  }

  /** Ferme la modale et réinitialise le formulaire. */
  function closePaymentModal() {
    App.state.editingPaymentId = null;
    App.$('#modal-payment').classList.add('hidden');
    App.$('#form-payment').reset();
  }

  /** Rafraîchit le tableau complet de l'onglet Virements. */
  function renderPayments() {
    App.populateEmitterSelect();
    var sorted = App.state.data.payments.slice().sort(function (a, b) {
      return LoyerCalc.parseDate(b.date) - LoyerCalc.parseDate(a.date);
    });

    App.$('#payments-table tbody').innerHTML = sorted
      .map(function (p) {
        return (
          '<tr>' +
          App.renderPaymentRowCells(p) +
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

  App.paymentStatusClass = paymentStatusClass;
  App.renderPaymentStatusBadge = renderPaymentStatusBadge;
  App.renderPaymentRowCells = renderPaymentRowCells;
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

  /** Boutons ajout, suppression globale, modale, import CSV. */
  function bindPaymentsEvents() {
    App.$('#form-payment').addEventListener('submit', function (e) {
      e.preventDefault();
      var payment = {
        id: App.state.editingPaymentId || LoyerCalc.generateId(),
        date: App.$('#pay-date').value,
        emitter: App.$('#pay-emitter').value,
        amount: parseFloat(App.$('#pay-amount').value),
        bankLabel: App.$('#pay-bank-label').value.trim(),
        bankRef: App.$('#pay-bank-ref').value.trim(),
        status: App.$('#pay-status').value || 'manuel',
        comment: App.$('#pay-comment').value.trim()
      };
      if (!payment.date || !payment.emitter || !(payment.amount > 0)) {
        LoyerNotify.warn('Veuillez remplir tous les champs correctement.');
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
      App.persist();
      App.closePaymentModal();
      App.renderAll();
      LoyerNotify.success(wasEdit ? 'Virement modifié.' : 'Virement enregistré.');
    });

    App.$('#btn-add-payment').addEventListener('click', function () {
      App.openPaymentModal(null);
    });

    App.$('#btn-clear-payments').addEventListener('click', function () {
      if (!App.state.data.payments.length) {
        LoyerNotify.info('Aucun virement à supprimer.');
        return;
      }
      LoyerNotify.confirm('Supprimer tous les virements enregistrés ?', {
        confirmLabel: 'Tout supprimer',
        danger: true
      }).then(function (ok) {
        if (!ok) return;
        App.state.data.payments = [];
        App.persist();
        App.renderAll();
        LoyerNotify.success('Tous les virements ont été supprimés.');
      });
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
      else if (!App.$('#modal-payment').classList.contains('hidden')) App.closePaymentModal();
    });

    App.$('#import-csv').addEventListener('change', function (e) {
      var file = e.target.files[0];
      if (file) App.readCsvFile(file);
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
        LoyerNotify.warn('Aucun virement sélectionné à importer.');
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
      LoyerNotify.success(toImport.length + ' virement(s) importé(s).');
      var csvName = App.$('#import-csv') && App.$('#import-csv').files && App.$('#import-csv').files[0]
        ? App.$('#import-csv').files[0].name
        : '';
      if (global.LoyerServerApi && global.LoyerServerApi.isActive()) {
        global.LoyerServerApi.logCsvImport(
          'Import CSV : ' + toImport.length + ' virement(s)',
          { count: toImport.length, filename: csvName }
        ).then(function () {
          if (global.LoyerActivityLog) global.LoyerActivityLog.loadAndRender();
        });
      }
    });

    App.$('#payments-table').addEventListener('click', function (e) {
      var editBtn = e.target.closest('.btn-edit-pay');
      var delBtn = e.target.closest('.btn-del-pay');
      if (editBtn) {
        var p = App.state.data.payments.find(function (x) {
          return x.id === editBtn.dataset.id;
        });
        if (p) App.openPaymentModal(p);
      }
      if (delBtn) {
        LoyerNotify.confirm('Supprimer ce virement ?', {
          confirmLabel: 'Supprimer',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          App.state.data.payments = App.state.data.payments.filter(function (x) {
            return x.id !== delBtn.dataset.id;
          });
          App.persist();
          App.renderAll();
          LoyerNotify.success('Virement supprimé.');
        });
      }
    });
  }

  App.bindPaymentsEvents = bindPaymentsEvents;
})(window);
