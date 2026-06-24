# Loyer Manager — guide développeurs

Application **vanilla** (HTML + JS + PHP), **sans build**, **sans framework**. Version **1.0.0**.

## Arborescence

```
LoyerManager/
├── index.html          # App principale (après auth)
├── login.html          # Connexion / création de compte
├── api.php             # Routeur HTTP → php/handlers/
├── php/
│   ├── bootstrap.php, http.php, auth.php, oauth.php, mail-send.php, smtp.php
│   ├── handlers/       # system, data, templates, auth-api, oauth-api, mail-api, activity-api
│   └── migrations/
├── vendor/             # Dépendances PHP (versionnées)
├── js/
│   ├── version.js, auth.js, server-api.js, store.js, help.js
│   ├── app/            # core.js, period.js, shell.js (LoyerApp)
│   ├── ui/             # dashboard, payments, settings, templates-ui, quittance, mail
│   └── main.js         # Init (~110 lignes)
├── data/loyer-data.json      # gitignored — métier JSON
├── data/loyer.db             # gitignored — compte, OAuth mail, historique
├── builtin-templates/        # Modèles complet/court versionnés (bootstrap PHP)
└── templates/quittances|mails/
```

**Architecture détaillée :** [`docs/ARCHITECTURE.md`](ARCHITECTURE.md)

## Persistance

1. **Données métier** : `api.php` → `data/loyer-data.json` + `templates/`
2. **Compte, OAuth mail, SMTP, historique** : `data/loyer.db` (SQLite)
3. **Cache navigateur** : `localStorage` miroir des données si le serveur est temporairement injoignable (**lecture seule** — toute écriture passe par `api.php`)

Pas de File System Access API.

## Modèles

- Registre JSON : `settings.templates`
- Fichiers : `templates/quittances/{id}.html`, `templates/mails/{id}.html` + `{id}-subject.txt`
- **`complet`** et **`court`** : modèles de base, lecture seule (403 API si modification/suppression)
- Legacy **`principal`** : migré automatiquement vers `complet`
- Import : **crée** un nouveau modèle (ne remplace jamais les modèles de base)
- Embarqués versionnés : `builtin-templates/` (copiés au bootstrap PHP)

## Commentaires code

- Chaque **fonction** (JS et PHP) doit avoir un commentaire : rôle, paramètres clés, effets de bord.
- Les blocs **métier non évidents** (calculs loyer, doublons CSV, flux OAuth auth vs mail) méritent un paragraphe inline.
- Script de maintenance : `_analysis/add_comments.py` (ajoute ou complète les docblocks).
- Fichiers prioritaires pour relecture manuelle : `store.js`, `calculations.js`, `oauth.php`, `mail-send.php`.

## Conventions code

- IIFE : `(function (global) { … })(window)`
- UI et aide en **français**
- Diffs minimaux ; ne pas modifier `lib/` ni `_analysis/`
- Exporter les fonctions UI sur `LoyerApp` (voir `js/ui/*.js`)

## Déploiement

```bash
php -S localhost:8080   # dev
```

Production : [`deploy/README.md`](../deploy/README.md) ou [`docs/HEBERGEMENT-MUTUALISE.md`](HEBERGEMENT-MUTUALISE.md)

## Priorités arbitrage

P0 sauvegarde + calculs → P1 quittance/mail/CSV → P2 modèles/aide → P3 déploiement

## Période, mail, historique

- Barre `#period-bar` + `js/period-picker.js` — mois unique ou plage
- Mail : `send-mail`, `save-mail-draft` → [`docs/OAUTH-MAIL.md`](OAUTH-MAIL.md)
- Historique : `activity-log` + `js/activity-log.js`
