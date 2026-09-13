#!/usr/bin/env bash
# Build the Asche zu Asche browser runtime from source.
#
# Reproduces runtime/engine/ from a pinned wine-assembly commit plus the
# patches in runtime/patches/. Requires git, node/npm and network access to
# github.com on the first run. Nothing proprietary is downloaded: wine-assembly
# is MIT and ships no Windows OS image.
#
# Usage:
#   tools/fetch-runtime.sh [--force]
#
#   runtime/engine.pin            wine-assembly commit to check out
#   runtime/patches/*.patch       applied in filename order with `git apply`
#   runtime/app/asche.entry.json  registry entry installed into lib/apps.js
#   runtime/engine/               output: static site with the Asche app entry

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUNTIME="$REPO_ROOT/runtime"
ENGINE="$RUNTIME/engine"
SRC="$RUNTIME/.engine-src"
PIN_FILE="$RUNTIME/engine.pin"
UPSTREAM="https://github.com/vgrichina/wine-assembly.git"

FORCE=0
for arg in "$@"; do
  case "$arg" in
    --force) FORCE=1 ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

command -v git >/dev/null || { echo "git is required" >&2; exit 1; }
command -v node >/dev/null || { echo "node is required" >&2; exit 1; }
command -v npm >/dev/null || { echo "npm is required" >&2; exit 1; }
[ -f "$PIN_FILE" ] || { echo "missing $PIN_FILE" >&2; exit 1; }
PIN="$(tr -d '[:space:]' < "$PIN_FILE")"

if [ -d "$ENGINE" ] && [ "$FORCE" -ne 1 ]; then
  echo "runtime/engine already exists; pass --force to rebuild" >&2
  exit 0
fi

rm -rf "$SRC" "$ENGINE"
mkdir -p "$SRC" "$ENGINE"

echo "== fetching wine-assembly @ $PIN"
git clone --filter=blob:none "$UPSTREAM" "$SRC"
git -C "$SRC" checkout --detach "$PIN"

if compgen -G "$RUNTIME/patches/*.patch" > /dev/null; then
  for patch in "$RUNTIME"/patches/*.patch; do
    echo "== applying $(basename "$patch")"
    git -C "$SRC" apply --whitespace=nowarn "$patch"
  done
fi

echo "== npm install (production deps only)"
( cd "$SRC" && npm install --omit=dev --no-audit --no-fund )

echo "== compiling wasm"
( cd "$SRC" && node tools/build-compile-wat.js )

echo "== assembling runtime/engine"
# Only the files the browser shell loads at runtime. Docs, screenshots, tests,
# source and the debug build stay out of the shipped tree.
for item in index.html host.js sw-coi.js manifest.webmanifest lib build fonts icons apps; do
  if [ -e "$SRC/$item" ]; then
    cp -R "$SRC/$item" "$ENGINE/"
  fi
done
# The name-section build is a debugging artifact and must not ship or be
# hash-compared; the engine only ever loads the canonical and compat modules.
rm -f "$ENGINE/build/wine-assembly.named.wasm"

# index.html loads build-info.js and falls back to the string "dev" when it is
# missing. Write the pin so the browser's versioned URLs are stable and the
# 404 disappears.
printf 'window.WINE_BUILD = %s;\n' "\"$(echo "$PIN" | cut -c1-12)\"" > "$ENGINE/build-info.js"

echo "== installing the Asche app entry"
node "$REPO_ROOT/tools/install-app-entry.mjs" --engine="$ENGINE" --entry="$RUNTIME/app/asche.entry.json"

echo "== done: $ENGINE"
du -sh "$ENGINE"
