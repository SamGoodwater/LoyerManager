/**
 * Logique métier pure : calculs mensuels et annuels.
 */
(function (global) {
  'use strict';

  var SIGNATURE_IMG_WIDTH = 250;

  var MONTH_NAMES = [
    'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
    'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'
  ];

  function generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  function parseDate(str) {
    var parts = str.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  function formatDateISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function startOfMonth(year, month) {
    return new Date(year, month - 1, 1);
  }

  function endOfMonth(year, month) {
    return new Date(year, month, 0);
  }

  function monthKey(year, month) {
    return year + '-' + String(month).padStart(2, '0');
  }

  function getRentAmount(priceHistory, date) {
    if (!priceHistory || !priceHistory.length) return 0;
    var sorted = priceHistory.slice().sort(function (a, b) {
      return parseDate(a.from) - parseDate(b.from);
    });
    var amount = sorted[0].amount;
    for (var i = 0; i < sorted.length; i++) {
      if (parseDate(sorted[i].from) <= date) {
        amount = sorted[i].amount;
      } else {
        break;
      }
    }
    return amount;
  }

  function iterateMonths(fromDate, toDate, callback) {
    var current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    var end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    while (current <= end) {
      callback(current.getFullYear(), current.getMonth() + 1);
      current.setMonth(current.getMonth() + 1);
    }
  }

  function sumPaymentsInMonth(payments, year, month) {
    var start = startOfMonth(year, month);
    var next = new Date(year, month, 1);
    var total = 0;
    (payments || []).forEach(function (p) {
      var d = parseDate(p.date);
      if (d >= start && d < next) {
        total += Number(p.amount) || 0;
      }
    });
    return total;
  }

  function filterPaymentsInMonth(payments, year, month) {
    var start = startOfMonth(year, month);
    var next = new Date(year, month, 1);
    return (payments || [])
      .filter(function (p) {
        var d = parseDate(p.date);
        return d >= start && d < next;
      })
      .sort(function (a, b) {
        return parseDate(a.date) - parseDate(b.date);
      });
  }

  function computeMonthlyRows(data, upToDate) {
    var settings = data.settings;
    var leaseStart = parseDate(settings.leaseStart);
    var today = upToDate || new Date();
    var end = new Date(today.getFullYear(), today.getMonth(), 1);
    var rows = [];
    var soldeCumule = 0;

    iterateMonths(leaseStart, end, function (year, month) {
      var monthStart = startOfMonth(year, month);
      if (monthStart > end) return;
      var attendu = getRentAmount(settings.priceHistory, monthStart);
      var recu = sumPaymentsInMonth(data.payments, year, month);
      var difference = recu - attendu;
      soldeCumule += difference;
      rows.push({
        year: year,
        month: month,
        key: monthKey(year, month),
        monthStart: formatDateISO(monthStart),
        attendu: attendu,
        recu: recu,
        difference: difference,
        soldeCumule: soldeCumule
      });
    });

    return rows;
  }

  function computeYearlySummary(monthlyRows) {
    var byYear = {};
    monthlyRows.forEach(function (row) {
      if (!byYear[row.year]) {
        byYear[row.year] = {
          year: row.year,
          attendu: 0,
          recu: 0,
          difference: 0,
          soldeCumule: 0
        };
      }
      byYear[row.year].attendu += row.attendu;
      byYear[row.year].recu += row.recu;
      byYear[row.year].difference += row.difference;
      byYear[row.year].soldeCumule = row.soldeCumule;
    });
    return Object.keys(byYear)
      .map(function (y) {
        return byYear[y];
      })
      .sort(function (a, b) {
        return a.year - b.year;
      });
  }

  function getAvailableYears(monthlyRows) {
    var years = {};
    monthlyRows.forEach(function (r) {
      years[r.year] = true;
    });
    return Object.keys(years)
      .map(Number)
      .sort(function (a, b) {
        return a - b;
      });
  }

  function getMonthDetail(data, year, month) {
    var monthlyRows = computeMonthlyRows(data);
    var row = monthlyRows.find(function (r) {
      return r.year === year && r.month === month;
    });
    var payments = filterPaymentsInMonth(data.payments, year, month);
    return {
      row: row || null,
      payments: payments,
      totalRecu: payments.reduce(function (s, p) {
        return s + (Number(p.amount) || 0);
      }, 0)
    };
  }

  function formatMonthLong(year, month) {
    return MONTH_NAMES[month - 1] + ' ' + year;
  }

  function formatMonthShort(year, month) {
    return String(month).padStart(2, '0') + '/' + year;
  }

  function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  function formatDateLong(dateStr) {
    var d = parseDate(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  function getQuittancePeriod(year, month, rentDueDay) {
    var start = startOfMonth(year, month);
    var day = Math.min(rentDueDay || 1, endOfMonth(year, month).getDate());
    start.setDate(day);
    var end = new Date(year, month, day);
    return {
      start: formatDateISO(start),
      end: formatDateISO(end),
      startLabel: formatDateLong(formatDateISO(start)),
      endLabel: formatDateLong(formatDateISO(end))
    };
  }

  function buildSignatureHtml(bailleur) {
    var name = (bailleur && bailleur.name) ? bailleur.name : '';
    var img = (bailleur && bailleur.signatureImage) ? bailleur.signatureImage : '';
    var nameStyle = 'margin-top:0.75rem;margin-bottom:0;font-weight:600;text-align:right;';
    var imgStyle =
      'width:' +
      SIGNATURE_IMG_WIDTH +
      'px;height:auto;max-width:' +
      SIGNATURE_IMG_WIDTH +
      'px;display:block;margin-top:0.5rem;margin-left:auto;object-fit:contain;';
    var parts = [];

    if (name) {
      parts.push(
        '<p class="quittance-signature-name" style="' + nameStyle + '">' +
          escapeHtml(name) +
          '</p>'
      );
    }
    if (img) {
      parts.push(
        '<img src="' +
          img +
          '" alt="Signature" class="quittance-signature-img" width="' +
          SIGNATURE_IMG_WIDTH +
          '" style="' +
          imgStyle +
          '">'
      );
    }
    return parts.join('');
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function buildQuittanceData(data, year, month) {
    var settings = data.settings;
    var detail = getMonthDetail(data, year, month);
    var row = detail.row;
    var period = getQuittancePeriod(year, month, settings.rentDueDay);
    var resteDu = row ? Math.max(0, row.attendu - row.recu) : 0;
    var texteSolde = '';
    if (resteDu > 0) {
      texteSolde = 'Reste dû pour le mois : ' + formatCurrency(resteDu) + '.';
    } else if (row && row.recu > row.attendu) {
      texteSolde = 'Excédent reçu pour le mois : ' + formatCurrency(row.recu - row.attendu) + '.';
    }

    var listePaiements = detail.payments
      .map(function (p) {
        return formatDateLong(p.date) + ' — ' + p.emitter + ' : ' + formatCurrency(p.amount);
      })
      .join('\n');

    if (!listePaiements) {
      listePaiements = 'Aucun virement enregistré pour ce mois.';
    }

    return {
      bailleur: settings.bailleur,
      locataire: settings.locataire,
      moisText: formatMonthLong(year, month),
      mois: MONTH_NAMES[month - 1],
      annee: String(year),
      paiement: formatCurrency(detail.totalRecu),
      paiementNum: detail.totalRecu,
      attendu: row ? formatCurrency(row.attendu) : formatCurrency(0),
      date: period.startLabel,
      datePlusUnMois: period.endLabel,
      listePaiements: listePaiements,
      texteSolde: texteSolde,
      dateDuJour: formatDateLong(formatDateISO(new Date())),
      lieu: settings.bailleur.city || '',
      signatureHtml: buildSignatureHtml(settings.bailleur)
    };
  }

  function replaceMailPlaceholders(text, year, month, bailleurName) {
    if (!text) return '';
    return text
      .replace(/\{mois\}/gi, MONTH_NAMES[month - 1])
      .replace(/\{annee\}/gi, String(year))
      .replace(/\{bailleur\}/gi, bailleurName || '');
  }

  global.LoyerCalc = {
    MONTH_NAMES: MONTH_NAMES,
    generateId: generateId,
    parseDate: parseDate,
    formatDateISO: formatDateISO,
    formatMonthLong: formatMonthLong,
    formatMonthShort: formatMonthShort,
    formatCurrency: formatCurrency,
    formatDateLong: formatDateLong,
    getRentAmount: getRentAmount,
    computeMonthlyRows: computeMonthlyRows,
    computeYearlySummary: computeYearlySummary,
    getAvailableYears: getAvailableYears,
    getMonthDetail: getMonthDetail,
    filterPaymentsInMonth: filterPaymentsInMonth,
    buildQuittanceData: buildQuittanceData,
    buildSignatureHtml: buildSignatureHtml,
    SIGNATURE_IMG_WIDTH: SIGNATURE_IMG_WIDTH,
    replaceMailPlaceholders: replaceMailPlaceholders
  };
})(window);
