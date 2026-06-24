<?php
/**
 * Handlers API historique
 *
 * Journal d'activité, export CSV.
 */
declare(strict_types=1);

/** POST log export PDF/DOCX/dashboard. */
function loyerRouteLogExport(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    $body = loyerJsonBody();
    $eventType = (string) ($body['eventType'] ?? '');
    if (!in_array($eventType, ['export_pdf', 'export_docx', 'export_html'], true)) {
        respondJson(['ok' => false, 'error' => 'Type d\'export invalide'], 400);
    }
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerMaybeAutoPurgeHistory($pdo);
        loyerLogActivity(
            $pdo,
            $eventType,
            (string) ($body['status'] ?? 'success') === 'error' ? 'error' : 'success',
            (string) ($body['summary'] ?? 'Export'),
            is_array($body['metadata'] ?? null) ? $body['metadata'] : null,
            isset($body['errorMessage']) ? (string) $body['errorMessage'] : null
        );
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** POST log import CSV virements. */
function loyerRouteLogCsvImport(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] !== 'POST') {
        respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
    }
    $body = loyerJsonBody();
    try {
        $pdo = loyerDbFromCtx($ctx);
        loyerMaybeAutoPurgeHistory($pdo);
        loyerLogActivity(
            $pdo,
            'csv_import',
            'success',
            (string) ($body['summary'] ?? 'Import CSV'),
            is_array($body['metadata'] ?? null) ? $body['metadata'] : null
        );
        respondJson(['ok' => true]);
    } catch (Throwable $e) {
        respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
    }
}

/** GET liste / POST purge journal. */
function loyerRouteActivityLog(array $ctx): void
{
    loyerRequireApiAccess($ctx);
    if ($ctx['method'] === 'GET') {
        try {
            $pdo = loyerDbFromCtx($ctx);
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 50;
            $offset = isset($_GET['offset']) ? (int) $_GET['offset'] : 0;
            $type = isset($_GET['type']) ? (string) $_GET['type'] : '';
            $from = isset($_GET['from']) ? (string) $_GET['from'] : '';
            $to = isset($_GET['to']) ? (string) $_GET['to'] : '';
            $format = isset($_GET['format']) ? (string) $_GET['format'] : 'json';
            $result = loyerListActivity($pdo, $limit, $offset, $type, $from, $to);
            if ($format === 'csv') {
                header('Content-Type: text/csv; charset=utf-8');
                header('Content-Disposition: attachment; filename="historique-loyer-manager.csv"');
                header('Cache-Control: no-store');
                echo loyerActivityToCsv($result['items']);
                exit;
            }
            respondJson(['ok' => true] + $result);
        } catch (Throwable $e) {
            respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }
    if ($ctx['method'] === 'DELETE') {
        $body = loyerJsonBody();
        try {
            $pdo = loyerDbFromCtx($ctx);
            $months = isset($body['olderThanMonths']) ? (int) $body['olderThanMonths'] : null;
            if (isset($body['all']) && $body['all']) {
                $months = null;
            }
            $deleted = loyerPurgeActivity($pdo, $months);
            respondJson(['ok' => true, 'deleted' => $deleted]);
        } catch (Throwable $e) {
            respondJson(['ok' => false, 'error' => $e->getMessage()], 500);
        }
    }
    respondJson(['ok' => false, 'error' => 'Méthode non supportée'], 405);
}
