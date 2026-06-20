#!/usr/bin/env bash
# Arrête le serveur PHP intégré (dev) quand nginx est utilisé.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "${DEPLOY_DIR}/.." && pwd)"

if [[ "${EUID}" -eq 0 ]]; then
  systemctl disable --now loyer-manager.service 2>/dev/null || true
fi

"${ROOT}/deploy/scripts/loyer-ctl.sh" stop 2>/dev/null || true
echo "Serveur dev (port 8080) arrêté."
