#!/usr/bin/env bash
set -euo pipefail

HOST="${LOYER_HOST:-127.0.0.1}"
PORT="${LOYER_PORT:-8080}"
URL="http://${HOST}:${PORT}/api.php?action=status"

if curl -sf "${URL}" | grep -q '"ok":true'; then
  echo "OK — ${URL}"
  exit 0
fi

echo "ÉCHEC — ${URL} ne répond pas correctement" >&2
exit 1
