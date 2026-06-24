<?php
/**
 * Base SQLite (loyer.db)
 *
 * Connexion PDO, migrations, paramètres applicatifs.
 */
declare(strict_types=1);

/** Chemin du fichier SQLite dans data/. */
function loyerDbPath(string $dataDir): string
{
    return $dataDir . '/loyer.db';
}

/** True si l'extension pdo_sqlite est chargée. */
function loyerDbAvailable(): bool
{
    return extension_loaded('pdo_sqlite');
}

/** Message utilisateur si SQLite indisponible. */
function loyerDbUnavailableHint(): string
{
    return 'Base de données indisponible — contactez l\'administrateur de l\'hébergement (extension PHP SQLite requise).';
}

/** Ouvre PDO SQLite avec WAL et clés étrangères. */
function loyerDbConnect(string $dataDir): PDO
{
    if (!loyerDbAvailable()) {
        throw new RuntimeException(
            'Base de données indisponible — contactez l\'administrateur de l\'hébergement.'
        );
    }
    ensureDir($dataDir);
    $path = loyerDbPath($dataDir);
    $pdo = new PDO('sqlite:' . $path, null, null, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA journal_mode = WAL');
    return $pdo;
}

/** Applique les fichiers SQL numérotés dans php/migrations/. */
function loyerDbRunMigrations(PDO $pdo, string $migrationsDir): int
{
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            applied_at TEXT NOT NULL
        )'
    );
    $applied = $pdo->query('SELECT MAX(version) AS v FROM schema_migrations')->fetch();
    $current = isset($applied['v']) ? (int) $applied['v'] : 0;

    $files = glob($migrationsDir . '/*.sql') ?: [];
    sort($files, SORT_NATURAL);
    $latest = $current;

    foreach ($files as $file) {
        $base = basename($file);
        if (!preg_match('/^(\d+)_/', $base, $m)) {
            continue;
        }
        $version = (int) $m[1];
        if ($version <= $current) {
            continue;
        }
        $sql = file_get_contents($file);
        if ($sql === false) {
            throw new RuntimeException('Migration illisible : ' . $base);
        }
        $pdo->beginTransaction();
        try {
            $pdo->exec($sql);
            $stmt = $pdo->prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)');
            $stmt->execute([$version, gmdate('c')]);
            $pdo->commit();
            $latest = $version;
        } catch (Throwable $e) {
            $pdo->rollBack();
            throw $e;
        }
    }

    return $latest;
}

/** Connecte et migre ; retourne [PDO, version schéma]. */
function loyerDbInit(string $baseDir, string $dataDir): array
{
    $pdo = loyerDbConnect($dataDir);
    $schemaVersion = loyerDbRunMigrations($pdo, $baseDir . '/php/migrations');
    return [$pdo, $schemaVersion];
}

/** Version max des migrations appliquées. */
function loyerDbSchemaVersion(PDO $pdo): int
{
    $row = $pdo->query('SELECT MAX(version) AS v FROM schema_migrations')->fetch();
    return isset($row['v']) ? (int) $row['v'] : 0;
}

/** Lit un paramètre clé/valeur dans app_settings. */
function loyerGetSetting(PDO $pdo, string $key, string $default = ''): string
{
    $stmt = $pdo->prepare('SELECT value FROM app_settings WHERE key = ?');
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    if (!$row) {
        return $default;
    }
    return (string) $row['value'];
}

/** Écrit ou met à jour un paramètre app_settings. */
function loyerSetSetting(PDO $pdo, string $key, string $value): void
{
    $stmt = $pdo->prepare(
        'INSERT INTO app_settings (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    );
    $stmt->execute([$key, $value]);
}
