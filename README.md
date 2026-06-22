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
- Serveur web : nginx + php-fpm, Apache, ou PHP intégré pour les tests
- Navigateur récent (Chrome, Firefox, Edge)

## Installation rapide

```bash
git clone https://github.com/SamGoodwater/LoyerManager.git
cd LoyerManager
cp config.example.php config.php
# Production : définir api_key dans config.php (recommandé si URL publique)

./deploy/scripts/fix-permissions.sh
```

### Test local (PHP intégré)

```bash
./deploy/debian/install-dev.sh
# ou : php -S 0.0.0.0:8080
```

Ouvrez `http://localhost:8080/` (pas en `file://`).

### Production Debian / nginx

Voir [`deploy/debian/README`](deploy/debian/README).

```bash
sudo ./deploy/debian/install-nginx.sh
curl http://localhost/api.php?action=status
```

## Configuration

| Élément | Rôle |
|---------|------|
| `config.php` | Clé API optionnelle (`api_key`) — **non versionné** |
| `data/loyer-data.json` | Paramètres, virements, registre des modèles — **non versionné** |
| `templates/quittances/` | Modèles HTML quittance — **non versionné** |
| `templates/mails/` | Modèles mail (corps + objet) — **non versionné** |
| `templates/*.example.*` | Modèles d'exemple versionnés |

Au premier lancement, l'application crée `data/loyer-data.json` et migre d'éventuels anciens fichiers plats (`templates/quittance.html`, etc.) vers `templates/quittances/principal.html`.

## Jeu de démonstration

Données **100 % fictives** pour tester sans informations personnelles :

```bash
cp docs/demo/loyer-data.demo.json data/loyer-data.json
./deploy/scripts/fix-permissions.sh
```

Voir [`docs/demo/README.md`](docs/demo/README.md) pour le CSV d'import bancaire associé.

## Données personnelles

Ne pas committer (déjà dans `.gitignore`) :

- `data/loyer-data.json`, `data/signature.jpg`
- `config.php`
- `templates/quittances/*`, `templates/mails/*`

Exportez régulièrement une copie via **Paramètres → Données**.

## Structure du projet

```
LoyerManager/
├── index.html          # Interface
├── api.php             # API JSON + modèles
├── js/                 # Application (vanilla JS, sans build)
├── css/
├── templates/          # Exemples versionnés (*.example.*)
├── data/               # Données utilisateur (gitignored)
├── docs/demo/          # Jeu de démonstration
├── deploy/             # nginx, systemd, scripts
└── docs/AGENTS.md      # Guide développeurs
```

## Modèles (résumé)

| Action | Quittance | Mail |
|--------|-----------|------|
| Aperçu du mois | Onglet Quittance | Onglet Mail |
| Édition | Modèle personnalisé uniquement | Idem |
| Dupliquer | Nouveau modèle… | Nouveau modèle… |
| Importer | Crée un **nouveau** modèle (.html) | Crée un **nouveau** modèle (.json) |
| Exporter | .html | .json (objet + corps) |

Le panneau **Mots-clés** (édition) propose les mêmes variables pour quittance et mail : `{{paiement}}`, `{{bailleur.name}}`, `{{locataire.city}}`, etc.

## Licence

[MIT](LICENSE)

## Liens

- Dépôt : https://github.com/SamGoodwater/LoyerManager
- Documentation développeur : [`docs/AGENTS.md`](docs/AGENTS.md)
