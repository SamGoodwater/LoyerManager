/**
 * Notifications toast et confirmations légères.
 */
(function (global) {
  'use strict';

  var container = null;
  var confirmResolve = null;

  function ensureContainer() {
    if (!container) {
      container = document.createElement('div');
      container.id = 'notify-container';
      container.className = 'notify-container';
      container.setAttribute('aria-live', 'polite');
      document.body.appendChild(container);
    }
    return container;
  }

  function notify(message, type, duration) {
    var root = ensureContainer();
    var toast = document.createElement('div');
    toast.className = 'notify-toast notify-' + (type || 'info');
    toast.innerHTML =
      '<span class="notify-msg">' + escapeHtml(message) + '</span>' +
      '<button type="button" class="notify-close" aria-label="Fermer">×</button>';

    var close = function () {
      toast.classList.add('notify-out');
      setTimeout(function () {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 200);
    };

    toast.querySelector('.notify-close').addEventListener('click', close);
    root.appendChild(toast);

    setTimeout(close, duration || (type === 'error' ? 6000 : 4000));
    return close;
  }

  function escapeHtml(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function confirm(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'notify-confirm-overlay';
      overlay.innerHTML =
        '<div class="notify-confirm" role="alertdialog" aria-modal="true">' +
        '<p class="notify-confirm-msg">' + escapeHtml(message) + '</p>' +
        '<div class="notify-confirm-actions">' +
        '<button type="button" class="btn btn-secondary" data-action="no">' +
        (options.cancelLabel || 'Annuler') +
        '</button>' +
        '<button type="button" class="btn ' + (options.danger ? 'btn-danger' : '') + '" data-action="yes">' +
        (options.confirmLabel || 'Confirmer') +
        '</button></div></div>';

      function done(value) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }

      overlay.querySelector('[data-action="no"]').addEventListener('click', function () {
        done(false);
      });
      overlay.querySelector('[data-action="yes"]').addEventListener('click', function () {
        done(true);
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) done(false);
      });

      document.body.appendChild(overlay);
      overlay.querySelector('[data-action="yes"]').focus();
    });
  }

  function corruptFileDialog(message, parseError) {
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'notify-confirm-overlay';
      var detail = parseError
        ? '<p class="notify-confirm-detail">Détail : ' + escapeHtml(parseError) + '</p>'
        : '';
      overlay.innerHTML =
        '<div class="notify-confirm notify-confirm-wide" role="alertdialog" aria-modal="true">' +
        '<p class="notify-confirm-msg">' + escapeHtml(message) + '</p>' +
        detail +
        '<ol class="corrupt-file-steps">' +
        '<li>Téléchargez une copie du fichier corrompu (secours)</li>' +
        '<li>Réinitialisez pour recréer un fichier vide</li>' +
        '</ol>' +
        '<div class="notify-confirm-actions notify-confirm-actions-stack">' +
        '<button type="button" class="btn btn-secondary" data-action="download">Télécharger le fichier corrompu</button>' +
        '<button type="button" class="btn btn-danger" data-action="reset">Réinitialiser et recréer le fichier</button>' +
        '<button type="button" class="btn btn-secondary" data-action="cancel">Continuer sans réinitialiser</button>' +
        '</div></div>';

      function done(value) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }

      overlay.querySelector('[data-action="download"]').addEventListener('click', function () {
        done('download');
      });
      overlay.querySelector('[data-action="reset"]').addEventListener('click', function () {
        done('reset');
      });
      overlay.querySelector('[data-action="cancel"]').addEventListener('click', function () {
        done('cancel');
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) done('cancel');
      });

      document.body.appendChild(overlay);
      overlay.querySelector('[data-action="download"]').focus();
    });
  }

  function prompt(message, options) {
    options = options || {};
    return new Promise(function (resolve) {
      var overlay = document.createElement('div');
      overlay.className = 'notify-confirm-overlay';
      overlay.innerHTML =
        '<div class="notify-confirm" role="dialog" aria-modal="true">' +
        '<p class="notify-confirm-msg">' + escapeHtml(message) + '</p>' +
        '<div class="form-row" style="margin:0.75rem 0">' +
        '<input type="text" class="notify-prompt-input" value="' +
        escapeHtml(options.defaultValue || '') +
        '" placeholder="' +
        escapeHtml(options.placeholder || '') +
        '"></div>' +
        '<div class="notify-confirm-actions">' +
        '<button type="button" class="btn btn-secondary" data-action="no">' +
        (options.cancelLabel || 'Annuler') +
        '</button>' +
        '<button type="button" class="btn" data-action="yes">' +
        (options.confirmLabel || 'OK') +
        '</button></div></div>';

      var input = overlay.querySelector('.notify-prompt-input');

      function done(value) {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(value);
      }

      overlay.querySelector('[data-action="no"]').addEventListener('click', function () {
        done(null);
      });
      overlay.querySelector('[data-action="yes"]').addEventListener('click', function () {
        var val = input ? String(input.value || '').trim() : '';
        done(val || null);
      });
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) done(null);
      });
      if (input) {
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            done(String(input.value || '').trim() || null);
          }
        });
      }

      document.body.appendChild(overlay);
      if (input) {
        input.focus();
        input.select();
      }
    });
  }

  global.LoyerNotify = {
    info: function (msg) {
      return notify(msg, 'info');
    },
    success: function (msg) {
      return notify(msg, 'success');
    },
    error: function (msg) {
      return notify(msg, 'error');
    },
    warn: function (msg) {
      return notify(msg, 'warn');
    },
    confirm: confirm,
    prompt: prompt,
    corruptFileDialog: corruptFileDialog
  };
})(window);
