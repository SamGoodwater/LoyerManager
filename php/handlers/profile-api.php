<?php
/**
 * Handlers export / import profil complet et réinitialisation données.
 */
declare(strict_types=1);

/** POST export scellé (mot de passe de sauvegarde obligatoire). */
function loyerHandleProfileExport(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Utilisez POST avec un mot de passe de sauvegarde.'], 405);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        $body = loyerJsonBody();
        $backupPassword = (string) ($body['backupPassword'] ?? '');
        if ($backupPassword === '') {
            respondJson(['ok' => false, 'error' => 'Mot de passe de sauvegarde requis.'], 400);
        }
        $user = loyerAuthCurrentUser($pdo);
        $source = loyerProfileSourceAccountFromUser($user);
        $profile = loyerProfileBuildSealedExport($ctx, $pdo, $backupPassword, $source);
        respondJson(['ok' => true, 'profile' => $profile]);
    } catch (InvalidArgumentException $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** POST import complet ou legacy JSON seul. */
function loyerHandleProfileImport(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        $body = loyerJsonBody();
        if (!is_array($body)) {
            respondJson(['ok' => false, 'error' => 'JSON invalide'], 400);
        }
        $backupPassword = isset($body['backupPassword']) ? (string) $body['backupPassword'] : null;
        $payload = isset($body['profile']) && is_array($body['profile']) ? $body['profile'] : $body;
        $parsed = loyerProfileParseImportPayload($payload, $backupPassword);
        loyerProfileApplyImport($ctx, $pdo, $parsed);
        loyerLogActivity($pdo, 'profile_import', 'success', 'Import profil depuis Mon compte');
        respondJson([
            'ok' => true,
            'importedDatabase' => !empty($parsed['database']),
        ]);
    } catch (InvalidArgumentException $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** POST réinitialise loyer-data.json et modèles personnalisés. */
function loyerHandleProfileResetData(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerProfileResetAllData($ctx, $pdo);
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** POST valide sauvegarde chiffrée et la met en attente (initiation seulement). */
function loyerHandleAuthPrepareBackup(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        if (!loyerAuthNeedsSetup($pdo, $ctx['dataFile'])) {
            respondJson(['ok' => false, 'error' => 'La restauration à l\'initiation n\'est possible que sans compte existant.'], 409);
        }
        $body = loyerJsonBody();
        $profile = $body['profile'] ?? null;
        $backupPassword = (string) ($body['backupPassword'] ?? '');
        if (!is_array($profile)) {
            respondJson(['ok' => false, 'error' => 'Fichier de sauvegarde invalide.'], 400);
        }
        if (!loyerProfileIsSealedExport($profile)) {
            respondJson([
                'ok' => false,
                'error' => 'Seules les sauvegardes protégées par mot de passe (v2) peuvent être restaurées à l\'initiation.',
            ], 400);
        }
        $inner = loyerProfileUnsealExport($profile, $backupPassword);
        loyerProfileStagePendingImport($inner);
        respondJson([
            'ok' => true,
            'sourceAccount' => $inner['sourceAccount'] ?? null,
            'expiresIn' => LOYER_PENDING_IMPORT_TTL_SECONDS,
        ]);
    } catch (InvalidArgumentException $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** GET état import en attente (initiation). */
function loyerHandleAuthPendingBackup(array $ctx): void
{
    loyerStartAppSession($ctx['config']);
    $raw = $_SESSION['pending_profile_import'] ?? null;
    $at = (int) ($_SESSION['pending_profile_import_at'] ?? 0);
    $valid = is_string($raw) && $raw !== '' && $at > 0 && (time() - $at) <= LOYER_PENDING_IMPORT_TTL_SECONDS;
    $sourceAccount = null;
    if ($valid) {
        $inner = json_decode($raw, true);
        if (is_array($inner)) {
            $sourceAccount = $inner['sourceAccount'] ?? null;
        }
    }
    respondJson([
        'ok' => true,
        'pending' => $valid,
        'sourceAccount' => $sourceAccount,
        'expiresIn' => $valid ? LOYER_PENDING_IMPORT_TTL_SECONDS - (time() - $at) : 0,
    ]);
}
