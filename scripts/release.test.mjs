import { afterEach, describe, expect, it, vi } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixtures = [];
afterEach(() => {
  fixtures.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  fixtures.length = 0;
  vi.resetModules();
  vi.doUnmock('node:child_process');
  vi.unstubAllEnvs();
});
function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'lcm-release-'));
  fixtures.push(dir);
  return dir;
}

it('requires a distribution identity and fails rather than silently packaging unsigned', () => {
  const { build } = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
  expect(build.forceCodeSigning).toBe(true);
  expect(build.mac.type).toBe('distribution');
});

describe('DMG notarization', () => {
  async function load() {
    const exec = vi.fn();
    vi.doMock('node:child_process', () => ({ execFileSync: exec, default: { execFileSync: exec } }));
    return { ...(await import('./notarize-dmg.mjs')), exec };
  }

  it('submits only the exact current artifact, ignoring stale DMGs beside it', async () => {
    const dir = fixture();
    const current = path.join(dir, 'current universal.dmg');
    writeFileSync(current, 'current');
    writeFileSync(path.join(dir, 'stale.dmg'), 'stale');
    const { notarizeDmg, exec } = await load();
    notarizeDmg(current, 'test-profile');
    expect(exec.mock.calls).toEqual([
      ['xcrun', ['notarytool', 'submit', current, '--keychain-profile', 'test-profile', '--wait'], { stdio: 'inherit' }],
      ['xcrun', ['stapler', 'staple', current], { stdio: 'inherit' }],
    ]);
  });

  it('fails on omitted, missing or non-file artifact paths before calling Apple', async () => {
    const dir = fixture();
    const { notarizeDmg, exec } = await load();
    for (const candidate of [undefined, path.join(dir, 'missing.dmg'), dir]) {
      expect(() => notarizeDmg(candidate)).toThrow();
    }
    expect(exec).not.toHaveBeenCalled();
  });
});

it.each([true, false])('requires a newly produced current artifact (builder produces it: %s)', (producesArtifact) => {
  const dir = fixture();
  mkdirSync(path.join(dir, 'scripts'));
  mkdirSync(path.join(dir, 'release'));
  mkdirSync(path.join(dir, 'bin'));
  copyFileSync(path.join(repo, 'scripts/dist-mac.sh'), path.join(dir, 'scripts/dist-mac.sh'));
  copyFileSync(path.join(repo, 'scripts/notarize-dmg.mjs'), path.join(dir, 'scripts/notarize-dmg.mjs'));
  const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8'));
  pkg.version = '9.8.7';
  pkg.build.productName = 'Test Chord Monitor';
  writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  const artifact = 'Test Chord Monitor-9.8.7-universal.dmg';
  writeFileSync(path.join(dir, 'release', artifact), 'stale current');
  writeFileSync(path.join(dir, 'release/older.dmg'), 'older');
  // Every packaging command is replaced: these tests cannot sign or submit an artifact.
  writeFileSync(path.join(dir, 'bin/npm'), '#!/bin/sh\nexit 0\n', { mode: 0o755 });
  writeFileSync(path.join(dir, 'bin/electron-builder'), `#!/bin/sh
printf '%s\\n' "$@" > builder-args
if [ -e 'release/${artifact}' ]; then exit 42; fi
${producesArtifact ? `printf current > 'release/${artifact}'` : 'exit 0'}
`, { mode: 0o755 });
  // Let the wrapper use Node for local metadata if needed; intercept the submission entrypoint.
  writeFileSync(path.join(dir, 'bin/node'), `#!/bin/sh
if [ "$1" = scripts/notarize-dmg.mjs ]; then
  printf '%s\\n' "$@" > notarize-args
fi
exec '${process.execPath}' "$@"
`, { mode: 0o755 });
  writeFileSync(path.join(dir, 'bin/xcrun'), '#!/bin/sh\ntouch submissions\n', { mode: 0o755 });
  const result = spawnSync('bash', ['scripts/dist-mac.sh', 'release'], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}`, SIGN_IDENTITY: 'test cert hash' },
  });
  expect(result.status === 0, result.stderr).toBe(producesArtifact);
  expect(existsSync(path.join(dir, 'submissions'))).toBe(producesArtifact);
  const builderArgs = readFileSync(path.join(dir, 'builder-args'), 'utf8').split('\n');
  expect(builderArgs).toContain('-c.mac.identity=test cert hash');
  expect(builderArgs).toContain(`-c.dmg.artifactName=${artifact}`);
  expect(readFileSync(path.join(dir, 'notarize-args'), 'utf8').trim().split('\n'))
    .toEqual(['scripts/notarize-dmg.mjs', `release/${artifact}`]);
  expect(existsSync(path.join(dir, 'release/older.dmg'))).toBe(true);
});

describe('notarization CLI', () => {
  function cliFixture() {
    const dir = fixture();
    mkdirSync(path.join(dir, 'release'));
    mkdirSync(path.join(dir, 'bin'));
    copyFileSync(path.join(repo, 'scripts/notarize-dmg.mjs'), path.join(dir, 'notarize-dmg.mjs'));
    writeFileSync(path.join(dir, 'bin/xcrun'), `#!/bin/sh
printf '%s\\n' "$*" >> submissions
`, { mode: 0o755 });
    return dir;
  }

  function run(dir, args) {
    return spawnSync(process.execPath, ['notarize-dmg.mjs', ...args], {
      cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${path.join(dir, 'bin')}:${process.env.PATH}` },
    });
  }

  it('does not submit an older DMG alongside the selected current release', () => {
    const dir = cliFixture();
    writeFileSync(path.join(dir, 'release/current.dmg'), 'current');
    writeFileSync(path.join(dir, 'release/older.dmg'), 'old');
    const result = run(dir, ['release/current.dmg']);
    expect(result.status, result.stderr).toBe(0);
    const submissions = readFileSync(path.join(dir, 'submissions'), 'utf8').trim().split('\n');
    expect(submissions).toHaveLength(2);
    expect(submissions[0]).toContain('notarytool submit release/current.dmg');
    expect(submissions[1]).toBe('stapler staple release/current.dmg');
  });

  it.each([[], ['release/missing.dmg']])('fails with no current artifact: %j', (...args) => {
    const dir = cliFixture();
    const result = run(dir, args);
    expect(result.status).not.toBe(0);
    expect(existsSync(path.join(dir, 'submissions'))).toBe(false);
  });
});
