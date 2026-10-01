#!/usr/bin/env bash
set -euo pipefail
ENVIRONMENT="${1:-}"
if [[ "$ENVIRONMENT" != "test" && "$ENVIRONMENT" != "prod" ]]; then
  printf 'Usage: PREBUILT_BUNDLE=/absolute/package.tar.gz %s <test|prod> [--check]\n' "$0" >&2
  exit 2
fi
if [[ -z "${PREBUILT_BUNDLE:-}" || ! -f "$PREBUILT_BUNDLE" ]]; then
  printf 'PREBUILT_BUNDLE must name a verified prebuilt package. See deploy/PREBUILT_API_RELEASES.md.\n' >&2
  exit 2
fi
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
shift
exec python3 "$SCRIPT_DIR/codevalley-release.py" zhimeng-api-"$ENVIRONMENT" --bundle "$PREBUILT_BUNDLE" "$@"
