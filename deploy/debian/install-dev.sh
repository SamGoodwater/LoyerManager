#!/usr/bin/env bash
# Installation mode développement WSL/Debian — service systemd + PHP intégré.
# Sans root : mode local uniquement (loyer-ctl start).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
ENV_DIR="/etc/loyer-manager"
ENV_FILE="${ENV_DIR}/env"
LOCAL_ENV="${ROOT}/deploy/.env.local"
SERVICE_NAME="loyer-manager.service"

echo "=== Loyer Manager — installation dev ==="
echo "Racine application : ${ROOT}"

if [[ "${EUID}" -ne 0 ]]; then
  echo "Mode local (sans root) — pas d'installation systemd."
  cp -n "${SCRIPT_DIR}/env.example" "${LOCAL_ENV}" 2>/dev/null || true
  sed -i "s|LOYER_ROOT=.*|LOYER_ROOT=${ROOT}|" "${LOCAL_ENV}" 2>/dev/null || \
    sed "s|LOYER_ROOT=.*|LOYER_ROOT=${ROOT}|" "${SCRIPT_DIR}/env.example" > "${LOCAL_ENV}"
  export LOYER_ROOT="${ROOT}"
  # shellcheck source=/dev/null
  source "${LOCAL_ENV}"
  chmod +x "${ROOT}/deploy/scripts/"*.sh
  "${ROOT}/deploy/scripts/cleanup-artifacts.sh"
  echo ""
  echo "Démarrage : ${ROOT}/deploy/scripts/loyer-ctl.sh start"
  "${ROOT}/deploy/scripts/loyer-ctl.sh" start
  "${ROOT}/deploy/scripts/loyer-ctl.sh" health || true
  echo "URL : http://localhost:${LOYER_PORT:-8080}/index.html"
  exit 0
fi

# --- root : installation complète ---
mkdir -p "${ENV_DIR}"
if [[ ! -f "${ENV_FILE}" ]]; then
  cp "${SCRIPT_DIR}/env.example" "${ENV_FILE}"
  sed -i "s|LOYER_ROOT=.*|LOYER_ROOT=${ROOT}|" "${ENV_FILE}"
  echo "Créé ${ENV_FILE}"
else
  echo "Conservé ${ENV_FILE} existant"
fi

export LOYER_ROOT="${ROOT}"
# shellcheck source=/dev/null
source "${ENV_FILE}"
"${ROOT}/deploy/scripts/cleanup-artifacts.sh"
"${ROOT}/deploy/scripts/fix-permissions.sh"

chmod +x "${ROOT}/deploy/scripts/"*.sh

cp "${SCRIPT_DIR}/systemd/loyer-manager.service" "/etc/systemd/system/${SERVICE_NAME}"
systemctl daemon-reload
systemctl enable "${SERVICE_NAME}"

if systemctl is-system-running &>/dev/null; then
  systemctl restart "${SERVICE_NAME}"
  sleep 1
  systemctl status "${SERVICE_NAME}" --no-pager || true
  LOYER_HOST=127.0.0.1 "${ROOT}/deploy/scripts/healthcheck.sh" && echo "Service opérationnel."
else
  echo ""
  echo "Systemd n'est pas actif (WSL sans systemd=true ?)."
  echo "Démarrage manuel : ${ROOT}/deploy/scripts/loyer-ctl.sh start"
  echo "Ou activez systemd dans /etc/wsl.conf puis wsl --shutdown"
fi

PORT="${LOYER_PORT:-8080}"
echo ""
echo "URL : http://localhost:${PORT}/index.html"
