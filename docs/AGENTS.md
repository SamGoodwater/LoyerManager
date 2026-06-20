# Loyer Manager — guide pour agents Cursor

Document de contexte pour toute IA travaillant sur ce dépôt. Lire ce fichier **avant** de modifier le code.

---

## 1. Vision produit

**Loyer Manager** est une application **100 % locale / self-hosted** pour un bailleur particulier qui gère un ou quelques biens :

- Suivre les loyers (attendu vs reçu, solde cumulé)
- Enregistrer les virements (CSV bancaire ou saisie manuelle)
- Produire des **quittances** (PDF, DOCX, HTML)
- Préparer l’envoi par **e-mail** (EML multipart + PDF, ou mailto)

**Contraintes non négociables :**

| Contrainte | Détail |
|------------|--------|
| Pas de SaaS | Aucun compte, aucune API cloud obligatoire |
| Simplicité | Vanilla HTML/CSS/JS, pas de build, pas de framework |
| Utilisateur final | Peu technique ; UI en **français**, aide intégrée (onglet Aide + boutons `?`) |
| Données sensibles | JSON + templates sur disque ; gitignore les fichiers utilisateur |
| Navigateur | **HTTP(S) obligatoire** — persistance via api.php ; tout navigateur moderne |

---

## 2. Structure du dépôt

```
LoyerManager/                     ← racine workspace Git + document root web
├── docs/AGENTS.md                ← ce fichier
├── deploy/                       ← déploiement serveur (systemd, nginx, scripts)
│   ├── server-router.php
│   ├── scripts/
│   └── debian/
├── .cursor/rules/
├── index.html                    ← point d’entrée unique
├── api.php                       ← API persistance (mode serveur)
├── config.example.php            ← modèle ; copier en config.php (gitignoré)
├── .htaccess                     ← protège config.php (Apache)
├── css/styles.css
├── js/                           ← modules (voir §4)
├── lib/                          ← dépendances vendored (ne pas modifier)
├── data/
│   ├── loyer-data.example.json
│   └── loyer-data.json           ← données utilisateur (gitignoré)
└── templates/
    ├── *.example.*               ← défauts versionnés
    └── quittance.html, mail.html, mail-subject.txt  ← gitignorés
```

---

## 3. Fonctionnalités (état actuel)

### 3.1 Onglets UI

| Onglet | Rôle |
|--------|------|
| **Tableau de bord** | Année/mois, tableau mensuel, graphiques, virements du mois |
| **Virements** | Liste CRUD, import CSV, saisie manuelle |
| **Paramètres** | Bail, parties, signature, loyers, émetteurs CSV, **Modèles**, destinataires mail, **Données** |
| **Quittance** | Aperçu WYSIWYG du mois sélectionné, exports, mail |
| **Aide** | Guide pas à pas + dépannage + installation serveur |

### 3.2 Persistance — mode serveur (api.php)

- App servie en `http://` ou `https://` (obligatoire pour enregistrer sur disque)
- Détection auto : `LoyerServerApi.detect()` → `api.php?action=status`
- JSON : `GET/POST api.php?action=data` → `data/loyer-data.json`
- Modèles : `GET/POST api.php?action=template&name=…` → `templates/`
- Miroir `localStorage` si le serveur est temporairement injoignable (lecture seule côté disque)
- File System Access API : **supprimée**

### 3.3 Modèles WYSIWYG (quittance + mail)

- Fichiers HTML (Quill) + `mail-subject.txt`
- Mots-clés `{{cle}}` et `{{objet.propriete}}` remplacés par `LoyerTemplates.fillTemplate()`
- **Paramètres → Modèles** : toggle **Modifier le modèle** / **Aperçu avec données**
- Panneau latéral **Mots-clés** : clic → insertion au curseur (`LoyerEditor.insertText`)
- Zone éditeur quittance : largeur **210 mm** (format A4)
- Défauts : `templates/*.example.*` + `js/template-defaults.js` (bootstrap sans fetch)

### 3.4 Exports & mail

- **PDF** : html2pdf sur le DOM Quill
- **DOCX** : html-docx.js
- **EML** : multipart `text/plain` + `text/html` + pièce jointe PDF (`mail.js`)
- Corps/objet mail lus depuis templates, pas depuis le JSON

### 3.5 Import CSV bancaire

- Encodages multiples, séparateur `;` ou `,`
- Matching par profils émetteurs (`emitterProfiles.patterns`)
- Prévisualisation avec détection doublons avant import

---

## 4. Architecture JavaScript

Chaque module est une IIFE `(function (global) { ... })(window)` exportant un namespace global.

### Ordre de chargement (`index.html`)

```
default-signature.js → template-defaults.js → seed-data.js → calculations.js
→ csv-import.js → server-api.js → template-manager.js → store.js → templates.js → notify.js
→ editor.js → charts.js → quittance.js → export.js → mail.js → help.js → main.js
```

**Ne pas inverser** `server-api.js` / `store.js` / `templates.js`.

### Modules

| Global | Fichier | Responsabilité |
|--------|---------|----------------|
| `LoyerStore` | `store.js` | Persistance JSON, modes serveur/FS, migration mail.body |
| `LoyerServerApi` | `server-api.js` | Client HTTP vers `api.php` |
| `LoyerTemplateManager` | `template-manager.js` | Registre multi-modèles, CRUD via API |
| `LoyerTemplates` | `templates.js` | load/save/fill templates, catalogue placeholders |
| `LoyerCalc` | `calculations.js` | Calculs purs, `buildQuittanceData()` |
| `LoyerEditor` | `editor.js` | Fabrique Quill multi-instances |
| `LoyerQuittance` | `quittance.js` | Rendu quittance depuis template fichier |
| `LoyerMail` | `mail.js` | EML / mailto |
| `LoyerExport` | `export.js` | PDF, DOCX, HTML |
| `LoyerCsvImport` | `csv-import.js` | Parse CSV + preview |
| `LoyerCharts` | `charts.js` | Chart.js bar/line |
| `LoyerHelp` | `help.js` | Infobulles `?`, textes d’aide |
| `LoyerNotify` | `notify.js` | Toasts, confirm, dialogue fichier corrompu |
| — | `main.js` | État UI, rendu écrans, événements, init |
| `LOYER_TEMPLATE_DEFAULTS` | `template-defaults.js` | HTML/texte embarqués |
| `LOYER_SEED_DATA` | `seed-data.js` | JSON exemple embarqué |

### État central (`main.js`)

```javascript
state = {
  data,              // objet normalisé loyer-data.json
  selectedYear,
  selectedMonth,
  editingPaymentId,
  csvImportItems,
  quittanceUi: { selectedId, mode, raw, dirty },
  mailUi: { selectedId, mode, raw, mailSubjectRaw, dirty }
}
```

Toute modification métier passe par `persist()` → `LoyerStore.save(state.data)`.

### Instances Quill (`editor.js`)

| ID | Usage |
|----|-------|
| `quittance-preview` | Onglet Quittance — aperçu du mois (export PDF/DOCX/HTML) |
| `template-quittance` | Onglet Quittance — édition modèle |
| `template-mail` | Onglet Mail — édition corps |
| `mail-preview` | Onglet Mail — aperçu corps rempli |

---

## 5. Schéma de données (`loyer-data.json`)

```json
{
  "version": 1,
  "settings": {
    "leaseStart", "rentDueDay",
    "emitters", "emitterProfiles",
    "priceHistory": [{ "from", "amount" }],
    "bailleur": { "name", "street", "postalCode", "city", "signatureImage" },
    "locataire": { ... },
    "mail": { "recipients": [{ "email", "type" }], "signature" },
    "templates": {
      "defaultQuittanceId", "defaultMailId",
      "quittances": [{ "id", "name" }],
      "mails": [{ "id", "name" }]
    }
  },
  "payments": [{ "id", "date", "amount", "emitter", "bankLabel", "bankRef", "comment" }]
}
```

**Hors JSON (fichiers templates) :** `templates/quittances/{id}.html`, `templates/mails/{id}.html` + `{id}-subject.txt`. Modèle système `_system` = contenu embarqué `LOYER_TEMPLATE_DEFAULTS`.  
**Migration :** anciens fichiers plats `quittance.html` / `mail.*` → modèle `principal` ; ancien `mail.body` / `mail.subject` dans JSON → idem (`migrateMailBodyFromData`).

---

## 6. API PHP (`api.php`)

| Action | Méthode | Rôle |
|--------|---------|------|
| `status`, `config` | GET | Healthcheck / auth requise ? (sans clé API) |
| `data` | GET/POST | Lire/écrire `data/loyer-data.json` (clé si configurée) |
| `templates` | GET | `?type=quittance\|mail` → liste des fichiers sur disque |
| `template` | GET/POST/DELETE | `?type=&id=&part=body\|subject` — CRUD multi-modèles |

Auth optionnelle : `config.php` → `'api_key' => '...'` (header `X-API-Key` ou `?key=`).

Au premier appel, copie automatique des `.example.*` si fichiers utilisateur absents.

---

## 7. Déploiement Debian / WSL

Scripts dans `deploy/debian/` — voir `deploy/debian/README`.

### Option A — service systemd (dev WSL / Debian)

```bash
sudo ./deploy/debian/install-dev.sh
# WSL sans systemd :
./deploy/scripts/loyer-ctl.sh start
```

→ http://localhost:8080/index.html — routeur PHP bloque l’accès direct à `data/` et `templates/`.

### Option B — nginx + php-fpm (production)

```bash
sudo ./deploy/debian/install-nginx.sh
```

Config : `deploy/debian/nginx/loyer-manager.conf` — `root` = racine du dépôt.

### Option C — Apache

- DocumentRoot = racine du dépôt
- `.htaccess` présent (protection `config.php`)

### Checklist post-déploiement

1. Copier `config.example.php` → `config.php` ; définir `api_key` si exposé sur Internet
2. `./deploy/scripts/healthcheck.sh` ou `curl http://localhost:8080/api.php?action=status`
3. Ouvrir l’app via URL (pas `file://`)
4. Badge **Enregistré** vert sans modale de dossier
5. Tester Enregistrer paramètres + Enregistrer modèle

---

## 8. Conventions de code (à respecter)

1. **Vanilla JS ES5-compatible** — pas de modules ES6 import/export, pas de bundler
2. **IIFE + `(window)`** — jamais `global` nu sans paramètre (bug corrigé dans `main.js`)
3. **Diffs minimaux** — ne pas refactoriser hors scope de la demande
4. **UI en français** — libellés, aide, notifications
5. **Pas de README/markdown** supplémentaire sauf demande explicite (sauf ce AGENTS.md)
6. **Git** — ne pas committer `data/loyer-data.json`, `templates/*.html`, `config.php`
7. **Tests** — pas de suite automatisée ; tests manuels navigateur
8. **Responsive** — breakpoints ~640 px et ~900 px dans `styles.css`
9. **Accessibilité** — onglets ARIA, skip link, infobulles clavier (Escape ferme)

---

## 9. Priorités produit (pour arbitrer les choix)

| Priorité | Sujet |
|----------|-------|
| P0 | Sauvegarde fiable (mode serveur sur Debian) |
| P0 | Exactitude des calculs loyer / solde / quittance |
| P1 | Génération quittance + PDF + EML corrects |
| P1 | Import CSV robuste (banques françaises) |
| P2 | Édition modèles WYSIWYG fluide (placeholders, A4) |
| P2 | Aide et messages clairs (pas de jargon technique) |
| P3 | Exports DOCX/HTML |

En cas de conflit : **fiabilité des données > nouvelles features > polish UI**.

---

## 10. Pièges connus

| Piège | Solution |
|-------|----------|
| `ReferenceError: global is not defined` | IIFE doit être `(function (global) { ... })(window)` |
| Modèles non enregistrables | Vérifier nginx/php-fpm, droits `templates/`, badge Enregistré |
| `file://` + fetch templates | Défauts embarqués dans `template-defaults.js` ; écriture impossible sans FS API |
| Doublons `data/data/` ou `data/templates/` | Artefacts ancienne config ; supprimer via `deploy/scripts/cleanup-artifacts.sh` |
| Quill casse layout quittance | `LoyerEditor.applyQuittanceLayout()` après setHtml en aperçu |
| EML trop gros | PDF en base64 dans multipart ; normal pour une quittance |

---

## 11. Historique des évolutions majeures

1. **MVP** — JSON localStorage, tableaux, graphiques
2. **Persistance fichier** — File System Access API, `loyer-data.json`
3. **Quittance WYSIWYG** — Quill, exports PDF/DOCX
4. **Import CSV** — profils émetteurs, anti-doublons
5. **Aide intégrée** — onglet Aide, infobulles, setup guidé
6. **Templates externalisés** — fichiers HTML, mots-clés `{{}}`, édition modèle vs aperçu
7. **UI modèles** — panneau mots-clés latéral, format A4
8. **Mode serveur** — `api.php` + détection auto, fin de la sélection de dossier à chaque refresh

---

## 12. Suite prévue (backlog)

Tâches **non implémentées** ou **phase 2** — à prioriser avec l’utilisateur :

### Court terme
- [x] Script `deploy/debian/` : systemd + nginx + permissions `data/`/`templates/`
- [x] Propager `api_key` côté client si configurée (`server-api.js`, Paramètres → Données)
- [x] Supprimer dossiers parasites `data/data/`, `data/templates/` (`cleanup-artifacts.sh`)
- [ ] Tests manuels checklist post-migration Debian

### Moyen terme
- [ ] Historique des quittances envoyées (metadata dans JSON)

### Long terme / hors scope actuel
- Multi-biens / multi-locataires
- Application mobile
- Signature électronique
- Connexion bancaire API (DSP2)

### Dette technique acceptable
- Pas de TypeScript ni tests unitaires — cohérent avec objectif simplicité

---

## 13. Fichiers à lire selon la tâche

| Tâche | Fichiers |
|-------|----------|
| Bug sauvegarde | `store.js`, `server-api.js`, `api.php`, `main.js` (badge/setup) |
| Calculs / solde | `calculations.js`, `main.js` (dashboard) |
| Quittance | `quittance.js`, `templates.js`, `template-defaults.js`, `editor.js` |
| Mail / EML | `mail.js`, `templates.js` |
| Modèles UI | `main.js` (quittanceUi/mailUi), `template-manager.js`, `index.html` (onglets Quittance/Mail, Paramètres listes) |
| Import CSV | `csv-import.js`, `main.js` (modal CSV) |
| Aide / textes | `help.js`, `index.html` (panel-help) |
| Déploiement | `deploy/debian/`, `api.php`, `config.example.php`, `.htaccess` |

---

## 14. Instructions pour l’agent Cursor

- Répondre à l’utilisateur en **français**
- Ne pas créer de commits sauf demande explicite
- Ne pas éditer `_analysis/` ni les fichiers dans `lib/` (vendor)
- Avant d’ajouter une dépendance npm : **refuser** sauf demande explicite — privilégier vendor CDN/local existant
- En cas de nouvelle persistance : **étendre** `store.js` / `api.php`, ne pas créer un second système parallèle
- Documenter les changements d’architecture **dans ce fichier** si la structure évolue significativement

---

*Dernière mise à jour : juin 2025 — bibliothèque multi-modèles quittance/mail + onglet Mail.*
