<?php

/**
 * Export / import profil complet (loyer-data.json + tables SQLite).
 */
declare(strict_types=1);

const LOYER_PROFILE_EXPORT_VERSION = 2;
const LOYER_PROFILE_BACKUP_KDF_ITERATIONS = 120000;

/** Dérive une clé AES-256 depuis le mot de passe de sauvegarde. */
function loyerProfileDeriveBackupKey(string $password, string $salt): string
{
    return hash_pbkdf2('sha256', $password, $salt, LOYER_PROFILE_BACKUP_KDF_ITERATIONS, 32, true);
}

/** Chiffre le contenu sensible (loyerData + database + sourceAccount). */
function loyerProfileSealInner(array $inner, string $backupPassword): array
{
    loyerAuthValidatePassword($backupPassword);
    $salt = random_bytes(16);
    $key = loyerProfileDeriveBackupKey($backupPassword, $salt);
    $json = json_encode($inner, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible de préparer la sauvegarde.');
    }
    return [
        'kdf' => 'pbkdf2-sha256',
        'iterations' => LOYER_PROFILE_BACKUP_KDF_ITERATIONS,
        'salt' => base64_encode($salt),
        'sealed' => loyerEncrypt($json, $key),
    ];
}

/** Déchiffre une export v2 ; lève si mot de passe incorrect. */
function loyerProfileUnsealExport(array $export, string $backupPassword): array
{
    if (empty($export['security']) || !is_array($export['security'])) {
        throw new InvalidArgumentException(
            'Cette sauvegarde n\'est pas protégée — exportez à nouveau depuis Mon compte avec un mot de passe de sauvegarde.'
        );
    }
    $sec = $export['security'];
    if (empty($sec['salt']) || empty($sec['sealed'])) {
        throw new InvalidArgumentException('Bloc de sécurité de sauvegarde invalide.');
    }
    $salt = base64_decode((string) $sec['salt'], true);
    if ($salt === false || $salt === '') {
        throw new InvalidArgumentException('Sel de dérivation invalide.');
    }
    $key = loyerProfileDeriveBackupKey($backupPassword, $salt);
    try {
        $json = loyerDecrypt((string) $sec['sealed'], $key);
    } catch (Throwable $e) {
        throw new InvalidArgumentException('Mot de passe de sauvegarde incorrect ou fichier corrompu.');
    }
    $inner = json_decode($json, true);
    if (!is_array($inner) || !isset($inner['loyerData']) || !is_array($inner['loyerData'])) {
        throw new InvalidArgumentException('Mot de passe de sauvegarde incorrect ou fichier corrompu.');
    }
    return $inner;
}

/** True si export chiffré v2. */
function loyerProfileIsSealedExport(array $export): bool
{
    return isset($export['profileExportVersion'])
        && (int) $export['profileExportVersion'] >= 2
        && isset($export['security']['sealed']);
}

/** Compte source pour indication UI (sans secret). */
function loyerProfileSourceAccountFromUser(?array $user): ?array
{
    if (!$user) {
        return null;
    }
    return [
        'provider' => (string) ($user['auth_provider'] ?? $user['provider'] ?? 'local'),
        'email' => (string) ($user['email'] ?? ''),
    ];
}

/** Construit export v2 scellé par mot de passe de sauvegarde. */
function loyerProfileBuildSealedExport(
    array $ctx,
    PDO $pdo,
    string $backupPassword,
    ?array $sourceAccount
): array {
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );

    $loyerData = null;
    if (is_file($ctx['dataFile'])) {
        $raw = file_get_contents($ctx['dataFile']);
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $loyerData = $decoded;
            }
        }
    }
    if (!is_array($loyerData)) {
        $loyerData = json_decode(loyerDefaultLoyerDataJson(), true);
    }

    $inner = [
        'loyerData' => $loyerData,
        'database' => loyerProfileExportDatabase($pdo),
        'sourceAccount' => $sourceAccount,
    ];

    return [
        'profileExportVersion' => LOYER_PROFILE_EXPORT_VERSION,
        'exportedAt' => gmdate('c'),
        'appVersion' => LOYER_APP_VERSION,
        'security' => loyerProfileSealInner($inner, $backupPassword),
    ];
}

/** JSON métier vide (réinitialisation). */
function loyerDefaultLoyerDataJson(): string
{
    return json_encode([
        'version' => 1,
        'settings' => [
            'leaseStart' => gmdate('Y') . '-01-01',
            'rentDueDay' => 1,
            'emitters' => ['Locataire exemple'],
            'emitterProfiles' => [
                ['name' => 'Locataire exemple', 'patterns' => ['LOCATAIRE EXEMPLE', 'VIR LOYER']],
            ],
            'priceHistory' => [['from' => gmdate('Y') . '-01-01', 'amount' => 0, 'charges' => 0]],
            'bailleur' => [
                'name' => '',
                'street' => '',
                'postalCode' => '',
                'city' => '',
                'signatureImage' => '',
            ],
            'locataire' => [
                'name' => '',
                'street' => '',
                'postalCode' => '',
                'city' => '',
            ],
            'mail' => [
                'recipients' => [['email' => '', 'type' => 'to']],
                'signature' => '',
            ],
            'templates' => [
                'defaultQuittanceId' => 'complet',
                'defaultMailId' => 'complet',
                'quittances' => [
                    ['id' => 'complet', 'name' => 'Modèle complet'],
                    ['id' => 'court', 'name' => 'Modèle court'],
                ],
                'mails' => [
                    ['id' => 'complet', 'name' => 'Modèle complet'],
                    ['id' => 'court', 'name' => 'Modèle court'],
                ],
            ],
        ],
        'payments' => [],
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

/** Snapshot tables SQLite (hors comptes utilisateurs). */
function loyerProfileExportDatabase(PDO $pdo): array
{
    $appSettings = $pdo->query('SELECT key, value FROM app_settings ORDER BY key')->fetchAll() ?: [];
    $smtp = loyerSmtpRow($pdo);
    unset($smtp['id']);
    $oauth = $pdo->query(
        'SELECT provider, email, refresh_token_enc, scopes, is_active, connected_at, updated_at
         FROM oauth_connections ORDER BY provider, email'
    )->fetchAll() ?: [];
    $activity = $pdo->query(
        'SELECT created_at, event_type, status, summary, metadata_json, error_message
         FROM activity_log ORDER BY created_at ASC, id ASC'
    )->fetchAll() ?: [];

    return [
        'appSettings' => $appSettings,
        'smtp' => $smtp,
        'oauthConnections' => $oauth,
        'activityLog' => $activity,
    ];
}

/** Construit l'export complet depuis le serveur (legacy v1 — préférer export scellé). */
function loyerProfileBuildExport(array $ctx, PDO $pdo): array
{
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );

    $loyerData = null;
    if (is_file($ctx['dataFile'])) {
        $raw = file_get_contents($ctx['dataFile']);
        if ($raw !== false && trim($raw) !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded)) {
                $loyerData = $decoded;
            }
        }
    }
    if (!is_array($loyerData)) {
        $loyerData = json_decode(loyerDefaultLoyerDataJson(), true);
    }

    return [
        'profileExportVersion' => 1,
        'exportedAt' => gmdate('c'),
        'appVersion' => LOYER_APP_VERSION,
        'loyerData' => $loyerData,
        'database' => loyerProfileExportDatabase($pdo),
    ];
}

/** Restaure les tables SQLite depuis un export (sans users). */
function loyerProfileImportDatabase(PDO $pdo, array $database): void
{
    if (!is_array($database)) {
        return;
    }

    $pdo->beginTransaction();
    try {
        if (isset($database['appSettings']) && is_array($database['appSettings'])) {
            foreach ($database['appSettings'] as $row) {
                if (!is_array($row) || !isset($row['key'])) {
                    continue;
                }
                loyerSetSetting($pdo, (string) $row['key'], (string) ($row['value'] ?? ''));
            }
        }

        if (isset($database['smtp']) && is_array($database['smtp'])) {
            $smtp = $database['smtp'];
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
                (string) ($smtp['host'] ?? ''),
                (int) ($smtp['port'] ?? 587),
                (string) ($smtp['encryption'] ?? 'tls'),
                (string) ($smtp['username'] ?? ''),
                (string) ($smtp['password_enc'] ?? ''),
                (string) ($smtp['from_email'] ?? ''),
                (string) ($smtp['from_name'] ?? ''),
                (int) ($smtp['is_configured'] ?? 0),
                $now,
            ]);
        }

        $pdo->exec('DELETE FROM oauth_connections');
        if (isset($database['oauthConnections']) && is_array($database['oauthConnections'])) {
            $ins = $pdo->prepare(
                'INSERT INTO oauth_connections (provider, email, refresh_token_enc, scopes, is_active, connected_at, updated_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?)'
            );
            foreach ($database['oauthConnections'] as $row) {
                if (!is_array($row) || empty($row['provider']) || empty($row['email'])) {
                    continue;
                }
                $ins->execute([
                    (string) $row['provider'],
                    (string) $row['email'],
                    (string) ($row['refresh_token_enc'] ?? ''),
                    (string) ($row['scopes'] ?? ''),
                    (int) ($row['is_active'] ?? 0),
                    (string) ($row['connected_at'] ?? gmdate('c')),
                    (string) ($row['updated_at'] ?? gmdate('c')),
                ]);
            }
        }

        $pdo->exec('DELETE FROM activity_log');
        if (isset($database['activityLog']) && is_array($database['activityLog'])) {
            $ins = $pdo->prepare(
                'INSERT INTO activity_log (created_at, event_type, status, summary, metadata_json, error_message)
                 VALUES (?, ?, ?, ?, ?, ?)'
            );
            foreach ($database['activityLog'] as $row) {
                if (!is_array($row) || empty($row['created_at']) || empty($row['event_type'])) {
                    continue;
                }
                $ins->execute([
                    (string) $row['created_at'],
                    (string) $row['event_type'],
                    (string) ($row['status'] ?? 'success'),
                    (string) ($row['summary'] ?? ''),
                    isset($row['metadata_json']) ? (string) $row['metadata_json'] : null,
                    isset($row['error_message']) ? (string) $row['error_message'] : null,
                ]);
            }
        }

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

/** True si le tableau ressemble à loyer-data.json (legacy). */
function loyerProfileLooksLikeLoyerData(array $payload): bool
{
    return isset($payload['settings']) && (isset($payload['payments']) || array_key_exists('payments', $payload));
}

/** Extrait loyerData + database ; déchiffre si export v2 et mot de passe fourni. */
function loyerProfileParseImportPayload(array $payload, ?string $backupPassword = null): array
{
    if (loyerProfileIsSealedExport($payload)) {
        if ($backupPassword === null || $backupPassword === '') {
            throw new InvalidArgumentException('Mot de passe de sauvegarde requis pour ce fichier.');
        }
        $inner = loyerProfileUnsealExport($payload, $backupPassword);
        return [
            'loyerData' => $inner['loyerData'],
            'database' => isset($inner['database']) && is_array($inner['database']) ? $inner['database'] : null,
            'sourceAccount' => $inner['sourceAccount'] ?? null,
        ];
    }
    if (isset($payload['profileExportVersion']) && isset($payload['loyerData']) && is_array($payload['loyerData'])) {
        return [
            'loyerData' => $payload['loyerData'],
            'database' => isset($payload['database']) && is_array($payload['database']) ? $payload['database'] : null,
            'sourceAccount' => null,
        ];
    }
    if (loyerProfileLooksLikeLoyerData($payload)) {
        return ['loyerData' => $payload, 'database' => null, 'sourceAccount' => null];
    }
    throw new InvalidArgumentException('Format de sauvegarde non reconnu.');
}

/** Applique loyerData + database importés. */
function loyerProfileApplyImport(array $ctx, PDO $pdo, array $parsed): void
{
    loyerProfileWriteLoyerData($ctx, $parsed['loyerData']);
    if (!empty($parsed['database']) && is_array($parsed['database'])) {
        loyerProfileImportDatabase($pdo, $parsed['database']);
    }
}

const LOYER_PENDING_IMPORT_TTL_SECONDS = 900;

/** Enregistre import validé en session (initiation uniquement). */
function loyerProfileStagePendingImport(array $inner): void
{
    $_SESSION['pending_profile_import'] = json_encode($inner, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $_SESSION['pending_profile_import_at'] = time();
}

/** Lit et efface import en attente si encore valide. */
function loyerProfileTakePendingImport(): ?array
{
    $raw = $_SESSION['pending_profile_import'] ?? null;
    $at = (int) ($_SESSION['pending_profile_import_at'] ?? 0);
    unset($_SESSION['pending_profile_import'], $_SESSION['pending_profile_import_at']);
    if (!is_string($raw) || $raw === '' || $at <= 0) {
        return null;
    }
    if (time() - $at > LOYER_PENDING_IMPORT_TTL_SECONDS) {
        return null;
    }
    $inner = json_decode($raw, true);
    return is_array($inner) ? $inner : null;
}

/** Applique import en session après création de compte (setup). */
function loyerProfileApplyPendingImportIfAny(array $ctx, PDO $pdo): bool
{
    $inner = loyerProfileTakePendingImport();
    if (!$inner || !isset($inner['loyerData']) || !is_array($inner['loyerData'])) {
        return false;
    }
    loyerProfileApplyImport($ctx, $pdo, [
        'loyerData' => $inner['loyerData'],
        'database' => $inner['database'] ?? null,
    ]);
    loyerLogActivity($pdo, 'profile_import', 'success', 'Restauration profil lors de l\'initiation');
    return true;
}

/** Écrit loyer-data.json depuis un tableau. */
function loyerProfileWriteLoyerData(array $ctx, array $loyerData): void
{
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );
    $loyerData = loyerSanitizeLoyerDataSignature($loyerData);
    $json = json_encode($loyerData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($json === false) {
        throw new RuntimeException('Impossible de sérialiser les données.');
    }
    json_decode($json, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException('Données métier invalides.');
    }
    ensureDir($ctx['dataDir']);
    assertDirWritable($ctx['dataDir'], 'data/');
    if (file_put_contents($ctx['dataFile'], $json, LOCK_EX) === false) {
        throw new RuntimeException('Écriture impossible — vérifiez les droits sur data/');
    }
}

/** Supprime les modèles personnalisés (conserve complet, court, principal). */
function loyerProfileDeleteCustomTemplates(string $quittancesDir, string $mailsDir): void
{
    $protected = loyerProtectedTemplateIds();
    foreach (glob($quittancesDir . '/*.html') ?: [] as $path) {
        $id = basename($path, '.html');
        if (!in_array($id, $protected, true) && is_file($path)) {
            unlink($path);
        }
    }
    foreach (glob($mailsDir . '/*.html') ?: [] as $path) {
        $id = basename($path, '.html');
        if (!in_array($id, $protected, true) && is_file($path)) {
            unlink($path);
            $subject = $mailsDir . '/' . $id . '-subject.txt';
            if (is_file($subject)) {
                unlink($subject);
            }
        }
    }
}

/** Réinitialise JSON métier + modèles personnalisés ; optionnellement OAuth/SMTP/historique SQLite. */
function loyerProfileResetAllData(array $ctx, ?PDO $pdo = null): void
{
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );
    ensureDir($ctx['dataDir']);
    assertDirWritable($ctx['dataDir'], 'data/');
    if (file_put_contents($ctx['dataFile'], loyerDefaultLoyerDataJson(), LOCK_EX) === false) {
        throw new RuntimeException('Réinitialisation impossible — vérifiez les droits sur data/');
    }
    loyerProfileDeleteCustomTemplates($ctx['quittancesDir'], $ctx['mailsDir']);
    if ($pdo !== null) {
        $pdo->exec('DELETE FROM oauth_connections');
        loyerSmtpClear($pdo);
        $pdo->exec('DELETE FROM activity_log');
    }
}
