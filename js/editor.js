/**
 * Éditeurs WYSIWYG Quill (fabrique multi-instances).
 */
(function (global) {
  'use strict';

  var DEFAULT_TOOLBAR = [
    [{ header: [1, 2, 3, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    [{ list: 'ordered' }, { list: 'bullet' }],
    [{ indent: '-1' }, { indent: '+1' }],
    ['blockquote', 'link'],
    ['clean']
  ];

  var instances = {};

  function setToolbarLabels(host) {
    var labels = {
      '.ql-bold': 'Gras',
      '.ql-italic': 'Italique',
      '.ql-underline': 'Souligné',
      '.ql-strike': 'Barré',
      '.ql-blockquote': 'Citation',
      '.ql-link': 'Lien',
      '.ql-clean': 'Effacer la mise en forme',
      '.ql-list[value="ordered"]': 'Liste numérotée',
      '.ql-list[value="bullet"]': 'Liste à puces',
      '.ql-indent[value="-1"]': 'Diminuer le retrait',
      '.ql-indent[value="+1"]': 'Augmenter le retrait',
      '.ql-align .ql-picker-label': 'Alignement',
      '.ql-color .ql-picker-label': 'Couleur du texte',
      '.ql-background .ql-picker-label': 'Surbrillance',
      '.ql-header .ql-picker-label': 'Titre'
    };
    Object.keys(labels).forEach(function (sel) {
      var btn = host.querySelector(sel);
      if (btn) btn.setAttribute('title', labels[sel]);
    });
  }

  function applyQuittanceLayout(root) {
    if (!root) return;

    var calc = global.LoyerCalc || {};
    var sigW = calc.SIGNATURE_IMG_WIDTH || 250;

    var header = root.querySelector('.quittance-header');
    if (header) {
      header.style.display = 'flex';
      header.style.flexDirection = 'row';
      header.style.justifyContent = 'space-between';
      header.style.alignItems = 'flex-start';
      header.style.gap = '2rem';
      header.style.width = '100%';
      header.style.marginBottom = '1.5rem';

      var bailleur = header.querySelector('.quittance-party-bailleur') || header.children[0];
      var locataire = header.querySelector('.quittance-party-locataire') || header.children[1];

      if (bailleur) {
        bailleur.style.flex = '1 1 45%';
        bailleur.style.minWidth = '180px';
        bailleur.style.textAlign = 'left';
      }
      if (locataire) {
        locataire.style.flex = '1 1 45%';
        locataire.style.minWidth = '180px';
        locataire.style.textAlign = 'right';
      }
    }

    var footer = root.querySelector('.quittance-footer');
    if (footer) {
      footer.style.marginTop = '2rem';
      footer.style.textAlign = 'right';
    }

    root.querySelectorAll('.quittance-footer > p').forEach(function (p) {
      p.style.margin = '0';
    });

    root.querySelectorAll('.quittance-signature-name, .quittance-signature').forEach(function (el) {
      el.style.textAlign = 'right';
      el.style.fontWeight = '600';
      el.style.marginTop = '0.75rem';
      el.style.marginBottom = '0';
    });

    root.querySelectorAll('.quittance-signature-wrap').forEach(function (wrap) {
      var img = wrap.querySelector('img');
      if (img && wrap.parentNode) {
        wrap.parentNode.insertBefore(img, wrap);
        wrap.parentNode.removeChild(wrap);
      }
    });

    root.querySelectorAll('.quittance-signature-img, .quittance-footer img').forEach(function (img) {
      img.style.width = sigW + 'px';
      img.style.height = 'auto';
      img.style.maxWidth = sigW + 'px';
      img.style.display = 'block';
      img.style.marginTop = '0.5rem';
      img.style.marginLeft = 'auto';
      img.style.objectFit = 'contain';
      img.setAttribute('width', String(sigW));
      img.removeAttribute('height');
    });
  }

  function createEditor(options) {
    options = options || {};
    var id = options.id;
    if (!id) throw new Error('LoyerEditor.create : id requis');

    if (instances[id]) return instances[id];

    if (typeof Quill === 'undefined') {
      console.warn('Quill non chargé — éditeur limité.');
      return null;
    }

    var containerId = options.containerId || id;
    var el = document.getElementById(containerId);
    if (!el) return null;

    var quill = new Quill('#' + containerId, {
      theme: 'snow',
      modules: {
        toolbar: options.toolbar || DEFAULT_TOOLBAR
      },
      placeholder: options.placeholder || 'Contenu…'
    });

    setToolbarLabels(el);

    var editor = {
      id: id,
      quill: quill,
      layout: options.layout || null,
      setHtml: function (html) {
        if (!quill) return;
        quill.setContents([], 'silent');
        quill.clipboard.dangerouslyPasteHTML(0, html || '', 'silent');
        if (editor.layout === 'quittance') applyQuittanceLayout(quill.root);
      },
      getHtml: function () {
        return quill ? quill.root.innerHTML : '';
      },
      getExportElement: function () {
        return quill ? quill.root : el;
      },
      focus: function () {
        if (quill) quill.focus();
      },
      insertText: function (text) {
        if (!quill) return;
        var range = quill.getSelection(true);
        var index = range ? range.index : quill.getLength();
        quill.insertText(index, text, 'user');
        quill.setSelection(index + text.length, 0);
      }
    };

    instances[id] = editor;
    return editor;
  }

  function getEditor(id) {
    return instances[id] || null;
  }

  function init() {
    createEditor({
      id: 'quittance-preview',
      containerId: 'quittance-editor',
      layout: 'quittance',
      placeholder: 'Contenu de la quittance…'
    });
    createEditor({
      id: 'template-quittance',
      containerId: 'template-quittance-editor',
      placeholder: 'Modèle quittance avec mots-clés {{…}}'
    });
    createEditor({
      id: 'template-mail',
      containerId: 'template-mail-editor',
      placeholder: 'Modèle mail avec mots-clés {{…}}'
    });
    createEditor({
      id: 'mail-preview',
      containerId: 'mail-preview-editor',
      placeholder: 'Aperçu du mail…'
    });
    return instances['quittance-preview'];
  }

  global.LoyerEditor = {
    create: createEditor,
    get: getEditor,
    init: init,
    applyQuittanceLayout: applyQuittanceLayout,
    setHtml: function (html) {
      var ed = getEditor('quittance-preview');
      if (ed) ed.setHtml(html);
    },
    getHtml: function () {
      var ed = getEditor('quittance-preview');
      return ed ? ed.getHtml() : '';
    },
    getExportElement: function () {
      var ed = getEditor('quittance-preview');
      return ed ? ed.getExportElement() : document.getElementById('quittance-editor');
    },
    focus: function () {
      var ed = getEditor('quittance-preview');
      if (ed) ed.focus();
    },
    getQuill: function () {
      var ed = getEditor('quittance-preview');
      return ed ? ed.quill : null;
    }
  };
})(window);
