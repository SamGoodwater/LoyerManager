<?php

/**
 * Journal activité SQLite + export CSV + purge.
 */
declare(strict_types=1);

/** Insère entrée journal (type, statut, résumé, metadata JSON). */
function loyerLogActivity(
    PDO $pdo,
    string $eventType,
    string $status,
    string $summary,
    ?array $metadata = null,
    ?string $errorMessage = null
): void {
    $stmt = $pdo->prepare(
        'INSERT INTO activity_log (created_at, event_type, status, summary, metadata_json, error_message)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    $stmt->execute([
        gmdate('c'),
        $eventType,
        $status,
        $summary,
        $metadata !== null ? json_encode($metadata, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : null,
        $errorMessage,
    ]);
}

/** Liste paginée filtrée activity_log. */
function loyerListActivity(
    PDO $pdo,
    int $limit,
    int $offset,
    ?string $type = null,
    ?string $from = null,
    ?string $to = null
): array {
    $limit = max(1, min(500, $limit));
    $offset = max(0, $offset);
    $where = [];
    $params = [];
    if ($type !== null && $type !== '') {
        $where[] = 'event_type = ?';
        $params[] = $type;
    }
    if ($from !== null && $from !== '') {
        $where[] = 'created_at >= ?';
        $params[] = $from;
    }
    if ($to !== null && $to !== '') {
        $where[] = 'created_at <= ?';
        $params[] = $to;
    }
    $sqlWhere = $where ? ('WHERE ' . implode(' AND ', $where)) : '';
    $countStmt = $pdo->prepare('SELECT COUNT(*) AS c FROM activity_log ' . $sqlWhere);
    $countStmt->execute($params);
    $total = (int) ($countStmt->fetch()['c'] ?? 0);

    $sql = 'SELECT id, created_at, event_type, status, summary, metadata_json, error_message
            FROM activity_log ' . $sqlWhere . ' ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?';
    $stmt = $pdo->prepare($sql);
    $idx = 1;
    foreach ($params as $p) {
        $stmt->bindValue($idx++, $p);
    }
    $stmt->bindValue($idx++, $limit, PDO::PARAM_INT);
    $stmt->bindValue($idx, $offset, PDO::PARAM_INT);
    $stmt->execute();
    $items = [];
    while ($row = $stmt->fetch()) {
        $meta = null;
        if (!empty($row['metadata_json'])) {
            $decoded = json_decode((string) $row['metadata_json'], true);
            $meta = is_array($decoded) ? $decoded : null;
        }
        $items[] = [
            'id' => (int) $row['id'],
            'createdAt' => $row['created_at'],
            'eventType' => $row['event_type'],
            'status' => $row['status'],
            'summary' => $row['summary'],
            'metadata' => $meta,
            'errorMessage' => $row['error_message'],
        ];
    }
    return ['total' => $total, 'items' => $items];
}

/** Supprime entrées ; option olderThanMonths. */
function loyerPurgeActivity(PDO $pdo, ?int $olderThanMonths = null): int
{
    if ($olderThanMonths === null || $olderThanMonths <= 0) {
        $stmt = $pdo->query('DELETE FROM activity_log');
        return $stmt->rowCount();
    }
    $cutoff = gmdate('c', strtotime('-' . $olderThanMonths . ' months'));
    $stmt = $pdo->prepare('DELETE FROM activity_log WHERE created_at < ?');
    $stmt->execute([$cutoff]);
    return $stmt->rowCount();
}

/** Convertit lignes journal en CSV UTF-8. */
function loyerActivityToCsv(array $items): string
{
    $lines = ["date;type;statut;resume;erreur"];
    foreach ($items as $row) {
        $cells = [
            $row['createdAt'] ?? '',
            $row['eventType'] ?? '',
            $row['status'] ?? '',
            str_replace(["\r", "\n", ';'], [' ', ' ', ','], (string) ($row['summary'] ?? '')),
            str_replace(["\r", "\n", ';'], [' ', ' ', ','], (string) ($row['errorMessage'] ?? '')),
        ];
        $lines[] = implode(';', $cells);
    }
    return implode("\n", $lines) . "\n";
}

/** Purge auto selon history_retention_months. */
function loyerMaybeAutoPurgeHistory(PDO $pdo): void
{
    $months = (int) loyerGetSetting($pdo, 'history_retention_months', '24');
    if ($months > 0) {
        loyerPurgeActivity($pdo, $months);
    }
}
