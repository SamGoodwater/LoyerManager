# Loyer Manager — guide développeurs

Application **vanilla** (HTML + JS + PHP), **sans build**, **sans framework**.

## Arborescence

```
LoyerManager/
├── index.html          # Point d'entrée ; ordre des scripts important
├── api.php             # Persistance : data/ + templates/
├── js/
│   ├── server-api.js   # Client HTTP api.php (avant store.js)
│   ├── store.js        # État + sauvegarde
│   ├── template-manager.js
│   ├── templates.js    # Remplissage {{mots-clés}}
│   ├── main.js         # UI
│   └── …
├── data/loyer-data.json      # gitignored
└── templates/quittances|mails/  # gitignored (sauf *.example.*)
```

## Persistance (priorité)

1. **Serveur** : `api.php` → `data/loyer-data.json` + `templates/`
2. **Cache** : `localStorage` si serveur injoignable (lecture seule disque)

Pas de File System Access API.

## Modèles

- Registre JSON : `settings.templates` (liste + `defaultQuittanceId` / `defaultMailId`)
- Fichiers : `templates/quittances/{id}.html`, `templates/mails/{id}.html` + `{id}-subject.txt`
- **`principal`** : modèle par défaut, **non modifiable** (403 API, UI lecture seule)
- Import fichier : **crée** un nouveau modèle (ne remplace jamais `principal`)
- Mots-clés : catalogue partagé dans `templates.js` (`SHARED_PLACEHOLDER_ITEMS`)

## Conventions code

- IIFE : `(function (global) { … })(window)`
- UI et aide en **français**
- Diffs minimaux ; ne pas modifier `lib/` ni `_analysis/`
- Gitignore : données utilisateur, `config.php`, templates personnalisés

## Déploiement local

```bash
php -S localhost:8080
```

Optionnel : dossier [`deploy/`](../deploy/README.md) (scripts dev, nginx Debian).

Production mutualisée : [`docs/HEBERGEMENT-MUTUALISE.md`](HEBERGEMENT-MUTUALISE.md) — **sans scripts**.

Guides utilisateur : [`docs/SECURITE.md`](SECURITE.md).

## Priorités arbitrage

P0 sauvegarde fiable + calculs → P1 quittance/mail/CSV → P2 modèles/aide → P3 scripts deploy

## Période et exports

- **Période partagée** : barre `#period-bar` + [`js/period-picker.js`](../js/period-picker.js) — mois unique (Quittance/Mail) ou plage optionnelle (Tableau de bord) ; timeline scrollable du début de bail à aujourd'hui.
- **Calculs dashboard** : `getMonthStatus`, `computeDashboardKpis`, `listMonthsInRange` dans `calculations.js`.
- **Export groupé quittances** : `LoyerQuittance.buildBatchHtml` + `LoyerExport.exportPdfFromHtml` / `exportDocxFromHtml` / `exportHtmlFromHtml` — une section `.quittance-export-page` par mois, sauts de page CSS.
