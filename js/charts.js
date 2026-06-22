/**
 * Graphiques Chart.js.
 */
(function (global) {
  'use strict';

  var charts = {};

  function destroyChart(id) {
    if (charts[id]) {
      charts[id].destroy();
      charts[id] = null;
    }
  }

  function renderMonthlyStackedBar(canvas, monthlyRows, title) {
    destroyChart('monthlyStack');
    var rows = monthlyRows || [];
    var labels = rows.map(function (r) {
      return global.LoyerCalc.formatMonthShort(r.year, r.month);
    });
    charts.monthlyStack = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Reçu',
            data: rows.map(function (r) {
              return r.recu;
            }),
            backgroundColor: 'rgba(75, 192, 192, 0.85)',
            stack: 'stack0',
            borderRadius: 4
          },
          {
            label: 'Reste dû',
            data: rows.map(function (r) {
              return Math.max(0, r.attendu - r.recu);
            }),
            backgroundColor: 'rgba(255, 99, 132, 0.65)',
            stack: 'stack0',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: title || 'Reçu vs reste dû' },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                return v + ' €';
              }
            }
          }
        }
      }
    });
  }

  function renderBalanceLine(canvas, monthlyRows, title) {
    destroyChart('balanceLine');
    var rows = monthlyRows || [];
    var labels = rows.map(function (r) {
      return global.LoyerCalc.formatMonthShort(r.year, r.month);
    });
    var values = rows.map(function (r) {
      return r.soldeCumule;
    });
    var positive = values.map(function (v) {
      return v >= 0 ? v : null;
    });
    var negative = values.map(function (v) {
      return v < 0 ? v : null;
    });

    charts.balanceLine = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Solde positif (avance)',
            data: positive,
            borderColor: 'rgba(75, 192, 192, 1)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            fill: true,
            tension: 0.25,
            spanGaps: false,
            pointRadius: 3
          },
          {
            label: 'Solde négatif (dette)',
            data: negative,
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.25,
            spanGaps: false,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: !!title, text: title || 'Solde cumulé' },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { grid: { display: false } },
          y: {
            ticks: {
              callback: function (v) {
                return v + ' €';
              }
            }
          }
        }
      }
    });
  }

  function renderYearlyBar(canvas, monthlyRows, title) {
    destroyChart('yearlyBar');
    var rows = monthlyRows || [];
    var labels = rows.map(function (r) {
      return global.LoyerCalc.formatMonthShort(r.year, r.month);
    });
    charts.yearlyBar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Reçu',
            data: rows.map(function (r) {
              return r.recu;
            }),
            backgroundColor: 'rgba(75, 192, 192, 0.85)',
            stack: 'stack0',
            borderRadius: 4
          },
          {
            label: 'Reste dû',
            data: rows.map(function (r) {
              return Math.max(0, r.attendu - r.recu);
            }),
            backgroundColor: 'rgba(255, 99, 132, 0.65)',
            stack: 'stack0',
            borderRadius: 4
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: !!title, text: title || 'Année' },
          legend: { position: 'bottom' }
        },
        scales: {
          x: { stacked: true, grid: { display: false } },
          y: {
            stacked: true,
            beginAtZero: true,
            ticks: {
              callback: function (v) {
                return v + ' €';
              }
            }
          }
        }
      }
    });
  }

  global.LoyerCharts = {
    renderMonthlyStackedBar: renderMonthlyStackedBar,
    renderYearlyBar: renderYearlyBar,
    renderBalanceLine: renderBalanceLine,
    destroyAll: function () {
      Object.keys(charts).forEach(destroyChart);
    }
  };
})(window);
