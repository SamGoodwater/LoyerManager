/** Sélection de période et filtres temporels. */
(function (global) {
  'use strict';
  var App = global.LoyerApp;
  if (!App) return;

  var PERIOD_PANELS = ['panel-dashboard', 'panel-quittance', 'panel-mail'];

  /** Aligne plage sur le mois principal si besoin. */
  function syncPeriodBoundsToMonth() {
    App.state.period.fromYear = App.state.selectedYear;
    App.state.period.fromMonth = App.state.selectedMonth;
    App.state.period.toYear = App.state.selectedYear;
    App.state.period.toMonth = App.state.selectedMonth;
  }

  /** Lignes mensuelles calculées jusqu'à aujourd'hui. */
  function getMonthlyRows() {
    return LoyerCalc.computeMonthlyRows(App.state.data);
  }

  /** Filtre lignes selon plage ou année courante. */
  function getDashboardSelectionRows(allRows) {
    allRows = allRows || App.getMonthlyRows();
    if (!global.LoyerPeriod) return allRows;
    var keys = LoyerPeriod.getFilterKeys();
    return allRows.filter(function (r) {
      return keys.indexOf(r.key) !== -1;
    });
  }

  /** Libellé période pour titres onglets. */
  function getPeriodDisplayLabel() {
    if (global.LoyerPeriod) return LoyerPeriod.formatPeriodLabel();
    return LoyerCalc.formatMonthLong(App.state.selectedYear, App.state.selectedMonth);
  }

  /** Contexte {from, to, label} pour exports/mail. */
  function getExportPeriodContext() {
    if (!App.isRangeActive()) {
      return {
        isRange: false,
        fromYear: App.state.selectedYear,
        fromMonth: App.state.selectedMonth,
        toYear: App.state.selectedYear,
        toMonth: App.state.selectedMonth
      };
    }
    var period = App.state.period;
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

  /** Met à jour spans période quittance/mail/dashboard. */
  function updatePeriodTabLabels() {
    var label = App.getPeriodDisplayLabel();
    var qLabel = App.$('#quittance-period-label');
    var mLabel = App.$('#mail-period-label');
    if (qLabel) qLabel.textContent = label;
    if (mLabel) mLabel.textContent = label;
    var dashLabel = App.$('#dash-period-label');
    if (dashLabel) dashLabel.textContent = label;
    App.updateHeaderSelection();
  }

  /** Badge header « Sélection » en mode plage. */
  function updateHeaderSelection() {
    var wrap = App.$('#header-selection');
    var text = App.$('#header-selection-text');
    if (!wrap || !text) return;
    var panel = App.getActivePanelId();
    var show = App.PERIOD_PANELS.indexOf(panel) !== -1;
    wrap.classList.toggle('hidden', !show);
    if (!show) return;
    var rangeActive = global.LoyerPeriod && LoyerPeriod.isRangeActive();
    var periodLabel = App.getPeriodDisplayLabel();
    if (rangeActive && panel === 'panel-dashboard') {
      text.textContent =
        periodLabel + ' · Détail : ' + LoyerCalc.formatMonthLong(App.state.focusYear, App.state.focusMonth);
    } else {
      text.textContent = periodLabel;
    }
  }

  /** Affiche barre période sauf onglet Aide. */
  function updatePeriodBarVisibility(panelId) {
    var bar = App.$('#period-bar');
    if (!bar) return;
    var show = App.PERIOD_PANELS.indexOf(panelId) !== -1;
    bar.classList.toggle('hidden', !show);
    if (show && global.LoyerPeriod) {
      LoyerPeriod.setCompactMode(false);
      LoyerPeriod.refresh();
    }
  }

  /** Branche LoyerPeriodPicker avec callbacks App. */
  function initPeriodPicker() {
    if (!global.LoyerPeriod) return;
    App.syncPeriodBoundsToMonth();
    LoyerPeriod.init({
      mountEl: App.$('#period-picker-mount'),
      getState: function () {
        return App.state;
      },
      getRows: getMonthlyRows,
      callbacks: {
        onSelectMonth: function (year, month) {
          App.setSelectedPeriod(year, month);
        },
        onToggleRangeUi: function () {
          App.state.period.rangeUiOpen = !App.state.period.rangeUiOpen;
          if (App.state.period.rangeUiOpen) {
            App.state.period.fromYear = App.state.selectedYear;
            App.state.period.fromMonth = App.state.selectedMonth;
            App.state.period.toYear = App.state.selectedYear;
            App.state.period.toMonth = App.state.selectedMonth;
          }
          LoyerPeriod.refresh();
          App.onPeriodChanged();
        },
        onSetRange: function (fromY, fromM, toY, toM) {
          App.state.period.rangeUiOpen = true;
          App.state.period.fromYear = fromY;
          App.state.period.fromMonth = fromM;
          App.state.period.toYear = toY;
          App.state.period.toMonth = toM;
          var fromKey = LoyerCalc.monthKey(fromY, fromM);
          var toKey = LoyerCalc.monthKey(toY, toM);
          var target = toKey >= fromKey ? { year: toY, month: toM } : { year: fromY, month: fromM };
          App.setSelectedPeriod(target.year, target.month, { keepRange: true });
        }
      }
    });
    if (global.LoyerHelp && global.LoyerHelp.refresh) {
      global.LoyerHelp.refresh();
    }
  }

  /** Callback : refresh dashboard, quittance, mail. */
  function onPeriodChanged() {
    App.updatePeriodTabLabels();
    if (global.LoyerPeriod) LoyerPeriod.refresh();
    App.renderDashboard();
    var panel = App.getActivePanelId();
    if (panel === 'panel-quittance' && App.state.quittanceUi.mode === 'preview') {
      App.renderQuittancePreview();
    }
    if (panel === 'panel-mail' && App.state.mailUi.mode === 'preview') {
      App.renderMailPreview();
    }
  }

  /** Fixe mois principal (+ option plage). */
  function setSelectedPeriod(year, month, options) {
    options = options || {};
    App.state.selectedYear = year;
    App.state.selectedMonth = month;
    App.state.focusYear = year;
    App.state.focusMonth = month;
    if (!options.keepRange) {
      App.state.period.rangeUiOpen = false;
      App.syncPeriodBoundsToMonth();
    }
    if (!options.skipRender) App.onPeriodChanged();
  }

  /** Délègue period picker plage active. */
  function isRangeActive() {
    return global.LoyerPeriod && LoyerPeriod.isRangeActive();
  }

  /** True si mois ligne dans plage Du→Au. */
  function isRowInPeriodRange(row) {
    if (!App.isRangeActive()) return false;
    var fromKey = LoyerCalc.monthKey(App.state.period.fromYear, App.state.period.fromMonth);
    var toKey = LoyerCalc.monthKey(App.state.period.toYear, App.state.period.toMonth);
    if (fromKey > toKey) {
      var t = fromKey;
      fromKey = toKey;
      toKey = t;
    }
    return row.key >= fromKey && row.key <= toKey;
  }

  /** True si mois ligne = focus heatmap. */
  function isRowFocused(row) {
    return row.year === App.state.focusYear && row.month === App.state.focusMonth;
  }

  /** Définit mois focus pour détail en mode plage. */
  function setFocusMonth(year, month) {
    App.state.focusYear = year;
    App.state.focusMonth = month;
    App.renderDashboard();
  }

  /** Clic heatmap/ligne → focus ou sélection mois. */
  function handleDashboardMonthClick(year, month) {
    if (!App.isRangeActive()) {
      App.state.dashboardChartYear = year;
    }
    if (App.isRangeActive()) {
      App.setFocusMonth(year, month);
    } else {
      App.setSelectedPeriod(year, month);
    }
  }

  /** Sélectionne un mois (timeline ou tableau). */
  function selectMonth(year, month) {
    App.handleDashboardMonthClick(year, month);
  }

  /** Année affichée graphique annuel. */
  function getDashboardChartYear(allRows) {
    var years = LoyerCalc.getAvailableYears(allRows);
    if (!years.length) return App.state.dashboardChartYear;
    if (years.indexOf(App.state.dashboardChartYear) === -1) {
      App.state.dashboardChartYear = years[years.length - 1];
    }
    return App.state.dashboardChartYear;
  }

  /** shift dashboard chart year. */
  function shiftDashboardChartYear(delta, allRows) {
    var years = LoyerCalc.getAvailableYears(allRows);
    if (!years.length) return;
    var idx = years.indexOf(App.state.dashboardChartYear);
    if (idx === -1) idx = years.length - 1;
    var next = idx + delta;
    if (next < 0 || next >= years.length) return;
    App.state.dashboardChartYear = years[next];
    App.renderDashboard();
  }

  App.PERIOD_PANELS = PERIOD_PANELS;
  App.syncPeriodBoundsToMonth = syncPeriodBoundsToMonth;
  App.getMonthlyRows = getMonthlyRows;
  App.getDashboardSelectionRows = getDashboardSelectionRows;
  App.getPeriodDisplayLabel = getPeriodDisplayLabel;
  App.getExportPeriodContext = getExportPeriodContext;
  App.updatePeriodTabLabels = updatePeriodTabLabels;
  App.updateHeaderSelection = updateHeaderSelection;
  App.updatePeriodBarVisibility = updatePeriodBarVisibility;
  App.initPeriodPicker = initPeriodPicker;
  App.onPeriodChanged = onPeriodChanged;
  App.setSelectedPeriod = setSelectedPeriod;
  App.isRangeActive = isRangeActive;
  App.isRowInPeriodRange = isRowInPeriodRange;
  App.isRowFocused = isRowFocused;
  App.setFocusMonth = setFocusMonth;
  App.handleDashboardMonthClick = handleDashboardMonthClick;
  App.selectMonth = selectMonth;
  App.getDashboardChartYear = getDashboardChartYear;
  App.shiftDashboardChartYear = shiftDashboardChartYear;
})(window);
