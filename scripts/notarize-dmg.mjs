// Notarize + staple the built .dmg(s) so the disk image itself passes Gatekeeper on download
// (electron-builder's afterSign hook already notarized+stapled the .app inside, but the .dmg is
// produced afterward and needs its own ticket). Reuses the account-level `bqst-notary` profile.
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import path from 'node:path';

const RELEASE = 'release';
const profile = process.env.NOTARY_PROFILE || 'apple-notary';
const dmgs = readdirSync(RELEASE)
  .filter((f) => f.endsWith('.dmg'))
  .map((f) => path.join(RELEASE, f));

if (dmgs.length === 0) {
  console.log('[notarize-dmg] no .dmg found, nothing to do.');
  process.exit(0);
}

for (const dmg of dmgs) {
  console.log(`[notarize-dmg] submitting "${dmg}" via profile "${profile}" (waits on Apple)...`);
  execFileSync('xcrun', ['notarytool', 'submit', dmg, '--keychain-profile', profile, '--wait'], { stdio: 'inherit' });
  console.log(`[notarize-dmg] stapling "${dmg}"...`);
  execFileSync('xcrun', ['stapler', 'staple', dmg], { stdio: 'inherit' });
}
console.log('[notarize-dmg] done.');
