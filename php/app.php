<?php

/**
 * Config, URLs publiques, corps JSON requêtes.
 */
declare(strict_types=1);

const LOYER_APP_VERSION = '1.0.0';
const LOYER_DB_SCHEMA_VERSION = 2;

/** Charge vendor/autoload.php si présent. */
function loyerVendorAutoload(string $baseDir): void
{
    $autoload = $baseDir . '/vendor/autoload.php';
    if (is_file($autoload)) {
        require_once $autoload;
    }
}

/** Accès sûr clé config avec défaut. */
function loyerConfigValue(array $config, string $key, $default = null)
{
    return array_key_exists($key, $config) ? $config[$key] : $default;
}

/** Bloc oauth.google|microsoft depuis config. */
function loyerOAuthConfig(array $config, string $provider): array
{
    $oauth = loyerConfigValue($config, 'oauth', []);
    if (!is_array($oauth)) {
        return [];
    }
    $block = loyerConfigValue($oauth, $provider, []);
    return is_array($block) ? $block : [];
}

/** Clé 32 octets depuis encryption_key config. */
function loyerEncryptionKey(array $config): string
{
    $raw = (string) loyerConfigValue($config, 'encryption_key', '');
    if ($raw === '') {
        return '';
    }
    $decoded = base64_decode($raw, true);
    if ($decoded === false || strlen($decoded) < 32) {
        return '';
    }
    return substr($decoded, 0, 32);
}

/** URL publique de l'app (racine web), sans slash final. */
function loyerPublicBaseUrl(?array $config = null): string
{
    if ($config === null && isset($GLOBALS['LOYER_CONFIG']) && is_array($GLOBALS['LOYER_CONFIG'])) {
        $config = $GLOBALS['LOYER_CONFIG'];
    }
    if (is_array($config)) {
        $override = trim((string) loyerConfigValue($config, 'public_base_url', ''));
        if ($override !== '') {
            return rtrim($override, '/');
        }
    }

    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (isset($_SERVER['SERVER_PORT']) && (string) $_SERVER['SERVER_PORT'] === '443')
        || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string) $_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https')
        || (isset($_SERVER['HTTP_X_FORWARDED_SSL']) && $_SERVER['HTTP_X_FORWARDED_SSL'] === 'on');
    $scheme = $https ? 'https' : 'http';
    $host = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');

    $path = loyerPublicBasePath();
    if ($path === '') {
        return $scheme . '://' . $host;
    }
    return $scheme . '://' . $host . $path;
}

/** Chemin web relatif à la racine du site (ex. /LoyerManager), sans slash final. */
function loyerPublicBasePath(): string
{
    $docRoot = rtrim(str_replace('\\', '/', (string) ($_SERVER['DOCUMENT_ROOT'] ?? '')), '/');
    $appRoot = isset($GLOBALS['LOYER_APP_ROOT'])
        ? rtrim(str_replace('\\', '/', (string) $GLOBALS['LOYER_APP_ROOT']), '/')
        : '';
    if ($docRoot !== '' && $appRoot !== '' && strpos($appRoot, $docRoot) === 0) {
        $rel = substr($appRoot, strlen($docRoot));
        if ($rel === '' || $rel === false) {
            return '';
        }
        return rtrim($rel, '/');
    }

    // Repli : répertoire parent de api.php (legacy)
    $script = (string) ($_SERVER['SCRIPT_NAME'] ?? '/api.php');
    if (substr($script, -8) === '/api.php') {
        $dir = rtrim(str_replace('\\', '/', dirname($script)), '/');
        if ($dir === '' || $dir === '.') {
            return '';
        }
        return $dir;
    }
    return '';
}

/** URI callback OAuth enregistrée chez Google / Microsoft Entra. */
function loyerOAuthRedirectUri(string $provider, ?array $config = null): string
{
    $base = loyerPublicBaseUrl($config);
    if ($provider === 'microsoft') {
        // Entra interdit ?query= dans l'URI pour les comptes Microsoft personnels.
        return $base . '/oauth/callback/microsoft.php';
    }
    return $base . '/api.php?action=oauth-callback&provider=' . rawurlencode($provider);
}

/** Session courte LOYER_OAUTH pour flux OAuth. */
function loyerStartOAuthSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $params = [
        'cookie_httponly' => true,
        'cookie_samesite' => 'Lax',
        'use_strict_mode' => true,
    ];
    if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $params['cookie_secure'] = true;
    }
    session_name('LOYER_OAUTH');
    session_start($params);
}

/** Parse corps JSON requête POST. */
function loyerJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }
    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}
