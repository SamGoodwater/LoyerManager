<?php
/**
 * Handlers API système
 *
 * Config, status serveur, paramètres app (rétention historique).
 */
declare(strict_types=1);

/** GET config publique (version, needsSetup). */
function loyerHandleConfig(array $ctx): void
{
    loyerStartAppSession($ctx['config']);
    $sessionAuth = false;
    $needsSetup = true;
    try {
        $pdo = loyerDbFromCtx($ctx);
        $sessionAuth = loyerAuthHasUsers($pdo);
        $needsSetup = loyerAuthNeedsSetup($pdo, $ctx['dataFile']);
    } catch (Throwable $e) {
        /* ignore */
    }
    respondJson([
        'ok' => true,
        'authRequired' => isAuthRequired($ctx['config']),
        'sessionAuth' => $sessionAuth,
        'needsSetup' => $needsSetup,
        'demo' => loyerDemoEnabled($ctx['config']),
        'appVersion' => LOYER_APP_VERSION,
    ]);
}

/** GET diagnostic serveur (SQLite, droits, OAuth). */
function loyerHandleStatus(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );
    $dbOk = false;
    $dbSchema = 0;
    $dbError = '';
    if (loyerDbAvailable()) {
        try {
            [, $dbSchema] = loyerDbInit($ctx['baseDir'], $ctx['dataDir']);
            $dbOk = is_writable(loyerDbPath($ctx['dataDir'])) || !is_file(loyerDbPath($ctx['dataDir']));
            assertDirWritable($ctx['dataDir'], 'data/');
        } catch (Throwable $e) {
            $dbError = $e->getMessage();
        }
    } else {
        $dbError = loyerDbUnavailableHint();
    }
    respondJson([
        'ok' => true,
        'mode' => 'server',
        'appVersion' => LOYER_APP_VERSION,
        'dbSchemaVersion' => $dbSchema,
        'php' => PHP_VERSION,
        'authRequired' => isAuthRequired($ctx['config']),
        'sqlite' => [
            'available' => loyerDbAvailable(),
            'ok' => $dbOk,
            'error' => $dbError,
        ],
        'oauth' => [
            'encryptionConfigured' => loyerEncryptionKey($ctx['config']) !== '',
            'googleEnabled' => loyerOAuthProviderEnabled($ctx['config'], 'google'),
            'microsoftEnabled' => loyerOAuthProviderEnabled($ctx['config'], 'microsoft'),
        ],
        'writable' => [
            'data' => is_writable($ctx['dataDir']),
            'templatesQuittances' => is_writable($ctx['quittancesDir']),
            'templatesMails' => is_writable($ctx['mailsDir']),
        ],
    ]);
}

/** GET/POST paramètres app (rétention historique). */
function loyerHandleAppSettings(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    try {
        $pdo = loyerDbFromCtx($ctx);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
    if ($ctx['method'] === 'GET') {
        respondJson([
            'ok' => true,
            'historyRetentionMonths' => (int) loyerGetSetting($pdo, 'history_retention_months', '24'),
        ]);
    }
    if ($ctx['method'] === 'POST') {
        $body = loyerJsonBody();
        if (isset($body['historyRetentionMonths'])) {
            $months = max(0, min(120, (int) $body['historyRetentionMonths']));
            loyerSetSetting($pdo, 'history_retention_months', (string) $months);
        }
        respondJson([
            'ok' => true,
            'historyRetentionMonths' => (int) loyerGetSetting($pdo, 'history_retention_months', '24'),
        ]);
    }
    respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
}
