#!/usr/bin/env bash
set -euo pipefail

# Verifies that all .sh scripts are executable and .cmd have CRLF line endings

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

STRICT=0
if [[ "${1:-}" == "--strict" ]]; then
  STRICT=1
fi

FAIL=0

check_exec() {
  local path="$1"
  if [[ ! -x "$path" ]]; then
    echo "[check-executables] Missing +x: $path"
    FAIL=1
  fi
}

check_crlf() {
  local path="$1"
  if command -v file >/dev/null; then
    if ! file "$path" | grep -q "CRLF"; then
      echo "[check-executables] Not CRLF (Windows): $path"
      if [[ $STRICT -eq 1 ]]; then FAIL=1; fi
    fi
  fi
}

echo "[check-executables] Checking sidecar scripts…"
for f in "$ROOT_DIR"/src-tauri/sidecars/openxliff/bin/*.sh; do
  [[ -e "$f" ]] || continue
  check_exec "$f"
done

for f in "$ROOT_DIR"/src-tauri/sidecars/openxliff/bin/*.cmd; do
  [[ -e "$f" ]] || continue
  check_crlf "$f"
done

if [[ $FAIL -eq 1 ]]; then
  echo "[check-executables] Issues found. Fix permissions/endings and re-run."
  exit 1
fi

echo "[check-executables] OK"
