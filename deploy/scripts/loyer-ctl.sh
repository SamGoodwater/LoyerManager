#!/usr/bin/env bash
# Contrôle du service — fonctionne avec systemd ou en mode manuel (WSL).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "${DEPLOY_DIR}/.." && pwd)"
PID_FILE="${ROOT}/deploy/.php-server.pid"
LOG_FILE="${ROOT}/deploy/.php-server.log"
ENV_FILE="/etc/loyer-manager/env"
LOCAL_ENV="${ROOT}/deploy/.env.local"

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck source=/dev/null
  source "${ENV_FILE}"
elif [[ -f "${LOCAL_ENV}" ]]; then
  # shellcheck source=/dev/null
  source "${LOCAL_ENV}"
fi

LOYER_ROOT="${LOYER_ROOT:-${ROOT}}"
export LOYER_ROOT LOYER_HOST="${LOYER_HOST:-0.0.0.0}" LOYER_PORT="${LOYER_PORT:-8080}"

cmd="${1:-status}"

_use_systemd() {
  systemctl is-system-running &>/dev/null && systemctl list-unit-files loyer-manager.service &>/dev/null
}

case "${cmd}" in
  start)
    if _use_systemd; then
      sudo systemctl start loyer-manager
      echo "Démarré via systemd"
    else
      if [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
        echo "Déjà en cours (PID $(cat "${PID_FILE}"))"
        exit 0
      fi
      if [[ "${EUID}" -eq 0 ]] && id www-data &>/dev/null; then
        RUN_USER="${LOYER_USER:-www-data}"
        nohup runuser -u "${RUN_USER}" -- env LOYER_ROOT="${LOYER_ROOT}" LOYER_HOST="${LOYER_HOST}" LOYER_PORT="${LOYER_PORT}" \
          "${DEPLOY_DIR}/scripts/run-php-server.sh" >> "${LOG_FILE}" 2>&1 &
      else
        nohup env LOYER_ROOT="${LOYER_ROOT}" LOYER_HOST="${LOYER_HOST}" LOYER_PORT="${LOYER_PORT}" \
          "${DEPLOY_DIR}/scripts/run-php-server.sh" >> "${LOG_FILE}" 2>&1 &
      fi
      echo $! > "${PID_FILE}"
      sleep 0.5
      echo "Démarré en arrière-plan (PID $(cat "${PID_FILE}")) — log : ${LOG_FILE}"
    fi
    ;;
  stop)
    if _use_systemd; then
      sudo systemctl stop loyer-manager
      echo "Arrêté (systemd)"
    elif [[ -f "${PID_FILE}" ]]; then
      kill "$(cat "${PID_FILE}")" 2>/dev/null && rm -f "${PID_FILE}"
      echo "Arrêté"
    else
      echo "Service non actif"
    fi
    ;;
  restart)
    "$0" stop
    sleep 1
    "$0" start
    ;;
  status)
    if _use_systemd; then
      systemctl status loyer-manager --no-pager || true
    elif [[ -f "${PID_FILE}" ]] && kill -0 "$(cat "${PID_FILE}")" 2>/dev/null; then
      echo "Actif — PID $(cat "${PID_FILE}") — http://localhost:${LOYER_PORT}/"
    else
      echo "Inactif"
    fi
    ;;
  health)
    LOYER_HOST=127.0.0.1 "${DEPLOY_DIR}/scripts/healthcheck.sh"
    ;;
  *)
    echo "Usage: $0 {start|stop|restart|status|health}" >&2
    exit 1
    ;;
esac
