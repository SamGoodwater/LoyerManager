<?php
/**
 * Handlers API OAuth mail
 *
 * Connexion Gmail/Outlook pour l'envoi.
 */
declare(strict_types=1);

/** GET oauth-status UI mail. */
function loyerHandleOAuthStatus(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    assertDirWritable($ctx['dataDir'], 'data/');
    try {
        $pdo = loyerDbFromCtx($ctx);
        $status = loyerOAuthStatus($pdo, $ctx['config']);
        $status['mailTransport'] = loyerMailTransportStatus($pdo, $ctx['config']);
        respondJson(['ok' => true] + $status);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** Redirect oauth-start purpose=mail. */
function loyerHandleOAuthStart(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    $provider = isset($_GET['provider']) ? (string) $_GET['provider'] : '';
    $purpose = loyerOAuthPurposeFromRequest();
    try {
        loyerOAuthStart($ctx['config'], $provider, $purpose);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** Callback unifié auth + mail. */
function loyerHandleOAuthCallback(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    $provider = isset($_GET['provider']) ? (string) $_GET['provider'] : '';
    $code = isset($_GET['code']) ? (string) $_GET['code'] : '';
    $state = isset($_GET['state']) ? (string) $_GET['state'] : '';
    $oauthError = isset($_GET['error']) ? (string) $_GET['error'] : '';

    loyerStartAppSession($ctx['config']);
    $purpose = (string) ($_SESSION['oauth_purpose'] ?? 'mail');

    if ($oauthError !== '') {
        if ($purpose === 'auth') {
            loyerAuthRedirectAfterLoginError($oauthError);
        }
        loyerOAuthRedirectToApp('oauth_error=' . rawurlencode($oauthError));
    }

    try {
        assertDirWritable($ctx['dataDir'], 'data/');
        $pdo = loyerDbFromCtx($ctx);
        $profileImported = loyerOAuthHandleCallback($ctx, $provider, $code, $state);
        if ($purpose === 'auth') {
            loyerAuthRedirectAfterLogin($profileImported ? 'profile_imported=1' : '');
        }
        loyerLogActivity($pdo, 'oauth_connected', 'success', 'Compte mail ' . $provider . ' connecté', ['provider' => $provider]);
        loyerOAuthRedirectToApp('oauth_ok=1');
    } catch (Throwable $e) {
        try {
            $pdo = loyerDbFromCtx($ctx);
            loyerLogActivity($pdo, 'oauth_connected', 'error', 'Échec connexion ' . $provider, ['provider' => $provider], $e->getMessage());
        } catch (Throwable $ignored) {
        }
        if ($purpose === 'auth') {
            loyerAuthRedirectAfterLoginError($e->getMessage());
        }
        loyerOAuthRedirectToApp('oauth_error=' . rawurlencode($e->getMessage()));
    }
}

/** POST déconnexion compte mail. */
function loyerHandleOAuthDisconnect(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    $body = loyerJsonBody();
    $provider = (string) ($body['provider'] ?? '');
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerOAuthDisconnect($pdo, $provider);
        loyerLogActivity($pdo, 'oauth_disconnected', 'success', 'Compte ' . $provider . ' déconnecté', ['provider' => $provider]);
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** POST choix compte expéditeur actif. */
function loyerHandleOAuthSetActive(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    $body = loyerJsonBody();
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerOAuthSetActive($pdo, (string) ($body['provider'] ?? ''), (string) ($body['email'] ?? ''));
        respondJson(['ok' => true] + loyerOAuthStatus($pdo, $ctx['config']));
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}
