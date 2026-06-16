#!/usr/bin/env bash
# macOS packaging wrapper. The signing identity (a cert SHA-1 hash) is read from the gitignored
# scripts/signing.local so it stays out of the committed repo. Without that file, electron-builder
# falls back to auto-discovering a Developer ID cert.
#
#   scripts/dist-mac.sh           quick local build (signed, not notarized)
#   scripts/dist-mac.sh release   universal, notarized + stapled (NOTARIZE=1)
set -eo pipefail

[ -f scripts/signing.local ] && . scripts/signing.local

IDENTITY=""
if [ -n "${SIGN_IDENTITY:-}" ]; then
  IDENTITY="-c.mac.identity=$SIGN_IDENTITY"
fi

npm run build

if [ "${1:-}" = "release" ]; then
  NOTARIZE=1 electron-builder --mac --universal $IDENTITY
  node scripts/notarize-dmg.mjs
else
  electron-builder --mac $IDENTITY
fi
