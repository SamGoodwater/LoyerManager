#!/usr/bin/env bash
# Push vers GitHub avec un Personal Access Token (sans enregistrer le token dans git config).
#
# 1. Créez un token : https://github.com/settings/tokens → scope repo
# 2. Lancez :
#      GITHUB_TOKEN='ghp_…' bash scripts/git-push.sh
#
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  echo "Erreur : définissez GITHUB_TOKEN (Personal Access Token GitHub)." >&2
  echo "Exemple : GITHUB_TOKEN='ghp_xxx' bash scripts/git-push.sh" >&2
  exit 1
fi

branch="$(git branch --show-current)"
remote_url="https://SamGoodwater:${GITHUB_TOKEN}@github.com/SamGoodwater/LoyerManager.git"

echo "Push de ${branch} vers origin…"
git push "${remote_url}" "${branch}"
echo "OK — ${branch} poussé sur GitHub."
