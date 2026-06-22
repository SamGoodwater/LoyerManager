<?php
/**
 * API Loyer Manager — data/ + templates multi-modèles.
 */
declare(strict_types=1);

$configFile = __DIR__ . '/config.php';
$config = file_exists($configFile) ? (require $configFile) : [];
if (!is_array($config)) {
    $config = [];
}

$baseDir = __DIR__;
$dataDir = $baseDir . '/data';
$templatesDir = $baseDir . '/templates';
$quittancesDir = $templatesDir . '/quittances';
$mailsDir = $templatesDir . '/mails';
$dataFile = $dataDir . '/loyer-data.json';

const SYSTEM_TEMPLATE_ID = '_system';
const LEGACY_MIGRATION_ID = 'principal';

function respondJson(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function isAuthRequired(array $config): bool
{
    $expected = isset($config['api_key']) ? (string) $config['api_key'] : '';
    return $expected !== '';
}

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

function ensureDir(string $path, int $mode = 0775): void
{
    if (!is_dir($path)) {
        mkdir($path, $mode, true);
    }
}

function assertDirWritable(string $path, string $hint): void
{
    ensureDir($path);
    if (!is_dir($path) || !is_writable($path)) {
        respondJson([
            'ok' => false,
            'error' => 'Écriture impossible dans ' . $hint
                . ' — exécutez : sudo ./deploy/scripts/fix-permissions.sh',
        ], 500);
    }
}

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

function isValidTemplateType(string $type): bool
{
    return $type === 'quittance' || $type === 'mail';
}

function isValidTemplateId(string $id): bool
{
    if ($id === SYSTEM_TEMPLATE_ID) {
        return false;
    }
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $id);
}

function templateDirForType(string $type, string $quittancesDir, string $mailsDir): ?string
{
    if ($type === 'quittance') {
        return $quittancesDir;
    }
    if ($type === 'mail') {
        return $mailsDir;
    }
    return null;
}

function templateBodyPath(string $type, string $id, string $quittancesDir, string $mailsDir): ?string
{
    if ($id === SYSTEM_TEMPLATE_ID || !isValidTemplateId($id)) {
        return null;
    }
    $dir = templateDirForType($type, $quittancesDir, $mailsDir);
    if ($dir === null) {
        return null;
    }
    if ($type === 'quittance') {
        return $dir . '/' . $id . '.html';
    }
    return $dir . '/' . $id . '.html';
}

function templateSubjectPath(string $id, string $mailsDir): ?string
{
    if ($id === SYSTEM_TEMPLATE_ID || !isValidTemplateId($id)) {
        return null;
    }
    return $mailsDir . '/' . $id . '-subject.txt';
}

function migrateLegacyFlatTemplates(string $templatesDir, string $quittancesDir, string $mailsDir): void
{
    ensureDir($quittancesDir);
    ensureDir($mailsDir);

    $legacyQuittance = $templatesDir . '/quittance.html';
    $targetQuittance = $quittancesDir . '/' . LEGACY_MIGRATION_ID . '.html';
    if (is_file($legacyQuittance) && !is_file($targetQuittance)) {
        copy($legacyQuittance, $targetQuittance);
        rename($legacyQuittance, $legacyQuittance . '.bak');
    }

    $legacyMail = $templatesDir . '/mail.html';
    $targetMail = $mailsDir . '/' . LEGACY_MIGRATION_ID . '.html';
    if (is_file($legacyMail) && !is_file($targetMail)) {
        copy($legacyMail, $targetMail);
        rename($legacyMail, $legacyMail . '.bak');
    }

    $legacySubject = $templatesDir . '/mail-subject.txt';
    $targetSubject = $mailsDir . '/' . LEGACY_MIGRATION_ID . '-subject.txt';
    if (is_file($legacySubject) && !is_file($targetSubject)) {
        copy($legacySubject, $targetSubject);
        rename($legacySubject, $legacySubject . '.bak');
    }

    if (!is_file($targetQuittance)) {
        copyExampleIfMissing(
            $targetQuittance,
            $templatesDir . '/quittance.example.html'
        );
    }
    if (!is_file($targetMail)) {
        copyExampleIfMissing($targetMail, $templatesDir . '/mail.example.html');
    }
    if (!is_file($targetSubject)) {
        copyExampleIfMissing($targetSubject, $templatesDir . '/mail-subject.example.txt');
    }
}

function bootstrapFiles(
    string $dataDir,
    string $dataFile,
    string $templatesDir,
    string $quittancesDir,
    string $mailsDir
): void {
    ensureDir($dataDir);
    ensureDir($templatesDir);
    copyExampleIfMissing($dataFile, $dataDir . '/loyer-data.example.json');
    migrateLegacyFlatTemplates($templatesDir, $quittancesDir, $mailsDir);
}

function listTemplateIds(string $type, string $quittancesDir, string $mailsDir): array
{
    $items = [];
    if ($type === 'quittance') {
        $pattern = $quittancesDir . '/*.html';
        foreach (glob($pattern) ?: [] as $path) {
            $base = basename($path, '.html');
            if (isValidTemplateId($base)) {
                $items[] = ['id' => $base];
            }
        }
        return $items;
    }
    if ($type === 'mail') {
        $seen = [];
        foreach (glob($mailsDir . '/*.html') ?: [] as $path) {
            $base = basename($path, '.html');
            if (isValidTemplateId($base)) {
                $seen[$base] = true;
                $items[] = ['id' => $base];
            }
        }
        return $items;
    }
    return [];
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$action = isset($_GET['action']) ? (string) $_GET['action'] : '';

switch ($action) {
    case 'config':
        respondJson([
            'ok' => true,
            'authRequired' => isAuthRequired($config),
        ]);

    case 'status':
        bootstrapFiles($dataDir, $dataFile, $templatesDir, $quittancesDir, $mailsDir);
        respondJson([
            'ok' => true,
            'mode' => 'server',
            'php' => PHP_VERSION,
            'authRequired' => isAuthRequired($config),
            'writable' => [
                'data' => is_writable($dataDir),
                'templatesQuittances' => is_writable($quittancesDir),
                'templatesMails' => is_writable($mailsDir),
            ],
        ]);

    case 'data':
        checkApiKey($config);
        bootstrapFiles($dataDir, $dataFile, $templatesDir, $quittancesDir, $mailsDir);

        if ($method === 'GET') {
            if (!is_file($dataFile)) {
                respondJson(['ok' => true, 'empty' => true, 'content' => '']);
            }
            $content = file_get_contents($dataFile);
            if ($content === false) {
                respondJson(['ok' => false, 'error' => 'Lecture impossible'], 500);
            }
            respondJson([
                'ok' => true,
                'empty' => trim($content) === '',
                'content' => $content,
            ]);
        }

        if ($method === 'POST') {
            $body = file_get_contents('php://input');
            if ($body === false || trim($body) === '') {
                respondJson(['ok' => false, 'error' => 'Corps vide'], 400);
            }
            json_decode($body, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                respondJson(['ok' => false, 'error' => 'JSON invalide'], 400);
            }
            ensureDir($dataDir);
            if (file_put_contents($dataFile, $body, LOCK_EX) === false) {
                respondJson(['ok' => false, 'error' => 'Écriture impossible — vérifiez les droits sur data/'], 500);
            }
            respondJson(['ok' => true]);
        }

        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);

    case 'templates':
        checkApiKey($config);
        bootstrapFiles($dataDir, $dataFile, $templatesDir, $quittancesDir, $mailsDir);
        $type = isset($_GET['type']) ? (string) $_GET['type'] : '';
        if (!isValidTemplateType($type)) {
            respondJson(['ok' => false, 'error' => 'Type invalide'], 400);
        }
        $diskItems = listTemplateIds($type, $quittancesDir, $mailsDir);
        respondJson([
            'ok' => true,
            'items' => $diskItems,
        ]);

    case 'template':
        checkApiKey($config);
        bootstrapFiles($dataDir, $dataFile, $templatesDir, $quittancesDir, $mailsDir);

        $type = isset($_GET['type']) ? (string) $_GET['type'] : '';
        $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
        $part = isset($_GET['part']) ? (string) $_GET['part'] : 'body';

        if (!isValidTemplateType($type)) {
            respondJson(['ok' => false, 'error' => 'Type invalide'], 400);
        }
        if ($id === SYSTEM_TEMPLATE_ID) {
            respondJson(['ok' => false, 'error' => 'Modèle système — contenu côté client'], 400);
        }
        if (!isValidTemplateId($id)) {
            respondJson(['ok' => false, 'error' => 'Identifiant invalide'], 400);
        }

        if ($method === 'DELETE') {
            if ($id === LEGACY_MIGRATION_ID) {
                respondJson(['ok' => false, 'error' => 'Le modèle principal ne peut pas être supprimé'], 403);
            }
            $bodyPath = templateBodyPath($type, $id, $quittancesDir, $mailsDir);
            if ($bodyPath === null || !is_file($bodyPath)) {
                respondJson(['ok' => false, 'error' => 'Modèle introuvable'], 404);
            }
            if (!unlink($bodyPath)) {
                respondJson(['ok' => false, 'error' => 'Suppression impossible'], 500);
            }
            if ($type === 'mail') {
                $subjectPath = templateSubjectPath($id, $mailsDir);
                if ($subjectPath !== null && is_file($subjectPath)) {
                    unlink($subjectPath);
                }
            }
            respondJson(['ok' => true]);
        }

        if ($part !== 'body' && $part !== 'subject') {
            respondJson(['ok' => false, 'error' => 'Part invalide'], 400);
        }

        if ($type === 'quittance' && $part === 'subject') {
            respondJson(['ok' => false, 'error' => 'Part invalide pour quittance'], 400);
        }

        if ($method === 'GET') {
            if ($part === 'subject') {
                $path = templateSubjectPath($id, $mailsDir);
            } else {
                $path = templateBodyPath($type, $id, $quittancesDir, $mailsDir);
            }
            if ($path === null || !is_file($path)) {
                respondJson(['ok' => true, 'empty' => true, 'content' => '']);
            }
            $content = file_get_contents($path);
            if ($content === false) {
                respondJson(['ok' => false, 'error' => 'Lecture impossible'], 500);
            }
            respondJson([
                'ok' => true,
                'empty' => trim($content) === '',
                'content' => $content,
            ]);
        }

        if ($method === 'POST') {
            if ($id === LEGACY_MIGRATION_ID) {
                respondJson(['ok' => false, 'error' => 'Le modèle principal ne peut pas être modifié'], 403);
            }
            $rawBody = file_get_contents('php://input');
            if ($rawBody === false) {
                respondJson(['ok' => false, 'error' => 'Corps vide'], 400);
            }

            $contentType = $_SERVER['CONTENT_TYPE'] ?? '';
            if (stripos($contentType, 'application/json') !== false) {
                $decoded = json_decode($rawBody, true);
                if (!is_array($decoded)) {
                    respondJson(['ok' => false, 'error' => 'JSON invalide'], 400);
                }
                if ($type === 'mail') {
                    $bodyContent = isset($decoded['body']) ? (string) $decoded['body'] : '';
                    $subjectContent = isset($decoded['subject']) ? (string) $decoded['subject'] : '';
                    $bodyPath = templateBodyPath($type, $id, $quittancesDir, $mailsDir);
                    $subjectPath = templateSubjectPath($id, $mailsDir);
                    if ($bodyPath === null || $subjectPath === null) {
                        respondJson(['ok' => false, 'error' => 'Chemin invalide'], 400);
                    }
                    ensureDir($mailsDir);
                    assertDirWritable($mailsDir, 'templates/mails/');
                    if (file_put_contents($bodyPath, $bodyContent, LOCK_EX) === false
                        || file_put_contents($subjectPath, $subjectContent, LOCK_EX) === false) {
                        respondJson(['ok' => false, 'error' => 'Écriture impossible'], 500);
                    }
                    respondJson(['ok' => true]);
                }
                $rawBody = isset($decoded['body']) ? (string) $decoded['body'] : '';
            }

            if ($part === 'subject') {
                $path = templateSubjectPath($id, $mailsDir);
            } else {
                $path = templateBodyPath($type, $id, $quittancesDir, $mailsDir);
            }
            if ($path === null) {
                respondJson(['ok' => false, 'error' => 'Chemin invalide'], 400);
            }
            $targetDir = dirname($path);
            assertDirWritable($targetDir, 'templates/');
            if (file_put_contents($path, $rawBody, LOCK_EX) === false) {
                respondJson(['ok' => false, 'error' => 'Écriture impossible — vérifiez les droits sur templates/'], 500);
            }
            respondJson(['ok' => true]);
        }

        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);

    default:
        respondJson(['ok' => false, 'error' => 'Action inconnue'], 400);
}
