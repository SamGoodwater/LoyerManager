<?php

/**
 * Bootstrap : config, chemins, autoload handlers.
 */
declare(strict_types=1);

/**
 * Bootstrap API : config, chemins, chargement des modules.
 *
 * @return array<string, mixed>
 */
function loyerBootstrap(string $entryDir): array
{
    $configFile = $entryDir . '/config.php';
    $config = file_exists($configFile) ? (require $configFile) : [];
    if (!is_array($config)) {
        $config = [];
    }

    $baseDir = $entryDir;
    $dataDir = $baseDir . '/data';
    $templatesDir = $baseDir . '/templates';
    $quittancesDir = $templatesDir . '/quittances';
    $mailsDir = $templatesDir . '/mails';
    $dataFile = $dataDir . '/loyer-data.json';

    require_once $baseDir . '/php/http.php';
    require_once $baseDir . '/php/app.php';
    require_once $baseDir . '/php/loyer-data-validate.php';

    $GLOBALS['LOYER_APP_ROOT'] = $baseDir;
    $GLOBALS['LOYER_CONFIG'] = $config;
    require_once $baseDir . '/php/crypto.php';
    require_once $baseDir . '/php/db.php';
    require_once $baseDir . '/php/templates-fs.php';
    require_once $baseDir . '/php/activity-log.php';
    loyerVendorAutoload($baseDir);
    require_once $baseDir . '/php/oauth.php';
    require_once $baseDir . '/php/auth.php';
    require_once $baseDir . '/php/profile-backup.php';
    require_once $baseDir . '/php/demo.php';
    require_once $baseDir . '/php/smtp.php';
    require_once $baseDir . '/php/mail-send.php';

    require_once $baseDir . '/php/handlers/system.php';
    require_once $baseDir . '/php/handlers/data.php';
    require_once $baseDir . '/php/handlers/templates.php';
    require_once $baseDir . '/php/handlers/profile-api.php';
    require_once $baseDir . '/php/handlers/auth-api.php';
    require_once $baseDir . '/php/handlers/oauth-api.php';
    require_once $baseDir . '/php/handlers/mail-api.php';
    require_once $baseDir . '/php/handlers/activity-api.php';

    return [
        'config' => $config,
        'baseDir' => $baseDir,
        'dataDir' => $dataDir,
        'templatesDir' => $templatesDir,
        'quittancesDir' => $quittancesDir,
        'mailsDir' => $mailsDir,
        'dataFile' => $dataFile,
        'method' => $_SERVER['REQUEST_METHOD'] ?? 'GET',
    ];
}

/** PDO depuis ctx ; lève si SQLite indisponible. */
function loyerDbFromCtx(array $ctx): PDO
{
    [$pdo] = loyerDbInit($ctx['baseDir'], $ctx['dataDir']);
    return $pdo;
}
