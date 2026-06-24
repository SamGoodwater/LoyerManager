<?php

/**
 * Chiffrement AES-256-GCM tokens OAuth et mots de passe SMTP.
 */
declare(strict_types=1);

/** Chiffre chaîne AES-256-GCM ; retour base64 iv+tag+cipher. */
function loyerEncrypt(string $plain, string $key32): string
{
    if ($plain === '') {
        return '';
    }
    if (strlen($key32) < 32) {
        throw new RuntimeException('Clé de chiffrement invalide.');
    }
    $iv = random_bytes(12);
    $tag = '';
    $cipher = openssl_encrypt(
        $plain,
        'aes-256-gcm',
        $key32,
        OPENSSL_RAW_DATA,
        $iv,
        $tag,
        '',
        16
    );
    if ($cipher === false) {
        throw new RuntimeException('Chiffrement impossible.');
    }
    return base64_encode($iv . $tag . $cipher);
}

/** Déchiffre payload loyerEncrypt. */
function loyerDecrypt(string $encoded, string $key32): string
{
    if ($encoded === '') {
        return '';
    }
    if (strlen($key32) < 32) {
        throw new RuntimeException('Clé de chiffrement invalide.');
    }
    $raw = base64_decode($encoded, true);
    if ($raw === false || strlen($raw) < 28) {
        throw new RuntimeException('Données chiffrées invalides.');
    }
    $iv = substr($raw, 0, 12);
    $tag = substr($raw, 12, 16);
    $cipher = substr($raw, 28);
    $plain = openssl_decrypt(
        $cipher,
        'aes-256-gcm',
        $key32,
        OPENSSL_RAW_DATA,
        $iv,
        $tag
    );
    if ($plain === false) {
        throw new RuntimeException('Déchiffrement impossible.');
    }
    return $plain;
}

/** Génère clé 32 octets encodée base64. */
function loyerGenerateEncryptionKeyBase64(): string
{
    return base64_encode(random_bytes(32));
}
