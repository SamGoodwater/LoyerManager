# Déploiement — Apache (Debian / WSL)

Loyer Manager est une **application web classique** : fichiers statiques + `api.php`.  
En production, servez-la avec **Apache** et **mod_php** (pas de build, pas de Node).

## Installation automatique (Debian / WSL)

```bash
cd /var/www/LoyerManager
sudo chmod +x deploy/scripts/*.sh
sudo ./deploy/scripts/install-apache.sh
```

Le script installe Apache, PHP (avec **pdo_sqlite**), active le site et règle les droits sur `data/` et `templates/`.

Ouvrez **http://localhost/** — la première visite redirige vers `login.html` pour créer le compte.

## Installation manuelle

1. Paquets : `apache2`, `libapache2-mod-php`, `php-sqlite3`, `php-curl`, `php-mbstring`, `php-xml`
2. Copiez [`apache/loyer-manager.conf`](apache/loyer-manager.conf) vers `/etc/apache2/sites-available/`
3. Remplacez `@LOYER_ROOT@` par le chemin du projet (ex. `/var/www/LoyerManager`)
4. `sudo a2enmod rewrite headers && sudo a2ensite loyer-manager && sudo systemctl reload apache2`
5. `cp config.example.php config.php` — renseignez `encryption_key` en production
6. Droits : `sudo ./deploy/scripts/fix-permissions.sh`

## Hébergement mutualisé (sans ce dossier)

Uploadez le projet via FTP. Le [`.htaccess`](../.htaccess) à la racine protège déjà `data/` et `config.php`.  
Guide : [`docs/HEBERGEMENT-MUTUALISE.md`](../docs/HEBERGEMENT-MUTUALISE.md)

## Mot de passe devant le site (optionnel)

En plus de la **connexion Loyer Manager** (`login.html`), vous pouvez ajouter une couche HTTP Basic Auth — voir [`apache/basic-auth.example`](apache/basic-auth.example).

## Scripts utiles

| Script | Rôle |
|--------|------|
| [`scripts/install-apache.sh`](scripts/install-apache.sh) | Installation complète Apache + PHP |
| [`scripts/fix-permissions.sh`](scripts/fix-permissions.sh) | Droits `www-data` sur `data/` et `templates/` |
| [`scripts/healthcheck.sh`](scripts/healthcheck.sh) | Test `api.php?action=auth-status` |
| [`scripts/cleanup-artifacts.sh`](scripts/cleanup-artifacts.sh) | Nettoie dossiers parasites dans `data/` |

## Développement local (sans Apache)

```bash
cp config.example.php config.php
php -S localhost:8080
```

Aucun script `deploy/` requis — pratique pour un test rapide. En WSL, préférez Apache pour reproduire la production (sessions PHP, SQLite).

## Dépannage

### Apache ne démarre pas (`Job for apache2.service failed`)

**Cause la plus fréquente après migration nginx → Apache :** nginx occupe encore le port 80.

```bash
sudo systemctl stop nginx
sudo systemctl disable nginx
sudo systemctl restart apache2
curl -sI http://127.0.0.1/ | head -3   # doit afficher Server: Apache
```

Si vous n'utilisez plus nginx du tout : `sudo apt remove nginx`.

### Anciens serveurs PHP de dev

Des processus `php -S` peuvent encore tourner (port 8080). Arrêtez-les si besoin :

```bash
pkill -f 'php -S.*LoyerManager' || true
```

## Vérification

```bash
LOYER_PORT=80 ./deploy/scripts/healthcheck.sh
curl -s http://localhost/api.php?action=auth-status | head -c 200
php -m | grep -i sqlite   # doit afficher pdo_sqlite
```

## Sécurité

- HTTPS en production (Let's Encrypt + `certbot --apache`)
- `encryption_key` dans `config.php` (OAuth mail + SMTP chiffré)
- Compte applicatif via `login.html` (session PHP)
- Détails : [`docs/SECURITE.md`](../docs/SECURITE.md)
