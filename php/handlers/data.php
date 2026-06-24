<?php
/**
 * Handler API données métier
 *
 * Lecture/écriture de loyer-data.json.
 */
declare(strict_types=1);

/** GET/POST loyer-data.json métier. */
function loyerHandleData(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    bootstrapFiles(
        $ctx['dataDir'],
        $ctx['dataFile'],
        $ctx['templatesDir'],
        $ctx['quittancesDir'],
        $ctx['mailsDir']
    );

    if ($ctx['method'] === 'GET') {
        if (!is_file($ctx['dataFile'])) {
            respondJson(['ok' => true, 'empty' => true, 'content' => '']);
        }
        $content = file_get_contents($ctx['dataFile']);
        if ($content === false) {
            respondJson(['ok' => false, 'error' => 'Lecture impossible'], 500);
        }
        respondJson([
            'ok' => true,
            'empty' => trim($content) === '',
            'content' => $content,
        ]);
    }

    if ($ctx['method'] === 'POST') {
        $body = file_get_contents('php://input');
        if ($body === false || trim($body) === '') {
            respondJson(['ok' => false, 'error' => 'Corps vide'], 400);
        }
        $decoded = json_decode($body, true);
        if (json_last_error() !== JSON_ERROR_NONE || !is_array($decoded)) {
            respondJson(['ok' => false, 'error' => 'JSON invalide'], 400);
        }
        try {
            $decoded = loyerSanitizeLoyerDataSignature($decoded);
        } catch (InvalidArgumentException $e) {
            respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
        }
        $json = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($json === false) {
            respondJson(['ok' => false, 'error' => 'JSON invalide'], 400);
        }
        ensureDir($ctx['dataDir']);
        if (file_put_contents($ctx['dataFile'], $json, LOCK_EX) === false) {
            respondJson(['ok' => false, 'error' => 'Écriture impossible — vérifiez les droits sur data/'], 500);
        }
        respondJson(['ok' => true]);
    }

    respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
}
