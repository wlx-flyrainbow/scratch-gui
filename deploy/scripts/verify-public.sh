#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat >&2 <<'USAGE'
Usage: deploy/scripts/verify-public.sh <test|prod>

Environment overrides:
  REPO_DIR                         Repository path. Default: current directory
  ZHIMENG_VERIFY_REQUIRE_HEALTH    Set to 1 to fail on /health problems.
USAGE
}

ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  usage
  exit 2
fi

REPO_DIR="${REPO_DIR:-$(pwd)}"

if [[ "$ENVIRONMENT" == "prod" ]]; then
  export ZHIMENG_VERIFY_PUBLIC_BASE_URL="${ZHIMENG_VERIFY_PUBLIC_BASE_URL:-https://zhimeng.codevalley.cn}"
  export ZHIMENG_VERIFY_REQUIRE_HEALTH="${ZHIMENG_VERIFY_REQUIRE_HEALTH:-1}"
else
  export ZHIMENG_VERIFY_PUBLIC_BASE_URL="${ZHIMENG_VERIFY_PUBLIC_BASE_URL:-https://zhimeng-test.codevalley.cn}"
fi

cd "$REPO_DIR"
npm run release:verify-public
