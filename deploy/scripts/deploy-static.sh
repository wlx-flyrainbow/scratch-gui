#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: deploy/scripts/deploy-static.sh <test|prod>

Environment overrides:
  REPO_DIR       Repository path. Default: current directory
  PROD_SITE_ROOT Production static root. Default: /www/wwwroot/zhimeng
  TEST_SITE_ROOT Test static root. Default: /www/wwwroot/zhimeng-test
  BACKUP_ROOT    Backup directory. Default: /www/backup
USAGE
}

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  usage
  exit 2
fi

REPO_DIR="${REPO_DIR:-$(pwd)}"
PROD_SITE_ROOT="${PROD_SITE_ROOT:-/www/wwwroot/zhimeng}"
TEST_SITE_ROOT="${TEST_SITE_ROOT:-/www/wwwroot/zhimeng-test}"
BACKUP_ROOT="${BACKUP_ROOT:-/www/backup}"

if [[ "$ENVIRONMENT" == "prod" ]]; then
  SITE_ROOT="$PROD_SITE_ROOT"
else
  SITE_ROOT="$TEST_SITE_ROOT"
fi

log() {
  printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"
}

if [[ ! -d "$REPO_DIR/website" ]]; then
  printf 'Missing website directory under REPO_DIR: %s\n' "$REPO_DIR" >&2
  exit 1
fi

mkdir -p "$SITE_ROOT/downloads" "$BACKUP_ROOT"

if [[ -d "$SITE_ROOT" ]]; then
  BACKUP_FILE="$BACKUP_ROOT/zhimeng-${ENVIRONMENT}-site-$(date '+%Y%m%d%H%M%S').tar.gz"
  log "Backing up $SITE_ROOT to $BACKUP_FILE"
  tar -czf "$BACKUP_FILE" -C "$SITE_ROOT" .
fi

log "Syncing website/ to $SITE_ROOT"
rsync -a --delete \
  --exclude='.user.ini' \
  --exclude='downloads/' \
  --exclude='releases.local.json' \
  "$REPO_DIR/website/" "$SITE_ROOT/"

rm -f "$SITE_ROOT/releases.local.json"
mkdir -p "$SITE_ROOT/downloads"

log "Static deploy complete: $ENVIRONMENT -> $SITE_ROOT"
