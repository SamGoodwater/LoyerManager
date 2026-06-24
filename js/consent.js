/**
 * Consentement RGPD (bandeau, pas de tracking).
 */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'loyerManagerConsent';
  var CONSENT_VERSION = 1;

  /** Lit consentement RGPD depuis localStorage. */
  function readConsent() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (!data || data.version !== CONSENT_VERSION) return null;
      return data;
    } catch (e) {
      return null;
    }
  }

  /** Enregistre acceptation bandeau RGPD. */
  function saveConsent() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          version: CONSENT_VERSION,
          acceptedAt: new Date().toISOString(),
          choices: { necessary: true, noAnalytics: true }
        })
      );
    } catch (e) {
      /* ignore */
    }
  }

  /** Masque #gdpr-consent-banner. */
  function hideBanner() {
    var el = document.getElementById('gdpr-consent-banner');
    if (el) el.classList.add('hidden');
  }

  /** Affiche bandeau si pas encore accepté. */
  function showBanner() {
    var el = document.getElementById('gdpr-consent-banner');
    if (el) el.classList.remove('hidden');
  }

  /** Init bandeau ; lien vers onglet Aide confidentialité. */
  function init() {
    if (readConsent()) {
      hideBanner();
      return;
    }
    showBanner();
    var acceptBtn = document.getElementById('btn-gdpr-accept');
    var privacyLink = document.getElementById('gdpr-privacy-link');
    if (acceptBtn) {
      acceptBtn.addEventListener('click', function () {
        saveConsent();
        hideBanner();
      });
    }
    if (privacyLink) {
      privacyLink.addEventListener('click', function (e) {
        e.preventDefault();
        if (global.LoyerHelp && global.LoyerHelp.openHelpPanel) {
          global.LoyerHelp.openHelpPanel('help-privacy');
        }
      });
    }
  }

  global.LoyerConsent = {
    init: init,
    hasConsent: function () {
      return !!readConsent();
    }
  };
})(window);
