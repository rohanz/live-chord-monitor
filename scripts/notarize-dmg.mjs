// Notarize + staple exactly the DMG produced by this release. The app is already notarized by
// afterSign; the signed disk image is produced afterward and needs its own ticket.
import { execFileSync } from 'node:child_process';
import { statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function notarizeDmg(dmg, profile = process.env.NOTARY_PROFILE || 'apple-notary') {
  if (!dmg || path.extname(dmg).toLowerCase() !== '.dmg' || !statSync(dmg).isFile()) {
    throw new Error('[notarize-dmg] expected the current release .dmg file path.');
  }
  console.log(`[notarize-dmg] submitting "${dmg}" via profile "${profile}" (waits on Apple)...`);
  execFileSync('xcrun', ['notarytool', 'submit', dmg, '--keychain-profile', profile, '--wait'], { stdio: 'inherit' });
  console.log(`[notarize-dmg] stapling "${dmg}"...`);
  execFileSync('xcrun', ['stapler', 'staple', dmg], { stdio: 'inherit' });
  console.log('[notarize-dmg] done.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  notarizeDmg(process.argv[2]);
}
