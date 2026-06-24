#!/usr/bin/env php
<?php
/**
 * Restaure le jeu de démonstration (CLI / cron).
 *
 * Usage : php scripts/demo-reset.php
 */
declare(strict_types=1);

$baseDir = dirname(__DIR__);
require_once $baseDir . '/php/bootstrap.php';

$ctx = loyerBootstrap($baseDir);
if (!loyerDemoEnabled($ctx['config'])) {
    fwrite(STDERR, "demo_mode n'est pas activé dans config.php.\n");
    exit(1);
}

try {
    loyerDemoApplyGoldenState($ctx);
    echo "Démonstration réinitialisée.\n";
    exit(0);
} catch (Throwable $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
}
