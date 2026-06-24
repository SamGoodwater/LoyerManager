<?php
/**
 * Exemple config pour instance démonstration publique.
 * Instance SÉPARÉE de la prod — initiation :
 *   sudo ./scripts/demo-init.sh --url https://demo.votre-domaine.fr --yes
 */
return [
    'api_key' => '',

    'public_base_url' => 'https://demo.loyermanager.iota21.fr',

    'demo_mode' => true,
    'demo' => [
        'reset_interval_hours' => 6,
    ],

    'auth' => [
        'session_lifetime_hours' => 168,
    ],

    // Clé AES-256 base64 (32 octets) — php -r "echo base64_encode(random_bytes(32)), PHP_EOL;"
    'encryption_key' => '',

    'oauth' => [
        'google' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
        ],
        'microsoft' => [
            'enabled' => false,
            'client_id' => '',
            'client_secret' => '',
            'tenant' => 'common',
        ],
    ],
];
