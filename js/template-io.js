/**
 * Export / import de fichiers modèles (hors serveur).
 */
(function (global) {
  'use strict';

  function templateNameFromFilename(filename) {
    var name = String(filename || '').replace(/^.*[\\/]/, '');
    name = name.replace(/\.[^.]+$/, '');
    name = name.replace(/-(quittance|mail)$/i, '');
    return name.trim() || 'Modèle importé';
  }

  function sanitizeFilename(name) {
    return String(name || 'modele')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'modele';
  }

  function downloadText(content, filename, mime) {
    var blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportQuittanceTemplate(displayName, html) {
    downloadText(html || '', sanitizeFilename(displayName) + '-quittance.html', 'text/html;charset=utf-8');
  }

  function exportMailTemplate(displayName, subject, body) {
    var payload = JSON.stringify(
      {
        type: 'mail',
        version: 1,
        subject: subject || '',
        body: body || ''
      },
      null,
      2
    );
    downloadText(payload, sanitizeFilename(displayName) + '-mail.json', 'application/json;charset=utf-8');
  }

  function parseQuittanceImport(text) {
    return { body: text || '', subject: null };
  }

  function parseMailImport(text, filename) {
    var trimmed = String(text || '').trim();
    var lower = String(filename || '').toLowerCase();
    if (lower.endsWith('.json') || trimmed.charAt(0) === '{') {
      var data = JSON.parse(trimmed);
      if (!data || typeof data !== 'object') {
        throw new Error('Fichier mail invalide.');
      }
      return {
        body: String(data.body || ''),
        subject: data.subject != null ? String(data.subject) : null
      };
    }
    return { body: text || '', subject: null };
  }

  function readTemplateFile(type, file) {
    return new Promise(function (resolve, reject) {
      if (!file) {
        reject(new Error('Aucun fichier sélectionné.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        try {
          var text = String(reader.result || '');
          if (type === 'quittance') {
            resolve(parseQuittanceImport(text));
            return;
          }
          resolve(parseMailImport(text, file.name));
        } catch (e) {
          reject(new Error('Fichier illisible ou format invalide.'));
        }
      };
      reader.onerror = function () {
        reject(new Error('Impossible de lire le fichier.'));
      };
      reader.readAsText(file);
    });
  }

  global.LoyerTemplateIo = {
    exportQuittanceTemplate: exportQuittanceTemplate,
    exportMailTemplate: exportMailTemplate,
    readTemplateFile: readTemplateFile,
    templateNameFromFilename: templateNameFromFilename
  };
})(window);
