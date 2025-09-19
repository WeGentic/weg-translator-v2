#!/usr/bin/env bash
set -euo pipefail

# Replace symlinks under src-tauri/resources/openxliff with regular files.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BASE="$ROOT_DIR/src-tauri/resources/openxliff"

if [[ ! -d "$BASE" ]]; then
  echo "[normalize-openxliff] No resources at ${BASE}" >&2
  exit 0
fi

echo "[normalize-openxliff] Replacing symlinks with plain files under ${BASE}…"
while IFS= read -r -d '' link; do
  target="$(readlink "$link")"
  if [[ -z "$target" ]]; then
    continue
  fi
  src="$(cd "$(dirname "$link")" && cd "$(dirname "$target")" 2>/dev/null && pwd)/$(basename "$target")"
  if [[ -f "$src" ]]; then
    rm -f "$link"
    cp -a "$src" "$link"
    echo "[normalize-openxliff] Replaced symlink: $link"
  else
    echo "[normalize-openxliff] Warning: target not found for $link -> $target"
  fi
done < <(find "${BASE}" -type l -print0)

echo "[normalize-openxliff] Done."
