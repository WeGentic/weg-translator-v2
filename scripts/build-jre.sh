#!/usr/bin/env bash
set -euo pipefail

# Build a minimal JRE image for the current platform using jdeps + jlink
# Outputs to src-tauri/resources/jre/<platform>/

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
JARS_GLOB="$ROOT_DIR/vendor/openxliff/lib/*.jar"

if ! compgen -G "$JARS_GLOB" > /dev/null; then
  echo "[build-jre] Error: No JARs found at vendor/openxliff/lib. Fetch/build OpenXLIFF first." >&2
  exit 1
fi

if ! command -v jdeps >/dev/null || ! command -v jlink >/dev/null; then
  echo "[build-jre] Error: jdeps/jlink (JDK 21) are required." >&2
  exit 1
fi

OS_NAME="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH_NAME="$(uname -m)"

case "$OS_NAME" in
  darwin)
    PLATFORM_DIR="macos-${ARCH_NAME}"
    ;;
  linux)
    PLATFORM_DIR="linux-${ARCH_NAME}"
    ;;
  msys*|mingw*|cygwin*)
    PLATFORM_DIR="win-x64"
    ;;
  *)
    echo "[build-jre] Unsupported OS: $OS_NAME" >&2
    exit 1
    ;;
esac

OUT_DIR="$ROOT_DIR/src-tauri/resources/jre/$PLATFORM_DIR"
mkdir -p "$OUT_DIR"

echo "[build-jre] Computing required modules with jdeps…"
MODULES=$(jdeps --multi-release 21 --ignore-missing-deps --print-module-deps $JARS_GLOB)
echo "$MODULES" > "$ROOT_DIR/vendor/jre/modules.txt"
echo "[build-jre] Modules: $MODULES"

echo "[build-jre] Running jlink to create image at $OUT_DIR…"
jlink \
  --module-path "$JAVA_HOME/jmods" \
  --add-modules "$MODULES" \
  --output "$OUT_DIR" \
  --strip-debug \
  --no-man-pages \
  --no-header-files \
  --compress=2

echo "[build-jre] Done."

