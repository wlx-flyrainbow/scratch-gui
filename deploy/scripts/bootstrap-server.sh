#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: deploy/scripts/bootstrap-server.sh --yes

Initializes server directories and installs pm2 if missing. This script is
intentionally gated by --yes because it changes the server environment.
USAGE
}

if [[ "${1:-}" != "--yes" ]]; then
  usage
  exit 2
fi

APP_NAME="${APP_NAME:-zhimeng}"
APP_ROOT="${APP_ROOT:-/www/wwwroot/${APP_NAME}-app}"
PROD_SITE_ROOT="${PROD_SITE_ROOT:-/www/wwwroot/${APP_NAME}}"
TEST_SITE_ROOT="${TEST_SITE_ROOT:-/www/wwwroot/${APP_NAME}-test}"
DATA_ROOT="${DATA_ROOT:-/www/wwwroot/${APP_NAME}-data}"
ENV_ROOT="${ENV_ROOT:-/www/server/${APP_NAME}/env}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing required command: %s\n' "$1" >&2
    exit 1
  fi
}

log "Checking base runtime commands"
require_command git
require_command node
require_command npm

if ! command -v pm2 >/dev/null 2>&1; then
  log "pm2 not found, installing globally with npm"
  npm install -g pm2
fi

log "Creating application directories"
mkdir -p "$APP_ROOT"
mkdir -p "$PROD_SITE_ROOT/downloads" "$TEST_SITE_ROOT/downloads"
mkdir -p "$DATA_ROOT/prod/payment-proofs" "$DATA_ROOT/test/payment-proofs"
mkdir -p "$ENV_ROOT"

chmod 700 "$DATA_ROOT/prod/payment-proofs" "$DATA_ROOT/test/payment-proofs"
chmod 700 "$ENV_ROOT"

log "Bootstrap complete"
printf 'APP_ROOT=%s\n' "$APP_ROOT"
printf 'PROD_SITE_ROOT=%s\n' "$PROD_SITE_ROOT"
printf 'TEST_SITE_ROOT=%s\n' "$TEST_SITE_ROOT"
printf 'DATA_ROOT=%s\n' "$DATA_ROOT"
printf 'ENV_ROOT=%s\n' "$ENV_ROOT"
