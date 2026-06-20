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

  function renderMonthlyBar(canvas, monthlyRows, year) {
    destroyChart('monthlyBar');
    var rows = monthlyRows.filter(function (r) {
      return r.year === year;
    });
    var labels = rows.map(function (r) {
      return global.LoyerCalc.MONTH_NAMES[r.month - 1].slice(0, 3);
    });
    charts.monthlyBar = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Attendu',
            data: rows.map(function (r) {
              return r.attendu;
            }),
            backgroundColor: 'rgba(54, 162, 235, 0.7)'
          },
          {
            label: 'Reçu',
            data: rows.map(function (r) {
              return r.recu;
            }),
            backgroundColor: 'rgba(75, 192, 192, 0.7)'
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Attendu vs reçu — ' + year }
        },
        scales: {
          y: {
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

  function renderBalanceLine(canvas, monthlyRows) {
    destroyChart('balanceLine');
    var labels = monthlyRows.map(function (r) {
      return global.LoyerCalc.formatMonthShort(r.year, r.month);
    });
    charts.balanceLine = new Chart(canvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Solde cumulé',
            data: monthlyRows.map(function (r) {
              return r.soldeCumule;
            }),
            borderColor: 'rgba(255, 99, 132, 1)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            fill: true,
            tension: 0.2
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          title: { display: true, text: 'Solde cumulé dans le temps' }
        },
        scales: {
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

  global.LoyerCharts = {
    renderMonthlyBar: renderMonthlyBar,
    renderBalanceLine: renderBalanceLine,
    destroyAll: function () {
      Object.keys(charts).forEach(destroyChart);
    }
  };
})(window);
