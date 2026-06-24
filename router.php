<?php
/**
 * Routeur pour le serveur PHP intégré (dev local uniquement).
 *
 *   php -S localhost:8080 router.php
 */
declare(strict_types=1);

$uri = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
if (!is_string($uri) || $uri === '') {
    $uri = '/';
}

$path = __DIR__ . $uri;
if ($uri !== '/' && is_file($path)) {
    return false;
}
if (is_dir($path) && is_file($path . '/index.html')) {
    return false;
}

http_response_code(404);
header('Content-Type: text/html; charset=UTF-8');
readfile(__DIR__ . '/404.html');
return true;
