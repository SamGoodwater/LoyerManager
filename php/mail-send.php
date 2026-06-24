<?php

/**
 * Envoi mail et brouillons via Gmail API, Graph API ou SMTP.
 */
declare(strict_types=1);

/** Construit message MIME multipart HTML + PDF base64. */
function loyerBuildMimeMessage(
    string $fromEmail,
    array $to,
    array $cc,
    array $bcc,
    string $subject,
    string $bodyHtml,
    string $pdfBinary,
    string $pdfFilename
): string
{
    $boundary = '=_Loyer_' . bin2hex(random_bytes(8));
    $lines = [];
    $lines[] = 'From: ' . $fromEmail;
    if ($to) {
        $lines[] = 'To: ' . implode(', ', $to);
    }
    if ($cc) {
        $lines[] = 'Cc: ' . implode(', ', $cc);
    }
    if ($bcc) {
        $lines[] = 'Bcc: ' . implode(', ', $bcc);
    }
    $lines[] = 'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=';
    $lines[] = 'MIME-Version: 1.0';
    $lines[] = 'Content-Type: multipart/mixed; boundary="' . $boundary . '"';
    $lines[] = '';
    $lines[] = '--' . $boundary;
    $lines[] = 'Content-Type: text/html; charset=UTF-8';
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = '';
    $lines[] = chunk_split(base64_encode($bodyHtml));
    $lines[] = '--' . $boundary;
    $lines[] = 'Content-Type: application/pdf; name="' . $pdfFilename . '"';
    $lines[] = 'Content-Transfer-Encoding: base64';
    $lines[] = 'Content-Disposition: attachment; filename="' . $pdfFilename . '"';
    $lines[] = '';
    $lines[] = chunk_split(base64_encode($pdfBinary));
    $lines[] = '--' . $boundary . '--';
    return implode("\r\n", $lines);
}

/** Valide et normalise payload send-mail / draft. */
function loyerParseMailPayload(array $payload): array
{
    $subject = trim((string) ($payload['subject'] ?? ''));
    $bodyHtml = (string) ($payload['bodyHtml'] ?? '');
    $pdfBase64 = (string) ($payload['pdfBase64'] ?? '');
    $pdfFilename = (string) ($payload['pdfFilename'] ?? 'quittance.pdf');
    $recipients = $payload['recipients'] ?? [];
    if (!is_array($recipients)) {
        $recipients = [];
    }
    $to = array_values(array_filter(array_map('strval', $recipients['to'] ?? [])));
    $cc = array_values(array_filter(array_map('strval', $recipients['cc'] ?? [])));
    $bcc = array_values(array_filter(array_map('strval', $recipients['bcc'] ?? [])));

    if ($subject === '' || $bodyHtml === '') {
        throw new RuntimeException('Objet ou corps du mail manquant.');
    }
    if (!$to && !$cc && !$bcc) {
        throw new RuntimeException('Aucun destinataire configuré.');
    }
    if ($pdfBase64 === '') {
        throw new RuntimeException('Pièce jointe PDF manquante.');
    }
    $pdfBinary = base64_decode($pdfBase64, true);
    if ($pdfBinary === false) {
        throw new RuntimeException('PDF invalide.');
    }
    if (strlen($pdfBinary) > 15 * 1024 * 1024) {
        throw new RuntimeException('PDF trop volumineux (max 15 Mo).');
    }
    if (!preg_match('/\.pdf$/i', $pdfFilename)) {
        $pdfFilename .= '.pdf';
    }
    $pdfFilename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $pdfFilename) ?: 'quittance.pdf';

    return [
        'subject' => $subject,
        'bodyHtml' => $bodyHtml,
        'pdfBinary' => $pdfBinary,
        'pdfFilename' => $pdfFilename,
        'to' => $to,
        'cc' => $cc,
        'bcc' => $bcc,
        'periodMeta' => $payload['periodMeta'] ?? null,
    ];
}

/** POST Gmail API users/me/messages/send. */
function loyerSendViaGmail(string $accessToken, string $fromEmail, string $rawMime): void
{
    $client = new Google\Client();
    $client->setAccessToken(['access_token' => $accessToken]);
    $service = new Google\Service\Gmail($client);
    $message = new Google\Service\Gmail\Message();
    $message->setRaw(rtrim(strtr(base64_encode($rawMime), '+/', '-_'), '='));
    $service->users_messages->send('me', $message);
}

/** Crée brouillon Gmail avec pièce jointe. */
function loyerCreateDraftViaGmail(string $accessToken, string $rawMime): void
{
    $client = new Google\Client();
    $client->setAccessToken(['access_token' => $accessToken]);
    $service = new Google\Service\Gmail($client);
    $message = new Google\Service\Gmail\Message();
    $message->setRaw(rtrim(strtr(base64_encode($rawMime), '+/', '-_'), '='));
    $draft = new Google\Service\Gmail\Draft();
    $draft->setMessage($message);
    try {
        $service->users_drafts->create('me', $draft);
    } catch (Throwable $e) {
        $msg = $e->getMessage();
        if (stripos($msg, 'insufficient') !== false || stripos($msg, 'scope') !== false) {
            throw new RuntimeException(
                'Autorisation Gmail insuffisante — reconnectez Gmail dans Paramètres pour créer des brouillons.'
            );
        }
        throw $e;
    }
}

/** Payload JSON Graph API message + attachments. */
function loyerMicrosoftMailPayload(
    array $to,
    array $cc,
    array $bcc,
    string $subject,
    string $bodyHtml,
    string $pdfBinary,
    string $pdfFilename
): array {
    $recipients = function (array $emails): array {
        $out = [];
        foreach ($emails as $email) {
            $email = trim((string) $email);
            if ($email !== '') {
                $out[] = [
                    'emailAddress' => ['address' => $email],
                ];
            }
        }
        return $out;
    };

    $payload = [
        'subject' => $subject,
        'body' => [
            'contentType' => 'HTML',
            'content' => $bodyHtml,
        ],
        'toRecipients' => $recipients($to),
        'attachments' => [[
            '@odata.type' => '#microsoft.graph.fileAttachment',
            'name' => $pdfFilename,
            'contentType' => 'application/pdf',
            'contentBytes' => base64_encode($pdfBinary),
        ]],
    ];
    if ($cc) {
        $payload['ccRecipients'] = $recipients($cc);
    }
    if ($bcc) {
        $payload['bccRecipients'] = $recipients($bcc);
    }

    return $payload;
}

/** POST Graph /me/sendMail. */
function loyerSendViaMicrosoft(
    string $accessToken,
    array $to,
    array $cc,
    array $bcc,
    string $subject,
    string $bodyHtml,
    string $pdfBinary,
    string $pdfFilename
): void {
    $payload = [
        'message' => loyerMicrosoftMailPayload($to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename),
        'saveToSentItems' => true,
    ];

    $ch = curl_init('https://graph.microsoft.com/v1.0/me/sendMail');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 60,
    ]);
    $response = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300) {
        $msg = is_string($response) ? $response : '';
        throw new RuntimeException('Envoi Outlook refusé (HTTP ' . $code . ').' . ($msg ? ' ' . $msg : ''));
    }
}

/** POST Graph /me/messages (brouillon). */
function loyerCreateDraftViaMicrosoft(
    string $accessToken,
    array $to,
    array $cc,
    array $bcc,
    string $subject,
    string $bodyHtml,
    string $pdfBinary,
    string $pdfFilename
): void {
    $payload = loyerMicrosoftMailPayload($to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);

    $ch = curl_init('https://graph.microsoft.com/v1.0/me/messages');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $accessToken,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_TIMEOUT => 60,
    ]);
    $response = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code < 200 || $code >= 300) {
        $msg = is_string($response) ? $response : '';
        if ($code === 403) {
            throw new RuntimeException(
                'Autorisation Outlook insuffisante — reconnectez Outlook dans Paramètres pour créer des brouillons.'
            );
        }
        throw new RuntimeException('Création du brouillon Outlook refusée (HTTP ' . $code . ').' . ($msg ? ' ' . $msg : ''));
    }
}

/** Route envoi OAuth Gmail/Outlook ou SMTP. */
function loyerHandleSendMail(array $config, PDO $pdo, array $payload): array
{
    $parsed = loyerParseMailPayload($payload);
    $subject = $parsed['subject'];
    $bodyHtml = $parsed['bodyHtml'];
    $pdfBinary = $parsed['pdfBinary'];
    $pdfFilename = $parsed['pdfFilename'];
    $to = $parsed['to'];
    $cc = $parsed['cc'];
    $bcc = $parsed['bcc'];
    $periodMeta = $parsed['periodMeta'];

    $connection = loyerOAuthGetActiveConnection($pdo);
    $smtpRow = loyerSmtpRow($pdo);
    $useOAuth = $connection !== null && loyerEncryptionKey($config) !== '';
    $useSmtp = !$useOAuth && (int) ($smtpRow['is_configured'] ?? 0) === 1;

    if (!$useOAuth && !$useSmtp) {
        throw new RuntimeException(
            'Aucun expéditeur configuré — connectez Gmail/Outlook ou renseignez le SMTP dans Paramètres.'
        );
    }

    $provider = 'smtp';
    $fromEmail = '';

    if ($useOAuth) {
        $fromEmail = (string) $connection['email'];
        $accessToken = loyerOAuthAccessToken($config, $pdo, $connection);
        $provider = (string) $connection['provider'];
        if ($provider === 'google') {
            $mime = loyerBuildMimeMessage($fromEmail, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);
            loyerSendViaGmail($accessToken, $fromEmail, $mime);
        } elseif ($provider === 'microsoft') {
            loyerSendViaMicrosoft($accessToken, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);
        } else {
            throw new RuntimeException('Fournisseur mail inconnu.');
        }
    } else {
        $fromEmail = (string) $smtpRow['from_email'];
        loyerSmtpSendRaw($config, $smtpRow, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);
    }

    $meta = [
        'provider' => $provider,
        'from' => $fromEmail,
        'to' => $to,
        'cc' => $cc,
        'pdfFilename' => $pdfFilename,
        'periodMeta' => is_array($periodMeta) ? $periodMeta : null,
    ];
    loyerLogActivity($pdo, 'mail_sent', 'success', 'Mail envoyé : ' . $subject, $meta);

    return ['provider' => $provider, 'from' => $fromEmail];
}

/** Route brouillon OAuth (pas SMTP). */
function loyerHandleSaveMailDraft(array $config, PDO $pdo, array $payload): array
{
    $parsed = loyerParseMailPayload($payload);
    $subject = $parsed['subject'];
    $bodyHtml = $parsed['bodyHtml'];
    $pdfBinary = $parsed['pdfBinary'];
    $pdfFilename = $parsed['pdfFilename'];
    $to = $parsed['to'];
    $cc = $parsed['cc'];
    $bcc = $parsed['bcc'];
    $periodMeta = $parsed['periodMeta'];

    $connection = loyerOAuthGetActiveConnection($pdo);
    if ($connection === null || loyerEncryptionKey($config) === '') {
        throw new RuntimeException(
            'Les brouillons nécessitent Gmail ou Outlook — connectez votre compte dans Paramètres → Envoi mail.'
        );
    }

    $fromEmail = (string) $connection['email'];
    $accessToken = loyerOAuthAccessToken($config, $pdo, $connection);
    $provider = (string) $connection['provider'];

    if ($provider === 'google') {
        $mime = loyerBuildMimeMessage($fromEmail, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);
        loyerCreateDraftViaGmail($accessToken, $mime);
    } elseif ($provider === 'microsoft') {
        loyerCreateDraftViaMicrosoft($accessToken, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);
    } else {
        throw new RuntimeException('Fournisseur mail inconnu.');
    }

    $meta = [
        'provider' => $provider,
        'from' => $fromEmail,
        'to' => $to,
        'cc' => $cc,
        'pdfFilename' => $pdfFilename,
        'periodMeta' => is_array($periodMeta) ? $periodMeta : null,
    ];
    loyerLogActivity($pdo, 'mail_draft', 'success', 'Brouillon créé : ' . $subject, $meta);

    return ['provider' => $provider, 'from' => $fromEmail];
}
