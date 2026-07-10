#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/ui/lib" "$ROOT/ui/fonts"

curl -fsSL "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js" \
  -o "$ROOT/ui/lib/three.min.js"
curl -fsSL "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/PointerLockControls.js" \
  -o "$ROOT/ui/lib/PointerLockControls.js"
curl -fsSL "https://github.com/googlefonts/spacemono/raw/main/fonts/ttf/SpaceMono-Regular.ttf" \
  -o "$ROOT/ui/fonts/SpaceMono-Regular.ttf"

# Patch sensitivity hook for settings slider
perl -0pi -e 's/_euler\.y -= movementX \* 0\.002;\s*_euler\.x -= movementY \* 0\.002;/const sens = ( typeof window !== '\''undefined'\'' \&\& window.LOOP10_LOOK_SENS ) || 1;\n\t\t\t\t_euler.y -= movementX * 0.002 * sens;\n\t\t\t\t_euler.x -= movementY * 0.002 * sens;/s' \
  "$ROOT/ui/lib/PointerLockControls.js" 2>/dev/null || true

echo "Offline assets ready in ui/lib and ui/fonts"
