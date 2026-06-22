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
cd LoyerManager
./deploy/debian/install-dev.sh
# ou : php -S 0.0.0.0:8080
```

Production : nginx/Apache, PHP 7.4+, droits écriture `data/` et `templates/`, `config.php` avec `api_key` si exposé.

```bash
./deploy/scripts/fix-permissions.sh
./deploy/scripts/healthcheck.sh
```

## Priorités arbitrage

P0 sauvegarde fiable + calculs → P1 quittance/mail/CSV → P2 modèles/aide → P3 scripts deploy
