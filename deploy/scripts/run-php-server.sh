#!/usr/bin/env bash
# Lance le serveur PHP intégré (utilisé par systemd).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${LOYER_ROOT:-$(cd "${DEPLOY_DIR}/.." && pwd)}"
HOST="${LOYER_HOST:-0.0.0.0}"
PORT="${LOYER_PORT:-8080}"
ROUTER="${DEPLOY_DIR}/server-router.php"

exec /usr/bin/php -S "${HOST}:${PORT}" -t "${ROOT}" "${ROUTER}"
