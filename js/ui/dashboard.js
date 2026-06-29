/** Tableau de bord : KPIs, heatmap, graphiques. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  /** Badge HTML coloré pour le statut d'un mois (payé, impayé…). */
  function renderMonthStatusBadge(status) {
    return (
      '<span class="month-status month-status-' +
      status +
      '">' +
      App.escapeHtml(LoyerCalc.getMonthStatusLabel(status)) +
      '</span>'
    );
  }

  /** HTML d'une cellule heatmap avec tooltip statut et classes CSS. */
  function heatmapCellHtml(row, year, month, status, extraClass) {
    var statusLabel = LoyerCalc.getMonthStatusLabel(status);
    var monthLabel = LoyerCalc.formatMonthLong(year, month);
    var title =
      monthLabel +
      '\nStatut : ' +
      statusLabel +
      '\nTotal dû : ' +
      App.fmt(row.attendu) +
      ' (' +
      LoyerCalc.formatRentBreakdownText({
        loyer: row.loyerAttendu,
        charges: row.chargesAttendu,
        total: row.attendu
      }) +
      ')' +
      '\nReçu : ' +
      App.fmt(row.recu);
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
      App.escapeHtml(title) +
      '" aria-label="' +
      App.escapeHtml(monthLabel + ', ' + statusLabel) +
      '">' +
      '<span class="heatmap-cell-tip" role="tooltip">' +
      '<strong>' +
      App.escapeHtml(statusLabel) +
      '</strong><span>' +
      App.escapeHtml(monthLabel) +
      '</span></span></button>'
    );
  }

  /** Construit la grille heatmap à partir des lignes mensuelles. */
  function renderDashboardHeatmap(rows) {
    var el = App.$('#dashboard-heatmap');
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
    var settings = App.state.data.settings || {};
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
          if (App.isRowInPeriodRange(row)) extra += ' heatmap-in-range';
          if (App.isRowFocused(row)) extra += ' heatmap-focused';
          cells += '<div class="heatmap-cell">' + App.heatmapCellHtml(row, year, m, status, extra) + '</div>';
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

  /** Rafraîchit tout le tableau de bord (KPIs, tableaux, graphiques). */
  function renderDashboard() {
    var allRows = App.getMonthlyRows();
    var selectionRows = App.getDashboardSelectionRows(allRows);
    var rangeActive = global.LoyerPeriod && LoyerPeriod.isRangeActive();
    var periodLabel = App.getPeriodDisplayLabel();
    var settings = App.state.data.settings || {};
    var statusOpts = { rentDueDay: settings.rentDueDay };
    var kpis = LoyerCalc.computeKpisForRows(App.state.data, selectionRows);
    var yearly = LoyerCalc.computeYearlySummary(allRows);

    App.updatePeriodTabLabels();
    if (global.LoyerPeriod) LoyerPeriod.refresh();

    var kpiEl = App.$('#dash-kpis');
    if (kpiEl) {
      var taux =
        kpis.tauxRecouvrement != null ? Math.round(kpis.tauxRecouvrement * 100) + ' %' : '—';
      var soldeClass = kpis.soldeADate >= 0 ? 'positive' : 'negative';
      var kpiScope = rangeActive ? 'Période' : 'Mois';
      kpiEl.innerHTML =
        '<div class="stat-box"><div class="label">Solde fin de période</div><div class="value ' +
        soldeClass +
        '">' +
        App.fmt(kpis.soldeADate) +
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

    App.$('#yearly-table tbody').innerHTML = yearly
      .map(function (y) {
        var diffClass = y.difference >= 0 ? 'positive' : 'negative';
        return (
          '<tr><td>' + y.year + '</td>' +
          '<td class="num">' + App.fmt(y.attendu) + '</td>' +
          '<td class="num">' + App.fmt(y.recu) + '</td>' +
          '<td class="num ' + diffClass + '">' + App.fmt(y.difference) + '</td>' +
          '<td class="num">' + App.fmt(y.soldeCumule) + '</td></tr>'
        );
      })
      .join('') || '<tr><td colspan="5" class="empty-msg">Aucune donnée</td></tr>';

    App.$('#monthly-table tbody').innerHTML = selectionRows
      .map(function (r) {
        var diffClass = r.difference >= 0 ? 'positive' : 'negative';
        var classes = 'row-clickable';
        if (rangeActive && App.isRowInPeriodRange(r)) classes += ' row-in-range';
        if (App.isRowFocused(r)) {
          classes += rangeActive ? ' row-focused' : ' row-selected';
        }
        var status = LoyerCalc.getMonthStatus(r, statusOpts);
        var delay = LoyerCalc.getPaymentDelayDays(App.state.data, r.year, r.month);
        var delayHint =
          delay != null && delay > 0
            ? ' <span class="month-delay-hint" title="Retard de paiement">+' +
              delay +
              ' j</span>'
            : '';
        var note = LoyerStore.getMonthNote(App.state.data, r.year, r.month);
        var noteMark = note
          ? ' <span class="month-note-indicator" title="' +
            App.escapeHtml(note) +
            '" aria-label="Note interne">📝</span>'
          : '';
        return (
          '<tr class="' +
          classes +
          '" data-year="' +
          r.year +
          '" data-month="' +
          r.month +
          '" role="button" tabindex="0">' +
          '<td class="col-row-action">' +
          App.renderRowIconButton({
            extraClass: 'btn-month-detail',
            label: 'Détail paiements et note du mois',
            attrs:
              'data-year="' +
              r.year +
              '" data-month="' +
              r.month +
              '"'
          }) +
          '</td>' +
          '<td>' +
          LoyerCalc.formatMonthLong(r.year, r.month) +
          noteMark +
          delayHint +
          '</td>' +
          '<td>' +
          App.renderMonthStatusBadge(status) +
          '</td>' +
          '<td class="num" title="' +
          App.escapeHtml(
            LoyerCalc.formatRentBreakdownText({
              loyer: r.loyerAttendu,
              charges: r.chargesAttendu,
              total: r.attendu
            })
          ) +
          '">' +
          App.fmt(r.attendu) +
          '</td>' +
          '<td class="num">' +
          App.fmt(r.recu) +
          '</td>' +
          '<td class="num ' +
          diffClass +
          '">' +
          App.fmt(r.difference) +
          '</td>' +
          '<td class="num">' +
          App.fmt(r.soldeCumule) +
          '</td></tr>'
        );
      })
      .join('') ||
      '<tr><td colspan="7" class="empty-msg">Aucune donnée pour cette période</td></tr>';

    var tableHint = App.$('#dash-table-hint');
    if (tableHint) {
      tableHint.textContent = rangeActive
        ? selectionRows.length + ' mois dans la plage — clic = sélection ; icône crayon = détail mois.'
        : 'Clic = sélectionner un mois ; icône crayon = détail paiements et note interne.';
    }

    var focusLabel = LoyerCalc.formatMonthLong(App.state.focusYear, App.state.focusMonth);
    var paymentsLabel = App.$('#dash-payments-label');
    if (paymentsLabel) {
      paymentsLabel.textContent = rangeActive ? focusLabel : periodLabel;
    }

    var paymentsHint = App.$('#dash-payments-hint');
    if (paymentsHint) {
      paymentsHint.textContent = rangeActive
        ? 'Paiements enregistrés pour ce mois (période : ' + periodLabel + ').'
        : 'Paiements enregistrés ce mois-ci.';
    }

    var focusDetail = LoyerCalc.getMonthDetail(App.state.data, App.state.focusYear, App.state.focusMonth);
    var monthStatsHeading = App.$('#dash-month-stats-heading');
    if (monthStatsHeading) {
      monthStatsHeading.classList.toggle('hidden', !focusDetail.row);
    }
    if (rangeActive) {
      if (focusDetail.row) {
        App.$('#month-stats').innerHTML =
          '<div class="stat-box"><div class="label">Total dû (' +
          focusLabel +
          ')</div><div class="value">' +
          App.fmt(focusDetail.row.attendu) +
          '</div><div class="field-hint">' +
          App.escapeHtml(
            LoyerCalc.formatRentBreakdownText({
              loyer: focusDetail.row.loyerAttendu,
              charges: focusDetail.row.chargesAttendu,
              total: focusDetail.row.attendu
            })
          ) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Reçu</div><div class="value">' +
          App.fmt(focusDetail.row.recu) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Différence</div><div class="value ' +
          (focusDetail.row.difference >= 0 ? 'positive' : 'negative') +
          '">' +
          App.fmt(focusDetail.row.difference) +
          '</div></div>' +
          '<div class="stat-box"><div class="label">Solde cumulé</div><div class="value">' +
          App.fmt(focusDetail.row.soldeCumule) +
          '</div></div>';
      } else {
        App.$('#month-stats').innerHTML = '<p class="empty-msg">Mois hors période de location.</p>';
      }
    } else if (focusDetail.row) {
      App.$('#month-stats').innerHTML =
        '<div class="stat-box"><div class="label">Total dû</div><div class="value">' +
        App.fmt(focusDetail.row.attendu) +
        '</div><div class="field-hint">' +
        App.escapeHtml(
          LoyerCalc.formatRentBreakdownText({
            loyer: focusDetail.row.loyerAttendu,
            charges: focusDetail.row.chargesAttendu,
            total: focusDetail.row.attendu
          })
        ) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Reçu</div><div class="value">' +
        App.fmt(focusDetail.row.recu) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Différence</div><div class="value ' +
        (focusDetail.row.difference >= 0 ? 'positive' : 'negative') +
        '">' +
        App.fmt(focusDetail.row.difference) +
        '</div></div>' +
        '<div class="stat-box"><div class="label">Solde cumulé</div><div class="value">' +
        App.fmt(focusDetail.row.soldeCumule) +
        '</div></div>';
    } else {
      App.$('#month-stats').innerHTML = '<p class="empty-msg">Mois hors période de location.</p>';
    }

    var dashPayments = focusDetail.payments || [];

    App.$('#payments-month-table tbody').innerHTML = dashPayments
      .map(function (p) {
        return (
          '<tr>' +
          '<td class="col-row-action">' +
          App.renderRowIconButton({
            extraClass: 'btn-edit-pay-dash',
            label: 'Modifier le paiement',
            attrs: 'data-id="' + App.escapeHtml(p.id) + '"'
          }) +
          '</td>' +
          App.renderPaymentRowCells(p, { dataLabels: true }) +
          '</tr>'
        );
      })
      .join('') ||
      '<tr class="payments-empty-row"><td colspan="9" class="empty-msg">Aucun paiement ce mois</td></tr>';

    var canvasOverview = App.$('#chart-overview');
    var overviewLabel = App.$('#dash-chart-overview-label');
    var overviewHint = App.$('#dash-chart-overview-hint');
    var yearNav = App.$('#dash-chart-year-nav');
    var chartYear = App.getDashboardChartYear(allRows);
    var chartRows;
    var chartTitle;

    if (rangeActive) {
      chartRows = selectionRows;
      chartTitle = periodLabel;
      if (overviewLabel) overviewLabel.textContent = periodLabel;
      if (overviewHint) {
        overviewHint.textContent =
          'Plage sélectionnée — clic sur un mois pour afficher ses paiements ci-dessus.';
      }
      if (yearNav) yearNav.classList.add('hidden');
    } else {
      chartRows = allRows.filter(function (r) {
        return r.year === chartYear;
      });
      chartTitle = 'Année ' + chartYear;
      if (overviewLabel) overviewLabel.textContent = String(chartYear);
      if (overviewHint) {
        overviewHint.textContent =
          'Total dû (ligne grise), paiements empilés (vert zébré), remboursements (orange), manque (rouge), excédent (bleu), solde cumulé (tirets). Icône crayon dans le tableau mensuel = détail mois.';
      }
      if (yearNav) yearNav.classList.remove('hidden');
      var years = LoyerCalc.getAvailableYears(allRows);
      var yearIdx = years.indexOf(chartYear);
      var prevBtn = App.$('#btn-chart-year-prev');
      var nextBtn = App.$('#btn-chart-year-next');
      if (prevBtn) prevBtn.disabled = yearIdx <= 0;
      if (nextBtn) nextBtn.disabled = yearIdx === -1 || yearIdx >= years.length - 1;
    }

    if (canvasOverview && typeof Chart !== 'undefined' && chartRows.length) {
      LoyerCharts.renderOverviewChart(canvasOverview, {
        rows: chartRows,
        payments: App.state.data.payments || [],
        title: chartTitle,
        highlightMonth: { year: App.state.focusYear, month: App.state.focusMonth },
        onMonthClick: function (year, month) {
          App.handleDashboardMonthClick(year, month);
        }
      });
    } else if (canvasOverview && typeof Chart !== 'undefined') {
      LoyerCharts.destroyAll();
    }

    App.renderDashboardHeatmap(allRows);
  }

  /** Remplit les listes Du/Au de la modale export groupé. */
  function populateBatchExportSelects() {
    var rows = App.getMonthlyRows();
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
      var el = App.$('#' + id);
      if (el) el.innerHTML = monthOpts;
    });
    ['batch-from-year', 'batch-to-year'].forEach(function (id) {
      var el = App.$('#' + id);
      if (el) el.innerHTML = yearOpts;
    });

    var first = rows[0];
    var last = rows[rows.length - 1];
    if (first) {
      App.$('#batch-from-month').value = String(first.month);
      App.$('#batch-from-year').value = String(first.year);
    }
    App.$('#batch-to-month').value = String(App.state.selectedMonth);
    App.$('#batch-to-year').value = String(App.state.selectedYear);
    App.updateBatchExportSummary();
  }

  /** Met à jour le résumé (nb mois) dans la modale export groupé. */
  function updateBatchExportSummary() {
    var summary = App.$('#batch-export-summary');
    if (!summary) return;
    var fromM = parseInt(App.$('#batch-from-month').value, 10);
    var fromY = parseInt(App.$('#batch-from-year').value, 10);
    var toM = parseInt(App.$('#batch-to-month').value, 10);
    var toY = parseInt(App.$('#batch-to-year').value, 10);
    var months = LoyerCalc.listMonthsInRange(fromY, fromM, toY, toM, App.state.data);
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

  /** Ouvre la modale d'export quittances sur une plage. */
  function openBatchExportModal() {
    App.populateBatchExportSelects();
    App.$('#modal-batch-quittance').classList.remove('hidden');
  }

  /** Ferme la modale export groupé. */
  function closeBatchExportModal() {
    App.$('#modal-batch-quittance').classList.add('hidden');
  }

  /** Lance l'export PDF/DOCX/HTML pour chaque mois de la plage. */
  function runBatchExport(format) {
    var fromM = parseInt(App.$('#batch-from-month').value, 10);
    var fromY = parseInt(App.$('#batch-from-year').value, 10);
    var toM = parseInt(App.$('#batch-to-month').value, 10);
    var toY = parseInt(App.$('#batch-to-year').value, 10);
    var months = LoyerCalc.listMonthsInRange(fromY, fromM, toY, toM, App.state.data);
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
      App.state.quittanceUi.selectedId ||
      LoyerTemplateManager.getDefaultId(App.state.data.settings, 'quittance');
    App.flushTemplateEditsIfNeeded('quittance')
      .then(function () {
        return LoyerQuittance.exportBatch(
          App.state.data,
          fromY,
          fromM,
          toY,
          toM,
          templateId,
          format
        );
      })
      .then(function () {
        App.closeBatchExportModal();
        LoyerNotify.success('Export groupé terminé.');
        if (format === 'pdf' || format === 'docx') {
          var fn = LoyerQuittance.getBatchFilename(
            LoyerCalc.monthKey(fromY, fromM),
            LoyerCalc.monthKey(toY, toM)
          );
          return App.logQuittanceExport(format, {
            isRange: true,
            fromYear: fromY,
            fromMonth: fromM,
            toYear: toY,
            toMonth: toM
          }, fn, 'batch');
        }
      })
      .catch(function (err) {
        LoyerNotify.error(err.message || 'Export impossible.');
      });
  }

  /** Date préremplie pour un paiement dans un mois (jour théorique du loyer). */
  function monthDetailPresetDate(year, month) {
    var settings = App.state.data.settings || {};
    var dueDay = settings.rentDueDay || 1;
    var lastDay = new Date(year, month, 0).getDate();
    var day = Math.min(dueDay, lastDay);
    return (
      year +
      '-' +
      String(month).padStart(2, '0') +
      '-' +
      String(day).padStart(2, '0')
    );
  }

  /** Rafraîchit le tableau paiements dans la modale détail mois. */
  function renderMonthDetailPayments() {
    var md = App.state.monthDetail;
    if (!md) return;
    var tbody = App.$('#month-detail-payments-table tbody');
    if (!tbody) return;
    var list = LoyerCalc.filterPaymentsInMonth(
      App.state.data.payments || [],
      md.year,
      md.month
    );
    var refreshCtx = {
      onSaved: function () {
        renderMonthDetailPayments();
        App.renderDashboard();
      }
    };
    tbody.innerHTML =
      list
        .map(function (p) {
          return (
            '<tr>' +
            '<td class="col-row-action">' +
            App.renderRowIconButton({
              extraClass: 'btn-edit-pay-month',
              label: 'Modifier le paiement',
              attrs: 'data-id="' + App.escapeHtml(p.id) + '"'
            }) +
            '</td>' +
            App.renderPaymentRowCells(p, { compact: true }) +
            '<td class="inline-actions">' +
            '<button type="button" class="btn btn-danger btn-sm btn-del-pay-month" data-id="' +
            p.id +
            '"><i class="fa-solid fa-trash" aria-hidden="true"></i>Suppr.</button>' +
            '</td></tr>'
          );
        })
        .join('') ||
      '<tr><td colspan="8" class="empty-msg">Aucun paiement ce mois</td></tr>';

    tbody.querySelectorAll('.btn-edit-pay-month').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var pay = App.state.data.payments.find(function (x) {
          return x.id === btn.dataset.id;
        });
        if (pay) App.openPaymentModal(pay, refreshCtx);
      });
    });

    tbody.querySelectorAll('.btn-del-pay-month').forEach(function (btn) {
      btn.addEventListener('click', function () {
        LoyerNotify.confirm('Supprimer ce paiement ?', {
          confirmLabel: 'Supprimer',
          danger: true
        }).then(function (ok) {
          if (!ok) return;
          App.state.data.payments = App.state.data.payments.filter(function (x) {
            return x.id !== btn.dataset.id;
          });
          App.persist();
          renderMonthDetailPayments();
          App.renderDashboard();
          App.renderPayments();
          LoyerNotify.success('Paiement supprimé.');
        });
      });
    });
  }

  /** Ouvre la modale détail mois (paiements + note interne). */
  function openMonthDetailModal(year, month) {
    App.state.monthDetail = { year: year, month: month };
    App.$('#modal-month-detail-title').textContent =
      'Paiements — ' + LoyerCalc.formatMonthLong(year, month);
    App.$('#month-detail-note').value = LoyerStore.getMonthNote(App.state.data, year, month);
    var noteExport = App.$('#month-detail-note-export');
    if (noteExport) {
      noteExport.textContent = App.$('#month-detail-note').value.trim() || '—';
    }
    renderMonthDetailPayments();
    App.$('#modal-month-detail').classList.remove('hidden');
    App.handleDashboardMonthClick(year, month);
  }

  /** Ferme la modale détail mois. */
  function closeMonthDetailModal() {
    App.state.monthDetail = null;
    App.$('#modal-month-detail').classList.add('hidden');
  }

  App.renderMonthDetailPayments = renderMonthDetailPayments;
  App.openMonthDetailModal = openMonthDetailModal;
  App.closeMonthDetailModal = closeMonthDetailModal;
  App.monthDetailPresetDate = monthDetailPresetDate;

  App.renderMonthStatusBadge = renderMonthStatusBadge;
  App.heatmapCellHtml = heatmapCellHtml;
  App.renderDashboardHeatmap = renderDashboardHeatmap;
  App.renderDashboard = renderDashboard;
  App.populateBatchExportSelects = populateBatchExportSelects;
  App.updateBatchExportSummary = updateBatchExportSummary;
  App.openBatchExportModal = openBatchExportModal;
  App.closeBatchExportModal = closeBatchExportModal;
  App.runBatchExport = runBatchExport;

  /** Attache clics heatmap, export groupé, graphiques. */
  function bindDashboardEvents() {
    App.$('#monthly-table').addEventListener('click', function (e) {
      var detailBtn = e.target.closest('.btn-month-detail');
      if (detailBtn) {
        e.stopPropagation();
        App.openMonthDetailModal(
          parseInt(detailBtn.dataset.year, 10),
          parseInt(detailBtn.dataset.month, 10)
        );
        return;
      }
      var row = e.target.closest('tr[data-month]');
      if (!row) return;
      App.handleDashboardMonthClick(parseInt(row.dataset.year, 10), parseInt(row.dataset.month, 10));
    });

    App.bindIf('#dashboard-heatmap', function (el) {
      el.addEventListener('click', function (e) {
        var btn = e.target.closest('.heatmap-btn');
        if (!btn) return;
        App.handleDashboardMonthClick(parseInt(btn.dataset.year, 10), parseInt(btn.dataset.month, 10));
      });
    });

    App.bindIf('#btn-chart-year-prev', function (el) {
      el.addEventListener('click', function () {
        App.shiftDashboardChartYear(-1, App.getMonthlyRows());
      });
    });

    App.bindIf('#btn-chart-year-next', function (el) {
      el.addEventListener('click', function () {
        App.shiftDashboardChartYear(1, App.getMonthlyRows());
      });
    });

    App.bindIf('#btn-export-batch', function (el) {
      el.addEventListener('click', openBatchExportModal);
    });

    ['batch-from-month', 'batch-from-year', 'batch-to-month', 'batch-to-year'].forEach(function (id) {
      App.bindIf('#' + id, function (el) {
        el.addEventListener('change', updateBatchExportSummary);
      });
    });

    App.$$('[data-batch-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeBatchExportModal);
    });

    App.bindIf('#btn-batch-export-pdf', function (el) {
      el.addEventListener('click', function () {
        App.runBatchExport('pdf');
      });
    });
    App.bindIf('#btn-batch-export-docx', function (el) {
      el.addEventListener('click', function () {
        App.runBatchExport('docx');
      });
    });
    App.bindIf('#btn-batch-export-html', function (el) {
      el.addEventListener('click', function () {
        App.runBatchExport('html');
      });
    });

    App.$('#monthly-table').addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      var row = e.target.closest('tr[data-month]');
      if (!row) return;
      e.preventDefault();
      App.handleDashboardMonthClick(parseInt(row.dataset.year, 10), parseInt(row.dataset.month, 10));
    });

    App.$$('[data-month-modal-close]').forEach(function (btn) {
      btn.addEventListener('click', closeMonthDetailModal);
    });

    App.bindIf('#payments-month-table', function (el) {
      el.addEventListener('click', function (e) {
        var editBtn = e.target.closest('.btn-edit-pay-dash');
        if (!editBtn) return;
        var pay = App.state.data.payments.find(function (x) {
          return x.id === editBtn.dataset.id;
        });
        if (pay) App.openPaymentModal(pay);
      });
    });

    App.bindIf('#btn-month-detail-save-note', function (el) {
      el.addEventListener('click', function () {
        var md = App.state.monthDetail;
        if (!md) return;
        LoyerStore.setMonthNote(
          App.state.data,
          md.year,
          md.month,
          App.$('#month-detail-note').value.trim()
        );
        var noteExport = App.$('#month-detail-note-export');
        if (noteExport) noteExport.textContent = App.$('#month-detail-note').value.trim() || '—';
        App.persist();
        App.renderDashboard();
        LoyerNotify.success('Note enregistrée.');
      });
    });

    App.bindIf('#btn-month-detail-add-payment', function (el) {
      el.addEventListener('click', function () {
        var md = App.state.monthDetail;
        if (!md) return;
        App.openPaymentModal(null, {
          presetDate: App.monthDetailPresetDate(md.year, md.month),
          onSaved: function () {
            renderMonthDetailPayments();
            App.renderDashboard();
          }
        });
      });
    });
  }

  App.bindDashboardEvents = bindDashboardEvents;
})(window);
