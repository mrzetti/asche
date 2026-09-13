#!/usr/bin/env bash
# Verify the shipped runtime boots the original game in a real browser.
#
# Starts a temporary static server for the repo root and drives the engine with
# the cached Chromium via tools/browser-check.mjs. Extra arguments are passed
# through (e.g. --click=320,240, --wait=8000, --out=/tmp/shot.png).
#
# Usage:
#   tools/verify-runtime.sh [--click=320,240] [--out=/tmp/asche.png]

set -euo pipefail
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

[ -f "$REPO_ROOT/runtime/engine/index.html" ] || {
  echo "runtime/engine is missing; run tools/fetch-runtime.sh --force first" >&2
  exit 1
}

exec node "$REPO_ROOT/tools/browser-check.mjs" \
  --root="$REPO_ROOT" \
  --page=runtime/engine/index.html \
  --entry="$REPO_ROOT/runtime/app/asche.entry.json" \
  --app=asche \
  --modules=RAMM16 \
  "$@"
