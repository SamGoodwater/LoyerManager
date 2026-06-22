#!/usr/bin/env bash
# Droits d'écriture PHP sur data/ et templates/.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${LOYER_ROOT:-$(cd "${DEPLOY_DIR}/.." && pwd)}"
USER="${LOYER_USER:-www-data}"
GROUP="${LOYER_GROUP:-www-data}"

for dir in data templates templates/quittances templates/mails; do
  target="${ROOT}/${dir}"
  if [[ ! -d "${target}" ]]; then
    mkdir -p "${target}"
  fi
  chown -R "${USER}:${GROUP}" "${target}"
  chmod 775 "${target}"
done

chown -R "${USER}:${GROUP}" "${ROOT}/templates"
find "${ROOT}/templates" -type d -exec chmod 775 {} \;
find "${ROOT}/templates" -type f -exec chmod 664 {} \;

if [[ -f "${ROOT}/config.php" ]]; then
  chown "${USER}:${GROUP}" "${ROOT}/config.php"
  chmod 640 "${ROOT}/config.php"
fi

echo "Permissions OK — ${USER}:${GROUP} sur ${ROOT}/data et ${ROOT}/templates"
