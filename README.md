# Loyer Manager

Application web **auto-hébergée** pour suivre les loyers, importer des virements bancaires, générer des quittances (PDF, DOCX, HTML) et préparer des e-mails avec pièces jointes.

Développé par **Goodwater** — logiciel libre sous [licence MIT](LICENSE).

## Fonctionnalités

- Tableau de bord : suivi mensuel, solde cumulé, graphiques
- Import CSV de relevés bancaires (avec détection de doublons)
- Bibliothèque de **modèles** quittance et mail (multi-fichiers, édition WYSIWYG)
- Exports quittance + génération EML / mailto
- Persistance via **PHP** (`api.php`) sur votre serveur — pas de cloud, pas de compte

## Prérequis

- PHP 7.4+ (8.x recommandé) avec extensions JSON
- Serveur web : nginx + php-fpm, Apache, ou PHP intégré pour les tests
- Navigateur récent (Chrome, Firefox, Edge)

## Installation rapide

```bash
git clone https://github.com/SamGoodwater/LoyerManager.git
cd LoyerManager
cp config.example.php config.php
# Optionnel en production : définir api_key dans config.php

# Droits d'écriture pour l'utilisateur PHP
chmod -R u+rwX data templates
```

### Test local (PHP intégré)

```bash
cd LoyerManager
php -S 0.0.0.0:8080
```

Ouvrez `http://localhost:8080/` (pas en `file://`).

### Production Debian / nginx

Voir [`deploy/debian/README`](deploy/debian/README) pour les scripts d'installation.

## Configuration

| Fichier | Rôle |
|---------|------|
| `config.php` | Clé API optionnelle (`api_key`) — **non versionné** |
| `data/loyer-data.json` | Paramètres, virements, registre des modèles — **non versionné** |
| `templates/quittances/` | Modèles HTML quittance — **non versionné** |
| `templates/mails/` | Modèles mail (corps + objet) — **non versionné** |
| `templates/*.example.*` | Modèles d'exemple versionnés |

Au premier lancement, l'application crée `data/loyer-data.json` et migre d'éventuels anciens fichiers plats vers `templates/quittances/principal.html`, etc.

## Données personnelles

Les fichiers suivants **ne doivent pas** être commités (déjà listés dans `.gitignore`) :

- `data/loyer-data.json` — bailleur, locataire, virements, e-mails
- `config.php` — clé API
- `templates/quittances/*`, `templates/mails/*` — modèles personnalisés

Un fichier exemple anonymisé est fourni : [`docs/loyer-data.sample.json`](docs/loyer-data.sample.json) (copiez-le vers `data/loyer-data.json` pour tester).

## Structure du projet

```
LoyerManager/
├── index.html          # Interface
├── api.php             # API JSON + modèles
├── js/                 # Application (vanilla JS)
├── css/
├── templates/          # Modèles (*.example.* versionnés)
├── data/               # Données utilisateur (gitignored)
├── deploy/             # nginx, systemd, scripts
└── docs/AGENTS.md      # Guide développeurs / agents IA
```

## Licence

[MIT](LICENSE) — utilisation, modification et distribution libres, avec mention de la licence.

## Liens

- Dépôt : https://github.com/SamGoodwater/LoyerManager
- Documentation développeur : [`docs/AGENTS.md`](docs/AGENTS.md)
