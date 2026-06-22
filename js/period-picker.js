/**
 * Sélecteur de période : mois unique, plage optionnelle, timeline scrollable.
 */
(function (global) {
  'use strict';

  var mountEl = null;
  var callbacks = {};
  var getState = null;
  var getRows = null;
  var dragAnchor = null;
  var compactMode = false;

  var STATUS_LEGEND = [
    { id: 'paye', label: 'Payé', hint: 'Loyer reçu intégralement pour ce mois.' },
    { id: 'avance', label: 'En avance', hint: 'Montant reçu supérieur au loyer attendu.' },
    { id: 'partiel', label: 'Partiel', hint: 'Paiement reçu mais inférieur au loyer attendu.' },
    { id: 'impaye', label: 'Impayé', hint: 'Aucun paiement ou mois passé sans règlement complet.' },
    { id: 'en_cours', label: 'En cours', hint: 'Mois en cours — échéance pas encore dépassée.' }
  ];

  function monthInputValue(year, month) {
    return year + '-' + String(month).padStart(2, '0');
  }

  function parseMonthInput(value) {
    if (!value || value.indexOf('-') === -1) return null;
    var parts = value.split('-');
    return { year: parseInt(parts[0], 10), month: parseInt(parts[1], 10) };
  }

  function getPeriodState() {
    return getState().period;
  }

  function getMainState() {
    return getState();
  }

  function isRangeActive(period) {
    if (!period.rangeUiOpen) return false;
    var fromKey = global.LoyerCalc.monthKey(period.fromYear, period.fromMonth);
    var toKey = global.LoyerCalc.monthKey(period.toYear, period.toMonth);
    return fromKey !== toKey;
  }

  function formatPeriodLabel(period, main) {
    if (isRangeActive(period)) {
      return (
        global.LoyerCalc.formatMonthLong(period.fromYear, period.fromMonth) +
        ' → ' +
        global.LoyerCalc.formatMonthLong(period.toYear, period.toMonth)
      );
    }
    return global.LoyerCalc.formatMonthLong(main.selectedYear, main.selectedMonth);
  }

  function monthIndexInList(months, year, month) {
    var key = global.LoyerCalc.monthKey(year, month);
    return months.findIndex(function (m) {
      return m.key === key;
    });
  }

  function getNormalizedRange(period) {
    var fromKey = global.LoyerCalc.monthKey(period.fromYear, period.fromMonth);
    var toKey = global.LoyerCalc.monthKey(period.toYear, period.toMonth);
    if (fromKey <= toKey) {
      return {
        fromKey: fromKey,
        toKey: toKey,
        fromYear: period.fromYear,
        fromMonth: period.fromMonth,
        toYear: period.toYear,
        toMonth: period.toMonth
      };
    }
    return {
      fromKey: toKey,
      toKey: fromKey,
      fromYear: period.toYear,
      fromMonth: period.toMonth,
      toYear: period.fromYear,
      toMonth: period.fromMonth
    };
  }

  function handleTimelineRangeClick(year, month) {
    var period = getPeriodState();
    var clickKey = global.LoyerCalc.monthKey(year, month);

    if (!isRangeActive(period)) {
      callbacks.onSetRange(period.fromYear, period.fromMonth, year, month);
      return;
    }

    var range = getNormalizedRange(period);
    if (clickKey < range.fromKey) {
      callbacks.onSetRange(year, month, range.toYear, range.toMonth);
    } else if (clickKey > range.toKey) {
      callbacks.onSetRange(range.fromYear, range.fromMonth, year, month);
    } else if (clickKey - range.fromKey <= range.toKey - clickKey) {
      callbacks.onSetRange(year, month, range.toYear, range.toMonth);
    } else {
      callbacks.onSetRange(range.fromYear, range.fromMonth, year, month);
    }
  }

  function scrollSegmentIntoView(scrollEl, segment) {
    if (!scrollEl || !segment) return;
    var left = segment.offsetLeft - scrollEl.clientWidth / 2 + segment.offsetWidth / 2;
    scrollEl.scrollTo({ left: Math.max(0, left), behavior: 'smooth' });
  }

  function getPickerRoot() {
    return mountEl ? mountEl.querySelector('[data-period-picker]') : null;
  }

  function statusLegendHtml() {
    return STATUS_LEGEND.map(function (item) {
      return (
        '<span class="month-status month-status-' +
        item.id +
        ' period-legend-badge" tabindex="0" role="note" data-status-tip="' +
        item.hint +
        '" title="' +
        item.hint +
        '" aria-label="' +
        item.label +
        ' : ' +
        item.hint +
        '">' +
        item.label +
        '</span>'
      );
    }).join('');
  }

  function timelineTooltip(row, status, settings) {
    var label = global.LoyerCalc.getMonthStatusLabel(status);
    var monthLabel = global.LoyerCalc.formatMonthLong(row.year, row.month);
    var lines = [monthLabel, 'Statut : ' + label];
    lines.push('Attendu : ' + global.LoyerCalc.formatCurrency(row.attendu));
    lines.push('Reçu : ' + global.LoyerCalc.formatCurrency(row.recu));
    var item = STATUS_LEGEND.find(function (s) {
      return s.id === status;
    });
    if (item) lines.push(item.hint);
    return lines.join('\n');
  }

  function renderTimeline(rows, period, main, settings) {
    var root = getPickerRoot();
    if (!root || compactMode) return;
    var scrollEl = root.querySelector('.period-timeline-scroll');
    var trackEl = root.querySelector('.period-timeline-track');
    if (!trackEl || !scrollEl) return;

    var statusOpts = { rentDueDay: settings.rentDueDay };
    var rangeActive = isRangeActive(period);
    var periodFromKey = global.LoyerCalc.monthKey(period.fromYear, period.fromMonth);
    var periodToKey = global.LoyerCalc.monthKey(period.toYear, period.toMonth);
    var spanFromKey = periodFromKey <= periodToKey ? periodFromKey : periodToKey;
    var spanToKey = periodFromKey <= periodToKey ? periodToKey : periodFromKey;
    var selKey = global.LoyerCalc.monthKey(main.selectedYear, main.selectedMonth);
    var rangeOpen = period.rangeUiOpen;

    trackEl.innerHTML = rows
      .map(function (r) {
        var status = global.LoyerCalc.getMonthStatus(r, statusOpts);
        var inRange = rangeActive && r.key >= spanFromKey && r.key <= spanToKey;
        var isSel = !rangeOpen && r.key === selKey;
        var isFrom = rangeOpen && r.key === periodFromKey;
        var isTo = rangeActive && r.key === periodToKey;
        var classes =
          'timeline-segment month-status-' +
          status +
          (inRange ? ' timeline-in-range' : '') +
          (isSel ? ' timeline-selected' : '') +
          (isFrom ? ' timeline-range-from' : '') +
          (isTo ? ' timeline-range-to' : '');
        var short = global.LoyerCalc.MONTH_NAMES[r.month - 1].slice(0, 3);
        var tip = timelineTooltip(r, status, settings);
        var statusLabel = global.LoyerCalc.getMonthStatusLabel(status);
        return (
          '<button type="button" class="' +
          classes +
          '" data-year="' +
          r.year +
          '" data-month="' +
          r.month +
          '" data-key="' +
          r.key +
          '" data-status="' +
          status +
          '" title="' +
          tip.replace(/"/g, '&quot;') +
          '" aria-label="' +
          global.LoyerCalc.formatMonthLong(r.year, r.month) +
          ', ' +
          statusLabel +
          '">' +
          '<span class="timeline-segment-label">' +
          short +
          '</span>' +
          '<span class="timeline-segment-year">' +
          r.year +
          '</span>' +
          '<span class="timeline-segment-tip" role="tooltip">' +
          '<strong>' +
          statusLabel +
          '</strong><span>' +
          global.LoyerCalc.formatMonthLong(r.year, r.month) +
          '</span></span></button>'
        );
      })
      .join('');

    var focusBtn =
      trackEl.querySelector('[data-key="' + (rangeActive ? periodToKey : selKey) + '"]') ||
      trackEl.querySelector('.timeline-segment:last-child');
    if (focusBtn) scrollSegmentIntoView(scrollEl, focusBtn);
  }

  function syncDom() {
    var root = getPickerRoot();
    if (!root) return;
    var main = getMainState();
    var period = getPeriodState();
    var rangeOpen = period.rangeUiOpen && !compactMode;

    var monthInput = root.querySelector('.period-month-input');
    var toWrap = root.querySelector('.period-to-wrap');
    var toInput = root.querySelector('.period-range-to');
    var sep = root.querySelector('.period-range-sep');
    var toggleBtn = root.querySelector('.period-range-toggle');

    var fromY = rangeOpen ? period.fromYear : main.selectedYear;
    var fromM = rangeOpen ? period.fromMonth : main.selectedMonth;

    if (monthInput) monthInput.value = monthInputValue(fromY, fromM);
    if (toInput) toInput.value = monthInputValue(period.toYear, period.toMonth);
    if (toWrap) toWrap.classList.toggle('hidden', !rangeOpen);
    if (sep) sep.classList.toggle('hidden', !rangeOpen);
    if (toggleBtn) {
      toggleBtn.classList.toggle('hidden', compactMode);
      toggleBtn.textContent = rangeOpen ? 'Mois unique' : 'Période';
      toggleBtn.setAttribute('aria-expanded', rangeOpen ? 'true' : 'false');
      toggleBtn.setAttribute('aria-pressed', rangeOpen ? 'true' : 'false');
    }

    var fromLabel = root.querySelector('.period-month-field .period-month-field-label');
    if (fromLabel) fromLabel.textContent = compactMode ? 'Mois' : rangeOpen ? 'Du' : 'Mois';

    var months = getRows().map(function (r) {
      return { year: r.year, month: r.month, key: r.key };
    });
    var idx = monthIndexInList(months, main.selectedYear, main.selectedMonth);
    var prev = root.querySelector('.period-nav-prev');
    var next = root.querySelector('.period-nav-next');
    if (prev) prev.disabled = idx <= 0;
    if (next) next.disabled = idx < 0 || idx >= months.length - 1;

    if (!compactMode) {
      renderTimeline(getRows(), period, main, main.data.settings || {});
    }
  }

  function buildHtml(compact) {
    return (
      '<div class="period-picker' +
      (compact ? ' period-picker--compact' : '') +
      '" data-period-picker>' +
      '<div class="period-picker-top">' +
      '<div class="period-inputs-row">' +
      '<button type="button" class="period-nav-btn period-nav-prev" aria-label="Mois précédent">‹</button>' +
      '<label class="period-month-field">' +
      '<span class="period-month-field-label">' +
      (compact ? 'Mois' : 'Du') +
      '</span>' +
      '<input type="month" class="period-month-input" aria-label="Mois sélectionné">' +
      '</label>' +
      '<span class="period-range-sep hidden" aria-hidden="true">→</span>' +
      '<label class="period-month-field period-to-wrap hidden">' +
      '<span class="period-month-field-label">Au</span>' +
      '<input type="month" class="period-range-to" aria-label="Fin de période">' +
      '</label>' +
      '<button type="button" class="period-range-toggle btn btn-secondary btn-sm" aria-expanded="false">Période</button>' +
      '<button type="button" class="period-nav-btn period-nav-next" aria-label="Mois suivant">›</button>' +
      '</div>' +
      (compact
        ? ''
        : '<div class="period-status-legend" aria-label="Légende des statuts">' + statusLegendHtml() + '</div>') +
      '</div>' +
      (compact
        ? ''
        : '<div class="period-timeline-row">' +
          '<button type="button" class="timeline-scroll-btn timeline-scroll-left" aria-label="Défiler vers le passé">‹</button>' +
          '<div class="period-timeline-scroll" tabindex="0">' +
          '<div class="period-timeline-track"></div>' +
          '</div>' +
          '<button type="button" class="timeline-scroll-btn timeline-scroll-right" aria-label="Défiler vers le présent">›</button>' +
          '</div>') +
      '</div>'
    );
  }

  function navigateMonth(delta) {
    var months = getRows().map(function (r) {
      return { year: r.year, month: r.month, key: r.key };
    });
    var main = getMainState();
    var idx = monthIndexInList(months, main.selectedYear, main.selectedMonth);
    if (idx === -1 && months.length) {
      callbacks.onSelectMonth(months[months.length - 1].year, months[months.length - 1].month);
      return;
    }
    var next = idx + delta;
    if (next < 0 || next >= months.length) return;
    callbacks.onSelectMonth(months[next].year, months[next].month);
  }

  function bindMountEvents() {
    if (!mountEl || mountEl.getAttribute('data-period-bound')) return;
    mountEl.setAttribute('data-period-bound', '1');

    mountEl.addEventListener('click', function (e) {
      if (e.target.closest('.period-nav-prev')) {
        e.preventDefault();
        navigateMonth(-1);
        return;
      }
      if (e.target.closest('.period-nav-next')) {
        e.preventDefault();
        navigateMonth(1);
        return;
      }
      if (e.target.closest('.period-range-toggle')) {
        e.preventDefault();
        callbacks.onToggleRangeUi();
        return;
      }
      if (e.target.closest('.timeline-scroll-left')) {
        var sc = mountEl.querySelector('.period-timeline-scroll');
        if (sc) sc.scrollBy({ left: -220, behavior: 'smooth' });
        return;
      }
      if (e.target.closest('.timeline-scroll-right')) {
        var sc2 = mountEl.querySelector('.period-timeline-scroll');
        if (sc2) sc2.scrollBy({ left: 220, behavior: 'smooth' });
        return;
      }
      var seg = e.target.closest('.timeline-segment');
      if (seg) {
        e.preventDefault();
        var y = parseInt(seg.dataset.year, 10);
        var m = parseInt(seg.dataset.month, 10);
        if (getPeriodState().rangeUiOpen) {
          handleTimelineRangeClick(y, m);
        } else {
          callbacks.onSelectMonth(y, m);
        }
      }
    });

    mountEl.addEventListener('change', function (e) {
      if (e.target.classList.contains('period-month-input')) {
        var p = parseMonthInput(e.target.value);
        if (!p) return;
        var period = getPeriodState();
        if (period.rangeUiOpen && !compactMode) {
          callbacks.onSetRange(p.year, p.month, period.toYear, period.toMonth);
        } else {
          callbacks.onSelectMonth(p.year, p.month);
        }
        return;
      }
      if (e.target.classList.contains('period-range-to')) {
        var t = parseMonthInput(e.target.value);
        if (t) {
          var period2 = getPeriodState();
          callbacks.onSetRange(period2.fromYear, period2.fromMonth, t.year, t.month);
        }
      }
    });

    mountEl.addEventListener('mousedown', function (e) {
      var seg = e.target.closest('.timeline-segment');
      if (!seg) return;
      dragAnchor = {
        year: parseInt(seg.dataset.year, 10),
        month: parseInt(seg.dataset.month, 10)
      };
    });

    mountEl.addEventListener('mouseup', function (e) {
      if (!dragAnchor) return;
      var seg = e.target.closest('.timeline-segment');
      if (seg) {
        var y = parseInt(seg.dataset.year, 10);
        var m = parseInt(seg.dataset.month, 10);
        if (dragAnchor.year !== y || dragAnchor.month !== m) {
          callbacks.onSetRange(dragAnchor.year, dragAnchor.month, y, m);
        }
      }
      dragAnchor = null;
    });
  }

  function renderMarkup() {
    if (!mountEl) return;
    mountEl.innerHTML = buildHtml(compactMode);
    syncDom();
  }

  function init(options) {
    mountEl = options.mountEl;
    getState = options.getState;
    getRows = options.getRows;
    callbacks = options.callbacks || {};
    if (!mountEl) return;
    bindMountEvents();
    renderMarkup();
  }

  function setCompactMode(compact) {
    if (compactMode === compact) {
      syncDom();
      return;
    }
    compactMode = compact;
    renderMarkup();
  }

  function refresh() {
    syncDom();
  }

  function isRangeActiveExport() {
    return isRangeActive(getPeriodState());
  }

  function getFilterKeys() {
    var main = getMainState();
    var period = getPeriodState();
    if (!isRangeActive(period)) {
      return [global.LoyerCalc.monthKey(main.selectedYear, main.selectedMonth)];
    }
    var fromKey = global.LoyerCalc.monthKey(period.fromYear, period.fromMonth);
    var toKey = global.LoyerCalc.monthKey(period.toYear, period.toMonth);
    if (fromKey > toKey) {
      var t = fromKey;
      fromKey = toKey;
      toKey = t;
    }
    return getRows()
      .filter(function (r) {
        return r.key >= fromKey && r.key <= toKey;
      })
      .map(function (r) {
        return r.key;
      });
  }

  global.LoyerPeriod = {
    init: init,
    refresh: refresh,
    setCompactMode: setCompactMode,
    isRangeActive: isRangeActiveExport,
    getFilterKeys: getFilterKeys,
    formatPeriodLabel: function () {
      return formatPeriodLabel(getPeriodState(), getMainState());
    },
    STATUS_LEGEND: STATUS_LEGEND
  };
})(window);
