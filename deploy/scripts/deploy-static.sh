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

log "Validating release manifest before static deploy"
REPO_DIR="$REPO_DIR" node <<'NODE'
const fs = require('fs');
const path = require('path');

const repoDir = process.env.REPO_DIR;
const packageJson = JSON.parse(fs.readFileSync(path.join(repoDir, 'package.json'), 'utf8'));
const releasesPath = path.join(repoDir, 'website/releases.json');
const releases = JSON.parse(fs.readFileSync(releasesPath, 'utf8'));
const failures = [];

const addFailure = message => failures.push(message);
const filenameFromUrl = raw => {
  try {
    const parsed = new URL(raw);
    return decodeURIComponent(parsed.pathname.split('/').pop() || '');
  } catch (err) {
    return '';
  }
};
const checkDownload = (id, item) => {
  const url = item && item.url;
  if (!url) {
    addFailure(`${id} is missing url`);
    return;
  }
  const filename = filenameFromUrl(url);
  if (/^zhimeng-/i.test(filename)) {
    addFailure(`${id} points to legacy zhimeng-* package filename: ${filename}`);
  }
  if (!url.includes(packageJson.version)) {
    addFailure(`${id} must include package version ${packageJson.version}: ${url}`);
  }
};

if (releases.version !== packageJson.version) {
  addFailure(`releases.version must be ${packageJson.version}, got ${releases.version || '(empty)'}`);
}
checkDownload('windows.nsis', releases.windows && releases.windows.nsis);
checkDownload('windows.portable', releases.windows && releases.windows.portable);
checkDownload('macos.appleSilicon', releases.macos && releases.macos.appleSilicon);
checkDownload('macos.intel', releases.macos && releases.macos.intel);

if (failures.length > 0) {
  console.error('Refusing to deploy stale website/releases.json:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}
NODE

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
