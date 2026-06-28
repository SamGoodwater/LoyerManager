#!/usr/bin/env bash
# Droits partagés : Apache (www-data) + serveur PHP dev (votre utilisateur WSL).
set -euo pipefail

APP_ROOT="/var/www/loyermanager"
DEV_USER="${SUDO_USER:-${LOGNAME:-goodwater}}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Relancez avec sudo : sudo bash $0" >&2
  exit 1
fi

if ! id "$DEV_USER" &>/dev/null; then
  echo "Utilisateur introuvable : $DEV_USER" >&2
  exit 1
fi

echo "→ Propriétaire ${DEV_USER}:www-data sur data/ et templates/"
install -d -m 775 -o "$DEV_USER" -g www-data \
  "${APP_ROOT}/data" \
  "${APP_ROOT}/templates/quittances" \
  "${APP_ROOT}/templates/mails"

chown -R "$DEV_USER":www-data "${APP_ROOT}/data" "${APP_ROOT}/templates"
find "${APP_ROOT}/data" "${APP_ROOT}/templates" -type d -exec chmod 775 {} +
find "${APP_ROOT}/data" "${APP_ROOT}/templates" -type f -exec chmod 664 {} +

# WAL SQLite : supprimer fichiers auxiliaires verrouillés par un autre utilisateur
rm -f "${APP_ROOT}/data/loyer.db-wal" "${APP_ROOT}/data/loyer.db-shm" 2>/dev/null || true

if id -nG "$DEV_USER" | grep -qw www-data; then
  echo "→ ${DEV_USER} est déjà dans le groupe www-data"
else
  usermod -aG www-data "$DEV_USER"
  echo "→ ${DEV_USER} ajouté au groupe www-data (reconnexion WSL conseillée)"
fi

echo "→ Redémarrage Apache"
systemctl restart apache2

echo "OK — Apache (www-data) et php -S (${DEV_USER}) peuvent écrire dans data/"
