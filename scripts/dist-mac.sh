#!/usr/bin/env bash
# macOS packaging wrapper. A cert SHA-1 may be pinned in gitignored scripts/signing.local;
# otherwise electron-builder discovers a Developer ID Application distribution identity.
# forceCodeSigning makes a missing identity fatal for both paths.
#
#   scripts/dist-mac.sh           quick local build (signed, not notarized)
#   scripts/dist-mac.sh release   universal, notarized + stapled (NOTARIZE=1)
set -eo pipefail

[ -f scripts/signing.local ] && . scripts/signing.local

IDENTITY=()
if [ -n "${SIGN_IDENTITY:-}" ]; then
  IDENTITY=("-c.mac.identity=$SIGN_IDENTITY")
fi

npm run build

if [ "${1:-}" = "release" ]; then
  DMG_NAME=$(node -p 'const p = require("./package.json"); `${p.build.productName}-${p.version}-universal.dmg`')
  DMG_PATH="release/$DMG_NAME"
  # The exact expected artifact must be new, even if the builder produces no DMG this time.
  rm -f -- "$DMG_PATH"
  NOTARIZE=1 electron-builder --mac --universal "${IDENTITY[@]}" "-c.dmg.artifactName=$DMG_NAME"
  node scripts/notarize-dmg.mjs "$DMG_PATH"
else
  NOTARIZE=0 electron-builder --mac "${IDENTITY[@]}"
fi
