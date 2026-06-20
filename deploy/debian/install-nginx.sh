#!/usr/bin/env bash
# Installation production — nginx + php-fpm (Debian).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Exécutez en root : sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

echo "=== Loyer Manager — installation nginx ==="

apt-get update
apt-get install -y nginx php-fpm php-json php-mbstring

# Environnement (permissions)
ENV_DIR="/etc/loyer-manager"
ENV_FILE="${ENV_DIR}/env"
mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/env.example" "${ENV_FILE}"
  sed -i "s|LOYER_ROOT=.*|LOYER_ROOT=${ROOT}|" "${ENV_FILE}"
fi
export LOYER_ROOT="${ROOT}"
# shellcheck source=/dev/null
source "${ENV_FILE}"
"${ROOT}/deploy/scripts/cleanup-artifacts.sh"
"${ROOT}/deploy/scripts/fix-permissions.sh"

# Adapter le socket php-fpm si version différente
PHP_SOCK="/run/php/php$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')-fpm.sock"
NGINX_CONF="${SCRIPT_DIR}/nginx/loyer-manager.conf"
TARGET="/etc/nginx/sites-available/loyer-manager"

sed "s|unix:/run/php/php8.4-fpm.sock|unix:${PHP_SOCK}|" "${NGINX_CONF}" > "${TARGET}"
ln -sf "${TARGET}" /etc/nginx/sites-enabled/loyer-manager
rm -f /etc/nginx/sites-enabled/default 2>/dev/null || true

nginx -t

PHP_VER="$(php -r 'echo PHP_MAJOR_VERSION.".".PHP_MINOR_VERSION;')"
PHP_FPM_UNIT="php${PHP_VER}-fpm"
if ! systemctl list-unit-files "${PHP_FPM_UNIT}.service" &>/dev/null; then
  PHP_FPM_UNIT="$(systemctl list-unit-files --type=service --no-legend 'php*-fpm.service' 2>/dev/null | awk '{print $1}' | head -1 | sed 's/\.service$//')"
fi
if [[ -z "${PHP_FPM_UNIT}" ]]; then
  echo "Service php-fpm introuvable" >&2
  exit 1
fi

systemctl enable nginx "${PHP_FPM_UNIT}"
systemctl restart "${PHP_FPM_UNIT}" nginx

# Désactiver le serveur PHP intégré (dev) — nginx prend le relais
if systemctl is-enabled loyer-manager.service &>/dev/null; then
  systemctl disable --now loyer-manager.service 2>/dev/null || true
fi
if [[ -f "${ROOT}/deploy/.php-server.pid" ]]; then
  "${ROOT}/deploy/scripts/loyer-ctl.sh" stop 2>/dev/null || true
fi

# config.php local si absent
if [[ ! -f "${ROOT}/config.php" ]]; then
  cp "${ROOT}/config.example.php" "${ROOT}/config.php"
  chown root:"${LOYER_GROUP:-www-data}" "${ROOT}/config.php"
  chmod 640 "${ROOT}/config.php"
  echo "Créé ${ROOT}/config.php (api_key vide — OK en local)"
fi

echo ""
echo "Site nginx activé (${PHP_FPM_UNIT})."
echo "server_name : loyer.local localhost — voir ${TARGET}"
LOYER_HOST=127.0.0.1 LOYER_PORT=80 "${ROOT}/deploy/scripts/healthcheck.sh" && echo "Installation OK."
