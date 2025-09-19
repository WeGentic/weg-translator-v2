#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

OS="$(uname -s)"
ARCH="$(uname -m)"
case "$OS" in
  Darwin) PLATFORM="macos-$ARCH" ;;
  Linux) PLATFORM="linux-$ARCH" ;;
  *) PLATFORM="$OS-$ARCH" ;;
esac

CANDIDATES=(
  "$DIR/../Resources/resources/openxliff/$PLATFORM"
  "$DIR/../Resources/openxliff/$PLATFORM"
  "$DIR/../../Resources/resources/openxliff/$PLATFORM"
  "$DIR/../../Resources/openxliff/$PLATFORM"
  "$DIR/../../../Resources/resources/openxliff/$PLATFORM"
  "$DIR/../../../Resources/openxliff/$PLATFORM"
  "$DIR/../../../resources/openxliff/$PLATFORM"
  "$DIR/../../../../src-tauri/resources/openxliff/$PLATFORM"
)

for base in "${CANDIDATES[@]}"; do
  if [[ -x "$base/merge.sh" ]]; then
    exec "$base/merge.sh" "$@"
  fi
done

echo "[merge wrapper] Could not locate OpenXLIFF resources for $PLATFORM relative to $DIR" >&2
exit 1
