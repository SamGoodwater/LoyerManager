/**
 * Graphiques Chart.js — tableau de bord.
 */
(function (global) {
  'use strict';

  var charts = {};
  var COLORS = {
    green: '#34d399',
    greenDark: '#10b981',
    red: '#f87171',
    redDark: '#ef4444',
    blue: '#60a5fa',
    blueDark: '#3b82f6',
    due: '#64748b',
    balancePos: '#059669',
    balanceNeg: '#dc2626',
    orange: '#fbbf24',
    orangeDark: '#d97706'
  };

  /** destroy chart. */
  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      charts[id] = null;
    }
  }

  /** Motif zébré diagonal pour segments virements. */
  function stripePattern(base, accent) {
    if (typeof document === 'undefined') return base;
    var tile = document.createElement('canvas');
    tile.width = 10;
    tile.height = 10;
    var ctx = tile.getContext('2d');
    if (!ctx) return base;
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 10, 10);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(10, 0);
    ctx.stroke();
    return ctx.createPattern(tile, 'repeat');
  }

  var patterns = {
    green: null,
    red: null,
    blue: null,
    orange: null
  };

  function getPattern(kind) {
    if (!patterns[kind]) {
      if (kind === 'green') patterns.green = stripePattern(COLORS.green, COLORS.greenDark);
      if (kind === 'red') patterns.red = stripePattern(COLORS.red, COLORS.redDark);
      if (kind === 'blue') patterns.blue = stripePattern(COLORS.blue, COLORS.blueDark);
      if (kind === 'orange') patterns.orange = stripePattern(COLORS.orange, COLORS.orangeDark);
    }
    return patterns[kind];
  }

  /** Prépare datasets barres empilées (paiements + remboursements + manque + excédent). */
  function buildPaymentBarDatasets(rows, payments) {
    var maxPay = 0;
    rows.forEach(function (r) {
      var list = global.LoyerCalc.filterPaymentsInMonth(payments, r.year, r.month);
      if (list.length > maxPay) maxPay = list.length;
    });

    var datasets = [];
    var slot;

    for (slot = 0; slot < maxPay; slot += 1) {
      datasets.push({
        label: slot === 0 ? 'Paiements reçus' : '',
        data: rows.map(function (r) {
          var list = global.LoyerCalc.filterPaymentsInMonth(payments, r.year, r.month);
          var amt = list[slot] ? Number(list[slot].amount) || 0 : 0;
          return amt > 0 ? amt : 0;
        }),
        backgroundColor: getPattern('green'),
        stack: 'payments',
        borderWidth: 0,
        order: 2
      });
    }

    for (slot = 0; slot < maxPay; slot += 1) {
      datasets.push({
        label: slot === 0 ? 'Remboursements (montant négatif)' : '',
        data: rows.map(function (r) {
          var list = global.LoyerCalc.filterPaymentsInMonth(payments, r.year, r.month);
          var amt = list[slot] ? Number(list[slot].amount) || 0 : 0;
          return amt < 0 ? amt : 0;
        }),
        backgroundColor: getPattern('orange'),
        stack: 'payments',
        borderWidth: 0,
        order: 2
      });
    }

    datasets.push({
      label: 'Manque',
      data: rows.map(function (r) {
        return Math.max(0, r.attendu - r.recu);
      }),
      backgroundColor: getPattern('red'),
      stack: 'payments',
      borderWidth: 0,
      order: 2
    });

    datasets.push({
      label: 'Excédent',
      data: rows.map(function (r) {
        return Math.max(0, r.recu - r.attendu);
      }),
      backgroundColor: getPattern('blue'),
      stack: 'payments',
      borderWidth: 0,
      order: 2
    });

    return datasets;
  }

  /** Graphique combiné : dû (palier), virements empilés, solde cumulé (palier). */
  function renderOverviewChart(canvas, options) {
    destroyChart('overview');
    options = options || {};
    var rows = options.rows || [];
    var payments = options.payments || [];
    var title = options.title || '';
    var highlight = options.highlightMonth || null;
    var onMonthClick = options.onMonthClick;

    if (!canvas || !rows.length || typeof Chart === 'undefined') return;

    var labels = rows.map(function (r) {
      return global.LoyerCalc.formatMonthShort(r.year, r.month);
    });

    var barDatasets = buildPaymentBarDatasets(rows, payments);

    var dueDataset = {
      label: 'Total dû / mois',
      type: 'line',
      data: rows.map(function (r) {
        return r.attendu;
      }),
      borderColor: COLORS.due,
      backgroundColor: 'transparent',
      borderWidth: 2,
      stepped: true,
      pointRadius: 3,
      pointHoverRadius: 5,
      order: 1,
      yAxisID: 'y'
    };

    var balanceDataset = {
      label: 'Solde cumulé',
      type: 'line',
      data: rows.map(function (r) {
        return r.soldeCumule;
      }),
      borderColor: COLORS.balancePos,
      segment: {
        borderColor: function (ctx) {
          var y0 = ctx.p0.parsed.y;
          var y1 = ctx.p1.parsed.y;
          if (y0 < 0 || y1 < 0) return COLORS.balanceNeg;
          return COLORS.balancePos;
        }
      },
      backgroundColor: 'transparent',
      borderWidth: 2,
      borderDash: [6, 4],
      stepped: true,
      pointRadius: 3,
      pointHoverRadius: 5,
      order: 0,
      yAxisID: 'y'
    };

    var datasets = barDatasets.concat([dueDataset, balanceDataset]);

    charts.overview = new Chart(canvas, {
      type: 'bar',
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        onClick: function (evt) {
          if (!onMonthClick) return;
          var hits = charts.overview.getElementsAtEventForMode(evt, 'index', { intersect: true }, false);
          if (!hits.length) return;
          var idx = hits[0].index;
          var row = rows[idx];
          if (row) onMonthClick(row.year, row.month);
        },
        plugins: {
          title: { display: !!title, text: title },
          legend: {
            position: 'bottom',
            labels: {
              filter: function (item) {
                return item.text !== '';
              }
            }
          },
          tooltip: {
            callbacks: {
              footer: function (items) {
                if (!items.length) return '';
                var idx = items[0].dataIndex;
                var row = rows[idx];
                if (!row) return '';
                var list = global.LoyerCalc.filterPaymentsInMonth(payments, row.year, row.month);
                if (!list.length) return ['Aucun paiement ce mois'];
                return list.map(function (p, i) {
                  var tag =
                    global.LoyerPaymentTags && p.tag
                      ? ' [' + global.LoyerPaymentTags.getTagLabel(p.tag) + ']'
                      : '';
                  return (
                    (i + 1) +
                    '. ' +
                    p.date +
                    ' — ' +
                    (Number(p.amount) || 0).toFixed(2) +
                    ' €' +
                    tag +
                    (p.emitter ? ' (' + p.emitter + ')' : '')
                  );
                });
              },
              label: function (ctx) {
                var label = ctx.dataset.label || '';
                if (!label) return null;
                var val = ctx.parsed.y;
                if (val == null || val === 0) return null;
                return label + ' : ' + val.toFixed(2) + ' €';
              }
            }
          },
          highlightMonth: highlight
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: {
              color: function (ctx) {
                var plugin = charts.overview && charts.overview.options.plugins.highlightMonth;
                if (!plugin || !rows[ctx.index]) return undefined;
                if (rows[ctx.index].year === plugin.year && rows[ctx.index].month === plugin.month) {
                  return '#0f172a';
                }
                return undefined;
              },
              font: function (ctx) {
                var plugin = charts.overview && charts.overview.options.plugins.highlightMonth;
                if (!plugin || !rows[ctx.index]) return {};
                if (rows[ctx.index].year === plugin.year && rows[ctx.index].month === plugin.month) {
                  return { weight: 'bold' };
                }
                return {};
              }
            }
          },
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                return v + ' €';
              }
            }
          }
        }
      },
      plugins: [
        {
          id: 'highlightMonthColumn',
          beforeDatasetsDraw: function (chart) {
            var hl = chart.options.plugins.highlightMonth;
            if (!hl) return;
            var idx = -1;
            for (var i = 0; i < rows.length; i += 1) {
              if (rows[i].year === hl.year && rows[i].month === hl.month) {
                idx = i;
                break;
              }
            }
            if (idx === -1) return;
            var meta = chart.getDatasetMeta(0);
            if (!meta || !meta.data[idx]) return;
            var el = meta.data[idx];
            var ctx = chart.ctx;
            var left = el.x - el.width / 2 - 4;
            var width = el.width + 8;
            var top = chart.chartArea.top;
            var height = chart.chartArea.bottom - top;
            ctx.save();
            ctx.fillStyle = 'rgba(59, 130, 246, 0.08)';
            ctx.fillRect(left, top, width, height);
            ctx.restore();
          }
        }
      ]
    });
  }

  /** @deprecated Conservé pour compatibilité — redirige vers overview. */
  function renderMonthlyStackedBar(canvas, monthlyRows, title) {
    renderOverviewChart(canvas, {
      rows: monthlyRows,
      payments: [],
      title: title
    });
  }

  function renderBalanceLine(canvas, monthlyRows, title) {
    renderOverviewChart(canvas, {
      rows: monthlyRows,
      payments: [],
      title: title
    });
  }

  function renderYearlyBar(canvas, monthlyRows, title) {
    renderOverviewChart(canvas, {
      rows: monthlyRows,
      payments: [],
      title: title
    });
  }

  global.LoyerCharts = {
    renderOverviewChart: renderOverviewChart,
    renderMonthlyStackedBar: renderMonthlyStackedBar,
    renderYearlyBar: renderYearlyBar,
    renderBalanceLine: renderBalanceLine,
    getOverviewChartImageUrl: function () {
      var canvas = document.getElementById('chart-overview');
      return canvas && canvas.toDataURL ? canvas.toDataURL('image/png', 1) : null;
    },
    destroyAll: function () {
      Object.keys(charts).forEach(destroyChart);
    }
  };
})(window);
