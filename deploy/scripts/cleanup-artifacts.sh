#!/usr/bin/env bash
# Supprime les dossiers parasites data/data/ et data/templates/ (ancienne config).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="${LOYER_ROOT:-$(cd "${DEPLOY_DIR}/.." && pwd)}"
DATA_DIR="${ROOT}/data"

removed=0
for artifact in "${DATA_DIR}/data" "${DATA_DIR}/templates"; do
  if [[ -d "${artifact}" ]]; then
    echo "Suppression : ${artifact}"
    rm -rf "${artifact}"
    removed=$((removed + 1))
  fi
done

for junk in "${DATA_DIR}"/loyer-data*.json; do
  if [[ -f "${junk}" && "${junk}" != "${DATA_DIR}/loyer-data.json" ]]; then
    echo "Suppression : ${junk}"
    rm -f "${junk}"
    removed=$((removed + 1))
  fi
done

TEMPLATES_DIR="${ROOT}/templates"
for bak in "${TEMPLATES_DIR}"/*.bak; do
  if [[ -f "${bak}" ]]; then
    echo "Suppression : ${bak}"
    rm -f "${bak}"
    removed=$((removed + 1))
  fi
done

if [[ "${removed}" -eq 0 ]]; then
  echo "Aucun artefact à supprimer."
else
  echo "${removed} dossier(s) parasite(s) supprimé(s)."
fi
