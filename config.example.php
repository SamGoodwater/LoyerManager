<?php
/**
 * Copiez ce fichier en config.php et adaptez si besoin.
 * config.php est ignoré par Git (données sensibles).
 *
 * api_key — secret partagé entre le navigateur et api.php (PAS un compte utilisateur).
 *
 * - Vide ('') : aucune clé exigée (pratique en local).
 * - Renseignée : lecture/écriture de data/loyer-data.json et templates/ via api.php
 *   exigent la même clé (Paramètres → Données dans l'app, ou en-tête X-API-Key).
 *
 * Ce n'est PAS le mot de passe du site (HTTP Basic Auth) : ce sont deux protections
 * différentes. Voir docs/SECURITE.md.
 */
return [
    'api_key' => '',
];
