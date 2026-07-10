#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor/webview"

if [[ ! -f "$VENDOR/CMakeLists.txt" ]]; then
  mkdir -p "$ROOT/vendor"
  git clone --depth 1 https://github.com/webview/webview.git "$VENDOR"
fi

echo "Vendor ready at $VENDOR"
