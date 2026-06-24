<?php

/**
 * Helpers HTTP : JSON, auth API key, réponses erreur.
 */
declare(strict_types=1);

/** Envoie réponse JSON et termine script. */
function respondJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/** True si api_key non vide dans config. */
function isAuthRequired(array $config): bool
{
    $expected = isset($config['api_key']) ? (string) $config['api_key'] : '';
    return $expected !== '';
}

/** Vérifie header/param api_key vs config. */
function checkApiKey(array $config): void
{
    $expected = isset($config['api_key']) ? (string) $config['api_key'] : '';
    if ($expected === '') {
        return;
    }
    $provided = '';
    if (!empty($_SERVER['HTTP_X_API_KEY'])) {
        $provided = (string) $_SERVER['HTTP_X_API_KEY'];
    } elseif (isset($_GET['key'])) {
        $provided = (string) $_GET['key'];
    }
    if (!hash_equals($expected, $provided)) {
        respondJson(['ok' => false, 'error' => 'Non autorisé'], 401);
    }
}

/** Crée le répertoire s'il n'existe pas (récursif). */
function ensureDir(string $path, int $mode = 0775): void
{
    if (!is_dir($path)) {
        mkdir($path, $mode, true);
    }
}

/** Vérifie que le répertoire est inscriptible ; sinon JSON 500 explicite. */
function assertDirWritable(string $path, string $hint): void
{
    ensureDir($path);
    if (!is_dir($path) || !is_writable($path)) {
        respondJson([
            'ok' => false,
            'error' => 'Écriture impossible dans ' . $hint
                . ' — vérifiez les droits d\'écriture PHP sur ce dossier (panneau hébergeur ou chmod 775).',
        ], 500);
    }
}

/** Copie un fichier .example.* vers la cible si elle est absente ou vide. */
function copyExampleIfMissing(string $targetPath, string $examplePath): void
{
    if (is_file($targetPath) && filesize($targetPath) > 0) {
        return;
    }
    if (!is_file($examplePath)) {
        return;
    }
    ensureDir(dirname($targetPath));
    copy($examplePath, $targetPath);
}
