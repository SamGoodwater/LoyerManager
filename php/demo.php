<?php

/**
 * Mode démonstration : accès sans compte, reset périodique, actions sensibles bloquées.
 */
declare(strict_types=1);

/** True si demo_mode activé dans config.php (instance démo uniquement). */
function loyerDemoEnabled(array $config): bool
{
    return !empty($config['demo_mode']);
}

/** Bloc demo depuis config. */
function loyerDemoSettings(array $config): array
{
    $demo = loyerConfigValue($config, 'demo', []);
    return is_array($demo) ? $demo : [];
}

/** Intervalle de reset en secondes (1–168 h). */
function loyerDemoResetIntervalSeconds(array $config): int
{
    $hours = (int) loyerConfigValue(loyerDemoSettings($config), 'reset_interval_hours', 6);
    return max(1, min(168, $hours)) * 3600;
}

/** Chemin du JSON golden à restaurer. */
function loyerDemoGoldenJsonPath(array $ctx): string
{
    $custom = (string) loyerConfigValue(loyerDemoSettings($ctx['config']), 'golden_json', '');
    if ($custom !== '' && is_file($custom)) {
        return $custom;
    }
    return $ctx['baseDir'] . '/demo/loyer-data.demo.json';
}

/** Restaure données démo depuis le JSON golden. */
function loyerDemoApplyGoldenState(array $ctx): void
{
    $goldenPath = loyerDemoGoldenJsonPath($ctx);
    if (!is_file($goldenPath)) {
        throw new RuntimeException('Jeu de démonstration introuvable : ' . $goldenPath);
    }
    $raw = file_get_contents($goldenPath);
    if ($raw === false) {
        throw new RuntimeException('Lecture impossible du jeu de démonstration.');
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        throw new RuntimeException('JSON de démonstration invalide.');
    }
    loyerProfileWriteLoyerData($ctx, $data);
    loyerProfileDeleteCustomTemplates($ctx['quittancesDir'], $ctx['mailsDir']);
    try {
        $pdo = loyerDbFromCtx($ctx);
        $pdo->exec('DELETE FROM oauth_connections');
        loyerSmtpClear($pdo);
        $pdo->exec('DELETE FROM activity_log');
        $pdo->exec('DELETE FROM users');
    } catch (Throwable $e) {
        /* SQLite optionnel en démo */
    }
    $marker = $ctx['dataDir'] . '/.demo-last-reset';
    ensureDir($ctx['dataDir']);
    file_put_contents($marker, (string) time(), LOCK_EX);
}

/** Reset si intervalle écoulé (lazy, à chaque requête API). */
function loyerDemoMaybeReset(array $ctx): void
{
    if (!loyerDemoEnabled($ctx['config'])) {
        return;
    }
    $marker = $ctx['dataDir'] . '/.demo-last-reset';
    $interval = loyerDemoResetIntervalSeconds($ctx['config']);
    $last = is_file($marker) ? (int) trim((string) file_get_contents($marker)) : 0;
    if ($last > 0 && (time() - $last) < $interval) {
        return;
    }
    if (!is_file($ctx['dataFile']) || $last === 0) {
        loyerDemoApplyGoldenState($ctx);
        return;
    }
    loyerDemoApplyGoldenState($ctx);
}

/** Répond 403 si action interdite en démo (mail, compte, export…). */
function loyerDemoRejectIfEnabled(array $ctx): void
{
    if (loyerDemoEnabled($ctx['config'])) {
        respondJson([
            'ok' => false,
            'error' => 'Action indisponible en mode démonstration.',
            'demo' => true,
        ], 403);
    }
}

/** État auth-status pour le frontend démo. */
function loyerDemoAuthStatus(array $config): array
{
    $hours = (int) loyerConfigValue(loyerDemoSettings($config), 'reset_interval_hours', 6);
    return [
        'needsSetup' => false,
        'authenticated' => true,
        'demo' => true,
        'demoResetHours' => max(1, min(168, $hours)),
        'hasUsers' => false,
        'hasData' => true,
        'user' => [
            'email' => 'demo@example.com',
            'provider' => 'demo',
            'displayName' => 'Démonstration',
        ],
        'oauthLogin' => [
            'google' => false,
            'microsoft' => false,
        ],
        'oauthRedirectUris' => [
            'google' => '',
            'microsoft' => '',
        ],
    ];
}
