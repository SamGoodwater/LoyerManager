<?php
/**
 * Handlers API authentification
 *
 * Actions auth-* : status, login, logout, changement passphrase…
 */
declare(strict_types=1);

/** GET auth-status pour login et app. */
function loyerHandleAuthStatus(array $ctx): void
{
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerStartAppSession($ctx['config'], $pdo);
        respondJson(['ok' => true] + loyerAuthStatus($pdo, $ctx['config'], $ctx['dataFile']));
    } catch (Throwable $e) {
        respondJson([
            'ok' => true,
            'needsSetup' => true,
            'authenticated' => false,
            'hasUsers' => false,
            'hasData' => loyerDataFileHasContent($ctx['dataFile']),
            'user' => null,
            'oauthLogin' => [
                'google' => loyerOAuthProviderEnabled($ctx['config'], 'google'),
                'microsoft' => loyerOAuthProviderEnabled($ctx['config'], 'microsoft'),
            ],
            'dbError' => 'Configuration serveur incomplète.',
            'serverBlocked' => !loyerDbAvailable(),
        ]);
    }
}

/** POST premier compte local. */
function loyerHandleAuthSetup(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        if (!loyerAuthNeedsSetup($pdo, $ctx['dataFile'])) {
            respondJson(['ok' => false, 'error' => 'Configuration déjà effectuée.'], 409);
        }
        $body = loyerJsonBody();
        $user = loyerAuthSetupLocal(
            $pdo,
            (string) ($body['email'] ?? ''),
            (string) ($body['password'] ?? ''),
            $ctx['config']
        );
        $imported = loyerProfileApplyPendingImportIfAny($ctx, $pdo);
        respondJson(['ok' => true, 'user' => $user, 'profileImported' => $imported]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** POST connexion passphrase. */
function loyerHandleAuthLogin(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        $body = loyerJsonBody();
        $user = loyerAuthLoginLocal(
            $pdo,
            (string) ($body['email'] ?? ''),
            (string) ($body['password'] ?? ''),
            $ctx['config']
        );
        respondJson(['ok' => true, 'user' => $user]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 401);
    }
}

/** POST déconnexion session. */
function loyerHandleAuthLogout(array $ctx): void
{
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerAuthLogout($pdo);
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** POST changement passphrase compte local. */
function loyerHandleAuthChangePassword(array $ctx): void
{
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerAuthRequireSession($pdo, $ctx['config'], $ctx['dataFile']);
        $body = loyerJsonBody();
        loyerAuthChangePassword(
            $pdo,
            (string) ($body['currentPassword'] ?? ''),
            (string) ($body['newPassword'] ?? '')
        );
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** POST suppression compte utilisateur. */
function loyerHandleAuthDeleteAccount(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    loyerStartAppSession($ctx['config']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerAuthRequireSession($pdo, $ctx['config'], $ctx['dataFile']);
        $body = loyerJsonBody();
        $resetAllData = !empty($body['resetAllData']);
        loyerAuthDeleteAccount($pdo, isset($body['password']) ? (string) $body['password'] : null, $resetAllData, $ctx);
        respondJson(['ok' => true, 'resetAllData' => $resetAllData]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** Redirect OAuth identité Google/Microsoft. */
function loyerHandleAuthOAuthStart(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    $provider = isset($_GET['provider']) ? (string) $_GET['provider'] : '';
    try {
        loyerAuthOAuthStart($ctx['config'], $provider);
    } catch (Throwable $e) {
        loyerStartAppSession($ctx['config']);
        loyerAuthRedirectAfterLoginError($e->getMessage());
    }
}

/** GET/POST configuration SMTP. */
function loyerHandleSmtpSettings(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    try {
        $pdo = loyerDbFromCtx($ctx);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }

    if ($ctx['method'] === 'GET') {
        respondJson(['ok' => true, 'smtp' => loyerSmtpPublicStatus($pdo)]);
    }

    if ($ctx['method'] === 'POST') {
        loyerDemoRejectIfEnabled($ctx);
        $body = loyerJsonBody();
        if (!empty($body['clear'])) {
            loyerSmtpClear($pdo);
            respondJson(['ok' => true, 'smtp' => loyerSmtpPublicStatus($pdo)]);
        }
        if (!empty($body['test'])) {
            try {
                loyerSmtpTestFromInput($pdo, $ctx['config'], $body);
                loyerLogActivity($pdo, 'smtp_test', 'success', 'Test connexion SMTP réussi', [
                    'host' => trim((string) ($body['host'] ?? '')),
                ]);
                respondJson([
                    'ok' => true,
                    'message' => 'Connexion et authentification SMTP réussies.',
                ]);
            } catch (Throwable $e) {
                loyerLogActivity($pdo, 'smtp_test', 'error', 'Échec test SMTP', [
                    'host' => trim((string) ($body['host'] ?? '')),
                ], $e->getMessage());
                respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
            }
        }
        $smtp = loyerSmtpSave($pdo, $ctx['config'], $body);
        respondJson(['ok' => true, 'smtp' => $smtp]);
    }

    respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
}

/** GET état transport mail OAuth/SMTP. */
function loyerHandleMailTransportStatus(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    try {
        $pdo = loyerDbFromCtx($ctx);
        respondJson(['ok' => true] + loyerMailTransportStatus($pdo, $ctx['config']));
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}
