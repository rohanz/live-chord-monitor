// electron-builder afterSign hook: notarize + staple the signed .app.
//
// Reuses the account-level notarytool keychain profile (default `apple-notary`, override with
// NOTARY_PROFILE); no secrets live here - credentials are in the macOS keychain via
// `xcrun notarytool store-credentials`.
// Only runs when NOTARIZE=1 (so the quick local `dist:mac` build stays fast and offline).
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { notarize } = require('@electron/notarize');

exports.default = async function notarizeHook(context) {
  if (process.env.NOTARIZE !== '1') {
    console.log('[notarize] NOTARIZE!=1 - skipping (signed but not notarized).');
    return;
  }
  if (context.electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(context.appOutDir, `${appName}.app`);
  const keychainProfile = process.env.NOTARY_PROFILE || 'apple-notary';

  console.log(`[notarize] submitting "${appPath}" with profile "${keychainProfile}" (waits on Apple)...`);
  await notarize({ tool: 'notarytool', appPath, keychainProfile });

  console.log('[notarize] accepted - stapling the ticket to the app...');
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' });
  console.log('[notarize] done.');
};
