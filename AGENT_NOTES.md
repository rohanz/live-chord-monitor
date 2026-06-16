# Agent Notes

This file is agent-facing context for future work on the live chord monitor app. Keep it updated when product decisions, implementation constraints, or architectural choices change.

## Current Decision Summary

- Build an Electron app from day one.
- Use React, TypeScript, Vite, Web MIDI, Web Audio, and VexFlow unless a later codebase decision changes this.
- MVP is a focused personal macOS live chord monitor inspired by Chordio, not a full Chordio clone.
- Chordio reference site: https://chordio.co.uk/
- Important Chordio-like behavior: real-time MIDI chord recognition, chord names on grand staff, keyboard/chord/staff views.

## Implementation Status

- Electron + React + TypeScript + Vite scaffold exists in this folder.
- Main Electron entry is `electron/main.ts`; renderer entry is `src/main.tsx`.
- The app currently implements:
  - all-device Web MIDI input
  - computer keyboard input using `A W S E D F T G Y H U J K O L`
  - `Z`/`X` computer-keyboard octave shifting
  - held-note accumulation with source-aware note release
  - default `C3-C6` visible keyboard range
  - octave left/right buttons and octave-stepped range slider
  - compact full-88-key range overview integrated into the stepped slider, with octave arrows and current low/high note labels beside it
  - pressed-key highlighting
  - optional labels for pressed keys
  - Web Audio simple piano feedback
  - volume and mute controls
  - chord-name style setting
  - inversion display setting
  - key-based sharp/flat spelling setting; default key is `C`, which prefers sharps
  - best chord plus small alternate interpretations
  - VexFlow grand staff for currently held notes
  - compact centered staff rendering with fixed chord x-position to avoid accidental-driven layout jumps
- Pressed keys use the same red active color for black and white keys.
- Main key styling intentionally avoids glossy gradients; use flat key surfaces with subtle separators/depth.
- The main chord readout is centered and empty when no note/chord is active.
- Chord/note display lingers after all active notes are released. Default is 500ms. Settings options are off, 250ms, 500ms, 750ms, and 1000ms. It stays solid during the hold and fades only during the final 100ms.
- The grand staff itself should always remain visible when notation is enabled; only chord text and rendered note glyphs fade/clear.
- StaffNotation uses `ResizeObserver` and redraws VexFlow when its container changes size. Preserve this; otherwise drag-resizing can leave stale SVG geometry that clips/obscures the staff.
- Display logic uses a short release-settle window (`RELEASE_SETTLE_MS`, currently 60ms) before accepting release-only reductions in the displayed note set. This prevents a full chord release from briefly becoming a partial chord because one key was released milliseconds later than another. Audio and key lighting should remain immediate. This settle/linger/fade state machine now lives in the `useDisplayNotes(activeNotes, lingerMs)` hook (`src/hooks/useDisplayNotes.ts`) and is unit-tested independently of `App`.
- The chord readout area reserves fixed vertical space so the staff does not shift when chord text or alternatives appear/disappear.
- The chord-name `h1` sits inside `.readout-area { overflow: hidden }`, so its box top must stay BELOW that clip edge or tall glyphs get cut off. This is font-dependent: fonts like Inter fill the em box (caps near the box top) and clip where the system fallback would not. The font-size/`vh` and `.readout-area` row split are tuned so the `h1` box top clears the clip edge by ~18-60px at every supported window size (verified by measuring `h1.getBoundingClientRect().top - readoutArea...top` across sizes). If you grow the chord font, re-check that margin.
- Do not show "No alternate interpretations"; leave the alternatives row empty unless there are actual alternatives.
- Settings are in a separate drawer; sound controls remain directly visible. The settings and help drawers are extracted presentational components (`src/components/SettingsDrawer.tsx`, `src/components/HelpDrawer.tsx`); `App` owns the state and passes value/handler props.
- User settings (volume, mute, pressed-key names, notation on/off, chord style, inversion mode, spelling, linger, computer-keyboard-notes) persist across restarts via `usePersistentState` (localStorage, key prefix `lcm:`). Visible-range/computer-octave view state is intentionally not persisted. Storage failures fall back silently to defaults.
- The "Computer keyboard notes" setting gates only the `A-L` note mapping (`useComputerKeyboard` enabled flag). The `Z`/`X` octave/range shortcuts are intentionally NOT gated by it (they are range controls with on-screen equivalents). Computer-keyboard note input is also focus-dependent (window `keydown`), unlike MIDI which fires regardless of focus while the app runs.
- The spelling control is labeled "Spelling" (not "Key") and groups options into `Sharps`/`Flats` optgroups. Spelling is intentionally a binary sharp-vs-flat choice (PRD: "C prefers sharps"); the grouping makes that behavior honest rather than implying full diatonic key-signature spelling. `SHARP_KEYS`/`FLAT_KEYS` in `notes.ts` are the single source of truth.
- Keyboard shortcut text lives in a separate Help drawer, not in the main bottom control strip.
- Header layout: keep the app title and MIDI input status on the top left; keep Sound, Help, and Settings controls on the top right. Do not show a separate computer-keyboard octave/status pill in the header.
- Build command `npm run build` passes.
- Packaging output goes to `release/` (gitignored), NOT `dist/`. `dist/` is the Vite renderer build only. This split is load-bearing: `build.files` globs `dist/**` into the asar, so if electron-builder also wrote there it would sweep its own output (incl. universal temp dirs) into the app and break the universal merge. `directories.output: "release"` keeps them separate.
- Two build commands:
  - `npm run dist:mac` - quick local build: signed (hardened runtime + secure timestamp, identity pinned by hash), NOT notarized, current arch. The notarize hooks no-op (NOTARIZE!=1).
  - `npm run dist:mac:release` - distribution build: universal (`x86_64 arm64`), signed, notarized + stapled. Sets `NOTARIZE=1`, builds universal, then `scripts/notarize-dmg.mjs` notarizes+staples the dmg.
- Signing: Developer ID Application, `hardenedRuntime: true` + `build/entitlements.mac.plist` (JIT allowances Electron needs); electron-builder signs inside-out automatically. The signing identity must be pinned by SHA-1 hash (two duplicate Developer ID certs exist, so the name is ambiguous). The hash is kept OUT of the committed repo: it lives in the gitignored `scripts/signing.local` (`SIGN_IDENTITY=...`), which `scripts/dist-mac.sh` passes to electron-builder via `-c.mac.identity`. Without that file, signing falls back to auto-discovery.
- Notarization: `afterSign` hook `scripts/notarize.cjs` notarizes+staples the `.app` via `@electron/notarize` using the keychain profile `apple-notary` (App Store Connect API key, account-level; override with `NOTARY_PROFILE`). `scripts/notarize-dmg.mjs` does the same for the `.dmg`. No secrets in the repo - credentials live in the keychain.
- Machine-specific signing details (cert hashes, team ID, `.p8` location) are kept OUT of this repo - the build identity is in the gitignored `scripts/signing.local`, and the full account-level guide lives outside the repo (its path is in `scripts/signing.local`'s comment). So this repo is safe to make public.
- Verified end-to-end: app `spctl -a -t exec` -> `accepted, source=Notarized Developer ID`; `stapler validate` passes on both app and dmg; `lipo -info` shows `x86_64 arm64`. (A `.dmg` is notarized+stapled but not code-signed, so verify it with `stapler validate`, not `spctl`.)
- Browser visual QA was attempted with the in-app browser, but the browser backend was unavailable in this session. Chrome automation fallback also failed to connect, even though Chrome was running and extension/native-host checks passed. Vite serving was verified with `curl`.
- `npm audit --omit=dev` reports 0 production vulnerabilities.
- Test suite uses Vitest + React Testing Library. `npm test` currently covers music logic (including dim7 spelling, the inversion-ordinal helper, and no-redundant-add13), UI behavior, MIDI handling, mouse/pointer note input, release-settle/linger (`useDisplayNotes`), settings persistence (`usePersistentState`), Web Audio voice start/stop/mute (`usePianoAudio`, mocked AudioContext), computer-keyboard mapping and unmount release (`useComputerKeyboard`), staff-centering math, and responsive CSS contracts. 51 tests across 10 files at last run.
- Electron minimum window size is intentionally `820x680` as a practical small-tablet-style floor. Below that, the app should not try to preserve every major region.
- Electron hardening (`electron/main.ts`): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The permission handler grants only `midi` (sysex is not requested). Web MIDI works without `experimentalFeatures`, so that flag was removed.
- Web MIDI permission: Chromium/Electron route `navigator.requestMIDIAccess()` through the `midiSysex` permission name EVEN when the renderer requests `{ sysex: false }` (confirmed by logging `setPermissionRequestHandler`). The permission handlers must grant BOTH `midi` and `midiSysex`, or requestMIDIAccess rejects with a `SecurityError` shown as "MIDI denied". Granting `midiSysex` does not actually expose SysEx because the renderer still requests `sysex: false`. Both the request handler and check handler grant these. The `app://` scheme is `secure: true` so the renderer is a secure context (also required by Web MIDI). Do NOT "tighten" this to `midi`-only; that breaks all MIDI.
- The preload is authored as `electron/preload.cts` so it compiles to CommonJS `dist-electron/preload.cjs` (referenced from `main.ts`). A sandboxed preload (`sandbox: true`) cannot be an ES module, and the root `package.json` `"type": "module"` would otherwise make a compiled `preload.js` ESM (fails with "Cannot use import statement outside a module"). `main.ts` stays ESM (it uses `import.meta.url`); only the preload must be CJS.
- Production loads the renderer from a custom `app://bundle` scheme (registered privileged + `standard`/`secure`, served by `protocol.handle` from `dist/`), NOT `file://`. This is load-bearing: Vite emits absolute `/assets/...` paths and CSP `'self'` only work against a real origin. `file://` resolves `/assets/...` to the filesystem root (blank screen) and gives the document an opaque origin that `'self'` can never match (would block the bundle). Dev still uses `http://localhost:5173`.
- The CSP is sent as a header from the `app://` protocol response. `font-src` MUST include `data:` because VexFlow embeds its music-notation fonts as `data:font/woff2` URIs; without it the staff glyphs are blocked. `style-src` needs `'unsafe-inline'` for VexFlow/SVG inline style attributes.
- The renderer was verified under a real origin with this exact CSP via a headless browser (Vite build served over http) before packaging; still smoke-test the packaged `.app` with a MIDI device, since the test suite mocks Web MIDI/Audio and does not exercise Electron or the `app://` protocol.

## User Decisions Captured

- Initial target: personal MVP, but later installation for others should remain feasible.
- User has an Apple Developer license.
- Platform: Electron/macOS app from day one.
- Input: both connected MIDI keyboard and computer keyboard.
- MIDI input should listen to all devices automatically.
- Computer keyboard mapping should be piano-like: `A W S E D F T G Y H U J K O L`, where `O` is C# and `L` is D above the `K` C.
- `Z` shifts computer-keyboard octave down; `X` shifts it up.
- The computer-keyboard octave should remain the middle octave of the selected 3-octave visible range. Manual visible-range changes should update `computerKeyBase`.
- Held notes should accumulate into the current chord until released.
- No sustain pedal support for MVP.
- No velocity sensitivity for MVP.
- No chord history.
- No export.
- No other sounds beyond simple piano.
- Audio is for feedback, but latency should feel smooth.
- Default keyboard visible range: `C3-C6`.
- `C4` is middle C.
- Range controls: include both left/right controls and a stepped slider.
- Include a small keyboard overview below the main keys showing the current visible range.
- Key names are not needed by default, but setting should allow showing pressed key names.
- Chord name style should be configurable.
- Prefer technically complete chord names over simpler/common labels.
- Show best guess as primary, alternatives in small secondary text.
- Accidentals in notation should follow chord spelling.
- Standard notation should be included.
- Notation should adapt to pitch/octave using a grand staff.

## Implementation Priorities

1. Establish Electron + React + TypeScript skeleton.
2. Implement note state model independent of input source.
3. Implement MIDI input adapter.
4. Implement computer keyboard adapter.
5. Implement piano keyboard UI with fixed range and discrete range controls.
6. Implement Web Audio piano feedback.
7. Implement chord detection engine and candidate ranking.
8. Implement chord naming settings.
9. Implement VexFlow grand staff rendering.
10. Implement settings UI.

## Chord Engine Notes

The chord engine should return structured candidates, not just strings.

Suggested candidate shape:

```ts
type ChordCandidate = {
  root: PitchClass;
  bass?: PitchClass;
  quality: string;
  extensions: string[];
  alterations: string[];
  omissions: string[];
  inversion?: number;
  displayNames: {
    maj: string;
    capitalM: string;
    delta: string;
  };
  spelling: Record<number, string>;
  score: number;
};
```

Ranking should favor technically complete names. Avoid collapsing away meaningful omissions or alterations just to produce a simpler label.

Ambiguous chords are normal. Return primary plus alternates.

Engine specifics worth preserving:

- There is no separate `add13` template: an added 13th is enharmonically a major 6th, so the `6`/`m6` templates cover it. `describeExtraInterval` returns `'6'` (not `'add13'`) for a 6/13 interval added to a triad with no seventh, which dedupes onto the `6` templates and avoids a redundant `Cadd13` twin in the alternatives. Over a seventh chord the same interval is named `add13`.
- `dim7`'s 9-semitone interval is spelled as a diminished 7th (7th degree, e.g. `Bbb` in `Cdim7`), not a 6th. See the `dim7` branch in `degreeForInterval`.
- Inversion-text ("full" mode) uses the exported `inversionOrdinalIndex` helper; a bass that is not actually a chord tone returns `null` and falls back to slash notation instead of being mislabeled as an inversion.

## Notation Notes

- Use VexFlow unless there is a strong reason not to.
- Render only currently held notes for MVP.
- Use grand staff.
- Split notes by pitch between bass and treble clefs.
- Accidentals should come from chord spelling metadata where available.

## UI Notes

- Avoid a marketing/landing-page structure. The first screen should be the actual tool.
- Keep the interface quiet, utilitarian, and performance-oriented.
- Main visible regions:
  - chord display
  - grand staff
  - piano keyboard
  - compact controls/settings
- Do not put the main tool inside decorative cards.
- Pressed notes should be visually obvious.

## Open Items

- App name.
- Exact visual design.
- Whether slider steps are octave-only or semitone. Current leaning: octave-only for MVP.
- Default computer keyboard octave. Current leaning: align around visible keyboard range.
- Whether alternatives are always visible or tucked into a compact disclosure.
- Key / spelling context is implemented as explicit keys. `C` defaults to sharps; flat keys prefer flats.
- External MIDI input is absolute and should not be transposed by the selected computer-keyboard octave. If users need better hardware-keyboard visibility, add a separate "follow MIDI input" range behavior.
