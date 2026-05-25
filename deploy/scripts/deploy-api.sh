#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: deploy/scripts/deploy-api.sh <test|prod>

Environment overrides:
  REPO_DIR       Repository path. Default: /www/wwwroot/zhimeng-app/scratch-gui
  GIT_REMOTE     Git remote. Default: origin
  GIT_REF        Branch or ref to deploy. Default: feat/electron
  ENV_ROOT       Env file directory. Default: /www/server/zhimeng/env
  SKIP_GIT_SYNC  Set to 1 to skip git fetch/reset.
  SKIP_NPM_CI    Set to 1 to skip npm ci.
USAGE
}

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  usage
  exit 2
fi

REPO_DIR="${REPO_DIR:-/www/wwwroot/zhimeng-app/scratch-gui}"
GIT_REMOTE="${GIT_REMOTE:-origin}"
GIT_REF="${GIT_REF:-feat/electron}"
ENV_ROOT="${ENV_ROOT:-/www/server/zhimeng/env}"
ENV_FILE="$ENV_ROOT/zhimeng-${ENVIRONMENT}.env"
PM2_NAME="zhimeng-api-${ENVIRONMENT}"

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

if [[ ! -d "$REPO_DIR/.git" ]]; then
  printf 'REPO_DIR is not a git checkout: %s\n' "$REPO_DIR" >&2
  exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
  printf 'Missing env file: %s\n' "$ENV_FILE" >&2
  exit 1
fi

cd "$REPO_DIR"

if [[ "${SKIP_GIT_SYNC:-0}" != "1" ]]; then
  log "Fetching $GIT_REMOTE and resetting to $GIT_REMOTE/$GIT_REF"
  git fetch "$GIT_REMOTE"
  git reset --hard "$GIT_REMOTE/$GIT_REF"
fi

if [[ "${SKIP_NPM_CI:-0}" != "1" ]]; then
  log "Installing production dependencies"
  npm ci --omit=dev --ignore-scripts --legacy-peer-deps --no-audit --no-fund
fi

log "Loading env: $ENV_FILE"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

log "Running database migration"
npm run db:migrate

log "Starting or restarting PM2 app: $PM2_NAME"
if pm2 describe "$PM2_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_NAME" --update-env
else
  pm2 start backend/server.js --name "$PM2_NAME" --update-env
fi
pm2 save

log "PM2 status"
pm2 status "$PM2_NAME"

log "API deploy complete: $ENVIRONMENT"
