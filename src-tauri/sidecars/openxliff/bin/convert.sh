#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

# Compute platform dir
OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM="macos-$ARCH" ;;
  Linux) PLATFORM="linux-$ARCH" ;;
  *) PLATFORM="$OS-$ARCH" ;;
esac

# Try common relative paths from sidecar to Resources
# Candidates for packaged app and dev tree
CANDIDATES=(
  "$DIR/../Resources/resources/openxliff/$PLATFORM"      # macOS .app: Tauri places under Resources/resources
  "$DIR/../Resources/openxliff/$PLATFORM"                # macOS .app: older or custom layout
  "$DIR/../../Resources/resources/openxliff/$PLATFORM"   # macOS .app with sidecars dir
  "$DIR/../../Resources/openxliff/$PLATFORM"
  "$DIR/../../../Resources/resources/openxliff/$PLATFORM"
  "$DIR/../../../Resources/openxliff/$PLATFORM"
  "$DIR/../../../resources/openxliff/$PLATFORM"          # dev: src-tauri/sidecars/... → src-tauri/resources
  "$DIR/../../../../src-tauri/resources/openxliff/$PLATFORM" # dev: nested
)

for base in "${CANDIDATES[@]}"; do
  if [[ -x "$base/convert.sh" ]]; then
    exec "$base/convert.sh" "$@"
  fi
done

echo "[convert wrapper] Could not locate OpenXLIFF resources for $PLATFORM relative to $DIR" >&2
exit 1
