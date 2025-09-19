#!/usr/bin/env bash
set -euo pipefail

# Sync vendored OpenXLIFF upstream dist into src-tauri/resources/openxliff/<platform>

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor/openxliff"

OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_NAME="$(uname -m)"
case "$OS_NAME" in
  darwin)
    PLATFORM="macos-${ARCH_NAME}"
    ;;
  linux)
    PLATFORM="linux-${ARCH_NAME}"
    ;;
  msys*|mingw*|cygwin*)
    PLATFORM="win-x64"
    ;;
  *)
    PLATFORM="${OS_NAME}-${ARCH_NAME}"
    ;;
esac

SRC_DIR="$VENDOR_DIR/dist-$PLATFORM"
DEST_DIR="$ROOT_DIR/src-tauri/resources/openxliff/$PLATFORM"

if [[ ! -d "$SRC_DIR" ]]; then
  echo "[sync-openxliff-resources] Error: $SRC_DIR not found. Run scripts/fetch-openxliff.sh first." >&2
  exit 1
fi

echo "[sync-openxliff-resources] Copying $SRC_DIR -> $DEST_DIR …"
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -a "$SRC_DIR/." "$DEST_DIR/"

echo "[sync-openxliff-resources] Done."

