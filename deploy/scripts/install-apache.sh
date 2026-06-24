#!/usr/bin/env bash
# Installation Loyer Manager — Apache 2.4 + mod_php (Debian / WSL).
set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Exécutez en root : sudo $0" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
APACHE_CONF="${SCRIPT_DIR}/../apache/loyer-manager.conf"
TARGET="/etc/apache2/sites-available/loyer-manager.conf"

echo "=== Loyer Manager — installation Apache ==="
echo "Racine application : ${ROOT}"

export DEBIAN_FRONTEND=noninteractive
apt-get update

# PHP 8.x + Apache + extensions requises par l'app (auth SQLite, OAuth, mail)
PHP_PKG=""
for ver in 8.4 8.3 8.2 8.1; do
  if apt-cache show "php${ver}-sqlite3" &>/dev/null; then
    PHP_PKG="php${ver}"
    break
  fi
done

if [[ -n "${PHP_PKG}" ]]; then
  echo "Paquets PHP détectés : ${PHP_PKG}"
  apt-get install -y \
    apache2 \
    "libapache2-mod-${PHP_PKG}" \
    "${PHP_PKG}" \
    "${PHP_PKG}-sqlite3" \
    "${PHP_PKG}-curl" \
    "${PHP_PKG}-mbstring" \
    "${PHP_PKG}-xml" \
    "${PHP_PKG}-zip" \
    "${PHP_PKG}-intl"
else
  echo "Installation via méta-paquets php génériques…"
  apt-get install -y \
    apache2 \
    libapache2-mod-php \
    php \
    php-sqlite3 \
    php-curl \
    php-mbstring \
    php-xml \
    php-zip \
    php-intl
fi

a2enmod rewrite headers

export LOYER_ROOT="${ROOT}"
export LOYER_USER="${LOYER_USER:-www-data}"
export LOYER_GROUP="${LOYER_GROUP:-www-data}"

"${SCRIPT_DIR}/cleanup-artifacts.sh" || true
"${SCRIPT_DIR}/fix-permissions.sh"

sed "s|@LOYER_ROOT@|${ROOT}|g" "${APACHE_CONF}" > "${TARGET}"
a2ensite loyer-manager.conf
a2dissite 000-default.conf 2>/dev/null || true

apache2ctl configtest

# Ancien déploiement nginx : libérer le port 80
if command -v nginx &>/dev/null; then
  if systemctl is-active --quiet nginx 2>/dev/null; then
    echo "Arrêt de nginx (ancien déploiement, port 80 occupé)…"
    systemctl stop nginx
  fi
  if systemctl is-enabled --quiet nginx 2>/dev/null; then
    systemctl disable nginx || true
    echo "nginx désactivé au démarrage — Apache prend le relais sur le port 80."
  fi
fi

if [[ ! -f "${ROOT}/config.php" ]]; then
  cp "${ROOT}/config.example.php" "${ROOT}/config.php"
  chown root:"${LOYER_GROUP}" "${ROOT}/config.php"
  chmod 640 "${ROOT}/config.php"
  echo "Créé ${ROOT}/config.php — renseignez encryption_key et OAuth si besoin."
fi

systemctl enable apache2
if ! systemctl restart apache2; then
  echo "" >&2
  echo "Échec du démarrage Apache. Causes fréquentes :" >&2
  echo "  • Port 80 déjà utilisé (nginx, autre service) : sudo ss -tlnp | grep ':80 '" >&2
  echo "  • Logs : sudo journalctl -xeu apache2.service" >&2
  exit 1
fi

echo ""
echo "Site Apache activé."
echo "  URL : http://localhost/  (ou http://loyer.local/ si entrée hosts)"
echo "  VHost : ${TARGET}"
echo ""
LOYER_HOST=127.0.0.1 LOYER_PORT=80 "${SCRIPT_DIR}/healthcheck.sh" && echo "Installation OK."
