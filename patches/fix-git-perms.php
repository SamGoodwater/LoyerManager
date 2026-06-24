<?php
/**
 * Rend .git inscriptible par le groupe goodwater (push depuis WSL).
 * Usage unique : curl http://127.0.0.1/patches/fix-git-perms.php
 */
declare(strict_types=1);
header('Content-Type: text/plain; charset=UTF-8');
if (!in_array($_SERVER['REMOTE_ADDR'] ?? '', ['127.0.0.1', '::1'], true)) {
    http_response_code(403);
    exit("Accès refusé.\n");
}
$git = dirname(__DIR__) . '/.git';
if (!is_dir($git)) {
    exit("Pas de .git\n");
}
$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($git, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);
$count = 0;
foreach ($it as $item) {
    $path = $item->getPathname();
    if (@chgrp($path, 'goodwater')) {
        $count++;
    }
    $mode = $item->isDir() ? 0775 : 0664;
    @chmod($path, $mode);
}
@chgrp($git, 'goodwater');
@chmod($git, 0775);
echo "Permissions .git mises à jour pour le groupe goodwater ($count entrées).\n";
