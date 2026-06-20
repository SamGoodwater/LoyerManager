<?php
/**
 * Routeur pour le serveur PHP intégré (php -S).
 * Bloque l'accès direct à data/ et templates/ — seule api.php y accède côté serveur.
 */
declare(strict_types=1);

$uri = urldecode(parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');

if (preg_match('#^/(data|templates)/#', $uri)) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    echo 'Accès interdit';
    return true;
}

$path = __DIR__ . $uri;
if ($uri !== '/' && is_file($path)) {
    return false;
}

return false;
