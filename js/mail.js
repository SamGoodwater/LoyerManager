/**
 * Préparation mail : EML multipart HTML + PDF, mailto, téléchargement PDF.
 */
(function (global) {
  'use strict';

  /** Convertit Blob PDF en chaîne base64 pour EML. */
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

  /** Sépare destinataires to/cc/bcc depuis settings. */
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

  /** Objet + corps HTML mail avec mots-clés remplacés. */
  function buildMailContent(data, year, month, mailId, periodCtx) {
    return global.LoyerTemplates.loadFilledMail(data, year, month, mailId, periodCtx).then(function (filled) {
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

  /** Construit fichier .eml MIME multipart (HTML + PDF). */
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

  /** Télécharge le .eml généré. */
  function downloadEml(content, filename) {
    var blob = new Blob([content], { type: 'message/rfc822' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** Ouvre client mail (sans PJ) ; copie corps si possible. */
  function openMailto(mailContent) {
    var to = mailContent.recipients.to.join(',');
    var cc = mailContent.recipients.cc.join(',');
    var bcc = mailContent.recipients.bcc.join(',');
    var params = [];
    if (cc) params.push('cc=' + encodeURIComponent(cc));
    if (bcc) params.push('bcc=' + encodeURIComponent(bcc));
    params.push('subject=' + encodeURIComponent(mailContent.subject));
    params.push('body=' + encodeURIComponent(mailContent.body));

    function launchMailto() {
      window.location.href = 'mailto:' + encodeURIComponent(to) + '?' + params.join('&');
    }

    var html = mailContent.bodyHtml || '';
    var plain = mailContent.body || '';
    var copiedRich = false;

    function afterCopy() {
      launchMailto();
      if (global.LoyerNotify && copiedRich) {
        global.LoyerNotify.info(
          'Corps HTML copié — collez (Ctrl+V) dans le mail pour la mise en forme.'
        );
      }
    }

    if (navigator.clipboard && html && window.ClipboardItem) {
      navigator.clipboard
        .write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([plain], { type: 'text/plain' })
          })
        ])
        .then(function () {
          copiedRich = true;
          afterCopy();
        })
        .catch(function () {
          if (navigator.clipboard.writeText) {
            return navigator.clipboard.writeText(plain).then(afterCopy);
          }
          afterCopy();
        });
      return;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(plain).then(afterCopy).catch(afterCopy);
      return;
    }

    afterCopy();
  }

  /** Orchestre envoi API, brouillon, EML ou mailto + PDF. */
  function prepareMail(mode, data, year, month, quittanceContainer, mailId, periodCtx, quittanceTemplateId) {
    periodCtx =
      periodCtx ||
      {
        isRange: false,
        fromYear: year,
        fromMonth: month,
        toYear: year,
        toMonth: month
      };

    function singleFilename() {
      return global.LoyerQuittance.getFilename(year, month);
    }

    function batchFilename() {
      return global.LoyerQuittance.getBatchFilename(
        global.LoyerCalc.monthKey(periodCtx.fromYear, periodCtx.fromMonth),
        global.LoyerCalc.monthKey(periodCtx.toYear, periodCtx.toMonth)
      );
    }

    function periodMeta() {
      if (!periodCtx.isRange) {
        return {
          fromKey: global.LoyerCalc.monthKey(year, month),
          toKey: global.LoyerCalc.monthKey(year, month),
          monthCount: 1
        };
      }
      return {
        fromKey: global.LoyerCalc.monthKey(periodCtx.fromYear, periodCtx.fromMonth),
        toKey: global.LoyerCalc.monthKey(periodCtx.toYear, periodCtx.toMonth),
        monthCount: global.LoyerCalc.listMonthsInRange(
          periodCtx.fromYear,
          periodCtx.fromMonth,
          periodCtx.toYear,
          periodCtx.toMonth,
          data
        ).length
      };
    }

    var qId =
      quittanceTemplateId ||
      (global.LoyerTemplates
        ? global.LoyerTemplates.resolveDefaultId('quittance', data.settings)
        : 'complet');

    function exportRangePdf() {
      return global.LoyerQuittance.exportBatch(
        data,
        periodCtx.fromYear,
        periodCtx.fromMonth,
        periodCtx.toYear,
        periodCtx.toMonth,
        qId,
        'pdf'
      );
    }

    function getRangePdfBlobPack() {
      return global.LoyerQuittance.getPeriodPdfBlob(
        data,
        periodCtx.fromYear,
        periodCtx.fromMonth,
        periodCtx.toYear,
        periodCtx.toMonth,
        qId
      ).then(function (blob) {
        var fn = batchFilename();
        return { blob: blob, filename: fn, emlBase: fn };
      });
    }

    function getPdfPack() {
      return periodCtx.isRange
        ? getRangePdfBlobPack()
        : global.LoyerExport.getPdfBlob(quittanceContainer).then(function (blob) {
            var fn = singleFilename();
            return { blob: blob, filename: fn, emlBase: fn };
          });
    }

    return buildMailContent(data, year, month, mailId, periodCtx).then(function (mailContent) {
      if (mode === 'send' || mode === 'draft') {
        if (!global.LoyerServerApi || !global.LoyerServerApi.isActive()) {
          return Promise.reject(new Error('Envoi direct indisponible.'));
        }
        return getPdfPack().then(function (pack) {
          return blobToBase64(pack.blob).then(function (pdfBase64) {
            var mailPayload = {
              subject: mailContent.subject,
              bodyHtml: mailContent.bodyHtml,
              recipients: mailContent.recipients,
              pdfBase64: pdfBase64,
              pdfFilename: pack.filename + '.pdf',
              periodMeta: periodMeta()
            };
            if (mode === 'draft') {
              return global.LoyerServerApi.saveMailDraft(mailPayload);
            }
            return global.LoyerServerApi.sendMail(mailPayload);
          });
        }).then(function (result) {
          if (global.LoyerNotify) {
            if (mode === 'draft') {
              global.LoyerNotify.success(
                'Brouillon enregistré dans ' +
                  (result.provider === 'google' ? 'Gmail' : result.provider === 'microsoft' ? 'Outlook' : 'votre boîte mail') +
                  ' — ouvrez votre messagerie pour relire et envoyer.'
              );
            } else {
              global.LoyerNotify.success('Mail envoyé depuis ' + (result.from || 'votre compte') + '.');
            }
          }
          if (global.LoyerActivityLog && global.LoyerActivityLog.loadAndRender) {
            global.LoyerActivityLog.loadAndRender();
          }
        });
      }

      if (mode === 'mailto') {
        openMailto(mailContent);
        var dl = periodCtx.isRange
          ? exportRangePdf()
          : global.LoyerExport.exportPdf(quittanceContainer, singleFilename());
        return dl.then(function () {
          if (global.LoyerNotify) {
            global.LoyerNotify.info(
              periodCtx.isRange
                ? 'PDF multi-quittances téléchargé — attachez-le manuellement au mail.'
                : 'PDF téléchargé — attachez-le manuellement au mail.'
            );
          }
        });
      }

      if (mode === 'pdf') {
        if (periodCtx.isRange) {
          return exportRangePdf();
        }
        return global.LoyerExport.exportPdf(quittanceContainer, singleFilename());
      }

      return getPdfPack().then(function (pack) {
        return blobToBase64(pack.blob).then(function (pdfBase64) {
          var eml = generateEml(mailContent, pdfBase64, pack.filename + '.pdf');
          downloadEml(eml, pack.emlBase + '.eml');
          if (global.LoyerNotify) global.LoyerNotify.success('Fichier EML généré.');
        });
      });
    });
  }

  global.LoyerMail = {
    buildMailContent: buildMailContent,
    prepareMail: prepareMail,
    openMailto: openMailto
  };
})(window);
