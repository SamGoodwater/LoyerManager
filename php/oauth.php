<?php

/**
 * OAuth Google/Microsoft : identité (login) et mail (envoi/brouillon).
 */
declare(strict_types=1);

use League\OAuth2\Client\Provider\Google;
use TheNetworg\OAuth2\Client\Provider\Azure;

/** True si provider OAuth configuré et activé. */
function loyerOAuthProviderEnabled(array $config, string $provider): bool
{
    $block = loyerOAuthConfig($config, $provider);
    if (empty($block['enabled'])) {
        return false;
    }
    return !empty($block['client_id']) && !empty($block['client_secret']);
}

/** Instancie League Google OAuth2 client. */
function loyerGoogleProvider(array $config): Google
{
    $block = loyerOAuthConfig($config, 'google');
    return new Google([
        'clientId' => (string) $block['client_id'],
        'clientSecret' => (string) $block['client_secret'],
        'redirectUri' => loyerOAuthRedirectUri('google', $config),
    ]);
}

/** Instancie Azure OAuth2 client (tenant configurable). */
function loyerMicrosoftProvider(array $config): Azure
{
    $block = loyerOAuthConfig($config, 'microsoft');
    $tenant = (string) ($block['tenant'] ?? 'common');
    return new Azure([
        'clientId' => (string) $block['client_id'],
        'clientSecret' => (string) $block['client_secret'],
        'redirectUri' => loyerOAuthRedirectUri('microsoft', $config),
        'defaultEndPointVersion' => '2.0',
        'tenant' => $tenant,
    ]);
}

/** Scopes OAuth pour envoi/brouillon mail. */
function loyerOAuthMailScopes(string $provider): array
{
    if ($provider === 'google') {
        return [
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
            'email',
        ];
    }
    if ($provider === 'microsoft') {
        return [
            'https://graph.microsoft.com/Mail.Send',
            'https://graph.microsoft.com/Mail.ReadWrite',
            'offline_access',
            'openid',
            'profile',
            'email',
        ];
    }
    return [];
}

/** Scopes OAuth identité (openid, email, profile). */
function loyerOAuthAuthScopes(string $provider): array
{
    if ($provider === 'google') {
        return ['openid', 'email', 'profile'];
    }
    if ($provider === 'microsoft') {
        return ['openid', 'profile', 'email', 'offline_access', 'User.Read'];
    }
    return [];
}

/** @deprecated use loyerOAuthMailScopes */
function loyerOAuthScopes(string $provider): array
{
    return loyerOAuthMailScopes($provider);
}

/** Lit purpose=auth|mail depuis session OAuth. */
function loyerOAuthPurposeFromRequest(): string
{
    $purpose = isset($_GET['purpose']) ? (string) $_GET['purpose'] : 'mail';
    return $purpose === 'auth' ? 'auth' : 'mail';
}

/** Valide google|microsoft ou exception. */
function loyerValidateOAuthProvider(string $provider): void
{
    if ($provider !== 'google' && $provider !== 'microsoft') {
        throw new InvalidArgumentException('Fournisseur OAuth inconnu.');
    }
}

/** Libellé affichable du provider. */
function loyerOAuthProviderLabel(string $provider): string
{
    return $provider === 'google' ? 'Google' : ($provider === 'microsoft' ? 'Microsoft' : $provider);
}

/** Redirige vers consent OAuth (auth ou mail). */
function loyerOAuthStart(array $config, string $provider, string $purpose = 'mail'): void
{
    loyerValidateOAuthProvider($provider);
    if (!loyerOAuthProviderEnabled($config, $provider)) {
        if ($purpose === 'auth') {
            loyerStartAppSession($config);
            loyerAuthRedirectAfterLoginError(
                'Connexion ' . loyerOAuthProviderLabel($provider) . ' non disponible sur ce serveur.'
            );
        }
        respondJson(['ok' => false, 'error' => 'OAuth non configuré pour ce fournisseur.'], 503);
    }
    if ($purpose === 'mail' && loyerEncryptionKey($config) === '') {
        respondJson(['ok' => false, 'error' => 'encryption_key manquante dans config.php.'], 503);
    }

    loyerStartAppSession($config);
    $state = bin2hex(random_bytes(16));
    $_SESSION['oauth_state'] = $state;
    $_SESSION['oauth_provider'] = $provider;
    $_SESSION['oauth_purpose'] = $purpose;

    $scopes = $purpose === 'auth' ? loyerOAuthAuthScopes($provider) : loyerOAuthMailScopes($provider);
    $options = [
        'scope' => $scopes,
        'state' => $state,
    ];
    if ($provider === 'google') {
        $options['access_type'] = 'offline';
        $options['prompt'] = 'consent';
        $url = loyerGoogleProvider($config)->getAuthorizationUrl($options);
    } else {
        $options['prompt'] = 'consent';
        $url = loyerMicrosoftProvider($config)->getAuthorizationUrl($options);
    }
    header('Location: ' . $url, true, 302);
    exit;
}

/** Récupère e-mail depuis token provider. */
function loyerOAuthFetchEmail(string $provider, $accessToken): string
{
    if ($provider === 'google') {
        $client = new Google\Client();
        $client->setAccessToken(['access_token' => (string) $accessToken->getToken()]);
        $oauth2 = new Google\Service\Oauth2($client);
        $info = $oauth2->userinfo->get();
        return (string) ($info->email ?? '');
    }
    $providerObj = null;
    return '';
}

/** E-mail Microsoft via Graph /me. */
function loyerOAuthFetchMicrosoftEmail($accessToken, array $config): string
{
    $token = (string) $accessToken->getToken();
    $ch = curl_init('https://graph.microsoft.com/v1.0/me?$select=mail,userPrincipalName');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    if ($body === false) {
        return '';
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        return '';
    }
    $mail = (string) ($data['mail'] ?? '');
    if ($mail !== '') {
        return $mail;
    }
    return (string) ($data['userPrincipalName'] ?? '');
}

/** Persiste tokens chiffrés en loyer.db. */
function loyerOAuthSaveConnection(
    PDO $pdo,
    array $config,
    string $provider,
    string $email,
    string $refreshToken,
    array $scopes
): void {
    $key = loyerEncryptionKey($config);
    if ($key === '') {
        throw new RuntimeException('encryption_key manquante.');
    }
    $enc = loyerEncrypt($refreshToken, $key);
    $now = gmdate('c');
    $scopesStr = implode(' ', $scopes);

    $stmt = $pdo->prepare(
        'INSERT INTO oauth_connections (provider, email, refresh_token_enc, scopes, is_active, connected_at, updated_at)
         VALUES (?, ?, ?, ?, 0, ?, ?)
         ON CONFLICT(provider, email) DO UPDATE SET
           refresh_token_enc = excluded.refresh_token_enc,
           scopes = excluded.scopes,
           updated_at = excluded.updated_at'
    );
    $stmt->execute([$provider, $email, $enc, $scopesStr, $now, $now]);

    $pdo->exec('UPDATE oauth_connections SET is_active = 0');
    $active = $pdo->prepare(
        'UPDATE oauth_connections SET is_active = 1 WHERE provider = ? AND email = ?'
    );
    $active->execute([$provider, $email]);
}

/** Callback OAuth : auth login ou connexion mail. Retourne true si import profil en attente appliqué. */
function loyerOAuthHandleCallback(array $ctx, string $provider, string $code, string $state): bool
{
    $config = $ctx['config'];
    $pdo = loyerDbFromCtx($ctx);
    loyerValidateOAuthProvider($provider);
    loyerStartAppSession($config);
    $expected = (string) ($_SESSION['oauth_state'] ?? '');
    $sessionProvider = (string) ($_SESSION['oauth_provider'] ?? '');
    $purpose = (string) ($_SESSION['oauth_purpose'] ?? 'mail');
    unset($_SESSION['oauth_state'], $_SESSION['oauth_provider'], $_SESSION['oauth_purpose']);

    // Anti-CSRF : le state doit correspondre à la session et au provider
    if ($expected === '' || !hash_equals($expected, $state) || $sessionProvider !== $provider) {
        throw new RuntimeException('État OAuth invalide — réessayez la connexion.');
    }

    if ($purpose === 'auth') {
        // Branche connexion identité (login.html) — crée ou ouvre session utilisateur
        if ($provider === 'google') {
            $google = loyerGoogleProvider($config);
            $token = $google->getAccessToken('authorization_code', ['code' => $code]);
            $profile = loyerAuthFetchGoogleProfile($token);
        } else {
            $azure = loyerMicrosoftProvider($config);
            $token = $azure->getAccessToken('authorization_code', ['code' => $code]);
            $profile = loyerAuthFetchMicrosoftProfile($token);
        }
        if ($profile['email'] === '') {
            throw new RuntimeException('Impossible de lire l\'adresse e-mail du compte.');
        }
        loyerStartAppSession($config, $pdo);
        loyerAuthLoginOrCreateOAuth(
            $pdo,
            $provider,
            $profile['email'],
            $profile['sub'],
            $profile['name'],
            $config
        );
        return loyerProfileApplyPendingImportIfAny($ctx, $pdo);
    }

    if ($provider === 'google') {
        $google = loyerGoogleProvider($config);
        $token = $google->getAccessToken('authorization_code', ['code' => $code]);
        $refresh = $token->getRefreshToken();
        if (!$refresh) {
            throw new RuntimeException('Google n\'a pas renvoyé de refresh token — déconnectez l\'app dans votre compte Google et réessayez.');
        }
        $email = loyerOAuthFetchEmail('google', $token);
        if ($email === '') {
            throw new RuntimeException('Impossible de lire l\'adresse Gmail.');
        }
        loyerOAuthSaveConnection($pdo, $config, 'google', $email, (string) $refresh, loyerOAuthMailScopes('google'));
        return false;
    }

    $azure = loyerMicrosoftProvider($config);
    $token = $azure->getAccessToken('authorization_code', ['code' => $code]);
    $refresh = $token->getRefreshToken();
    if (!$refresh) {
        throw new RuntimeException('Microsoft n\'a pas renvoyé de refresh token — réessayez avec consentement.');
    }
    $email = loyerOAuthFetchMicrosoftEmail($token, $config);
    if ($email === '') {
        throw new RuntimeException('Impossible de lire l\'adresse Outlook.');
    }
    loyerOAuthSaveConnection($pdo, $config, 'microsoft', $email, (string) $refresh, loyerOAuthMailScopes('microsoft'));
    return false;
}

/** Redirect index.html selon purpose. */
function loyerOAuthRedirectAfterCallback(string $purpose, string $query = ''): void
{
    if ($purpose === 'auth') {
        if ($query !== '' && strpos($query, 'oauth_error=') === 0) {
            loyerAuthRedirectAfterLoginError(rawurldecode(substr($query, 12)));
        }
        loyerAuthRedirectAfterLogin($query !== '' && strpos($query, 'oauth_ok=') === 0 ? '' : $query);
    }
    loyerOAuthRedirectToApp($query);
}

/** Redirect index.html avec query optionnelle. */
function loyerOAuthRedirectToApp(string $query = ''): void
{
    $base = loyerPublicBaseUrl();
    $url = $base . '/index.html#settings-mail-oauth';
    if ($query !== '') {
        $url .= '?' . $query;
    }
    header('Location: ' . $url, true, 302);
    exit;
}

/** Liste connexions mail + compte actif pour UI. */
function loyerOAuthStatus(PDO $pdo, array $config): array
{
    $providers = [];
    foreach (['google', 'microsoft'] as $p) {
        $providers[$p] = [
            'enabled' => loyerOAuthProviderEnabled($config, $p),
            'connected' => false,
            'email' => '',
        ];
    }
    $rows = $pdo->query('SELECT provider, email, is_active FROM oauth_connections ORDER BY provider, email')->fetchAll();
    $active = null;
    foreach ($rows as $row) {
        $p = (string) $row['provider'];
        if (!isset($providers[$p])) {
            continue;
        }
        $providers[$p]['connected'] = true;
        if ((int) $row['is_active'] === 1) {
            $providers[$p]['email'] = (string) $row['email'];
            $active = ['provider' => $p, 'email' => (string) $row['email']];
        } elseif ($providers[$p]['email'] === '') {
            $providers[$p]['email'] = (string) $row['email'];
        }
    }
    if ($active === null && count($rows) > 0) {
        $first = $rows[0];
        $active = ['provider' => (string) $first['provider'], 'email' => (string) $first['email']];
    }
    return [
        'encryptionConfigured' => loyerEncryptionKey($config) !== '',
        'active' => $active,
        'providers' => $providers,
        'redirectUri' => [
            'google' => loyerOAuthRedirectUri('google', $config),
            'microsoft' => loyerOAuthRedirectUri('microsoft', $config),
        ],
    ];
}

/** Supprime connexion OAuth mail d'un provider. */
function loyerOAuthDisconnect(PDO $pdo, string $provider): void
{
    loyerValidateOAuthProvider($provider);
    $stmt = $pdo->prepare('DELETE FROM oauth_connections WHERE provider = ?');
    $stmt->execute([$provider]);
}

/** Définit compte expéditeur mail actif. */
function loyerOAuthSetActive(PDO $pdo, string $provider, string $email): void
{
    loyerValidateOAuthProvider($provider);
    $check = $pdo->prepare('SELECT id FROM oauth_connections WHERE provider = ? AND email = ?');
    $check->execute([$provider, $email]);
    if (!$check->fetch()) {
        throw new RuntimeException('Compte non connecté.');
    }
    $pdo->exec('UPDATE oauth_connections SET is_active = 0');
    $stmt = $pdo->prepare('UPDATE oauth_connections SET is_active = 1 WHERE provider = ? AND email = ?');
    $stmt->execute([$provider, $email]);
}

/** Ligne oauth_connections active ou null. */
function loyerOAuthGetActiveConnection(PDO $pdo): ?array
{
    $stmt = $pdo->query(
        'SELECT provider, email, refresh_token_enc, scopes FROM oauth_connections WHERE is_active = 1 LIMIT 1'
    );
    $row = $stmt->fetch();
    if (!$row) {
        $row = $pdo->query(
            'SELECT provider, email, refresh_token_enc, scopes FROM oauth_connections ORDER BY updated_at DESC LIMIT 1'
        )->fetch();
    }
    return $row ?: null;
}

/** Access token valide (refresh si expiré). */
function loyerOAuthAccessToken(array $config, PDO $pdo, array $connection): string
{
    $key = loyerEncryptionKey($config);
    if ($key === '') {
        throw new RuntimeException('encryption_key manquante.');
    }
    $refresh = loyerDecrypt((string) $connection['refresh_token_enc'], $key);
    $provider = (string) $connection['provider'];

    if ($provider === 'google') {
        $google = loyerGoogleProvider($config);
        $token = $google->getAccessToken('refresh_token', ['refresh_token' => $refresh]);
        if (!$token || !$token->getToken()) {
            throw new RuntimeException('Impossible de rafraîchir le token Google — reconnectez Gmail.');
        }
        return (string) $token->getToken();
    }

    $azure = loyerMicrosoftProvider($config);
    $token = $azure->getAccessToken('refresh_token', ['refresh_token' => $refresh]);
    if (!$token || !$token->getToken()) {
        throw new RuntimeException('Impossible de rafraîchir le token Microsoft — reconnectez Outlook.');
    }
    return (string) $token->getToken();
}
