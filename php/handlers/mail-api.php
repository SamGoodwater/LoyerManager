<?php
/**
 * Handlers API mail
 *
 * Envoi mail et brouillons.
 */
declare(strict_types=1);

/** POST send-mail après garde session. */
function loyerRouteSendMail(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerMaybeAutoPurgeHistory($pdo);
        $result = loyerHandleSendMail($ctx['config'], $pdo, loyerJsonBody());
        respondJson(['ok' => true] + $result);
    } catch (Throwable $e) {
        try {
            $pdo = loyerDbFromCtx($ctx);
            loyerLogActivity($pdo, 'mail_sent', 'error', 'Échec envoi mail', null, $e->getMessage());
        } catch (Throwable $ignored) {
        }
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}

/** POST save-mail-draft OAuth. */
function loyerRouteSaveMailDraft(array $ctx): void
{
    loyerDemoRejectIfEnabled($ctx);
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerMaybeAutoPurgeHistory($pdo);
        $result = loyerHandleSaveMailDraft($ctx['config'], $pdo, loyerJsonBody());
        respondJson(['ok' => true] + $result);
    } catch (Throwable $e) {
        try {
            $pdo = loyerDbFromCtx($ctx);
            loyerLogActivity($pdo, 'mail_draft', 'error', 'Échec création brouillon', null, $e->getMessage());
        } catch (Throwable $ignored) {
        }
        respondJson(['ok' => false, 'error' => $e->getMessage()], 400);
    }
}
