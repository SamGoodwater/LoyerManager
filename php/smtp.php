<?php

/**
 * Configuration et envoi SMTP bas niveau (socket STARTTLS).
 */
declare(strict_types=1);

/** Ligne smtp_settings unique ou tableau vide. */
function loyerSmtpRow(PDO $pdo): array
{
    $row = $pdo->query('SELECT * FROM smtp_settings WHERE id = 1')->fetch();
    if (!$row) {
        return [
            'host' => '',
            'port' => 587,
            'encryption' => 'tls',
            'username' => '',
            'password_enc' => '',
            'from_email' => '',
            'from_name' => '',
            'is_configured' => 0,
        ];
    }
    return $row;
}

/** Statut SMTP sans mot de passe pour UI. */
function loyerSmtpPublicStatus(PDO $pdo): array
{
    $row = loyerSmtpRow($pdo);
    $configured = (int) ($row['is_configured'] ?? 0) === 1
        && trim((string) ($row['host'] ?? '')) !== ''
        && trim((string) ($row['from_email'] ?? '')) !== '';
    return [
        'configured' => $configured,
        'host' => (string) ($row['host'] ?? ''),
        'port' => (int) ($row['port'] ?? 587),
        'encryption' => (string) ($row['encryption'] ?? 'tls'),
        'username' => (string) ($row['username'] ?? ''),
        'fromEmail' => (string) ($row['from_email'] ?? ''),
        'fromName' => (string) ($row['from_name'] ?? ''),
        'hasPassword' => trim((string) ($row['password_enc'] ?? '')) !== '',
    ];
}

/** Valide et enregistre config SMTP (pwd chiffré). */
function loyerSmtpSave(PDO $pdo, array $config, array $input): array
{
    $key = loyerEncryptionKey($config);
    if ($key === '') {
        throw new RuntimeException('encryption_key manquante dans config.php.');
    }

    $host = trim((string) ($input['host'] ?? ''));
    $port = (int) ($input['port'] ?? 587);
    $encryption = (string) ($input['encryption'] ?? 'tls');
    if (!in_array($encryption, ['tls', 'ssl', 'none'], true)) {
        $encryption = 'tls';
    }
    $username = trim((string) ($input['username'] ?? ''));
    $fromEmail = trim(strtolower((string) ($input['fromEmail'] ?? '')));
    $fromName = trim((string) ($input['fromName'] ?? ''));
    $password = (string) ($input['password'] ?? '');

    if ($host === '') {
        throw new InvalidArgumentException('Serveur SMTP requis.');
    }
    if ($fromEmail === '' || !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse expéditeur invalide.');
    }
    if ($port < 1 || $port > 65535) {
        throw new InvalidArgumentException('Port SMTP invalide.');
    }

    $existing = loyerSmtpRow($pdo);
    $passwordEnc = (string) ($existing['password_enc'] ?? '');
    if ($password !== '') {
        $passwordEnc = loyerEncrypt($password, $key);
    } elseif ($passwordEnc === '') {
        throw new InvalidArgumentException('Mot de passe SMTP requis.');
    }

    $configured = $host !== '' && $fromEmail !== '' && $passwordEnc !== '';
    $now = gmdate('c');
    $stmt = $pdo->prepare(
        'INSERT INTO smtp_settings (id, host, port, encryption, username, password_enc, from_email, from_name, is_configured, updated_at)
         VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           host = excluded.host,
           port = excluded.port,
           encryption = excluded.encryption,
           username = excluded.username,
           password_enc = excluded.password_enc,
           from_email = excluded.from_email,
           from_name = excluded.from_name,
           is_configured = excluded.is_configured,
           updated_at = excluded.updated_at'
    );
    $stmt->execute([
        $host,
        $port,
        $encryption,
        $username,
        $passwordEnc,
        $fromEmail,
        $fromName,
        $configured ? 1 : 0,
        $now,
    ]);

    loyerLogActivity($pdo, 'smtp_configured', 'success', 'Paramètres SMTP enregistrés', [
        'host' => $host,
        'from' => $fromEmail,
    ]);

    return loyerSmtpPublicStatus($pdo);
}

/** Supprime configuration SMTP. */
function loyerSmtpClear(PDO $pdo): void
{
    $now = gmdate('c');
    $pdo->prepare(
        'UPDATE smtp_settings SET host = "", port = 587, encryption = "tls", username = "",
         password_enc = "", from_email = "", from_name = "", is_configured = 0, updated_at = ? WHERE id = 1'
    )->execute([$now]);
    loyerLogActivity($pdo, 'smtp_cleared', 'success', 'Configuration SMTP supprimée');
}

/** Déchiffre mot de passe SMTP stocké. */
function loyerSmtpGetPassword(array $config, array $row): string
{
    $key = loyerEncryptionKey($config);
    if ($key === '') {
        throw new RuntimeException('encryption_key manquante.');
    }
    $enc = (string) ($row['password_enc'] ?? '');
    if ($enc === '') {
        return '';
    }
    return loyerDecrypt($enc, $key);
}

/** Lit réponse multiligne socket SMTP. */
function loyerSmtpReadResponse($socket): string
{
    $data = '';
    while (($line = fgets($socket, 515)) !== false) {
        $data .= $line;
        if (strlen($line) >= 4 && $line[3] === ' ') {
            break;
        }
    }
    return $data;
}

/** Vérifie code réponse SMTP attendu. */
function loyerSmtpExpect($socket, array $codes): void
{
    $resp = loyerSmtpReadResponse($socket);
    $code = (int) substr($resp, 0, 3);
    if (!in_array($code, $codes, true)) {
        throw new RuntimeException('SMTP : ' . trim($resp));
    }
}

/** Envoie commande SMTP et vérifie OK. */
function loyerSmtpCmd($socket, string $cmd, array $okCodes): void
{
    fwrite($socket, $cmd . "\r\n");
    loyerSmtpExpect($socket, $okCodes);
}

/** Prépare mot de passe en clair depuis formulaire ou stockage chiffré. */
function loyerSmtpResolvePlainPassword(PDO $pdo, array $config, array $input): string
{
    $password = (string) ($input['password'] ?? '');
    if ($password !== '') {
        return $password;
    }
    $existing = loyerSmtpRow($pdo);
    if (trim((string) ($existing['password_enc'] ?? '')) === '') {
        throw new InvalidArgumentException('Mot de passe SMTP requis.');
    }
    return loyerSmtpGetPassword($config, $existing);
}

/** Ouvre une session SMTP authentifiée (sans envoi). */
function loyerSmtpConnect(string $host, int $port, string $encryption, string $username, string $password)
{
    $remote = $encryption === 'ssl' ? 'ssl://' . $host . ':' . $port : $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 30, STREAM_CLIENT_CONNECT);
    if (!$socket) {
        throw new RuntimeException('Connexion SMTP impossible : ' . $errstr . ' (' . $errno . ')');
    }
    stream_set_timeout($socket, 30);

    loyerSmtpExpect($socket, [220]);

    $ehloHost = 'localhost';
    loyerSmtpCmd($socket, 'EHLO ' . $ehloHost, [250]);

    if ($encryption === 'tls') {
        loyerSmtpCmd($socket, 'STARTTLS', [220]);
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new RuntimeException('Échec STARTTLS SMTP.');
        }
        loyerSmtpCmd($socket, 'EHLO ' . $ehloHost, [250]);
    }

    if ($username !== '' && $password !== '') {
        loyerSmtpCmd($socket, 'AUTH LOGIN', [334]);
        loyerSmtpCmd($socket, base64_encode($username), [334]);
        loyerSmtpCmd($socket, base64_encode($password), [235]);
    }

    return $socket;
}

/** Ferme proprement une session SMTP. */
function loyerSmtpDisconnect($socket): void
{
    if (!is_resource($socket)) {
        return;
    }
    try {
        loyerSmtpCmd($socket, 'QUIT', [221]);
    } catch (Throwable $e) {
        /* ignore */
    }
    fclose($socket);
}

/** Teste connexion + authentification SMTP (sans envoi de mail). */
function loyerSmtpTestFromInput(PDO $pdo, array $config, array $input): void
{
    $host = trim((string) ($input['host'] ?? ''));
    $port = (int) ($input['port'] ?? 587);
    $encryption = (string) ($input['encryption'] ?? 'tls');
    if (!in_array($encryption, ['tls', 'ssl', 'none'], true)) {
        $encryption = 'tls';
    }
    $username = trim((string) ($input['username'] ?? ''));

    if ($host === '') {
        throw new InvalidArgumentException('Serveur SMTP requis.');
    }
    if ($port < 1 || $port > 65535) {
        throw new InvalidArgumentException('Port SMTP invalide.');
    }

    $password = loyerSmtpResolvePlainPassword($pdo, $config, $input);
    if ($username === '' && $password !== '') {
        throw new InvalidArgumentException('Identifiant SMTP requis avec un mot de passe.');
    }

    $socket = loyerSmtpConnect($host, $port, $encryption, $username, $password);
    try {
        loyerSmtpCmd($socket, 'NOOP', [250]);
    } finally {
        loyerSmtpDisconnect($socket);
    }
}

/** Dialogue SMTP complet (EHLO, STARTTLS, AUTH, DATA). */
function loyerSmtpSendRaw(
    array $config,
    array $smtpRow,
    array $to,
    array $cc,
    array $bcc,
    string $subject,
    string $bodyHtml,
    string $pdfBinary,
    string $pdfFilename
): void {
    $host = (string) $smtpRow['host'];
    $port = (int) $smtpRow['port'];
    $encryption = (string) $smtpRow['encryption'];
    $username = (string) $smtpRow['username'];
    $password = loyerSmtpGetPassword($config, $smtpRow);
    $fromEmail = (string) $smtpRow['from_email'];
    $fromName = (string) $smtpRow['from_name'];

    $fromHeader = $fromName !== ''
        ? '=?UTF-8?B?' . base64_encode($fromName) . '?= <' . $fromEmail . '>'
        : $fromEmail;

    $mime = loyerBuildMimeMessage($fromEmail, $to, $cc, $bcc, $subject, $bodyHtml, $pdfBinary, $pdfFilename);

    $socket = loyerSmtpConnect($host, $port, $encryption, $username, $password);

    loyerSmtpCmd($socket, 'MAIL FROM:<' . $fromEmail . '>', [250]);

    $allRcpt = array_merge($to, $cc, $bcc);
    foreach ($allRcpt as $rcpt) {
        $rcpt = trim((string) $rcpt);
        if ($rcpt !== '') {
            loyerSmtpCmd($socket, 'RCPT TO:<' . $rcpt . '>', [250, 251]);
        }
    }

    loyerSmtpCmd($socket, 'DATA', [354]);
    $dataLines = 'From: ' . $fromHeader . "\r\n" . $mime;
    $dataLines = preg_replace('/\r\n\./', "\r\n..", $dataLines);
    fwrite($socket, $dataLines . "\r\n.\r\n");
    loyerSmtpExpect($socket, [250]);
    loyerSmtpDisconnect($socket);
}

/** True si SMTP configuré et mot de passe présent. */
function loyerSmtpIsReady(PDO $pdo): bool
{
    $status = loyerSmtpPublicStatus($pdo);
    return !empty($status['configured']);
}

/** Résumé OAuth actif + SMTP pour boutons mail. */
function loyerMailTransportStatus(PDO $pdo, array $config): array
{
    $oauth = loyerOAuthStatus($pdo, $config);
    $smtp = loyerSmtpPublicStatus($pdo);
    $oauthReady = !empty($oauth['active']) && !empty($oauth['encryptionConfigured']);
    return [
        'oauth' => $oauth,
        'smtp' => $smtp,
        'sendReady' => $oauthReady || !empty($smtp['configured']),
        'oauthReady' => $oauthReady,
        'draftReady' => $oauthReady,
        'smtpReady' => !empty($smtp['configured']),
    ];
}
