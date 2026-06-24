<?php
/**
 * Handlers API modèles
 *
 * Liste et contenu des templates quittance/mail.
 */
declare(strict_types=1);

/** GET liste modèles quittance|mail. */
function loyerHandleTemplatesList(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );
    $type = isset($_GET['type']) ? (string) $_GET['type'] : '';
    if (!isValidTemplateType($type)) {
        respondJson(['ok' => false, 'error' => 'Type invalide'], 400);
    }
    respondJson([
        'ok' => true,
        'items' => listTemplateIds($type, $ctx['quittancesDir'], $ctx['mailsDir']),
    ]);
}

/** GET/POST/DELETE contenu modèle. */
function loyerHandleTemplate(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );

    $type = isset($_GET['type']) ? (string) $_GET['type'] : '';
    $id = isset($_GET['id']) ? (string) $_GET['id'] : '';
    $part = isset($_GET['part']) ? (string) $_GET['part'] : 'body';

    if (!isValidTemplateType($type)) {
        respondJson(['ok' => false, 'error' => 'Type invalide'], 400);
    }
    if ($id === LOYER_SYSTEM_TEMPLATE_ID) {
        respondJson(['ok' => false, 'error' => 'Modèle système — contenu côté client'], 400);
    }
    if (!isValidTemplateId($id)) {
        respondJson(['ok' => false, 'error' => 'Identifiant invalide'], 400);
    }

    if ($ctx['method'] === 'DELETE') {
        if (loyerIsProtectedTemplateId($id)) {
            respondJson(['ok' => false, 'error' => 'Les modèles complet et court ne peuvent pas être supprimés'], 403);
        }
        $bodyPath = templateBodyPath($type, $id, $ctx['quittancesDir'], $ctx['mailsDir']);
        if ($bodyPath === null || !is_file($bodyPath)) {
            respondJson(['ok' => false, 'error' => 'Modèle introuvable'], 404);
        }
        if (!unlink($bodyPath)) {
            respondJson(['ok' => false, 'error' => 'Suppression impossible'], 500);
        }
        if ($type === 'mail') {
            $subjectPath = templateSubjectPath($id, $ctx['mailsDir']);
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

    if ($ctx['method'] === 'GET') {
        $content = readTemplateContent(
            $type,
            $id,
            $part,
            $ctx['templatesDir'],
            $ctx['quittancesDir'],
            $ctx['mailsDir']
        );
        respondJson([
            'ok' => true,
            'empty' => trim($content) === '',
            'content' => $content,
        ]);
    }

    if ($ctx['method'] === 'POST') {
        if (loyerIsProtectedTemplateId($id)) {
            respondJson(['ok' => false, 'error' => 'Les modèles complet et court ne peuvent pas être modifiés'], 403);
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
                $bodyPath = templateBodyPath($type, $id, $ctx['quittancesDir'], $ctx['mailsDir']);
                $subjectPath = templateSubjectPath($id, $ctx['mailsDir']);
                if ($bodyPath === null || $subjectPath === null) {
                    respondJson(['ok' => false, 'error' => 'Chemin invalide'], 400);
                }
                ensureDir($ctx['mailsDir']);
                assertDirWritable($ctx['mailsDir'], 'templates/mails/');
                if (file_put_contents($bodyPath, $bodyContent, LOCK_EX) === false
                    || file_put_contents($subjectPath, $subjectContent, LOCK_EX) === false) {
                    respondJson(['ok' => false, 'error' => 'Écriture impossible'], 500);
                }
                respondJson(['ok' => true]);
            }
            $rawBody = isset($decoded['body']) ? (string) $decoded['body'] : '';
        }

        if ($part === 'subject') {
            $path = templateSubjectPath($id, $ctx['mailsDir']);
        } else {
            $path = templateBodyPath($type, $id, $ctx['quittancesDir'], $ctx['mailsDir']);
        }
        if ($path === null) {
            respondJson(['ok' => false, 'error' => 'Chemin invalide'], 400);
        }
        assertDirWritable(dirname($path), 'templates/');
        if (file_put_contents($path, $rawBody, LOCK_EX) === false) {
            respondJson(['ok' => false, 'error' => 'Écriture impossible — vérifiez les droits sur templates/'], 500);
        }
        respondJson(['ok' => true]);
    }

    respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
}
