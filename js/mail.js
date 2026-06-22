/**
 * Préparation mail : EML multipart HTML + PDF, mailto, téléchargement PDF.
 */
(function (global) {
  'use strict';

  function blobToBase64(blob) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onloadend = function () {
        var parts = reader.result.split(',');
        resolve(parts.length > 1 ? parts[1] : parts[0]);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  function splitRecipients(recipients) {
    var to = [];
    var cc = [];
    var bcc = [];
    (recipients || []).forEach(function (r) {
      if (!r.email) return;
      if (r.type === 'cc') cc.push(r.email);
      else if (r.type === 'bcc') bcc.push(r.email);
      else to.push(r.email);
    });
    return { to: to, cc: cc, bcc: bcc };
  }

  function buildMailContent(data, year, month, mailId) {
    return global.LoyerTemplates.loadFilledMail(data, year, month, mailId).then(function (filled) {
      var settings = data.settings || data;
      var plain = global.LoyerTemplates.htmlToPlainText(filled.bodyHtml);
      return {
        subject: filled.subject,
        bodyHtml: filled.bodyHtml,
        body: plain,
        recipients: splitRecipients(settings.mail.recipients)
      };
    });
  }

  function generateEml(mailContent, pdfBase64, pdfFilename) {
    var boundary = '----=_LoyerManager_' + Date.now();
    var altBoundary = boundary + '_alt';

    var lines = [];
    lines.push('To: ' + mailContent.recipients.to.join(', '));
    if (mailContent.recipients.cc.length) {
      lines.push('Cc: ' + mailContent.recipients.cc.join(', '));
    }
    if (mailContent.recipients.bcc.length) {
      lines.push('Bcc: ' + mailContent.recipients.bcc.join(', '));
    }
    lines.push('Subject: ' + mailContent.subject);
    lines.push('MIME-Version: 1.0');
    lines.push('Content-Type: multipart/mixed; boundary="' + boundary + '"');
    lines.push('');
    lines.push('--' + boundary);
    lines.push('Content-Type: multipart/alternative; boundary="' + altBoundary + '"');
    lines.push('');
    lines.push('--' + altBoundary);
    lines.push('Content-Type: text/plain; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(mailContent.body);
    lines.push('');
    lines.push('--' + altBoundary);
    lines.push('Content-Type: text/html; charset=UTF-8');
    lines.push('Content-Transfer-Encoding: 8bit');
    lines.push('');
    lines.push(mailContent.bodyHtml);
    lines.push('');
    lines.push('--' + altBoundary + '--');
    lines.push('--' + boundary);
    lines.push('Content-Type: application/pdf; name="' + pdfFilename + '"');
    lines.push('Content-Transfer-Encoding: base64');
    lines.push('Content-Disposition: attachment; filename="' + pdfFilename + '"');
    lines.push('');
    for (var i = 0; i < pdfBase64.length; i += 76) {
      lines.push(pdfBase64.slice(i, i + 76));
    }
    lines.push('--' + boundary + '--');

    return lines.join('\r\n');
  }

  function downloadEml(content, filename) {
    var blob = new Blob([content], { type: 'message/rfc822' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function openMailto(mailContent) {
    var to = mailContent.recipients.to.join(',');
    var cc = mailContent.recipients.cc.join(',');
    var bcc = mailContent.recipients.bcc.join(',');
    var params = [];
    if (cc) params.push('cc=' + encodeURIComponent(cc));
    if (bcc) params.push('bcc=' + encodeURIComponent(bcc));
    params.push('subject=' + encodeURIComponent(mailContent.subject));
    params.push('body=' + encodeURIComponent(mailContent.body));
    window.location.href = 'mailto:' + encodeURIComponent(to) + '?' + params.join('&');
  }

  function prepareMail(mode, data, year, month, quittanceContainer, mailId) {
    return buildMailContent(data, year, month, mailId).then(function (mailContent) {
      var filename = global.LoyerQuittance.getFilename(year, month);

      if (mode === 'mailto') {
        openMailto(mailContent);
        return global.LoyerExport.exportPdf(quittanceContainer, filename).then(function () {
          if (global.LoyerNotify) {
            global.LoyerNotify.info('PDF téléchargé — attachez-le manuellement au mail.');
          }
        });
      }

      if (mode === 'pdf') {
        return global.LoyerExport.exportPdf(quittanceContainer, filename);
      }

      return global.LoyerExport.getPdfBlob(quittanceContainer)
        .then(function (pdfBlob) {
          return blobToBase64(pdfBlob);
        })
        .then(function (pdfBase64) {
          var eml = generateEml(mailContent, pdfBase64, filename + '.pdf');
          downloadEml(eml, 'Quittance_' + year + '-' + String(month).padStart(2, '0') + '.eml');
          if (global.LoyerNotify) global.LoyerNotify.success('Fichier EML généré.');
        });
    });
  }

  global.LoyerMail = {
    buildMailContent: buildMailContent,
    prepareMail: prepareMail,
    openMailto: openMailto
  };
})(window);
