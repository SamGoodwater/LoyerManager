# Loyer Manager

Application web **auto-hébergée** pour suivre les loyers, importer des virements bancaires, générer des quittances (PDF, DOCX, HTML) et préparer des e-mails avec pièce jointe.

Développé par **Goodwater** — logiciel libre sous [licence MIT](LICENSE).

## Fonctionnalités

- **Tableau de bord** : suivi mensuel, solde cumulé, graphiques
- **Virements** : saisie manuelle ou import CSV (relevé bancaire), détection de doublons, glisser-déposer sur la page
- **Modèles quittance et mail** : bibliothèque multi-fichiers, édition WYSIWYG, mots-clés `{{…}}` (paiement, bailleur, locataire, etc.)
- **Modèle principal** : fourni par défaut, en lecture seule — dupliquer ou importer pour personnaliser
- **Exports** : PDF / DOCX / HTML pour la quittance ; EML + PDF ou mailto pour le mail
- **Persistance serveur** via `api.php` — pas de cloud, pas de compte

## Prérequis

- PHP 7.4+ (8.x recommandé), extension JSON
- Serveur web Apache (mutualisé) ou nginx / PHP intégré (local)
- Navigateur récent (Chrome, Firefox, Edge)

## Installation — hébergement web (production)

**Aucun script requis.** L'application est autonome : uploadez les fichiers et c'est tout.

1. Envoyez le projet sur votre hébergeur (FTP ou gestionnaire de fichiers).
2. Copiez `config.example.php` → `config.php`.
3. Vérifiez que PHP peut écrire dans `data/` et `templates/` (souvent droits **755** ou **775** via le panneau).
4. Ouvrez l'URL du site dans le navigateur.

Guide détaillé : [`docs/HEBERGEMENT-MUTUALISE.md`](docs/HEBERGEMENT-MUTUALISE.md)

Sécurité (HTTPS, mot de passe site, clé API) : [`docs/SECURITE.md`](docs/SECURITE.md)

## Installation — test local (développement)

```bash
git clone https://github.com/SamGoodwater/LoyerManager.git
cd LoyerManager
cp config.example.php config.php
php -S localhost:8080
```

Ouvrez `http://localhost:8080/` (pas en `file://`). La clé API peut rester **vide** en local.

Le dossier [`deploy/`](deploy/README.md) est **optionnel** (scripts dev, exemple nginx Debian).

## Configuration

| Élément | Rôle |
|---------|------|
| `config.php` | Clé API optionnelle (`api_key`) — voir ci-dessous |
| `data/loyer-data.json` | Paramètres, virements, registre des modèles — **non versionné** |
| `templates/quittances/` | Modèles HTML quittance — **non versionné** |
| `templates/mails/` | Modèles mail (corps + objet) — **non versionné** |
| `templates/*.example.*` | Modèles d'exemple versionnés |

### Clé API (`api_key`) — c'est quoi ?

Ce n'est **pas** un compte utilisateur. C'est un **mot de passe technique** entre votre navigateur et `api.php` :

- Protège la **lecture et l'écriture** de `data/loyer-data.json` et des modèles sur le serveur.
- Vous la saisissez **une fois** dans Paramètres → Données ; le navigateur la retient le temps de la session.
- **Vide** en local : pas de clé demandée.
- **Renseignée** en production : recommandé si l'URL est accessible sur Internet.

Distinct du **mot de passe du site** (fenêtre du navigateur avant d'afficher les pages) — les deux se complètent. Détails : [`docs/SECURITE.md`](docs/SECURITE.md).

Au premier lancement, l'application crée `data/loyer-data.json` si besoin.

## Jeu de démonstration

```bash
cp docs/demo/loyer-data.demo.json data/loyer-data.json
```

Voir [`docs/demo/README.md`](docs/demo/README.md).

## Données personnelles

Ne pas committer (déjà dans `.gitignore`) : `data/loyer-data.json`, `config.php`, modèles personnalisés dans `templates/`.

## Structure du projet

```
LoyerManager/
├── index.html, api.php, .htaccess   ← suffisent avec js/, css/, lib/
├── js/ css/ lib/
├── data/ templates/
├── docs/          ← guides utilisateur (sécurité, mutualisé)
└── deploy/        ← optionnel (dev local, exemples nginx)
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
- [`docs/SECURITE.md`](docs/SECURITE.md) · [`docs/HEBERGEMENT-MUTUALISE.md`](docs/HEBERGEMENT-MUTUALISE.md) · [`docs/AGENTS.md`](docs/AGENTS.md)
