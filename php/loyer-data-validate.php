<?php

/**
 * Validation des données métier (loyer-data.json).
 */
declare(strict_types=1);

const LOYER_SIGNATURE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** True si data-URL signature autorisée (PNG, JPEG, WebP, GIF, max 5 Mo). */
function loyerIsValidSignatureImageDataUrl(string $value): bool
{
    if ($value === '') {
        return true;
    }
    if (!preg_match('#^data:image/(png|jpe?g|webp|gif);base64,#i', $value)) {
        return false;
    }
    $comma = strpos($value, ',');
    if ($comma === false) {
        return false;
    }
    $b64 = substr($value, $comma + 1);
    if ($b64 === '' || !preg_match('#^[A-Za-z0-9+/=\s]+$#', $b64)) {
        return false;
    }
    $decoded = base64_decode(str_replace(["\r", "\n", ' '], '', $b64), true);
    if ($decoded === false) {
        return false;
    }
    return strlen($decoded) <= LOYER_SIGNATURE_IMAGE_MAX_BYTES;
}

/** Valide signatureImage dans loyer-data ; lève si format non autorisé. */
function loyerSanitizeLoyerDataSignature(array $data): array
{
    if (!isset($data['settings']) || !is_array($data['settings'])) {
        return $data;
    }
    if (!isset($data['settings']['bailleur']) || !is_array($data['settings']['bailleur'])) {
        return $data;
    }
    $img = (string) ($data['settings']['bailleur']['signatureImage'] ?? '');
    if ($img !== '' && !loyerIsValidSignatureImageDataUrl($img)) {
        throw new InvalidArgumentException(
            'Image de signature invalide — PNG, JPG, WebP ou GIF encodés en base64 uniquement (max. 5 Mo).'
        );
    }
    return $data;
}
