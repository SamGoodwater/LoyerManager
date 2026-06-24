#!/usr/bin/env bash
# Initialise une instance démonstration Loyer Manager :
# - sauvegarde / remplace config.php depuis config.demo.example.php
# - génère encryption_key si placeholder
# - nettoie données et modèles personnalisés
# - restaure le jeu golden (demo-reset.php)
# - installe une tâche cron de reset périodique
#
# Usage :
#   sudo ./scripts/demo-init.sh --url https://demo.example.com
#   ./scripts/demo-init.sh --url https://demo.example.com --cron-hours 6
#
# Variables optionnelles : LOYER_ROOT, LOYER_USER, LOYER_GROUP, PHP_BIN
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

SOURCE_CONFIG="${ROOT}/config.demo.example.php"
TARGET_CONFIG="${ROOT}/config.php"
DEMO_RESET="${ROOT}/scripts/demo-reset.php"
CRON_MARKER="LoyerManager demo-reset"
PHP_BIN="${PHP_BIN:-$(command -v php || true)}"
LOYER_USER="${LOYER_USER:-www-data}"
LOYER_GROUP="${LOYER_GROUP:-www-data}"

PUBLIC_URL=""
CRON_HOURS=6
FORCE=0
SKIP_CRON=0
YES=0

usage() {
  cat <<'EOF'
Initiation instance démonstration Loyer Manager

  ./scripts/demo-init.sh --url URL_PUBLIQUE [options]

Options :
  --url URL           public_base_url dans config.php (recommandé)
  --cron-hours N      Intervalle reset cron (défaut : 6, toutes les N heures)
  --force             Écrase config.php même si prod (demo_mode absent)
  --skip-cron         Ne pas modifier la crontab
  --yes               Sans confirmation interactive
  -h, --help          Cette aide

Exemple :
  sudo LOYER_USER=www-data ./scripts/demo-init.sh \
    --url https://demo.loyermanager.iota21.fr --yes

Après initiation : ouvrir /demo.html ou /index.html (sans connexion).
EOF
}

log() { printf '%s\n' "$*"; }
die() { printf 'Erreur : %s\n' "$*" >&2; exit 1; }

confirm() {
  if [[ "${YES}" -eq 1 ]]; then
    return 0
  fi
  read -r -p "$1 [o/N] " reply
  [[ "${reply}" =~ ^[oOyY]$ ]]
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --url) PUBLIC_URL="${2:-}"; shift 2 ;;
    --cron-hours) CRON_HOURS="${2:-6}"; shift 2 ;;
    --force) FORCE=1; shift ;;
    --skip-cron) SKIP_CRON=1; shift ;;
    --yes) YES=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) die "Option inconnue : $1 (voir --help)" ;;
  esac
done

[[ -f "${SOURCE_CONFIG}" ]] || die "Fichier source introuvable : ${SOURCE_CONFIG}"
[[ -n "${PHP_BIN}" && -x "${PHP_BIN}" ]] || die "PHP CLI introuvable (export PHP_BIN=/chemin/php)"
[[ -f "${DEMO_RESET}" ]] || die "Script reset introuvable : ${DEMO_RESET}"

if [[ -f "${TARGET_CONFIG}" ]] && grep -q "'demo_mode'[[:space:]]*=>[[:space:]]*true" "${TARGET_CONFIG}" 2>/dev/null; then
  log "config.php existant avec demo_mode — réinitialisation de l'instance démo."
elif [[ -f "${TARGET_CONFIG}" ]]; then
  if [[ "${FORCE}" -ne 1 ]]; then
    die "config.php existe sans demo_mode (prod ?). Utilisez --force pour écraser."
  fi
  log "Attention : écrasement de config.php (--force)."
fi

if ! confirm "Configurer ${ROOT} en instance DÉMO (données effacées) ?"; then
  log "Annulé."
  exit 0
fi

STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -f "${TARGET_CONFIG}" ]]; then
  cp -a "${TARGET_CONFIG}" "${TARGET_CONFIG}.bak.${STAMP}"
  log "Sauvegarde : config.php.bak.${STAMP}"
fi

cp "${SOURCE_CONFIG}" "${TARGET_CONFIG}"
log "config.php créé depuis config.demo.example.php"

# Génère encryption_key et applique public_base_url
export TARGET_CONFIG PUBLIC_URL
"${PHP_BIN}" <<'PHPEOF'
<?php
$f = getenv('TARGET_CONFIG') ?: '';
if ($f === '' || !is_file($f)) {
    fwrite(STDERR, "config.php introuvable\n");
    exit(1);
}
$c = file_get_contents($f);
if (strpos($c, 'REMPLACER') !== false) {
    $key = base64_encode(random_bytes(32));
    $c = str_replace("'encryption_key' => 'REMPLACER'", "'encryption_key' => '" . $key . "'", $c);
}
$url = getenv('PUBLIC_URL') ?: '';
if ($url !== '') {
    $c = preg_replace(
        "/'public_base_url'\\s*=>\\s*'[^']*'/",
        "'public_base_url' => " . var_export($url, true),
        $c,
        1
    );
}
file_put_contents($f, $c);
PHPEOF

grep -q "'demo_mode'[[:space:]]*=>[[:space:]]*true" "${TARGET_CONFIG}" \
  || die "config.php copié sans demo_mode — vérifiez config.demo.example.php"

log "Nettoyage des données et artefacts…"
for dir in data templates/quittances templates/mails; do
  mkdir -p "${ROOT}/${dir}"
done

rm -f "${ROOT}/data/.demo-last-reset"
rm -f "${ROOT}/data/loyer.db"
rm -f "${ROOT}/data/loyer-data.json"
rm -f "${ROOT}/data/demo-reset.log"

# Modèles personnalisés (conserve complet, court, principal)
PROTECTED="complet court principal"
for sub in quittances mails; do
  dir="${ROOT}/templates/${sub}"
  [[ -d "${dir}" ]] || continue
  for f in "${dir}"/*.html; do
    [[ -f "${f}" ]] || continue
    id="$(basename "${f}" .html)"
    skip=0
    for p in ${PROTECTED}; do
      [[ "${id}" == "${p}" ]] && skip=1 && break
    done
    [[ "${skip}" -eq 1 ]] || rm -f "${f}" "${dir}/${id}-subject.txt"
  done
done

log "Restauration du jeu golden…"
"${PHP_BIN}" "${DEMO_RESET}"

# Droits écriture PHP
if [[ "$(id -u)" -eq 0 ]]; then
  chown -R "${LOYER_USER}:${LOYER_GROUP}" "${ROOT}/data" "${ROOT}/templates"
  chmod 775 "${ROOT}/data" "${ROOT}/templates" "${ROOT}/templates/quittances" "${ROOT}/templates/mails"
  chown "${LOYER_USER}:${LOYER_GROUP}" "${TARGET_CONFIG}"
  chmod 640 "${TARGET_CONFIG}"
  log "Permissions : ${LOYER_USER}:${LOYER_GROUP} sur data/ et templates/"
else
  log "Exécutez en root (sudo) pour chown www-data, ou vérifiez les droits sur data/."
fi

if [[ "${SKIP_CRON}" -eq 0 ]]; then
  if ! command -v crontab >/dev/null 2>&1; then
    log "crontab absent — installez le cron manuellement (voir docs/demo/README.md)."
  else
    if [[ "$(id -u)" -eq 0 ]]; then
      CRON_USER="${CRON_USER:-${LOYER_USER}}"
    else
      CRON_USER="${USER}"
    fi
    CRON_SCHEDULE="0 */${CRON_HOURS} * * *"
    CRON_LINE="${CRON_SCHEDULE} cd ${ROOT} && ${PHP_BIN} ${DEMO_RESET} >> ${ROOT}/data/demo-reset.log 2>&1 # ${CRON_MARKER}"
    EXISTING="$(crontab -u "${CRON_USER}" -l 2>/dev/null || true)"
    if printf '%s\n' "${EXISTING}" | grep -q "${CRON_MARKER}"; then
      FILTERED="$(printf '%s\n' "${EXISTING}" | grep -v "${CRON_MARKER}" || true)"
      printf '%s\n%s\n' "${FILTERED}" "${CRON_LINE}" | sed '/^$/d' | crontab -u "${CRON_USER}" -
      log "Cron mis à jour (${CRON_USER}, toutes les ${CRON_HOURS} h)."
    else
      { printf '%s\n' "${EXISTING}" | sed '/^$/d'; printf '%s\n' "${CRON_LINE}"; } | crontab -u "${CRON_USER}" -
      log "Cron installé (${CRON_USER}, toutes les ${CRON_HOURS} h)."
    fi
    log "  ${CRON_LINE}"
  fi
else
  log "Cron ignoré (--skip-cron)."
fi

log ""
log "Instance démo prête."
log "  URL : ${PUBLIC_URL:-<définir public_base_url dans config.php>}"
log "  Entrée : /demo.html ou /index.html"
log "  Reset manuel : php scripts/demo-reset.php"
log "  Journal cron : data/demo-reset.log"
