<?php
/**
 * Copiez ce fichier en config.php et adaptez si besoin.
 * config.php est ignoré par Git (données sensibles).
 *
 * api_key — secret legacy (voir docs/SECURITE.md). Une fois un compte créé sur login.html,
 * l'accès repose sur la session PHP ; la clé API n'est plus nécessaire en usage normal.
 *
 * encryption_key — clé AES-256 (32 octets) encodée base64, pour chiffrer les tokens OAuth.
 * Générez-en une : php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
 *
 * oauth — identifiants de l'application Loyer Manager (Gmail / Outlook).
 * Vous pouvez remplacer par votre propre app Google Cloud / Azure AD (voir docs/OAUTH-MAIL.md).
 */
return [
    'api_key' => '',

    'public_base_url' => '',

    // Session (heures) + cookie « rester connecté » (jours) après login / OAuth
    'auth' => [
        'session_lifetime_hours' => 720,
        'remember_lifetime_days' => 180,
    ],

    // Obligatoire pour OAuth mail, SMTP et chiffrement des secrets
    'encryption_key' => '',

    // Optionnel : URL publique exacte si la détection auto échoue (reverse proxy, sous-dossier).
    // 'public_base_url' => 'https://example.com',

    // Instance démonstration publique (sans connexion, reset auto, mail désactivé).
    // 'demo_mode' => true,
    // 'demo' => [
    //     'reset_interval_hours' => 6,
    // ],

    'oauth' => [
        // Connexion (login.html) et envoi mail utilisent les mêmes identifiants.
        'google' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
        ],
        'microsoft' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
            // Nécessite un répertoire Azure (programme développeurs M365 ou compte Azure).
            'tenant' => 'common',
        ],
    ],
];
