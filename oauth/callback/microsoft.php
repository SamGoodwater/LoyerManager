<?php
/**
 * Callback OAuth Microsoft (URI sans paramètres — requis Entra / comptes personnels).
 */
declare(strict_types=1);

$baseDir = dirname(__DIR__, 2);
require_once $baseDir . '/php/bootstrap.php';

$ctx = loyerBootstrap($baseDir);
loyerDemoMaybeReset($ctx);
$_GET['provider'] = 'microsoft';

loyerHandleOAuthCallback($ctx);
