<?php

/**
 * Lecture/écriture modèles sur disque templates/.
 */
declare(strict_types=1);

const LOYER_SYSTEM_TEMPLATE_ID = '_system';
const LOYER_BUILTIN_COMPLET_ID = 'complet';
const LOYER_BUILTIN_COURT_ID = 'court';
/** Ancien id registre — migré vers complet au chargement. */
const LOYER_DEPRECATED_TEMPLATE_ID = 'principal';

/** Ids modèles de base non modifiables / non supprimables. */
function loyerProtectedTemplateIds(): array
{
    return [LOYER_BUILTIN_COMPLET_ID, LOYER_BUILTIN_COURT_ID];
}

/** Normalise un id modèle (principal → complet). */
function loyerNormalizeTemplateId(string $id): string
{
    return $id === LOYER_DEPRECATED_TEMPLATE_ID ? LOYER_BUILTIN_COMPLET_ID : $id;
}

/** True si id protégé (complet ou court). */
function loyerIsProtectedTemplateId(string $id): bool
{
    return in_array(loyerNormalizeTemplateId($id), loyerProtectedTemplateIds(), true);
}

/** Valide le type de modèle (quittance ou mail). */
function isValidTemplateType(string $type): bool
{
    return $type === 'quittance' || $type === 'mail';
}

/** Valide l'id modèle (slug alphanum ; _system interdit). */
function isValidTemplateId(string $id): bool
{
    if ($id === LOYER_SYSTEM_TEMPLATE_ID) {
        return false;
    }
    return (bool) preg_match('/^[a-z0-9][a-z0-9-]{0,63}$/', $id);
}

/** Répertoire disque selon le type quittance|mail. */
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

/** Chemin absolu du fichier corps (.html) d'un modèle. */
function templateBodyPath(string $type, string $id, string $quittancesDir, string $mailsDir): ?string
{
    $id = loyerNormalizeTemplateId($id);
    if ($id === LOYER_SYSTEM_TEMPLATE_ID || !isValidTemplateId($id)) {
        return null;
    }
    $dir = templateDirForType($type, $quittancesDir, $mailsDir);
    if ($dir === null) {
        return null;
    }
    return $dir . '/' . $id . '.html';
}

/** Chemin du fichier objet mail (-subject.txt). */
function templateSubjectPath(string $id, string $mailsDir): ?string
{
    $id = loyerNormalizeTemplateId($id);
    if ($id === LOYER_SYSTEM_TEMPLATE_ID || !isValidTemplateId($id)) {
        return null;
    }
    return $mailsDir . '/' . $id . '-subject.txt';
}

/** Migre fichiers legacy (templates/ plats, id principal) vers complet. */
function migrateLegacyFlatTemplates(string $templatesDir, string $quittancesDir, string $mailsDir): void
{
    ensureDir($quittancesDir);
    ensureDir($mailsDir);

    $targetCompletQ = $quittancesDir . '/' . LOYER_BUILTIN_COMPLET_ID . '.html';
    $targetCompletM = $mailsDir . '/' . LOYER_BUILTIN_COMPLET_ID . '.html';
    $targetSubjectComplet = $mailsDir . '/' . LOYER_BUILTIN_COMPLET_ID . '-subject.txt';

    $legacyQuittance = $templatesDir . '/quittance.html';
    if (is_file($legacyQuittance) && !is_file($targetCompletQ)) {
        copy($legacyQuittance, $targetCompletQ);
        rename($legacyQuittance, $legacyQuittance . '.bak');
    }

    $legacyMail = $templatesDir . '/mail.html';
    if (is_file($legacyMail) && !is_file($targetCompletM)) {
        copy($legacyMail, $targetCompletM);
        rename($legacyMail, $legacyMail . '.bak');
    }

    $legacySubject = $templatesDir . '/mail-subject.txt';
    if (is_file($legacySubject) && !is_file($targetSubjectComplet)) {
        copy($legacySubject, $targetSubjectComplet);
        rename($legacySubject, $legacySubject . '.bak');
    }

    $legacyPrincipalQ = $quittancesDir . '/' . LOYER_DEPRECATED_TEMPLATE_ID . '.html';
    if (is_file($legacyPrincipalQ)) {
        if (!is_file($targetCompletQ) || filesize($targetCompletQ) === 0) {
            copy($legacyPrincipalQ, $targetCompletQ);
        }
        unlink($legacyPrincipalQ);
    }

    $legacyPrincipalM = $mailsDir . '/' . LOYER_DEPRECATED_TEMPLATE_ID . '.html';
    if (is_file($legacyPrincipalM)) {
        if (!is_file($targetCompletM) || filesize($targetCompletM) === 0) {
            copy($legacyPrincipalM, $targetCompletM);
        }
        unlink($legacyPrincipalM);
    }

    $legacyPrincipalS = $mailsDir . '/' . LOYER_DEPRECATED_TEMPLATE_ID . '-subject.txt';
    if (is_file($legacyPrincipalS)) {
        if (!is_file($targetSubjectComplet) || filesize($targetSubjectComplet) === 0) {
            copy($legacyPrincipalS, $targetSubjectComplet);
        }
        unlink($legacyPrincipalS);
    }
}

/** Copie modèles embarqués (builtin-templates/) si absents sur disque. */
function ensureBuiltinTemplates(string $templatesDir, string $quittancesDir, string $mailsDir): void
{
    $builtinDir = dirname($templatesDir) . '/builtin-templates';
    ensureDir($quittancesDir);
    ensureDir($mailsDir);

    $pairs = [
        [$quittancesDir . '/' . LOYER_BUILTIN_COMPLET_ID . '.html', $builtinDir . '/quittances/complet.html'],
        [$quittancesDir . '/' . LOYER_BUILTIN_COURT_ID . '.html', $builtinDir . '/quittances/court.html'],
        [$mailsDir . '/' . LOYER_BUILTIN_COMPLET_ID . '.html', $builtinDir . '/mails/complet.html'],
        [$mailsDir . '/' . LOYER_BUILTIN_COMPLET_ID . '-subject.txt', $builtinDir . '/mails/complet-subject.txt'],
        [$mailsDir . '/' . LOYER_BUILTIN_COURT_ID . '.html', $builtinDir . '/mails/court.html'],
        [$mailsDir . '/' . LOYER_BUILTIN_COURT_ID . '-subject.txt', $builtinDir . '/mails/court-subject.txt'],
    ];
    foreach ($pairs as [$target, $source]) {
        copyExampleIfMissing($target, $source);
    }
}

/** Crée data/, templates/ et copie exemples si fichiers absents. */
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
    ensureBuiltinTemplates($templatesDir, $quittancesDir, $mailsDir);
}

/** Liste fichiers modèles d'un type sur disque. */
function listTemplateIds(string $type, string $quittancesDir, string $mailsDir): array
{
    $items = [];
    if ($type === 'quittance') {
        foreach (glob($quittancesDir . '/*.html') ?: [] as $path) {
            $base = basename($path, '.html');
            if ($base === LOYER_DEPRECATED_TEMPLATE_ID) {
                continue;
            }
            if (isValidTemplateId($base)) {
                $items[] = ['id' => $base];
            }
        }
        return $items;
    }
    if ($type === 'mail') {
        foreach (glob($mailsDir . '/*.html') ?: [] as $path) {
            $base = basename($path, '.html');
            if ($base === LOYER_DEPRECATED_TEMPLATE_ID) {
                continue;
            }
            if (isValidTemplateId($base)) {
                $items[] = ['id' => $base];
            }
        }
        return $items;
    }
    return [];
}

/** Chemin source dans builtin-templates/ (complet, court). */
function builtinTemplateSourcePath(string $type, string $id, string $part, string $templatesDir): ?string
{
    $id = loyerNormalizeTemplateId($id);
    if ($id !== LOYER_BUILTIN_COMPLET_ID && $id !== LOYER_BUILTIN_COURT_ID) {
        return null;
    }
    $builtinDir = dirname($templatesDir) . '/builtin-templates';
    if ($type === 'quittance' && $part === 'body') {
        return $builtinDir . '/quittances/' . $id . '.html';
    }
    if ($type === 'mail') {
        if ($part === 'subject') {
            return $builtinDir . '/mails/' . $id . '-subject.txt';
        }
        if ($part === 'body') {
            return $builtinDir . '/mails/' . $id . '.html';
        }
    }
    return null;
}

/** Lit un modèle (disque utilisateur, puis builtin-templates/ si complet/court). */
function readTemplateContent(
    string $type,
    string $id,
    string $part,
    string $templatesDir,
    string $quittancesDir,
    string $mailsDir
): string {
    $id = loyerNormalizeTemplateId($id);
    if ($part === 'subject') {
        $path = templateSubjectPath($id, $mailsDir);
    } else {
        $path = templateBodyPath($type, $id, $quittancesDir, $mailsDir);
    }
    if ($path !== null && is_file($path)) {
        $content = file_get_contents($path);
        if ($content !== false && trim($content) !== '') {
            return $content;
        }
    }
    $builtinPath = builtinTemplateSourcePath($type, $id, $part, $templatesDir);
    if ($builtinPath !== null && is_file($builtinPath)) {
        $content = file_get_contents($builtinPath);
        if ($content !== false) {
            return $content;
        }
    }
    return '';
}
