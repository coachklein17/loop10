#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

chmod +x scripts/setup-vendor.sh scripts/download-deps.sh

./scripts/setup-vendor.sh
./scripts/download-deps.sh

BUILD_DIR="$ROOT/desktop/build"
mkdir -p "$BUILD_DIR"
cd "$BUILD_DIR"

cmake .. -DCMAKE_BUILD_TYPE=Release
cmake --build . --config Release

APP_PATH="$(find "$BUILD_DIR" -maxdepth 1 -name 'loop10.app' -print -quit)"
if [[ -n "$APP_PATH" ]]; then
  echo ""
  echo "Built: $APP_PATH"
  echo "Run:   open \"$APP_PATH\""
else
  echo ""
  echo "Built binary in $BUILD_DIR"
fi
