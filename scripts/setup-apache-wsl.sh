#!/usr/bin/env bash
# Configuration Apache locale pour Loyer Manager (WSL / Debian).
set -euo pipefail

APP_ROOT="/var/www/loyermanager"
SITE="loyermanager.conf"
DEV_USER="${SUDO_USER:-${LOGNAME:-goodwater}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez avec sudo : sudo bash $0" >&2
  exit 1
fi

if ! id "$DEV_USER" &>/dev/null; then
  echo "Utilisateur introuvable : $DEV_USER — exportez SUDO_USER ou éditez DEV_USER." >&2
  exit 1
fi

echo "→ VirtualHost Apache → ${APP_ROOT}"
cat > "/etc/apache2/sites-available/${SITE}" <<EOF
<VirtualHost *:80>
	ServerAdmin webmaster@localhost
	DocumentRoot ${APP_ROOT}

	<Directory ${APP_ROOT}>
		Options Indexes FollowSymLinks
		AllowOverride All
		Require all granted
	</Directory>

	ErrorLog \${APACHE_LOG_DIR}/loyermanager-error.log
	CustomLog \${APACHE_LOG_DIR}/loyermanager-access.log combined
</VirtualHost>
EOF

a2ensite "${SITE}"
a2dissite 000-default.conf 2>/dev/null || true
a2enmod rewrite

echo "→ Extensions PHP (SQLite requis pour l'authentification)"
apt-get install -y libapache2-mod-php php8.4-sqlite3 php8.4-curl php8.4-mbstring curl

echo "→ Droits d'écriture partagés (${DEV_USER} + www-data)"
install -d -m 775 -o "$DEV_USER" -g www-data \
  "${APP_ROOT}/data" \
  "${APP_ROOT}/templates/quittances" \
  "${APP_ROOT}/templates/mails"
chown -R "$DEV_USER":www-data "${APP_ROOT}/data" "${APP_ROOT}/templates"
find "${APP_ROOT}/data" "${APP_ROOT}/templates" -type d -exec chmod 775 {} +
find "${APP_ROOT}/data" "${APP_ROOT}/templates" -type f -exec chmod 664 {} +
rm -f "${APP_ROOT}/data/loyer.db-wal" "${APP_ROOT}/data/loyer.db-shm" 2>/dev/null || true
if ! id -nG "$DEV_USER" | grep -qw www-data; then
  usermod -aG www-data "$DEV_USER"
fi

echo "→ Redémarrage Apache"
systemctl restart apache2

echo "→ Test API"
if curl -sf "http://localhost/api.php?action=config" | grep -q '"ok":true'; then
  echo "OK — ouvrez http://localhost/login.html"
else
  echo "Échec — consultez /var/log/apache2/loyermanager-error.log" >&2
  exit 1
fi

if curl -sf "http://localhost/api.php?action=auth-status" | grep -q '"serverBlocked":true'; then
  echo "ATTENTION : SQLite toujours indisponible côté Apache." >&2
  echo "Vérifiez : php -r 'echo extension_loaded(\"pdo_sqlite\") ? \"ok\" : \"ko\";' avec un script servi par Apache." >&2
  exit 1
fi

echo "Configuration terminée."
