# Loyer Manager

Application web **auto-hébergée** pour suivre les loyers, importer des virements bancaires, générer des quittances (PDF, DOCX, HTML) et **envoyer des e-mails** avec quittance jointe (Gmail / Outlook via OAuth, ou SMTP).

**Version 1.0.0** — authentification par session (passphrase, Google ou Microsoft).

Développé par **Goodwater** — logiciel libre sous [licence MIT](LICENSE).

## Fonctionnalités

- **Connexion** : passphrase (mot de passe), Google ou Microsoft (OAuth identité) — voir [`docs/SECURITE.md`](docs/SECURITE.md)
- **Mon compte** : changement de passphrase (compte local), export/import profil, suppression compte
- **Tableau de bord** : suivi mensuel, solde cumulé, heatmap, graphiques, période partagée
- **Virements** : saisie manuelle ou import CSV (relevé bancaire), détection de doublons, glisser-déposer sur la page
- **Modèles quittance et mail** : bibliothèque multi-fichiers, édition WYSIWYG, mots-clés `{{…}}`
- **Modèles de base** : « complet » (détaillé, défaut) et « court » (simplifié), en lecture seule — dupliquer ou importer pour personnaliser
- **Exports** : PDF / DOCX / HTML pour la quittance ; export groupé sur une plage de mois
- **Mail** : envoi direct (OAuth ou SMTP), **brouillon** dans Gmail/Outlook, repli EML + PDF ou mailto
- **Historique** : journal des mails, brouillons, imports CSV, exports — onglet dédié, export CSV, purge RGPD
- **Persistance** : données sur **votre serveur** via `api.php` — pas de cloud tiers

## Prérequis

- PHP 7.4+ (8.x recommandé), extensions JSON, **PDO SQLite**, OpenSSL, cURL
- Serveur web **Apache** (mutualisé ou VPS) ; `php -S` possible en dev local
- Navigateur récent (Chrome, Firefox, Edge)

## Installation — hébergement web (production)

**Aucun script requis.** Uploadez les fichiers et configurez :

1. Envoyez le projet sur votre hébergeur (FTP ou gestionnaire de fichiers).
2. Copiez `config.example.php` → `config.php` (clé API, `encryption_key`, OAuth si besoin).
3. Vérifiez que PHP peut écrire dans `data/` et `templates/` (souvent **755** ou **775**).
4. Ouvrez l'URL du site → **créez votre compte** sur `login.html`.

Guide détaillé : [`docs/HEBERGEMENT-MUTUALISE.md`](docs/HEBERGEMENT-MUTUALISE.md)

Sécurité (HTTPS, mot de passe site, session) : [`docs/SECURITE.md`](docs/SECURITE.md)

Déploiement Apache Debian/WSL : [`deploy/README.md`](deploy/README.md)

## Développement local

L'application **requiert un serveur web** (pas d'ouverture en `file://`). Pour tester sur votre machine :

```bash
git clone https://github.com/SamGoodwater/LoyerManager.git
cd LoyerManager
cp config.example.php config.php
php -S localhost:8080
```

Ouvrez `http://localhost:8080/` et créez votre compte sur `login.html`. Voir [`deploy/README.md`](deploy/README.md) pour Apache en production.

## Configuration

| Élément | Rôle |
|---------|------|
| `config.php` | Session (`auth.session_lifetime_hours`), clé API (legacy), **encryption_key**, OAuth — voir [`docs/OAUTH-MAIL.md`](docs/OAUTH-MAIL.md) |
| `data/loyer-data.json` | Paramètres, virements, registre des modèles — **non versionné** |
| `data/loyer.db` | Compte utilisateur, SMTP chiffré, tokens OAuth mail, historique — **non versionné** |
| `templates/quittances/` | Modèles HTML quittance — **non versionné** |
| `templates/mails/` | Modèles mail (corps + objet) — **non versionné** |
| `templates/*.example.*` | Modèles d'exemple versionnés |

### Clé API (`api_key`) — usage actuel

Secret technique entre le navigateur et `api.php`. **Dès qu'un compte utilisateur existe**, l'accès repose surtout sur la **session PHP** (connexion via `login.html`). La clé API reste utile en **migration** (aucun compte encore créé) ou en complément sur une URL publique — voir [`docs/SECURITE.md`](docs/SECURITE.md).

Au premier lancement, l'application crée `data/loyer-data.json` et `data/loyer.db` si besoin.

## Jeu de démonstration

```bash
cp docs/demo/loyer-data.demo.json data/loyer-data.json
```

Voir [`docs/demo/README.md`](docs/demo/README.md).

## Données personnelles

Ne pas committer (déjà dans `.gitignore`) : `data/loyer-data.json`, `data/loyer.db`, `config.php`, modèles personnalisés dans `templates/`.

**Sauvegarde régulière recommandée** : export profil JSON (Paramètres → Mon compte) + copie FTP de `data/loyer.db`, `data/loyer-data.json` et `templates/`. Voir [`docs/SECURITE.md`](docs/SECURITE.md).

Confidentialité : [`docs/CONFIDENTIALITE.md`](docs/CONFIDENTIALITE.md)

## Structure du projet

```
LoyerManager/
├── index.html, login.html, api.php, .htaccess
├── js/ css/ lib/
├── php/              handlers, auth, mail, OAuth…
├── data/ templates/
├── docs/             guides utilisateur et développeurs
└── deploy/           Apache Debian/WSL (optionnel)
```

## Modèles (résumé)

| Action | Quittance | Mail |
|--------|-----------|------|
| Aperçu du mois | Onglet Quittance | Onglet Mail |
| Édition | Modèle personnalisé uniquement | Idem |
| Dupliquer | Nouveau modèle… | Nouveau modèle… |
| Importer | Crée un **nouveau** modèle (.html) | Crée un **nouveau** modèle (.json) |
| Exporter | .html | .json (objet + corps) |

## Licence

[MIT](LICENSE)

## Liens

- Dépôt : https://github.com/SamGoodwater/LoyerManager
- [`docs/SECURITE.md`](docs/SECURITE.md) · [`docs/OAUTH-MAIL.md`](docs/OAUTH-MAIL.md) · [`docs/CONFIDENTIALITE.md`](docs/CONFIDENTIALITE.md) · [`docs/HEBERGEMENT-MUTUALISE.md`](docs/HEBERGEMENT-MUTUALISE.md) · [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · [`docs/AGENTS.md`](docs/AGENTS.md)
