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

  /** Espacement vertical du corps de quittance — géré par styles-quittance.css. */
  function applyQuittanceBodySpacing(root) {
    /* Conservé pour compatibilité ; ne plus injecter de marges inline. */
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
    td.querySelectorAll('.quittance-party-label, h3').forEach(function (label) {
      label.style.margin = '0 0 0.08rem';
      label.style.padding = '0';
      label.style.fontSize = '0.72rem';
      label.style.lineHeight = '1.1';
      label.style.letterSpacing = '0.06em';
      label.style.textTransform = 'uppercase';
    });
    td.querySelectorAll('.quittance-party-lines').forEach(function (block) {
      block.style.margin = '0';
      block.style.padding = '0';
      block.style.lineHeight = '1.15';
    });
    td.querySelectorAll('p:not(.quittance-party-label):not(.quittance-party-lines)').forEach(function (p) {
      p.style.margin = '0';
      p.style.padding = '0';
      p.style.lineHeight = '1.15';
    });
  }

  /** Styles communs table en-tête (compatible Word). */
  function styleHeaderTable(table, compactForDocx) {
    table.className = 'quittance-header';
    table.setAttribute('width', '100%');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.border = 'none';
    table.style.marginBottom = '0.65rem';
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
    var sigW = compactForDocx ? 180 : (calc.SIGNATURE_IMG_WIDTH || 180);

    root.querySelectorAll('.quittance-header').forEach(function (header) {
      if (header.tagName === 'TABLE') {
        styleHeaderTable(header, compactForDocx);
        header.querySelectorAll('.quittance-party').forEach(tightenPartyCell);
        return;
      }
      convertHeaderToTable(header, compactForDocx);
    });

    root.querySelectorAll('.quittance-footer').forEach(function (footerEl) {
      footerEl.style.marginTop = '0.65rem';
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

  /** Affiche ou masque le placeholder Quill selon le HTML injecté. */
  function syncEditorBlankState(quill, html) {
    if (!quill || !quill.root) return;
    var hasContent = !!(html && String(html).replace(/<[^>]+>/g, '').replace(/\s|&nbsp;/g, ''));
    quill.root.classList.toggle('ql-blank', !hasContent);
  }

  /** Placeholder pour surface HTML sans Quill. */
  function syncPlainBlankState(surface, html, placeholder) {
    if (!surface) return;
    var hasContent = !!(html && String(html).replace(/<[^>]+>/g, '').replace(/\s|&nbsp;/g, ''));
    surface.classList.toggle('ql-blank', !hasContent);
    if (placeholder) surface.dataset.placeholder = placeholder;
  }

  /** Exécute une commande de mise en forme sur une surface contenteditable. */
  function execHtmlCommand(surface, command, value) {
    if (!surface) return;
    surface.focus();
    try {
      document.execCommand(command, false, value == null ? null : value);
    } catch (e) {
      /* ignore */
    }
  }

  /** Mémorise la sélection dans une surface contenteditable (barre d'outils). */
  function bindPlainHtmlSelection(surface) {
    var savedRange = null;

    function save() {
      var sel = window.getSelection();
      if (!sel || sel.rangeCount === 0) return;
      var range = sel.getRangeAt(0);
      if (!surface.contains(range.commonAncestorContainer)) return;
      savedRange = range.cloneRange();
    }

    function restore() {
      if (!savedRange) return;
      var sel = window.getSelection();
      if (!sel) return;
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }

    ['keyup', 'mouseup', 'focus'].forEach(function (evt) {
      surface.addEventListener(evt, save);
    });

    return {
      focus: function () {
        surface.focus();
        restore();
      }
    };
  }

  /** Handlers Quill → execCommand pour éditeur HTML pur (même barre que le mail). */
  function createPlainHtmlToolbarHandlers(surface, selection) {
    function focusSurface() {
      selection.focus();
    }

    function headerTag(value) {
      if (value === false || value === 'false' || value == null) return 'p';
      if (value === 1 || value === '1') return 'h1';
      if (value === 2 || value === '2') return 'h2';
      if (value === 3 || value === '3') return 'h3';
      return 'p';
    }

    return {
      bold: function () {
        focusSurface();
        execHtmlCommand(surface, 'bold');
      },
      italic: function () {
        focusSurface();
        execHtmlCommand(surface, 'italic');
      },
      underline: function () {
        focusSurface();
        execHtmlCommand(surface, 'underline');
      },
      strike: function () {
        focusSurface();
        execHtmlCommand(surface, 'strikeThrough');
      },
      header: function (value) {
        focusSurface();
        execHtmlCommand(surface, 'formatBlock', headerTag(value));
      },
      list: function (value) {
        focusSurface();
        execHtmlCommand(surface, value === 'ordered' ? 'insertOrderedList' : 'insertUnorderedList');
      },
      indent: function (value) {
        focusSurface();
        execHtmlCommand(surface, value === '+1' ? 'indent' : 'outdent');
      },
      align: function (value) {
        focusSurface();
        var map = {
          '': 'justifyLeft',
          left: 'justifyLeft',
          center: 'justifyCenter',
          right: 'justifyRight',
          justify: 'justifyFull'
        };
        execHtmlCommand(surface, map[value] || 'justifyLeft');
      },
      color: function (value) {
        focusSurface();
        execHtmlCommand(surface, 'foreColor', value);
      },
      background: function (value) {
        focusSurface();
        execHtmlCommand(surface, 'hiliteColor', value);
      },
      blockquote: function () {
        focusSurface();
        execHtmlCommand(surface, 'formatBlock', 'blockquote');
      },
      link: function (value) {
        focusSurface();
        if (value) {
          execHtmlCommand(surface, 'createLink', value);
          return;
        }
        var sel = window.getSelection();
        var preview = sel && sel.toString ? sel.toString() : '';
        var url = global.prompt('URL du lien', preview ? '' : 'https://');
        if (url) execHtmlCommand(surface, 'createLink', url);
      },
      clean: function () {
        focusSurface();
        execHtmlCommand(surface, 'removeFormat');
      }
    };
  }

  /** Barre Quill Snow identique au mail, branchée sur une surface HTML pure. */
  function mountPlainHtmlQuillToolbar(host, surface, toolbarConfig) {
    if (typeof Quill === 'undefined') return null;

    var ghostHost = document.createElement('div');
    ghostHost.className = 'plain-html-toolbar-ghost';
    ghostHost.setAttribute('aria-hidden', 'true');
    host.appendChild(ghostHost);

    var selection = bindPlainHtmlSelection(surface);
    var ghostQuill = new Quill(ghostHost, {
      theme: 'snow',
      modules: {
        toolbar: {
          container: toolbarConfig,
          handlers: createPlainHtmlToolbarHandlers(surface, selection)
        }
      }
    });

    return ghostQuill;
  }

  /** Éditeur HTML pur (sans Quill) — tables/div quittance non supportées par Quill. */
  function createPlainHtmlEditor(options) {
    var id = options.id;
    var containerId = options.containerId || id;
    var host = document.getElementById(containerId);
    if (!host) return null;

    host.classList.add('is-plain-html');
    host.innerHTML = '';
    var surface = document.createElement('div');
    surface.className = 'ql-editor quittance-html-root';

    var toolbarConfig = options.toolbar === false ? false : (options.toolbar || DEFAULT_TOOLBAR);
    if (toolbarConfig !== false && !options.readOnly) {
      mountPlainHtmlQuillToolbar(host, surface, toolbarConfig);
      setToolbarLabels(host);
    }
    host.appendChild(surface);

    if (options.readOnly) {
      surface.contentEditable = 'false';
    } else if (options.contentEditable !== false) {
      surface.contentEditable = 'true';
    }

    var editor = {
      id: id,
      quill: null,
      root: surface,
      layout: options.layout || null,
      setHtml: function (html) {
        surface.innerHTML = html || '';
        if (editor.layout === 'quittance') applyQuittanceLayout(surface);
        syncPlainBlankState(surface, html, options.placeholder);
      },
      getHtml: function () {
        return surface.innerHTML;
      },
      getExportElement: function () {
        return surface;
      },
      focus: function () {
        surface.focus();
      },
      insertText: function (text) {
        editor.focus();
        if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
          document.execCommand('insertText', false, text);
          return;
        }
        surface.innerHTML += text;
      }
    };

    syncPlainBlankState(surface, '', options.placeholder);
    instances[id] = editor;
    return editor;
  }

  /** Crée create editor. */
  function createEditor(options) {
    options = options || {};
    var id = options.id;
    if (!id) throw new Error('LoyerEditor.create : id requis');

    if (instances[id]) return instances[id];

    if (options.plainHtml) {
      return createPlainHtmlEditor(options);
    }

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
        syncEditorBlankState(quill, html);
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
      plainHtml: true,
      placeholder: 'Contenu de la quittance…',
      readOnly: true
    });
    createEditor({
      id: 'template-quittance',
      containerId: 'template-quittance-editor',
      layout: 'quittance',
      plainHtml: true,
      contentEditable: true,
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
