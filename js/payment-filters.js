/**
 * Filtrage et tri de la liste des paiements (onglet Paiements).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'loyer-payment-filters';

  function defaultCriteria() {
    return {
      search: '',
      year: '',
      month: '',
      tag: '',
      amountMode: 'all',
      amountExact: '',
      sort: 'date-desc'
    };
  }

  /** Lit les critères depuis sessionStorage. */
  function loadCriteria() {
    try {
      var raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultCriteria();
      var parsed = JSON.parse(raw);
      return Object.assign(defaultCriteria(), parsed);
    } catch (e) {
      return defaultCriteria();
    }
  }

  /** Persiste les critères en sessionStorage. */
  function saveCriteria(criteria) {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(criteria || defaultCriteria()));
    } catch (e) {
      /* ignore */
    }
  }

  function paymentYear(p) {
    var parts = String(p.date || '').split('-');
    return parts[0] || '';
  }

  function paymentMonth(p) {
    var parts = String(p.date || '').split('-');
    return parts[1] ? String(parseInt(parts[1], 10)) : '';
  }

  function haystack(p) {
    return [
      p.emitter,
      p.bankLabel,
      p.bankRef,
      p.comment,
      global.LoyerPaymentTags ? global.LoyerPaymentTags.getTagLabel(p.tag) : p.tag
    ]
      .join(' ')
      .toLowerCase();
  }

  /** Filtre et trie un tableau de paiements. */
  function filterAndSort(payments, criteria) {
    criteria = criteria || defaultCriteria();
    var list = (payments || []).slice();

    if (criteria.search) {
      var q = String(criteria.search).toLowerCase().trim();
      list = list.filter(function (p) {
        return haystack(p).indexOf(q) !== -1;
      });
    }

    if (criteria.year) {
      list = list.filter(function (p) {
        return paymentYear(p) === String(criteria.year);
      });
    }

    if (criteria.month) {
      list = list.filter(function (p) {
        return paymentMonth(p) === String(criteria.month);
      });
    }

    if (criteria.tag) {
      list = list.filter(function (p) {
        var tag = global.LoyerPaymentTags
          ? global.LoyerPaymentTags.normalizeTag(p.tag)
          : p.tag;
        return tag === criteria.tag;
      });
    }

    if (criteria.amountMode === 'positive') {
      list = list.filter(function (p) {
        return Number(p.amount) > 0;
      });
    } else if (criteria.amountMode === 'negative') {
      list = list.filter(function (p) {
        return Number(p.amount) < 0;
      });
    } else if (criteria.amountMode === 'exact' && criteria.amountExact !== '') {
      var target = parseFloat(String(criteria.amountExact).replace(',', '.'));
      if (!isNaN(target)) {
        list = list.filter(function (p) {
          return Math.abs(Number(p.amount) - target) < 0.005;
        });
      }
    }

    var sort = criteria.sort || 'date-desc';
    list.sort(function (a, b) {
      if (sort === 'date-asc') {
        return global.LoyerCalc.parseDate(a.date) - global.LoyerCalc.parseDate(b.date);
      }
      if (sort === 'date-desc') {
        return global.LoyerCalc.parseDate(b.date) - global.LoyerCalc.parseDate(a.date);
      }
      if (sort === 'amount-asc') {
        return Number(a.amount) - Number(b.amount);
      }
      if (sort === 'amount-desc') {
        return Number(b.amount) - Number(a.amount);
      }
      if (sort === 'tag') {
        var ta = global.LoyerPaymentTags ? global.LoyerPaymentTags.getTagLabel(a.tag) : a.tag;
        var tb = global.LoyerPaymentTags ? global.LoyerPaymentTags.getTagLabel(b.tag) : b.tag;
        return String(ta).localeCompare(String(tb), 'fr');
      }
      return 0;
    });

    return list;
  }

  global.LoyerPaymentFilters = {
    defaultCriteria: defaultCriteria,
    loadCriteria: loadCriteria,
    saveCriteria: saveCriteria,
    filterAndSort: filterAndSort
  };
})(window);
