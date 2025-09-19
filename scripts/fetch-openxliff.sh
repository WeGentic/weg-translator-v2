#!/usr/bin/env bash
set -euo pipefail

# Fetch/build OpenXLIFF assets into vendor/openxliff
# Usage: scripts/fetch-openxliff.sh [--version vX.Y.Z]

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT_DIR/vendor/openxliff"
VERSION_ARG="${1:-}"
OPENXLIFF_VERSION=""

if [[ "$VERSION_ARG" == "--version" && -n "${2:-}" ]]; then
  OPENXLIFF_VERSION="$2"
fi

mkdir -p "$VENDOR_DIR"

echo "[fetch-openxliff] Target vendor dir: $VENDOR_DIR"

echo "[fetch-openxliff] Resolving version…"
if [[ -z "$OPENXLIFF_VERSION" ]]; then
  # Try to read pinned VERSION file
  if [[ -f "$VENDOR_DIR/VERSION" ]]; then
    OPENXLIFF_VERSION="$(cat "$VENDOR_DIR/VERSION" | tr -d '\n' | tr -d '\r')"
  fi
fi

if [[ -z "$OPENXLIFF_VERSION" ]]; then
  echo "[fetch-openxliff] No version specified; will attempt to build latest from source (requires JDK 21 + Gradle)."
else
  echo "$OPENXLIFF_VERSION" > "$VENDOR_DIR/VERSION"
  echo "[fetch-openxliff] Using version: $OPENXLIFF_VERSION"
fi

TMP_WORK="$(mktemp -d 2>/dev/null || mktemp -d -t openxliff)"
cleanup() { rm -rf "$TMP_WORK"; }
trap cleanup EXIT

echo "[fetch-openxliff] Cloning repository…"
git clone --depth 1 ${OPENXLIFF_VERSION:+--branch "$OPENXLIFF_VERSION"} https://github.com/rmraya/OpenXLIFF.git "$TMP_WORK/OpenXLIFF"

pushd "$TMP_WORK/OpenXLIFF" >/dev/null
echo "[fetch-openxliff] Checking Java/Gradle…"
if ! command -v java >/dev/null; then
  echo "[fetch-openxliff] Error: Java (JDK 21) is required to build from source." >&2
  exit 1
fi

JAVA_VERSION_LINE="$(java -version 2>&1 | head -n1)"
if ! echo "$JAVA_VERSION_LINE" | grep -Eq '"21\.| 21\.'; then
  echo "[fetch-openxliff] Warning: Detected $JAVA_VERSION_LINE — JDK 21+ recommended. Build may fail." >&2
fi

if ! command -v gradle >/dev/null; then
  echo "[fetch-openxliff] Error: Gradle is required (8.14.3+)." >&2
  exit 1
fi

echo "[fetch-openxliff] Building distribution with Gradle… (this may take a while)"
# Build the upstream distribution (creates ./dist with scripts and a jlink image)
gradle -q dist

if [[ ! -d "dist" ]]; then
  echo "[fetch-openxliff] Error: dist folder was not produced." >&2
  exit 1
fi

# Detect platform to store per-OS distribution snapshot
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

DEST_DIR="$VENDOR_DIR/dist-$PLATFORM"
echo "[fetch-openxliff] Copying upstream dist to $DEST_DIR …"
rm -rf "$DEST_DIR"
mkdir -p "$DEST_DIR"
cp -a dist/. "$DEST_DIR/"

echo "[fetch-openxliff] Done. Upstream dist mirrored to: $DEST_DIR"
echo "[fetch-openxliff] Next: scripts/sync-openxliff-resources.sh to place dist under src-tauri/resources/openxliff/$PLATFORM"

popd >/dev/null

echo "[fetch-openxliff] Done. Binaries in vendor/openxliff/bin and JARs in vendor/openxliff/lib"
echo "[fetch-openxliff] Next: scripts/sync-openxliff-sidecars.sh to mirror into src-tauri/sidecars."
