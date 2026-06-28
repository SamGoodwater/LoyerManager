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

  /** generate id. */
  function generateId() {
    return 'p_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
  }

  /** Parse une date ISO ou FR en objet Date. */
  function parseDate(str) {
    var parts = str.split('-');
    return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  }

  /** Formate format date iso. */
  function formatDateISO(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  /** start of month. */
  function startOfMonth(year, month) {
    return new Date(year, month - 1, 1);
  }

  /** end of month. */
  function endOfMonth(year, month) {
    return new Date(year, month, 0);
  }

  /** month key. */
  function monthKey(year, month) {
    return year + '-' + String(month).padStart(2, '0');
  }

  /** Montant loyer + charges applicable à une date (paliers priceHistory). */
  function getRentBreakdown(priceHistory, date) {
    if (!priceHistory || !priceHistory.length) {
      return { loyer: 0, charges: 0, total: 0 };
    }
    var sorted = priceHistory.slice().sort(function (a, b) {
      return parseDate(a.from) - parseDate(b.from);
    });
    var loyer = Number(sorted[0].amount) || 0;
    var charges = sorted[0].charges != null ? Number(sorted[0].charges) || 0 : 0;
    for (var i = 0; i < sorted.length; i++) {
      if (parseDate(sorted[i].from) <= date) {
        loyer = Number(sorted[i].amount) || 0;
        charges = sorted[i].charges != null ? Number(sorted[i].charges) || 0 : 0;
      } else {
        break;
      }
    }
    return { loyer: loyer, charges: charges, total: loyer + charges };
  }

  /** Montant total dû (loyer + charges) à une date — alias rétrocompat. */
  function getRentAmount(priceHistory, date) {
    return getRentBreakdown(priceHistory, date).total;
  }

  /** iterate months. */
  function iterateMonths(fromDate, toDate, callback) {
    var current = new Date(fromDate.getFullYear(), fromDate.getMonth(), 1);
    var end = new Date(toDate.getFullYear(), toDate.getMonth(), 1);
    while (current <= end) {
      callback(current.getFullYear(), current.getMonth() + 1);
      current.setMonth(current.getMonth() + 1);
    }
  }

  /** sum payments in month. */
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

  /** filter payments in month. */
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

  /** Calcule une ligne par mois : attendu, reçu, solde cumulé, statut. */
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
      var breakdown = getRentBreakdown(settings.priceHistory, monthStart);
      var attendu = breakdown.total;
      var recu = sumPaymentsInMonth(data.payments, year, month);
      var difference = recu - attendu;
      soldeCumule += difference;
      rows.push({
        year: year,
        month: month,
        key: monthKey(year, month),
        monthStart: formatDateISO(monthStart),
        loyerAttendu: breakdown.loyer,
        chargesAttendu: breakdown.charges,
        attendu: attendu,
        recu: recu,
        difference: difference,
        soldeCumule: soldeCumule
      });
    });

    return rows;
  }

  /** Agrège les lignes mensuelles par année civile. */
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

  /** Liste des années présentes dans les lignes mensuelles. */
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

  /** Détail d'un mois + virements associés. */
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

  /** Formate format month long. */
  function formatMonthLong(year, month) {
    return MONTH_NAMES[month - 1] + ' ' + year;
  }

  /** Formate format month short. */
  function formatMonthShort(year, month) {
    return String(month).padStart(2, '0') + '/' + year;
  }

  /** Formate format currency. */
  function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  }

  /** Formate format date long. */
  function formatDateLong(dateStr) {
    var d = parseDate(dateStr);
    return d.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  }

  /** Texte période quittance (du/au selon jour échéance). */
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

  /** Construit build signature html. */
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

  /** Échappe escape html. */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Date d'échéance théorique pour un mois donné. */
  function getRentDueDate(year, month, rentDueDay) {
    var day = Math.min(rentDueDay || 1, endOfMonth(year, month).getDate());
    return new Date(year, month - 1, day);
  }

  /** True si le mois correspond au mois calendaire courant. */
  function isCurrentMonth(year, month, today) {
    today = today || new Date();
    return year === today.getFullYear() && month === today.getMonth() + 1;
  }

  /** True si le mois est strictement antérieur au mois courant. */
  function isMonthPast(year, month, today) {
    today = today || new Date();
    var monthStart = startOfMonth(year, month);
    var currentStart = new Date(today.getFullYear(), today.getMonth(), 1);
    return monthStart < currentStart;
  }

  /** Statut métier : payé, partiel, impayé, en cours, avance. */
  function getMonthStatus(row, options) {
    options = options || {};
    var today = options.today || new Date();
    if (!row || !row.attendu) return 'hors_periode';
    // Reçu >= attendu : payé ou trop-perçu (avance locataire)
    if (row.recu >= row.attendu) {
      return row.recu > row.attendu ? 'avance' : 'paye';
    }
    if (row.recu > 0) return 'partiel';
    // Mois en cours : « impayé » seulement après le jour d'échéance théorique
    if (isCurrentMonth(row.year, row.month, today)) {
      var rentDueDay = options.rentDueDay != null ? options.rentDueDay : 1;
      var due = getRentDueDate(row.year, row.month, rentDueDay);
      if (today < due) return 'en_cours';
    }
    if (isMonthPast(row.year, row.month, today)) return 'impaye';
    return 'en_cours';
  }

  var MONTH_STATUS_LABELS = {
    paye: 'Payé',
    partiel: 'Partiel',
    impaye: 'Impayé',
    avance: 'En avance',
    en_cours: 'En cours',
    hors_periode: '—'
  };

  /** Libellé français du statut mois (Payé, Impayé…). */
  function getMonthStatusLabel(status) {
    return MONTH_STATUS_LABELS[status] || status;
  }

  /** Nombre de jours calendaires entre deux dates. */
  function daysBetween(fromDate, toDate) {
    var ms = toDate.getTime() - fromDate.getTime();
    return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
  }

  /** Jours de retard vs jour théorique du virement. */
  function getPaymentDelayDays(data, year, month, today) {
    today = today || new Date();
    var settings = data.settings || {};
    var row = computeMonthlyRows(data, today).find(function (r) {
      return r.year === year && r.month === month;
    });
    if (!row || !row.attendu) return null;

    var due = getRentDueDate(year, month, settings.rentDueDay);
    var payments = filterPaymentsInMonth(data.payments, year, month);

    if (payments.length) {
      var firstPay = parseDate(payments[0].date);
      if (firstPay <= due) return 0;
      return daysBetween(due, firstPay);
    }

    if (isMonthPast(year, month, today) || (isCurrentMonth(year, month, today) && today > due)) {
      return daysBetween(due, today);
    }
    return null;
  }

  /** list months in range. */
  function listMonthsInRange(fromYear, fromMonth, toYear, toMonth, data, upToDate) {
    var rows = computeMonthlyRows(data, upToDate);
    var fromKey = monthKey(fromYear, fromMonth);
    var toKey = monthKey(toYear, toMonth);
    if (fromKey > toKey) {
      var tmpY = fromYear;
      var tmpM = fromMonth;
      fromYear = toYear;
      fromMonth = toMonth;
      toYear = tmpY;
      toMonth = tmpM;
      fromKey = monthKey(fromYear, fromMonth);
      toKey = monthKey(toYear, toMonth);
    }
    return rows.filter(function (r) {
      return r.key >= fromKey && r.key <= toKey;
    });
  }

  /** KPIs année en cours pour le tableau de bord. */
  function computeDashboardKpis(data, year, today) {
    today = today || new Date();
    var rows = computeMonthlyRows(data, today);
    var yearRows = rows.filter(function (r) {
      return r.year === year;
    });
    var settings = data.settings || {};
    var statusOpts = { today: today, rentDueDay: settings.rentDueDay };

    var attenduTotal = 0;
    var recuTotal = 0;
    var counts = { paye: 0, partiel: 0, impaye: 0, avance: 0, en_cours: 0 };
    var delaySum = 0;
    var delayCount = 0;

    yearRows.forEach(function (row) {
      attenduTotal += row.attendu;
      recuTotal += row.recu;
      var status = getMonthStatus(row, statusOpts);
      if (counts[status] != null) counts[status] += 1;
      var delay = getPaymentDelayDays(data, row.year, row.month, today);
      if (delay != null && delay > 0) {
        delaySum += delay;
        delayCount += 1;
      }
    });

    var lastRow = rows.length ? rows[rows.length - 1] : null;
    var soldeADate = lastRow ? lastRow.soldeCumule : 0;
    var tauxRecouvrement = attenduTotal > 0 ? recuTotal / attenduTotal : null;

    return {
      year: year,
      soldeADate: soldeADate,
      tauxRecouvrement: tauxRecouvrement,
      counts: counts,
      moisProblematiques: counts.partiel + counts.impaye,
      retardMoyenJours: delayCount > 0 ? Math.round(delaySum / delayCount) : null
    };
  }

  /** KPIs dashboard sur un sous-ensemble de lignes mensuelles. */
  function computeKpisForRows(data, filterRows, today) {
    today = today || new Date();
    var allRows = computeMonthlyRows(data, today);
    var settings = data.settings || {};
    var statusOpts = { today: today, rentDueDay: settings.rentDueDay };

    var attenduTotal = 0;
    var recuTotal = 0;
    var counts = { paye: 0, partiel: 0, impaye: 0, avance: 0, en_cours: 0 };
    var delaySum = 0;
    var delayCount = 0;

    (filterRows || []).forEach(function (row) {
      attenduTotal += row.attendu;
      recuTotal += row.recu;
      var status = getMonthStatus(row, statusOpts);
      if (counts[status] != null) counts[status] += 1;
      var delay = getPaymentDelayDays(data, row.year, row.month, today);
      if (delay != null && delay > 0) {
        delaySum += delay;
        delayCount += 1;
      }
    });

    var lastInSelection = filterRows && filterRows.length ? filterRows[filterRows.length - 1] : null;
    var lastAll = allRows.length ? allRows[allRows.length - 1] : null;
    var soldeADate = lastInSelection ? lastInSelection.soldeCumule : lastAll ? lastAll.soldeCumule : 0;

    return {
      soldeADate: soldeADate,
      tauxRecouvrement: attenduTotal > 0 ? recuTotal / attenduTotal : null,
      counts: counts,
      moisProblematiques: counts.partiel + counts.impaye,
      retardMoyenJours: delayCount > 0 ? Math.round(delaySum / delayCount) : null,
      attenduTotal: attenduTotal,
      recuTotal: recuTotal,
      differenceTotal: recuTotal - attenduTotal
    };
  }

  /** Texte « loyer X + charges Y = total Z » pour affichage. */
  function formatRentBreakdownText(breakdown) {
    breakdown = breakdown || { loyer: 0, charges: 0, total: 0 };
    if (!breakdown.charges) {
      return 'loyer ' + formatCurrency(breakdown.loyer);
    }
    return (
      'loyer ' +
      formatCurrency(breakdown.loyer) +
      ' + charges ' +
      formatCurrency(breakdown.charges) +
      ' = ' +
      formatCurrency(breakdown.total)
    );
  }

  /** Construit build quittance data. */
  function buildQuittanceData(data, year, month) {
    var settings = data.settings;
    var detail = getMonthDetail(data, year, month);
    var row = detail.row;
    var period = getQuittancePeriod(year, month, settings.rentDueDay);
    var monthStart = startOfMonth(year, month);
    var breakdown = getRentBreakdown(settings.priceHistory, monthStart);
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

    var estQuittance = resteDu <= 0 && detail.totalRecu > 0;
    var moisText = formatMonthLong(year, month);
    var titreDocument = estQuittance
      ? 'Quittance de loyer et charges — ' + moisText
      : 'Reçu de paiement — ' + moisText;
    var loc = settings.locataire || {};
    var adresseLogement =
      [loc.street, loc.postalCode, loc.city].filter(Boolean).join(', ') || '—';
    var bailDate = settings.leaseStart ? formatDateLong(settings.leaseStart) : '';
    var texteBail = bailDate ? ', en application du contrat de bail en date du ' + bailDate + ',' : '';
    var texteDatePaiement = '';
    if (detail.payments.length) {
      var lastPayment = detail.payments.reduce(function (best, p) {
        if (!best) return p;
        return parseDate(p.date) > parseDate(best.date) ? p : best;
      }, null);
      if (lastPayment) {
        texteDatePaiement = 'Date du dernier encaissement : ' + formatDateLong(lastPayment.date) + '.';
      }
    }
    var mentionLegale = estQuittance
      ? 'La présente quittance atteste du paiement intégral du loyer et des charges pour la période indiquée, avec distinction du loyer hors charges et des provisions pour charges. Elle ne vaut pas présomption de paiement des loyers antérieurs et futurs (art. 21 de la loi n° 89-462 du 6 juillet 1989).'
      : 'Le présent reçu atteste des sommes versées pour la période indiquée. Une quittance ne peut être délivrée qu\'après règlement intégral du loyer et des charges dus pour la période (art. 21 de la loi n° 89-462 du 6 juillet 1989).';
    var textePieceJointe = estQuittance
      ? 'la quittance de loyer pour ' + moisText
      : 'le reçu de paiement pour ' + moisText;

    return {
      bailleur: settings.bailleur,
      locataire: settings.locataire,
      moisText: moisText,
      mois: MONTH_NAMES[month - 1],
      annee: String(year),
      loyer: formatCurrency(breakdown.loyer),
      charges: formatCurrency(breakdown.charges),
      totalAttendu: formatCurrency(breakdown.total),
      montantTotal: formatCurrency(breakdown.total),
      texteMontants: formatRentBreakdownText(breakdown),
      paiement: formatCurrency(detail.totalRecu),
      paiementNum: detail.totalRecu,
      attendu: row ? formatCurrency(row.attendu) : formatCurrency(0),
      date: period.startLabel,
      datePlusUnMois: period.endLabel,
      listePaiements: listePaiements,
      texteSolde: texteSolde,
      titreDocument: titreDocument,
      typeDocument: estQuittance ? 'Quittance' : 'Reçu',
      adresseLogement: adresseLogement,
      bailDate: bailDate,
      texteBail: texteBail,
      texteDatePaiement: texteDatePaiement,
      mentionLegale: mentionLegale,
      textePieceJointe: textePieceJointe,
      dateDuJour: formatDateLong(formatDateISO(new Date())),
      lieu: settings.bailleur.city || '',
      signatureHtml: buildSignatureHtml(settings.bailleur)
    };
  }

  global.LoyerCalc = {
    MONTH_NAMES: MONTH_NAMES,
    MONTH_STATUS_LABELS: MONTH_STATUS_LABELS,
    generateId: generateId,
    parseDate: parseDate,
    formatDateISO: formatDateISO,
    monthKey: monthKey,
    formatMonthLong: formatMonthLong,
    formatMonthShort: formatMonthShort,
    formatCurrency: formatCurrency,
    formatDateLong: formatDateLong,
    getRentAmount: getRentAmount,
    getRentBreakdown: getRentBreakdown,
    formatRentBreakdownText: formatRentBreakdownText,
    computeMonthlyRows: computeMonthlyRows,
    computeYearlySummary: computeYearlySummary,
    getAvailableYears: getAvailableYears,
    getMonthDetail: getMonthDetail,
    filterPaymentsInMonth: filterPaymentsInMonth,
    getMonthStatus: getMonthStatus,
    getMonthStatusLabel: getMonthStatusLabel,
    getPaymentDelayDays: getPaymentDelayDays,
    listMonthsInRange: listMonthsInRange,
    computeDashboardKpis: computeDashboardKpis,
    computeKpisForRows: computeKpisForRows,
    buildQuittanceData: buildQuittanceData,
    buildSignatureHtml: buildSignatureHtml,
    SIGNATURE_IMG_WIDTH: SIGNATURE_IMG_WIDTH
  };
})(window);
