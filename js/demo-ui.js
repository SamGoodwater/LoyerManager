/**
 * Bandeau et restrictions UI en mode démonstration.
 */
(function (global) {
  'use strict';

  /** Applique bandeau et masquages si auth-status.demo. */
  function applyDemoUi(status) {
    if (!status || !status.demo) return;
    document.body.classList.add('demo-mode');
    var banner = document.getElementById('demo-banner');
    if (banner) {
      var hours = status.demoResetHours || 6;
      banner.innerHTML =
        '<strong>Mode démonstration</strong> — données fictives, réinitialisées toutes les ' +
        hours +
        ' h. Envoi mail et compte utilisateur désactivés. ' +
        '<a href="' +
        (global.LOYER_SITE_META && global.LOYER_SITE_META.githubUrl
          ? global.LOYER_SITE_META.githubUrl
          : '#') +
        '" class="demo-banner-link" rel="noopener noreferrer">Installer votre instance</a>';
      banner.classList.remove('hidden');
    }
    document.querySelectorAll('[data-demo-hide]').forEach(function (el) {
      el.classList.add('hidden');
    });
    document.querySelectorAll('[data-demo-only]').forEach(function (el) {
      el.classList.remove('hidden');
      el.removeAttribute('hidden');
    });
    ['btn-mail-send', 'btn-mail-draft'].forEach(function (id) {
      var btn = document.getElementById(id);
      if (btn) {
        btn.disabled = true;
        btn.title = 'Indisponible en mode démonstration';
      }
    });
  }

  /** True si mode démo actif (cache auth-status). */
  function isDemoMode() {
    return !!(global.LoyerAuth && global.LoyerAuth.getCachedStatus && global.LoyerAuth.getCachedStatus().demo);
  }

  global.LoyerDemoUi = {
    applyDemoUi: applyDemoUi,
    isDemoMode: isDemoMode
  };
})(window);
