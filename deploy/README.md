# Dossier `deploy/` — optionnel

**En production (hébergement mutualisé)** : vous n'avez **pas besoin** de ce dossier. Uploadez le reste du projet (`index.html`, `api.php`, `js/`, `css/`, `data/`, `templates/`, `.htaccess`…) et suivez [`docs/HEBERGEMENT-MUTUALISE.md`](../docs/HEBERGEMENT-MUTUALISE.md).

**Ce dossier sert surtout au développement local** (WSL, Debian, nginx) et aux exemples de configuration serveur.

## Contenu

| Élément | Utilité |
|---------|---------|
| [`debian/nginx/loyer-manager.conf`](debian/nginx/loyer-manager.conf) | Exemple de site nginx (VPS) |
| [`nginx/basic-auth.example.conf`](nginx/basic-auth.example.conf) | Exemple mot de passe nginx |
| [`apache/basic-auth.example`](apache/basic-auth.example) | Exemple mot de passe Apache |
| [`server-router.php`](server-router.php) | Routeur pour `php -S` (bloque `data/` en dev) |
| [`scripts/`](scripts/) | Démarrage PHP local, droits, healthcheck — **dev uniquement** |
| [`debian/install-dev.sh`](debian/install-dev.sh) | Raccourci dev WSL (optionnel) |
| [`debian/install-nginx.sh`](debian/install-nginx.sh) | Installation nginx sur Debian (optionnel) |

## Développement local (le plus simple)

Sans aucun script :

```bash
cd LoyerManager
cp config.example.php config.php
php -S localhost:8080
```

Ouvrez `http://localhost:8080/` (la clé API peut rester **vide** en local).

Avec le routeur qui protège `data/` :

```bash
php -S localhost:8080 deploy/server-router.php
```

## Scripts (si vous voulez)

```bash
./deploy/scripts/loyer-ctl.sh start   # PHP intégré en arrière-plan
./deploy/debian/install-dev.sh      # idem + nettoyage artefacts
```

Voir [`debian/README`](debian/README) pour nginx + systemd sur Debian.
