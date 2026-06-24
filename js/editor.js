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

  /** Définit set toolbar labels. */
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

  /** Paragraphe Quill vide (espacement manuel). */
  function isEmptyParagraph(el) {
    if (!el || el.tagName !== 'P') return false;
    var html = String(el.innerHTML || '')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/&nbsp;/gi, '')
      .trim();
    return !html;
  }

  /** Supprime les paragraphes vides (export Word uniquement). */
  function removeEmptySpacerParagraphs(root) {
    if (!root) return;
    root.querySelectorAll('p').forEach(function (p) {
      if (isEmptyParagraph(p) && p.parentNode) p.parentNode.removeChild(p);
    });
  }

  /** Espacement vertical du corps de quittance (aperçu + PDF). */
  function applyQuittanceBodySpacing(root) {
    if (!root) return;

    root.querySelectorAll('.quittance-header').forEach(function (header) {
      header.style.marginBottom = '1.5rem';
    });

    root.querySelectorAll('h2, .quittance-title').forEach(function (h) {
      if (h.closest('.quittance-party')) return;
      h.style.margin = '1.25rem 0 0.75rem';
    });

    root.querySelectorAll('h4').forEach(function (h) {
      if (h.closest('.quittance-party')) return;
      h.style.margin = '1rem 0 0.5rem';
    });

    root.querySelectorAll('p').forEach(function (p) {
      if (p.closest('.quittance-party') || p.closest('.quittance-footer')) return;
      p.style.margin = '0.65rem 0';
      p.style.lineHeight = '1.5';
    });

    root.querySelectorAll('.quittance-legal').forEach(function (p) {
      p.style.marginTop = '1rem';
    });

    root.querySelectorAll('.quittance-breakdown, .quittance-solde').forEach(function (p) {
      p.style.margin = '0.65rem 0';
    });

    root.querySelectorAll('.quittance-payments').forEach(function (block) {
      block.style.margin = '0.75rem 0';
    });

    root.querySelectorAll('.ql-align-right').forEach(function (el) {
      if (el.closest('.quittance-party')) return;
      el.style.marginTop = '1.25rem';
    });
  }

  /** Libellé h3 BAILLEUR / LOCATAIRE normalisé. */
  function headerLabel(el) {
    return String(el && el.textContent ? el.textContent : '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /** Compacte marges dans une cellule d'en-tête. */
  function tightenPartyCell(td) {
    if (!td) return;
    td.querySelectorAll('h3').forEach(function (h) {
      h.style.margin = '0 0 0.35rem';
      h.style.fontSize = '0.85rem';
      h.style.letterSpacing = '0.05em';
    });
    td.querySelectorAll('p').forEach(function (p) {
      p.style.margin = '0 0 0.15rem';
    });
  }

  /** Styles communs table en-tête (compatible Word). */
  function styleHeaderTable(table, compactForDocx) {
    table.className = 'quittance-header';
    table.setAttribute('width', '100%');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = 'none';
    table.style.marginBottom = compactForDocx ? '1rem' : '1.5rem';
  }

  /** Convertit div flex en table 2 colonnes. */
  function convertHeaderToTable(headerEl, compactForDocx) {
    if (!headerEl || headerEl.tagName === 'TABLE') return;

    var bailleur = headerEl.querySelector('.quittance-party-bailleur') || headerEl.children[0];
    var locataire = headerEl.querySelector('.quittance-party-locataire') || headerEl.children[1];
    if (!bailleur || !locataire || !headerEl.parentNode) return;

    var table = document.createElement('table');
    styleHeaderTable(table, compactForDocx);
    var tr = document.createElement('tr');

    var tdLeft = document.createElement('td');
    tdLeft.className = 'quittance-party quittance-party-bailleur';
    tdLeft.style.cssText = 'width:50%;vertical-align:top;text-align:left;border:none;padding:0;';
    while (bailleur.firstChild) tdLeft.appendChild(bailleur.firstChild);

    var tdRight = document.createElement('td');
    tdRight.className = 'quittance-party quittance-party-locataire';
    tdRight.style.cssText = 'width:50%;vertical-align:top;text-align:right;border:none;padding:0;';
    while (locataire.firstChild) tdRight.appendChild(locataire.firstChild);

    tr.appendChild(tdLeft);
    tr.appendChild(tdRight);
    table.appendChild(tr);
    headerEl.parentNode.replaceChild(table, headerEl);
    tightenPartyCell(tdLeft);
    tightenPartyCell(tdRight);
  }

  /** Reconstruit l'en-tête Quill plat (h3 BAILLEUR puis h3 LOCATAIRE). */
  function normalizeFlatHeader(container, compactForDocx) {
    if (!container || container.querySelector('.quittance-header')) return;

    var children = Array.prototype.slice.call(container.children);
    var bailleurIdx = -1;
    var locataireIdx = -1;
    var i;

    for (i = 0; i < children.length; i++) {
      if (children[i].tagName !== 'H3') continue;
      var label = headerLabel(children[i]);
      if (label.indexOf('BAILLEUR') !== -1) bailleurIdx = i;
      if (label.indexOf('LOCATAIRE') !== -1) locataireIdx = i;
    }
    if (bailleurIdx === -1 || locataireIdx === -1 || locataireIdx <= bailleurIdx) return;

    var bailleurNodes = [];
    var locataireNodes = [];
    for (i = bailleurIdx; i < locataireIdx; i++) {
      if (!compactForDocx || !isEmptyParagraph(children[i])) bailleurNodes.push(children[i]);
    }
    for (i = locataireIdx; i < children.length; i++) {
      if (children[i].tagName === 'H1' || children[i].tagName === 'H2') break;
      if (!compactForDocx || !isEmptyParagraph(children[i])) locataireNodes.push(children[i]);
    }
    if (!bailleurNodes.length || !locataireNodes.length) return;

    var marker = document.createComment('quittance-header');
    container.insertBefore(marker, bailleurNodes[0]);

    var table = document.createElement('table');
    styleHeaderTable(table, compactForDocx);
    var tr = document.createElement('tr');

    var tdLeft = document.createElement('td');
    tdLeft.className = 'quittance-party quittance-party-bailleur';
    tdLeft.style.cssText = 'width:50%;vertical-align:top;text-align:left;border:none;padding:0;';
    bailleurNodes.forEach(function (node) {
      tdLeft.appendChild(node);
    });

    var tdRight = document.createElement('td');
    tdRight.className = 'quittance-party quittance-party-locataire';
    tdRight.style.cssText = 'width:50%;vertical-align:top;text-align:right;border:none;padding:0;';
    locataireNodes.forEach(function (node) {
      tdRight.appendChild(node);
    });

    tr.appendChild(tdLeft);
    tr.appendChild(tdRight);
    table.appendChild(tr);
    container.insertBefore(table, marker);
    container.removeChild(marker);
    tightenPartyCell(tdLeft);
    tightenPartyCell(tdRight);
  }

  /** Normalise en-tête quittance (table ; compactage optionnel pour Word). */
  function normalizeQuittanceDocument(root, compactForDocx) {
    if (!root) return;
    if (compactForDocx) removeEmptySpacerParagraphs(root);

    root.querySelectorAll('.quittance-header').forEach(function (header) {
      convertHeaderToTable(header, compactForDocx);
    });

    root.querySelectorAll('.quittance-doc').forEach(function (doc) {
      if (!doc.querySelector('.quittance-header')) normalizeFlatHeader(doc, compactForDocx);
    });
    if (!root.querySelector('.quittance-header')) normalizeFlatHeader(root, compactForDocx);

    root.querySelectorAll('.ql-align-right').forEach(function (el) {
      el.style.textAlign = 'right';
    });
  }

  /** Prépare HTML string pour export Word (compact). */
  function prepareHtmlForExport(html) {
    var host = document.createElement('div');
    host.innerHTML = html || '';
    applyQuittanceLayout(host, { compactForDocx: true });
    return host.innerHTML;
  }

  /** apply quittance layout. */
  function applyQuittanceLayout(root, options) {
    if (!root) return;
    options = options || {};
    var compactForDocx = !!options.compactForDocx;

    normalizeQuittanceDocument(root, compactForDocx);

    var calc = global.LoyerCalc || {};
    var sigW = calc.SIGNATURE_IMG_WIDTH || 250;

    root.querySelectorAll('.quittance-header').forEach(function (header) {
      if (header.tagName === 'TABLE') {
        styleHeaderTable(header, compactForDocx);
        return;
      }
      convertHeaderToTable(header, compactForDocx);
    });

    root.querySelectorAll('.quittance-footer').forEach(function (footerEl) {
      footerEl.style.marginTop = compactForDocx ? '1.5rem' : '2rem';
      footerEl.style.textAlign = 'right';
    });

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

    if (!compactForDocx) applyQuittanceBodySpacing(root);
  }

  /** Crée create editor. */
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

    var toolbarModules = options.toolbar === false ? false : (options.toolbar || DEFAULT_TOOLBAR);
    var quill = new Quill('#' + containerId, {
      theme: 'snow',
      modules: {
        toolbar: toolbarModules
      },
      placeholder: options.placeholder || 'Contenu…'
    });

    if (options.readOnly) quill.enable(false);
    if (toolbarModules !== false) setToolbarLabels(el);

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

  /** Retourne instance Quill associée à un conteneur. */
  function getEditor(id) {
    return instances[id] || null;
  }

  /** Initialise init. */
  function init() {
    createEditor({
      id: 'quittance-preview',
      containerId: 'quittance-editor',
      layout: 'quittance',
      placeholder: 'Contenu de la quittance…',
      toolbar: false,
      readOnly: true
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
      placeholder: 'Aperçu du mail…',
      toolbar: false,
      readOnly: true
    });
    return instances['quittance-preview'];
  }

  global.LoyerEditor = {
    create: createEditor,
    get: getEditor,
    init: init,
    applyQuittanceLayout: applyQuittanceLayout,
    prepareHtmlForExport: prepareHtmlForExport,
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
