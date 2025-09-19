#!/usr/bin/env bash
set -euo pipefail

# Sync vendor/openxliff assets to src-tauri/sidecars for development/build

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_BIN="$ROOT_DIR/vendor/openxliff/bin"
VENDOR_LIB="$ROOT_DIR/vendor/openxliff/lib"
DEST_BIN="$ROOT_DIR/src-tauri/sidecars/openxliff/bin"
DEST_LIB="$ROOT_DIR/src-tauri/sidecars/openxliff/lib"

if [[ ! -d "$VENDOR_BIN" || ! -d "$VENDOR_LIB" ]]; then
  echo "[sync-openxliff] Error: vendor/openxliff/bin or lib missing. Run scripts/fetch-openxliff.sh first." >&2
  exit 1
fi

mkdir -p "$DEST_BIN" "$DEST_LIB"

echo "[sync-openxliff] Copying scripts (.sh/.cmd)…"
cp -f "$VENDOR_BIN"/*.sh "$DEST_BIN"/
cp -f "$VENDOR_BIN"/*.cmd "$DEST_BIN"/

echo "[sync-openxliff] Copying JARs…"
cp -f "$VENDOR_LIB"/*.jar "$DEST_LIB"/

echo "[sync-openxliff] Normalizing permissions…"
chmod +x "$DEST_BIN"/*.sh || true

echo "[sync-openxliff] Done."

