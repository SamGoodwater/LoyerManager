/**
 * Import CSV bancaire : parsing, filtrage par émetteur, détection des doublons.
 */
(function (global) {
  'use strict';

  /** Détecte encodage ISO-8859-1 vs UTF-8 sur buffer CSV. */
  function decodeCsvBuffer(buffer) {
    var iso = '';
    var utf8 = '';
    try {
      iso = new TextDecoder('iso-8859-1').decode(buffer).replace(/^\uFEFF/, '');
    } catch (e1) {
      iso = '';
    }
    try {
      utf8 = new TextDecoder('utf-8').decode(buffer).replace(/^\uFEFF/, '');
    } catch (e2) {
      utf8 = '';
    }

    function score(text) {
      if (!text) return -10;
      var first = normalizeText(String(text.split(/\r?\n/)[0] || ''));
      var pts = 0;
      if (first.indexOf('DATE') !== -1) pts += 2;
      if (first.indexOf('CREDIT') !== -1 || first.indexOf('CRED') !== -1) pts += 2;
      if (first.indexOf('LIBELL') !== -1 || first.indexOf('LIBEL') !== -1) pts += 2;
      if (text.indexOf('\uFFFD') !== -1) pts -= 5;
      return pts;
    }

    if (score(iso) >= score(utf8)) return iso;
    return utf8 || iso;
  }

  /** normalize text. */
  function normalizeText(str) {
    return String(str || '')
      .toUpperCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Découpe une ligne CSV en respectant guillemets et séparateur. */
  function parseCsvLine(line, sep) {
    var parts = [];
    var cur = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
        continue;
      }
      if (!inQuotes && ch === sep) {
        parts.push(cur);
        cur = '';
        continue;
      }
      cur += ch;
    }
    parts.push(cur);
    return parts;
  }

  /** Infère ; ou , comme séparateur CSV. */
  function detectSeparator(headerLine) {
    if (headerLine.indexOf(';') !== -1) return ';';
    if (headerLine.indexOf('\t') !== -1) return '\t';
    return ',';
  }

  /** Parse montant bancaire FR (virgule décimale). */
  function parseFrenchAmount(str) {
    if (str == null || str === '') return null;
    var cleaned = String(str).replace(/\s/g, '').replace(/\u00a0/g, '').replace(',', '.');
    var n = parseFloat(cleaned);
    return isNaN(n) ? null : Math.round(n * 100) / 100;
  }

  /** Parse date relevé (JJ/MM/AAAA et variantes). */
  function parseBankDate(str) {
    var m = String(str || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!m) return null;
    var day = parseInt(m[1], 10);
    var month = parseInt(m[2], 10);
    var year = parseInt(m[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    var mm = String(month).padStart(2, '0');
    var dd = String(day).padStart(2, '0');
    return year + '-' + mm + '-' + dd;
  }

  /** extract bank ref. */
  function extractBankRef(label) {
    var text = String(label || '').trim();
    var mSepa = text.match(/(\d{5}-\d{2}-\d{10,})\s*$/);
    if (mSepa) return mSepa[1];
    var mDigits = text.match(/(\d{12,})\s*$/);
    if (mDigits) return mDigits[1];
    var mAlpha = text.match(/\s([A-Z0-9]{10,})\s*$/);
    if (mAlpha) return mAlpha[1];
    return '';
  }

  /** Repère colonnes date, montant, libellé, référence (banques FR). */
  function findColumnIndexes(header) {
    var idxDate = -1;
    var idxValueDate = -1;
    var idxCredit = -1;
    var idxLabel = -1;

    header.forEach(function (h, i) {
      if (idxDate === -1 && h === 'DATE') idxDate = i;
      if (idxValueDate === -1 && h.indexOf('DATE DE VALEUR') !== -1) idxValueDate = i;
      if (
        idxCredit === -1 &&
        (h.indexOf('CREDIT') !== -1 || h.indexOf('CRED') !== -1 || h === 'CRDIT')
      ) {
        idxCredit = i;
      }
      if (idxLabel === -1 && (h.indexOf('LIBELL') !== -1 || h.indexOf('LIBEL') !== -1)) {
        idxLabel = i;
      }
    });

    if (idxDate === -1) idxDate = 0;
    if (idxCredit === -1 && header.length >= 4) idxCredit = 3;
    if (idxLabel === -1 && header.length >= 5) idxLabel = 4;

    return {
      idxDate: idxDate,
      idxValueDate: idxValueDate,
      idxCredit: idxCredit,
      idxLabel: idxLabel
    };
  }

  /** Profils émetteurs depuis settings pour filtrage import. */
  function getEmitterProfiles(settings) {
    var profiles = [];
    if (settings.emitterProfiles && settings.emitterProfiles.length) {
      profiles = settings.emitterProfiles.slice();
    } else {
      profiles = (settings.emitters || []).map(function (name) {
        return { name: name, patterns: [] };
      });
    }

    var defaults = global.LoyerCsvImport
      ? global.LoyerCsvImport.defaultEmitterProfiles()
      : [];

    profiles = profiles.map(function (profile) {
      if (profile.patterns && profile.patterns.length) return profile;
      var match = defaults.find(function (def) {
        return normalizeText(def.name) === normalizeText(profile.name);
      });
      if (match) {
        return { name: profile.name, patterns: match.patterns.slice() };
      }
      return profile;
    });

    var hasPatterns = profiles.some(function (profile) {
      return profile.patterns && profile.patterns.length;
    });
    if (!hasPatterns && defaults.length) {
      return defaults.slice();
    }

    return profiles;
  }

  /** match emitter profile. */
  function matchEmitterProfile(label, profiles) {
    var normLabel = normalizeText(label);
    for (var i = 0; i < profiles.length; i++) {
      var profile = profiles[i];
      var patterns = profile.patterns || [];
      for (var j = 0; j < patterns.length; j++) {
        if (normLabel.indexOf(normalizeText(patterns[j])) !== -1) {
          return profile.name;
        }
      }
    }
    return null;
  }

  /** Parse lignes CSV (séparateur ; ou ,). */
  function parseCsvRows(text) {
    var lines = text.split(/\r?\n/).filter(function (line) {
      return line.trim().length > 0;
    });
    if (!lines.length) return { rows: [], error: 'Fichier CSV vide.' };

    var sep = detectSeparator(lines[0]);
    var header = parseCsvLine(lines[0], sep).map(function (h) {
      return normalizeText(h);
    });

    var cols = findColumnIndexes(header);
    var idxDate = cols.idxDate;
    var idxValueDate = cols.idxValueDate;
    var idxCredit = cols.idxCredit;
    var idxLabel = cols.idxLabel;

    if (idxCredit === -1 || idxLabel === -1) {
      return {
        rows: [],
        error: 'Colonnes attendues : Date, Crédit, Libellé (export bancaire français).'
      };
    }

    var rows = [];
    for (var li = 1; li < lines.length; li++) {
      var cols = parseCsvLine(lines[li], sep);
      if (cols.length < header.length) continue;

      var amount = parseFrenchAmount(cols[idxCredit]);
      if (amount == null || amount <= 0) continue;

      var label = cols[idxLabel] || '';
      var dateOp = parseBankDate(cols[idxDate]);
      var dateVal = idxValueDate >= 0 ? parseBankDate(cols[idxValueDate]) : null;
      var date = dateOp || dateVal;
      if (!date) continue;

      rows.push({
        date: date,
        valueDate: dateVal || date,
        amount: amount,
        label: label,
        bankRef: extractBankRef(label)
      });
    }

    return { rows: rows, error: null };
  }

  /** Doublon si même ref bancaire ou montant+date existants. */
  function findDuplicateReason(candidate, existingPayments, selectedKeys) {
    // 1) Même référence bancaire = doublon certain (relevés FR)
    if (candidate.bankRef) {
      var byRef = existingPayments.find(function (p) {
        return p.bankRef && p.bankRef === candidate.bankRef;
      });
      if (byRef) {
        return { duplicate: true, reason: 'Réf. bancaire déjà importée (' + candidate.bankRef + ').' };
      }
      if (selectedKeys[candidate.bankRef]) {
        return { duplicate: true, reason: 'Doublon dans la sélection (même réf. bancaire).' };
      }
    }

    // 2) Même date + montant : doublon sauf si références bancaires distinctes
    var byDateAmount = existingPayments.find(function (p) {
      return p.date === candidate.date && Math.abs(p.amount - candidate.amount) < 0.005;
    });
    if (byDateAmount) {
      if (candidate.bankRef && byDateAmount.bankRef && byDateAmount.bankRef !== candidate.bankRef) {
        return { duplicate: false, reason: '' };
      }
      return {
        duplicate: true,
        reason: 'Date et montant déjà enregistrés (' + byDateAmount.date + ', ' + byDateAmount.amount + ' €).'
      };
    }

    var dateAmountKey = candidate.date + '|' + candidate.amount;
    if (selectedKeys[dateAmountKey]) {
      return { duplicate: true, reason: 'Doublon dans la sélection (même date et montant).' };
    }

    return { duplicate: false, reason: '' };
  }

  /** Structure données pour renderCsvImportTable. */
  function buildImportPreview(csvText, settings, existingPayments) {
    var parsed = parseCsvRows(csvText);
    if (parsed.error) return { error: parsed.error, items: [] };

    var profiles = getEmitterProfiles(settings);
    var items = [];
    var selectedKeys = {};

    parsed.rows.forEach(function (row, index) {
      var emitterName = matchEmitterProfile(row.label, profiles);
      if (!emitterName) return;

      var candidate = {
        date: row.date,
        valueDate: row.valueDate,
        amount: row.amount,
        label: row.label,
        bankRef: row.bankRef,
        emitterName: emitterName
      };

      var dup = findDuplicateReason(candidate, existingPayments || [], selectedKeys);
      if (candidate.bankRef) selectedKeys[candidate.bankRef] = true;
      selectedKeys[candidate.date + '|' + candidate.amount] = true;

      items.push({
        id: 'csv_' + index,
        date: candidate.date,
        valueDate: candidate.valueDate,
        amount: candidate.amount,
        label: candidate.label,
        bankRef: candidate.bankRef,
        emitterName: candidate.emitterName,
        duplicate: dup.duplicate,
        duplicateReason: dup.reason,
        selected: !dup.duplicate
      });
    });

    items.sort(function (a, b) {
      if (a.date === b.date) return b.amount - a.amount;
      return a.date < b.date ? 1 : -1;
    });

    return { error: null, items: items, stats: {
      csvCredits: parsed.rows.length,
      matched: items.length
    }};
  }

  /** items to payments. */
  function itemsToPayments(items) {
    return items
      .filter(function (item) {
        return item.selected && !item.duplicate;
      })
      .map(function (item) {
        var payment = {
          id: global.LoyerCalc ? global.LoyerCalc.generateId() : 'p_' + Date.now(),
          date: item.date,
          emitter: item.emitterName,
          amount: item.amount,
          bankLabel: item.label || '',
          bankRef: item.bankRef || '',
          status: 'importé',
          comment: ''
        };
        return payment;
      });
  }

  global.LoyerCsvImport = {
    decodeCsvBuffer: decodeCsvBuffer,
    parseCsvRows: parseCsvRows,
    buildImportPreview: buildImportPreview,
    itemsToPayments: itemsToPayments,
    extractBankRef: extractBankRef,
    normalizeText: normalizeText,
    defaultEmitterProfiles: function () {
      return [
        {
          name: 'Locataire exemple',
          patterns: ['LOCATAIRE EXEMPLE', 'VIR LOYER']
        }
      ];
    }
  };
})(window);
