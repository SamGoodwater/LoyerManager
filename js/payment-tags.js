/**
 * Types de paiement (tag utilisateur) — distinct du statut origine (importé/manuel).
 */
(function (global) {
  'use strict';

  var TAGS = [
    { id: 'virement', label: 'Virement' },
    { id: 'espece', label: 'Espèce' },
    { id: 'nature', label: 'Nature' },
    { id: 'autre', label: 'Autres' }
  ];

  var DEFAULT_TAG = 'virement';
  var VALID_IDS = TAGS.map(function (t) {
    return t.id;
  });

  /** Normalise un tag (défaut virement si absent ou invalide). */
  function normalizeTag(tag) {
    if (!tag) return DEFAULT_TAG;
    var id = String(tag).toLowerCase();
    return VALID_IDS.indexOf(id) !== -1 ? id : DEFAULT_TAG;
  }

  /** Libellé affiché d'un tag. */
  function getTagLabel(tag) {
    var id = normalizeTag(tag);
    for (var i = 0; i < TAGS.length; i += 1) {
      if (TAGS[i].id === id) return TAGS[i].label;
    }
    return id;
  }

  global.LoyerPaymentTags = {
    TAGS: TAGS,
    DEFAULT_TAG: DEFAULT_TAG,
    normalizeTag: normalizeTag,
    getTagLabel: getTagLabel,
    isValidTag: function (tag) {
      return VALID_IDS.indexOf(normalizeTag(tag)) !== -1;
    }
  };
})(window);
