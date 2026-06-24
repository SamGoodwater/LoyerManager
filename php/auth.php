<?php
/**
 * Authentification Loyer Manager
 *
 * Session PHP, compte local (passphrase), OAuth identité, garde API.
 */
declare(strict_types=1);

/** Durée de session en heures (config, bornée 1–8760). */
function loyerAuthSessionLifetime(array $config): int
{
    $auth = loyerConfigValue($config, 'auth', []);
    if (!is_array($auth)) {
        return 720;
    }
    $hours = (int) loyerConfigValue($auth, 'session_lifetime_hours', 720);
    return max(1, min(8760, $hours));
}

/** Durée du cookie « rester connecté » en jours (config, bornée 1–365). */
function loyerAuthRememberLifetimeDays(array $config): int
{
    $auth = loyerConfigValue($config, 'auth', []);
    if (!is_array($auth)) {
        return 180;
    }
    $days = (int) loyerConfigValue($auth, 'remember_lifetime_days', 180);
    return max(1, min(365, $days));
}

/** Nom du cookie persistant (HttpOnly). */
function loyerAuthRememberCookieName(): string
{
    return 'LOYER_REMEMBER';
}

/** Chemin cookie (racine site ou dossier de l'app). */
function loyerAuthCookiePath(): string
{
    $script = (string) ($_SERVER['SCRIPT_NAME'] ?? '/api.php');
    $dir = str_replace('\\', '/', dirname($script));
    if ($dir === '/' || $dir === '.' || $dir === '') {
        return '/';
    }
    return rtrim($dir, '/') . '/';
}

/** True si la requête est en HTTPS. */
function loyerAuthCookieSecure(): bool
{
    return !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
}

/** Pose le cookie « rester connecté ». */
function loyerAuthSetRememberCookie(string $value, int $lifetimeSeconds, array $config): void
{
    setcookie(loyerAuthRememberCookieName(), $value, [
        'expires' => time() + $lifetimeSeconds,
        'path' => loyerAuthCookiePath(),
        'secure' => loyerAuthCookieSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Supprime le cookie « rester connecté ». */
function loyerAuthClearRememberCookie(): void
{
    setcookie(loyerAuthRememberCookieName(), '', [
        'expires' => time() - 3600,
        'path' => loyerAuthCookiePath(),
        'secure' => loyerAuthCookieSecure(),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
}

/** Purge les jetons expirés. */
function loyerAuthPurgeExpiredRememberTokens(PDO $pdo): void
{
    $stmt = $pdo->prepare('DELETE FROM auth_remember_tokens WHERE expires_at < ?');
    $stmt->execute([gmdate('c')]);
}

/** Révoque tous les jetons « rester connecté » d'un utilisateur. */
function loyerAuthRevokeRememberTokens(PDO $pdo, int $userId): void
{
    $stmt = $pdo->prepare('DELETE FROM auth_remember_tokens WHERE user_id = ?');
    $stmt->execute([$userId]);
}

/** Émet un jeton « rester connecté » (cookie + base). */
function loyerAuthIssueRememberToken(PDO $pdo, int $userId, array $config): void
{
    loyerAuthPurgeExpiredRememberTokens($pdo);
    loyerAuthRevokeRememberTokens($pdo, $userId);

    $selector = bin2hex(random_bytes(16));
    $validator = bin2hex(random_bytes(32));
    $days = loyerAuthRememberLifetimeDays($config);
    $now = gmdate('c');
    $expires = gmdate('c', time() + $days * 86400);

    $stmt = $pdo->prepare(
        'INSERT INTO auth_remember_tokens (user_id, selector, token_hash, expires_at, created_at, last_used_at)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        $userId,
        $selector,
        hash('sha256', $validator),
        $expires,
        $now,
        $now,
    ]);

    loyerAuthSetRememberCookie($selector . ':' . $validator, $days * 86400, $config);
}

/** Restaure la session depuis le cookie « rester connecté » si valide. */
function loyerAuthRestoreFromRemember(PDO $pdo, array $config): bool
{
    if (loyerAuthIsLoggedIn() || loyerDemoEnabled($config)) {
        return loyerAuthIsLoggedIn();
    }

    $raw = (string) ($_COOKIE[loyerAuthRememberCookieName()] ?? '');
    if ($raw === '' || strpos($raw, ':') === false) {
        return false;
    }

    [$selector, $validator] = explode(':', $raw, 2);
    if ($selector === '' || $validator === '') {
        loyerAuthClearRememberCookie();
        return false;
    }

    loyerAuthPurgeExpiredRememberTokens($pdo);

    $stmt = $pdo->prepare(
        'SELECT t.*, u.email, u.auth_provider, u.display_name
         FROM auth_remember_tokens t
         INNER JOIN users u ON u.id = t.user_id
         WHERE t.selector = ? LIMIT 1'
    );
    $stmt->execute([$selector]);
    $row = $stmt->fetch();
    if (!$row) {
        loyerAuthClearRememberCookie();
        return false;
    }

    if (strcmp((string) $row['expires_at'], gmdate('c')) < 0) {
        $del = $pdo->prepare('DELETE FROM auth_remember_tokens WHERE id = ?');
        $del->execute([(int) $row['id']]);
        loyerAuthClearRememberCookie();
        return false;
    }

    if (!hash_equals((string) $row['token_hash'], hash('sha256', $validator))) {
        loyerAuthRevokeRememberTokens($pdo, (int) $row['user_id']);
        loyerAuthClearRememberCookie();
        return false;
    }

    $upd = $pdo->prepare('UPDATE auth_remember_tokens SET last_used_at = ? WHERE id = ?');
    $upd->execute([gmdate('c'), (int) $row['id']]);

    loyerAuthLoginUser($pdo, $row, $config, false);
    return true;
}

/** Démarre la session PHP LOYER_SESS (cookie HttpOnly, durée configurable). */
function loyerStartAppSession(array $config, ?PDO $pdo = null): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        if ($pdo !== null && !loyerDemoEnabled($config)) {
            loyerAuthRestoreFromRemember($pdo, $config);
        }
        return;
    }
    $lifetime = loyerAuthSessionLifetime($config) * 3600;
    $params = [
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
        'gc_maxlifetime' => $lifetime,
        'cookie_lifetime' => $lifetime,
        'cookie_path' => loyerAuthCookiePath(),
    ];
    if (loyerAuthCookieSecure()) {
        $params['cookie_secure'] = true;
    }
    session_name('LOYER_SESS');
    session_start($params);

    if ($pdo !== null && !loyerDemoEnabled($config)) {
        loyerAuthRestoreFromRemember($pdo, $config);
    }
}


/** Nombre d'utilisateurs en base. */
function loyerAuthUserCount(PDO $pdo): int
{
    return (int) $pdo->query('SELECT COUNT(*) AS c FROM users')->fetch()['c'];
}

/** True si au moins un compte existe. */
function loyerAuthHasUsers(PDO $pdo): bool
{
    return loyerAuthUserCount($pdo) > 0;
}

/** True si le JSON métier contient des données. */
function loyerDataFileHasContent(string $dataFile): bool
{
    if (!is_file($dataFile)) {
        return false;
    }
    return trim((string) file_get_contents($dataFile)) !== '';
}

/** True tant qu'aucun compte utilisateur n'existe. */
function loyerAuthNeedsSetup(PDO $pdo, string $dataFile): bool
{
    return !loyerAuthHasUsers($pdo);
}

/** True si user_id est en session. */
function loyerAuthIsLoggedIn(): bool
{
    return !empty($_SESSION['user_id']);
}

/** Retourne l'utilisateur connecté ou null. */
function loyerAuthCurrentUser(PDO $pdo): ?array
{
    if (!loyerAuthIsLoggedIn()) {
        return null;
    }
    $stmt = $pdo->prepare('SELECT id, email, auth_provider, display_name FROM users WHERE id = ?');
    $stmt->execute([(int) $_SESSION['user_id']]);
    $row = $stmt->fetch();
    return $row ?: null;
}

/** État auth pour login.html et l'app (needsSetup, oauthLogin…). */
function loyerAuthStatus(PDO $pdo, array $config, string $dataFile): array
{
    if (loyerDemoEnabled($config)) {
        return loyerDemoAuthStatus($config);
    }
    $needsSetup = loyerAuthNeedsSetup($pdo, $dataFile);
    $user = loyerAuthCurrentUser($pdo);
    return [
        'needsSetup' => $needsSetup,
        'authenticated' => $user !== null,
        'hasUsers' => loyerAuthHasUsers($pdo),
        'hasData' => loyerDataFileHasContent($dataFile),
        'user' => $user ? [
            'email' => (string) $user['email'],
            'provider' => (string) $user['auth_provider'],
            'displayName' => (string) ($user['display_name'] ?? ''),
        ] : null,
        'oauthLogin' => [
            'google' => loyerOAuthProviderEnabled($config, 'google'),
            'microsoft' => loyerOAuthProviderEnabled($config, 'microsoft'),
        ],
        'oauthRedirectUris' => [
            'google' => loyerOAuthProviderEnabled($config, 'google')
                ? loyerOAuthRedirectUri('google', $config) : '',
            'microsoft' => loyerOAuthProviderEnabled($config, 'microsoft')
                ? loyerOAuthRedirectUri('microsoft', $config) : '',
        ],
    ];
}

/** Normalise et valide l'e-mail ; lève InvalidArgumentException. */
function loyerAuthValidateEmail(string $email): string
{
    $email = trim(strtolower($email));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new InvalidArgumentException('Adresse e-mail invalide.');
    }
    return $email;
}

/** Valide la passphrase (min. 8 caractères). */
function loyerAuthValidatePassword(string $password): void
{
    if (strlen($password) < 8) {
        throw new InvalidArgumentException('La passphrase doit contenir au moins 8 caractères.');
    }
}

/** Hache la passphrase avec password_hash (PASSWORD_DEFAULT). */
function loyerAuthHashPassword(string $password): string
{
    if (!function_exists('password_hash')) {
        throw new RuntimeException('password_hash indisponible sur ce serveur PHP.');
    }
    $hash = password_hash($password, PASSWORD_DEFAULT);
    if ($hash === false) {
        throw new RuntimeException('Impossible de hacher le mot de passe.');
    }
    return $hash;
}

/** Vérifie une passphrase contre le hash stocké. */
function loyerAuthVerifyPassword(string $password, string $hash): bool
{
    if ($hash === '') {
        return false;
    }
    return password_verify($password, $hash);
}

/** Enregistre user_id en session et retourne le profil public. */
function loyerAuthLoginUser(PDO $pdo, array $userRow, array $config, bool $issueRemember = true): array
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_regenerate_id(true);
    }
    $_SESSION['user_id'] = (int) $userRow['id'];
    $_SESSION['user_email'] = (string) $userRow['email'];
    if ($issueRemember) {
        loyerAuthIssueRememberToken($pdo, (int) $userRow['id'], $config);
    }
    return [
        'email' => (string) $userRow['email'],
        'provider' => (string) $userRow['auth_provider'],
        'displayName' => (string) ($userRow['display_name'] ?? ''),
    ];
}

/** Crée le premier compte local (e-mail + passphrase). */
function loyerAuthSetupLocal(PDO $pdo, string $email, string $password, array $config): array
{
    if (loyerAuthHasUsers($pdo)) {
        throw new RuntimeException('Un compte existe déjà — connectez-vous.');
    }
    $email = loyerAuthValidateEmail($email);
    loyerAuthValidatePassword($password);
    $now = gmdate('c');
    $stmt = $pdo->prepare(
        'INSERT INTO users (email, password_hash, auth_provider, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)'
    );
    $stmt->execute([$email, loyerAuthHashPassword($password), 'local', $now, $now]);
    $id = (int) $pdo->lastInsertId();
    loyerLogActivity($pdo, 'auth_setup', 'success', 'Compte local créé : ' . $email, ['provider' => 'local']);
    return loyerAuthLoginUser($pdo, [
        'id' => $id,
        'email' => $email,
        'auth_provider' => 'local',
        'display_name' => '',
    ], $config);
}

/** Connexion e-mail + passphrase ; journalise les échecs. */
function loyerAuthLoginLocal(PDO $pdo, string $email, string $password, array $config): array
{
    if (!loyerAuthHasUsers($pdo)) {
        throw new RuntimeException('Aucun compte — créez votre accès.');
    }
    $email = loyerAuthValidateEmail($email);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    if (!$row || !loyerAuthVerifyPassword($password, (string) ($row['password_hash'] ?? ''))) {
        loyerLogActivity($pdo, 'auth_login', 'error', 'Échec connexion local', ['email' => $email], 'Identifiants incorrects');
        throw new RuntimeException('E-mail ou passphrase incorrect.');
    }
    loyerLogActivity($pdo, 'auth_login', 'success', 'Connexion local : ' . $email, ['provider' => 'local']);
    return loyerAuthLoginUser($pdo, $row, $config);
}

/** Connexion OAuth identité ; crée le compte si aucun user. */
function loyerAuthLoginOrCreateOAuth(PDO $pdo, string $provider, string $email, string $oauthSub, string $displayName, array $config): array
{
    loyerValidateOAuthProvider($provider);
    $email = loyerAuthValidateEmail($email);
    $stmt = $pdo->prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1');
    $stmt->execute([$email]);
    $row = $stmt->fetch();
    $now = gmdate('c');

    if (!$row) {
        if (loyerAuthHasUsers($pdo)) {
            throw new RuntimeException(
                'Aucun compte associé à ' . $email . '. Connectez-vous avec votre e-mail / passphrase ou le compte enregistré.'
            );
        }
        $ins = $pdo->prepare(
            'INSERT INTO users (email, password_hash, auth_provider, oauth_sub, display_name, created_at, updated_at)
             VALUES (?, NULL, ?, ?, ?, ?, ?)'
        );
        $ins->execute([$email, $provider, $oauthSub, $displayName, $now, $now]);
        $row = [
            'id' => (int) $pdo->lastInsertId(),
            'email' => $email,
            'auth_provider' => $provider,
            'display_name' => $displayName,
        ];
        loyerLogActivity($pdo, 'auth_setup', 'success', 'Compte ' . $provider . ' créé : ' . $email, ['provider' => $provider]);
    } else {
        if ((string) $row['auth_provider'] === 'local' && empty($row['oauth_sub'])) {
            $upd = $pdo->prepare(
                'UPDATE users SET oauth_sub = ?, display_name = COALESCE(NULLIF(?, ""), display_name), updated_at = ? WHERE id = ?'
            );
            $upd->execute([$oauthSub, $displayName, $now, (int) $row['id']]);
        }
        loyerLogActivity($pdo, 'auth_login', 'success', 'Connexion ' . $provider . ' : ' . $email, ['provider' => $provider]);
    }

    return loyerAuthLoginUser($pdo, $row, $config);
}

/** Détruit la session et journalise. */
function loyerAuthLogout(PDO $pdo): void
{
    if (loyerAuthIsLoggedIn()) {
        $email = (string) ($_SESSION['user_email'] ?? '');
        loyerAuthRevokeRememberTokens($pdo, (int) $_SESSION['user_id']);
        loyerLogActivity($pdo, 'auth_logout', 'success', 'Déconnexion : ' . $email);
    }
    loyerAuthClearRememberCookie();
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

/** Garde API : 401 needsSetup ou needsLogin. */
function loyerAuthRequireSession(PDO $pdo, array $config, string $dataFile): void
{
    loyerStartAppSession($config, $pdo);
    if (loyerAuthIsLoggedIn()) {
        return;
    }
    if (!loyerAuthHasUsers($pdo)) {
        respondJson([
            'ok' => false,
            'error' => 'Configuration requise',
            'needsSetup' => true,
        ], 401);
    }
    respondJson([
        'ok' => false,
        'error' => 'Non authentifié',
        'needsLogin' => true,
    ], 401);
}

/** Garde API : session ou clé API legacy si pas de compte. */
function loyerRequireApiAccess(array $ctx): void
{
    $config = $ctx['config'];
    if (loyerDemoEnabled($config)) {
        loyerStartAppSession($config);
        return;
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
    } catch (Throwable $e) {
        checkApiKey($config);
        return;
    }
    loyerStartAppSession($config, $pdo);

    if (loyerAuthIsLoggedIn()) {
        return;
    }

    if (!loyerAuthHasUsers($pdo)) {
        $expected = isset($config['api_key']) ? (string) $config['api_key'] : '';
        if ($expected !== '') {
            checkApiKey($config);
            return;
        }
        respondJson(['ok' => false, 'error' => 'Configuration requise', 'needsSetup' => true], 401);
    }

    respondJson(['ok' => false, 'error' => 'Non authentifié', 'needsLogin' => true], 401);
}

/** Change la passphrase d'un compte local authentifié. */
function loyerAuthChangePassword(PDO $pdo, string $currentPassword, string $newPassword): void
{
    if (!loyerAuthIsLoggedIn()) {
        throw new RuntimeException('Non authentifié.');
    }
    $userId = (int) $_SESSION['user_id'];
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new RuntimeException('Compte introuvable.');
    }
    if ((string) $row['auth_provider'] !== 'local') {
        throw new RuntimeException('Votre compte utilise Google ou Microsoft — la passphrase ne s\'applique pas.');
    }
    if (!loyerAuthVerifyPassword($currentPassword, (string) ($row['password_hash'] ?? ''))) {
        throw new RuntimeException('Passphrase actuelle incorrecte.');
    }
    loyerAuthValidatePassword($newPassword);
    if ($currentPassword === $newPassword) {
        throw new InvalidArgumentException('La nouvelle passphrase doit être différente de l\'actuelle.');
    }
    $now = gmdate('c');
    $upd = $pdo->prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?');
    $upd->execute([loyerAuthHashPassword($newPassword), $now, $userId]);
    loyerLogActivity($pdo, 'auth_change_password', 'success', 'Passphrase modifiée : ' . (string) $row['email']);
    loyerAuthRevokeRememberTokens($pdo, $userId);
}

/** Supprime compte, OAuth mail, SMTP et historique ; option reset données métier. */
function loyerAuthDeleteAccount(PDO $pdo, ?string $password = null, bool $resetAllData = false, array $ctx = []): void
{
    if (!loyerAuthIsLoggedIn()) {
        throw new RuntimeException('Non authentifié.');
    }
    $userId = (int) $_SESSION['user_id'];
    $stmt = $pdo->prepare('SELECT * FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $row = $stmt->fetch();
    if (!$row) {
        throw new RuntimeException('Compte introuvable.');
    }
    if ((string) $row['auth_provider'] === 'local') {
        if ($password === null || $password === '') {
            throw new InvalidArgumentException('Passphrase requise pour supprimer ce compte.');
        }
        if (!loyerAuthVerifyPassword($password, (string) ($row['password_hash'] ?? ''))) {
            throw new RuntimeException('Passphrase incorrecte.');
        }
    }
    loyerAuthRevokeRememberTokens($pdo, $userId);
    loyerAuthClearRememberCookie();
    $pdo->exec('DELETE FROM oauth_connections');
    loyerSmtpClear($pdo);
    $pdo->exec('DELETE FROM activity_log');
    $del = $pdo->prepare('DELETE FROM users WHERE id = ?');
    $del->execute([$userId]);
    $_SESSION = [];
    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
    if ($resetAllData && $ctx !== []) {
        loyerProfileResetAllData($ctx);
    }
}

/** Redirection HTTP vers index.html après OAuth OK. */
function loyerAuthRedirectAfterLogin(string $query = ''): void
{
    $base = loyerPublicBaseUrl();
    $url = $base . '/index.html';
    if ($query !== '') {
        $url .= '?' . $query;
    }
    header('Location: ' . $url, true, 302);
    exit;
}

/** Redirection vers login.html avec message d'erreur. */
function loyerAuthRedirectAfterLoginError(string $message): void
{
    $base = loyerPublicBaseUrl();
    $url = $base . '/login.html?error=' . rawurlencode($message);
    header('Location: ' . $url, true, 302);
    exit;
}

/** Initie le flux OAuth identité (Google/Microsoft). */
function loyerAuthOAuthStart(array $config, string $provider): void
{
    loyerOAuthStart($config, $provider, 'auth');
}

/** Authentification : loyer auth fetch google profile. */
function loyerAuthFetchGoogleProfile($accessToken): array
{
    $client = new Google\Client();
    $client->setAccessToken(['access_token' => (string) $accessToken->getToken()]);
    $oauth2 = new Google\Service\Oauth2($client);
    $info = $oauth2->userinfo->get();
    return [
        'email' => (string) ($info->email ?? ''),
        'sub' => (string) ($info->id ?? ''),
        'name' => (string) ($info->name ?? ''),
    ];
}

/** Authentification : loyer auth fetch microsoft profile. */
function loyerAuthFetchMicrosoftProfile($accessToken): array
{
    $token = (string) $accessToken->getToken();
    $ch = curl_init('https://graph.microsoft.com/v1.0/me?$select=id,mail,userPrincipalName,displayName');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token],
        CURLOPT_TIMEOUT => 20,
    ]);
    $body = curl_exec($ch);
    curl_close($ch);
    if ($body === false) {
        return ['email' => '', 'sub' => '', 'name' => ''];
    }
    $data = json_decode($body, true);
    if (!is_array($data)) {
        return ['email' => '', 'sub' => '', 'name' => ''];
    }
    $mail = (string) ($data['mail'] ?? '');
    if ($mail === '') {
        $mail = (string) ($data['userPrincipalName'] ?? '');
    }
    return [
        'email' => $mail,
        'sub' => (string) ($data['id'] ?? ''),
        'name' => (string) ($data['displayName'] ?? ''),
    ];
}
