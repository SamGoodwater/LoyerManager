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
      '<tr><td colspan="6" class="empty-msg">Aucune donnée pour cette période</td></tr>';

    var tableHint = App.$('#dash-table-hint');
    if (tableHint) {
      tableHint.textContent = rangeActive
        ? selectionRows.length + ' mois dans la plage — cliquez une ligne pour le détail virements.'
        : 'Cliquez sur une ligne pour sélectionner un mois.';
    }

    var focusLabel = LoyerCalc.formatMonthLong(App.state.focusYear, App.state.focusMonth);
    var paymentsLabel = App.$('#dash-payments-label');
    if (paymentsLabel) {
      paymentsLabel.textContent = rangeActive ? focusLabel : periodLabel;
    }

    var paymentsHint = App.$('#dash-payments-hint');
    if (paymentsHint) {
      paymentsHint.textContent = rangeActive
        ? 'Virements reçus pour ce mois (période : ' + periodLabel + ').'
        : 'Virements reçus ce mois-ci.';
    }

    var focusDetail = LoyerCalc.getMonthDetail(App.state.data, App.state.focusYear, App.state.focusMonth);
    var monthStatsHeading = App.$('#dash-month-stats-heading');
    if (monthStatsHeading) {
      monthStatsHeading.classList.toggle('hidden', !rangeActive);
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
        return '<tr>' + App.renderPaymentRowCells(p, { dataLabels: true }) + '</tr>';
      })
      .join('') ||
      '<tr class="payments-empty-row"><td colspan="7" class="empty-msg">Aucun virement ce mois</td></tr>';

    var canvasStack = App.$('#chart-monthly-stack');
    var canvasYear = App.$('#chart-yearly-bar');
    var canvasLine = App.$('#chart-balance');
    var stackLabel = App.$('#dash-chart-stack-label');
    var yearLabel = App.$('#dash-chart-year-label');
    var balanceLabel = App.$('#dash-chart-balance-label');
    var balanceHint = App.$('#dash-chart-balance-hint');
    if (stackLabel) stackLabel.textContent = periodLabel;
    var chartYear = App.getDashboardChartYear(allRows);
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
          var sel = LoyerCalc.monthKey(App.state.selectedYear, App.state.selectedMonth);
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
    var prevBtn = App.$('#btn-chart-year-prev');
    var nextBtn = App.$('#btn-chart-year-next');
    if (prevBtn) prevBtn.disabled = yearIdx <= 0;
    if (nextBtn) nextBtn.disabled = yearIdx === -1 || yearIdx >= years.length - 1;

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

  App.renderMonthStatusBadge = renderMonthStatusBadge;
  App.heatmapCellHtml = heatmapCellHtml;
  App.renderDashboardHeatmap = renderDashboardHeatmap;
  App.renderDashboard = renderDashboard;
  App.populateBatchExportSelects = populateBatchExportSelects;
  App.updateBatchExportSummary = updateBatchExportSummary;
  App.openBatchExportModal = openBatchExportModal;
  App.closeBatchExportModal = closeBatchExportModal;
  App.runBatchExport = runBatchExport;

  /** Attache clics heatmap, impression, export groupé, graphiques. */
  function bindDashboardEvents() {
    App.bindIf('#btn-print-report', function (el) {
      el.addEventListener('click', function () {
        window.print();
      });
    });

    App.$('#monthly-table').addEventListener('click', function (e) {
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
  }

  App.bindDashboardEvents = bindDashboardEvents;
})(window);
