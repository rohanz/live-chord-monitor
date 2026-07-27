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
- The settle window applies ONLY while the display is still live. `useDisplayNotes` tracks `displayIsLiveRef` - true while `displayNotes` reflects notes that are actually held, false from the moment everything is released (i.e. throughout linger and fade). A press arriving while not live is always shown IMMEDIATELY, never settled. This is load-bearing: `isReleaseOnlyChange` compares the new press against `displayNotesRef.current`, which during linger still holds the already-released chord, so a single tapped note looks like a "subset" of it. Without the live check, repeated staccato taps latched the readout onto the previous full chord and it never updated. Covered by the "never settles a press that lands while a released chord is lingering" / staccato-tap tests in `useDisplayNotes.test.ts`.
- The chord readout area reserves fixed vertical space so the staff does not shift when chord text or alternatives appear/disappear.
- The chord-name `h1` sits inside `.readout-area { overflow: hidden }`, so its box top must stay BELOW that clip edge or tall glyphs get cut off. This is font-dependent: fonts like Inter fill the em box (caps near the box top) and clip where the system fallback would not. The font-size/`vh` and `.readout-area` row split are tuned so the `h1` box top clears the clip edge by ~18-60px at every supported window size (verified by measuring `h1.getBoundingClientRect().top - readoutArea...top` across sizes). If you grow the chord font, re-check that margin.
- Do not show "No alternate interpretations"; leave the alternatives row empty unless there are actual alternatives.
- Settings are in a separate drawer; sound controls remain directly visible. The settings and help drawers are extracted presentational components (`src/components/SettingsDrawer.tsx`, `src/components/HelpDrawer.tsx`); `App` owns the state and passes value/handler props.
- Only one drawer is open at a time (`App` holds a single `openDrawer: 'help' | 'settings' | null`), so the two panels can never stack at the same fixed position.
- The drawers are deliberately NON-modal: `role="dialog"` + `aria-label`, but no `aria-modal` and no Tab focus trap (`src/hooks/useDrawerDialog.ts`). This is a live instrument, and adjusting volume/linger while still playing is a supported workflow, so the app behind a drawer stays fully interactive. Declaring `aria-modal` while leaving the rest of the app clickable would misrepresent the app to assistive tech. What the hook DOES keep: focus into the panel on open, Escape to close, and focus restored to the trigger (only if focus is still inside the closing panel). Escape is handled on the panel via React `onKeyDown`, never on `window`, and only Escape calls `stopPropagation()` - so `Z`/`X` and the `A-L` note keys still reach the window listeners from a drawer control.
- User settings (volume, mute, pressed-key names, notation on/off, chord style, inversion mode, spelling, linger, computer-keyboard-notes) persist across restarts via `usePersistentState` (localStorage, key prefix `lcm:`). Visible-range/computer-octave view state is intentionally not persisted. Storage failures fall back silently to defaults.
- The "Computer keyboard notes" setting gates only the `A-L` note mapping (`useComputerKeyboard` enabled flag). The `Z`/`X` octave/range shortcuts are intentionally NOT gated by it (they are range controls with on-screen equivalents). Computer-keyboard note input is also focus-dependent (window `keydown`), unlike MIDI which fires regardless of focus while the app runs.
- Two different focus guards live in `src/utils/textEditingTarget.ts`, and the distinction is load-bearing:
  - `isTextEditingTarget` (text inputs, `textarea`, `select`, contenteditable) gates the `A-L` NOTE keys. Inside those targets the hook must neither fire a note nor `preventDefault`, or it kills native behavior such as `<select>` type-ahead in the settings drawer.
  - `isTextEntryTarget` (the same minus `select`) gates `Z`/`X`. Octave shift stays available from every settings control - selects, checkboxes, sliders - and is blocked only by literal text entry, which is what "always available" above means in practice. There are no free-text fields in the app today; the guard exists so adding one later does not break typing.
- Every input path has an explicit "the release event may never arrive" safety net, because a stuck note has no in-app recovery (it drones and cannot be cleared):
  - Computer keyboard: window `blur` + `visibilitychange` release all held keys (Cmd+Tab, Spotlight, and macOS swallowing keyup for other keys while Cmd is held).
  - Pointer: `PianoKeyboard` tracks pointerId -> note in a ref and releases from a window `pointerup`/`pointercancel` listener, on unmount, and when a held note scrolls out of the visible range. Releases must never depend on the key ELEMENT still existing - an octave shift mid-press unmounts it.
  - MIDI: CC 120 (All Sound Off) and CC 123 (All Notes Off) release everything held on that input, which is also the user-facing panic path. Device disconnect does the same.
- Pointer input deliberately does NOT support glissando (dragging across keys to sound each one). `setPointerCapture` on pointerdown binds the press to the key it started on, which makes the release deterministic; the cost is that boundary events are not dispatched, so `onPointerLeave`/`onPointerEnter` are dead there. The old `onPointerLeave` + `event.buttons > 0` fallback was removed as dead code. To add glissando later you must drop the capture AND add `pointerenter`-with-buttons note-on, and re-check the stuck-note safety nets.
- A held computer key survives an octave shift: `useComputerKeyboard` re-subscribes when `baseMidiNote` changes, releasing at the OLD base in cleanup and re-triggering still-held keys at the NEW base. Do not clear `pressedKeysRef` on that teardown - key repeat is filtered by `event.repeat` and the real keyup is guarded by the same set, so a cleared key goes silent and unrecoverable. While the setting is disabled the hook still tracks keyup/blur so re-enabling never resurrects a key the user already released.
- MIDI note sources include the channel (`midi:${inputId}:${channel}:${note}`), so a split/layer setup sounding the same pitch on two channels refcounts as two holds.
- The spelling control is labeled "Spelling" (not "Key") and groups options into `Sharps`/`Flats` optgroups. Spelling is intentionally a binary sharp-vs-flat choice (PRD: "C prefers sharps"); the grouping makes that behavior honest rather than implying full diatonic key-signature spelling. `SHARP_KEYS`/`FLAT_KEYS` in `notes.ts` are the single source of truth.
- Keyboard shortcut text lives in a separate Help drawer, not in the main bottom control strip.
- Header layout: keep the app title and MIDI input status on the top left; keep Sound, Help, and Settings controls on the top right. Do not show a separate computer-keyboard octave/status pill in the header.
- Build command `npm run build` passes. It now starts with `npm run clean` (`rimraf dist dist-electron node_modules/.tmp`). This matters: Vite's `emptyOutDir` only cleans `dist/`, nothing cleaned `dist-electron/`, and `build.files` globs `dist-electron/**` into the asar - so a renamed or deleted Electron source used to leave an orphan `.js` behind and get packaged. Removing the tsbuildinfo dir too is deliberate, otherwise incremental `tsc` skips emit after the outputs are deleted.
- `npx tsc --noEmit` at the repo root typechecks NOTHING - the root `tsconfig.json` is solution-style (`"files": []` + project references), so it is vacuously green. Use `npm run typecheck` (`tsc -b --force`), which is what actually checks both the app and the Electron project.
- `npm run lint` is flat-config ESLint 9 (`eslint.config.js`) over `src/`, `electron/`, and `scripts/`: typescript-eslint recommended + `eslint-plugin-react-hooks` + `react-refresh`. `react-hooks/exhaustive-deps` is escalated to an ERROR on purpose (stale-closure/missing-cleanup bugs in the MIDI and audio hooks are the expensive failure class). The newer React-Compiler-derived rules `react-hooks/set-state-in-effect` and `react-hooks/refs` are set to WARN because they also flag some legitimate existing patterns; treat them as a cleanup backlog, not a gate. Linting is intentionally not type-aware so it stays fast - `tsc -b` already covers types.
- Packaging output goes to `release/` (gitignored), NOT `dist/`. `dist/` is the Vite renderer build only. This split is load-bearing: `build.files` globs `dist/**` into the asar, so if electron-builder also wrote there it would sweep its own output (incl. universal temp dirs) into the app and break the universal merge. `directories.output: "release"` keeps them separate.
- Two build commands:
  - `npm run dist:mac` - quick local build: signed (hardened runtime + secure timestamp, identity pinned by hash), NOT notarized, current arch. The notarize hooks no-op (NOTARIZE!=1).
  - `npm run dist:mac:release` - distribution build: universal (`x86_64 arm64`), signed, notarized + stapled. Sets `NOTARIZE=1`, builds universal, then `scripts/notarize-dmg.mjs` notarizes+staples the dmg.
- The asar deliberately contains ONLY `dist/`, `dist-electron/`, and `package.json` (10 entries). electron-builder normally adds every production `dependency` on top of the `files` globs, which previously packaged ~3,800 redundant `node_modules` files (react, react-dom, scheduler, vexflow, lucide-react, js-tokens, loose-envify) even though Vite already bundles them into `dist/assets`. The `"!node_modules/**"` entry in `build.files` suppresses that. Nothing loads those packages from disk at runtime, so if you ever add a dep that IS required at runtime by the main process, it must be un-excluded explicitly.
- `build.mac.extendInfo` nulls out `NSCameraUsageDescription`/`NSMicrophoneUsageDescription`. Those are electron-builder boilerplate; this app never requests camera or microphone, and advertising TCC purpose strings it never uses is just misleading.
- Signing: Developer ID Application, `hardenedRuntime: true` + `build/entitlements.mac.plist` (JIT allowances Electron needs); electron-builder signs inside-out automatically. The signing identity must be pinned by SHA-1 hash (two duplicate Developer ID certs exist, so the name is ambiguous). The hash is kept OUT of the committed repo: it lives in the gitignored `scripts/signing.local` (`SIGN_IDENTITY=...`), which `scripts/dist-mac.sh` passes to electron-builder via `-c.mac.identity`. Without that file, signing falls back to auto-discovery.
- `build/entitlements.mac.plist` grants ONLY `allow-jit` and `allow-unsigned-executable-memory` (V8 needs both under the hardened runtime). `disable-library-validation` was removed: it is only needed for unsigned native modules, the asar ships none, and it would permit unsigned dylib injection into the signed process. Do not add it back without a native module that actually requires it.
- Notarization: `@electron/notarize` is now an explicit devDependency. It used to resolve only as a hoisted transitive of electron-builder, so any hoisting change, pnpm/yarn-pnp move, or electron-builder major bump would have broken `npm run dist:mac:release` at the `afterSign` hook - i.e. AFTER a full universal build had already been produced. The `afterSign` hook `scripts/notarize.cjs` notarizes+staples the `.app` via `@electron/notarize` using the keychain profile `apple-notary` (App Store Connect API key, account-level; override with `NOTARY_PROFILE`). `scripts/notarize-dmg.mjs` does the same for the `.dmg`. No secrets in the repo - credentials live in the keychain.
- Machine-specific signing details (cert hashes, team ID, `.p8` location) are kept OUT of the repo's WORKING TREE - the build identity is in the gitignored `scripts/signing.local`, and the full account-level guide lives outside the repo (its path is in `scripts/signing.local`'s comment). Caveat before publishing: the signing cert SHA-1 and a machine-specific path still exist in git HISTORY (they were removed in commit `673a76d`, not rewritten out). Severity is low - a cert fingerprint is recoverable from any signed binary and no private keys or API keys were ever committed - but "the working tree is clean" is the accurate claim, not "the history is clean".
- Verified end-to-end: app `spctl -a -t exec` -> `accepted, source=Notarized Developer ID`; `stapler validate` passes on both app and dmg; `lipo -info` shows `x86_64 arm64`. (A `.dmg` is notarized+stapled but not code-signed, so verify it with `stapler validate`, not `spctl`.)
- Browser visual QA was attempted with the in-app browser, but the browser backend was unavailable in this session. Chrome automation fallback also failed to connect, even though Chrome was running and extension/native-host checks passed. Vite serving was verified with `curl`.
- `npm audit --omit=dev` reports 0 vulnerabilities, but that number is close to meaningless here and should not be quoted as a safety claim: the runtime `dependencies` are only react/react-dom/vexflow/lucide-react, and everything that actually ships attack surface (Electron/Chromium itself, electron-builder) is a devDependency and therefore excluded by `--omit=dev`. The full `npm audit` currently reports ~31 advisories, all in the dev toolchain (electron-builder 24's `app-builder-lib`/`builder-util-runtime`, plus transitive `brace-expansion`/`tar`/`esbuild`/`postcss`). The number that matters for shipped security is the Electron major (see below).
- Electron is pinned to `^43.2.0` (upgraded from the EOL 31.7.7 / Chromium 126, which was shipping unpatched CVEs inside a signed, notarized binary). Keep this on a supported Electron major; check https://www.electronjs.org/docs/latest/tutorial/electron-timelines before letting it drift. `npm run build` and a packaged-app launch were both verified on 43. `electron-builder` is still 24.13.3 and packages Electron 43 fine.
- Test suite uses Vitest + React Testing Library. `npm test` currently covers music logic (including dim7 spelling, the inversion-ordinal helper, and no-redundant-add13), UI behavior, MIDI handling, mouse/pointer note input, release-settle/linger (`useDisplayNotes`), settings persistence (`usePersistentState`), Web Audio (`usePianoAudio` against a recording mock AudioContext local to that test file - it asserts the VALUES written to the graph: oscillator frequencies and the exact 2x harmonic, master gain = volume * 0.28, silence at attack while muted, envelope not rescheduled on volume change, master/limiter routing, release-timer cleanup, context close, gesture priming), computer-keyboard mapping/blur-release/octave re-arm (`useComputerKeyboard`), focus guards (`utils/textEditingTarget`), staff-centering math, spelled-octave math, and a rendered-SVG suite for `StaffNotation`. Do not put a test COUNT in this file - it goes stale the same day it is written; describe coverage instead.
- Stuck-note and input-guard behavior is covered by tests that assert the IMMEDIATE held-note state, read off the always-rendered 88-key `RangeOverview` (`.mini-white-key.is-active`), NOT off the chord heading. The heading is filtered through release-settle + linger, so "the heading still says C" is true both when a release worked and when it was dropped - such an assertion cannot fail and is worthless. Prefer asserting a state CHANGE.
- Why the suite grew: a mutation-testing pass over the PRE-review suite (53 tests) found ~49% of mutants surviving. The chord scoring model, the audio path, and MIDI note-off handling were effectively untested - the tests exercised them but could not fail on them. Most of the engine bugs listed under "Chord Engine Notes" were sitting under green tests. If you change scoring, audio, or note-off, assume the existing tests will not catch you and add one that would.
- Testing rules learned the hard way:
  - Assert state CHANGES, not non-changes. The old zero-velocity note-off test asserted the heading was still `C`, which is true whether the release worked or was dropped - an assertion no implementation can fail is worse than no test, because it reads as coverage.
  - Do NOT assert computed styles in jsdom. jsdom applies no stylesheet and performs no layout, so `toHaveStyle`/`getComputedStyle` assertions about anything not written as an inline attribute are vacuous. A `toHaveStyle({ pointerEvents: 'auto' })` assertion was deleted from `PianoKeyboard.test.tsx` for exactly this reason.
  - Do NOT string-match `styles.css`. `src/responsive-layout.test.ts` was DELETED: it read the CSS file and asserted byte-exact source formatting (e.g. `'body {\n  margin: 0;\n  min-width: 0;'`), so it would fail on a Prettier run and pass on a completely broken layout. It also asserted `overflow: hidden;` twice with no way to know which rule matched. Real layout assertions need a real engine - a browser test (Playwright or similar) driving the built app at several window sizes, which is NOT wired into vitest today. Until that exists, responsive layout is verified by eye at the `820x680` Electron minimum, not by a test.
- Audio (`src/audio/usePianoAudio.ts`) is a stable, non-React `createPianoEngine()` object created once per hook instance (via `useState(createPianoEngine)`); the React effects only forward note on/off, level, and disposal to it. Load-bearing details:
  - Signal graph is `osc -> lowpass -> per-voice envelope gain (peaks at 1.0) -> ONE shared master gain (volume * MASTER_GAIN, 0 when muted) -> DynamicsCompressor limiter -> destination`. Voices must NEVER connect to `context.destination` directly: with `MASTER_GAIN = 0.28` and the default volume, per-voice peak is ~0.2, so a ten-note two-hand voicing sums to ~2.0 and hard-clips. The limiter catches the low-register in-phase worst case.
  - Volume/mute writes ONLY to the master gain. It must never touch a voice envelope: the old code did `cancelScheduledValues` + `setTargetAtTime(peak)` on every voice, so nudging the slider mid-chord re-attacked held notes at FULL peak and destroyed their decay. Envelopes are unit-scaled precisely so volume and envelope are separable.
  - Envelopes are gated with `0.0001` floors so there are no exponential-ramp-to-zero exceptions and no attack/release clicks.
  - Retriggering a note inside the 220ms release window is safe because `stopNote` deletes the map entry immediately while the teardown timer closes over the OLD voice. Keep that ordering.
  - Every teardown timer is tracked in a set and cleared on dispose, and the `AudioContext` is `close()`d on unmount (it used to leak a live hardware audio stream, plus timers firing post-unmount).
  - The context is primed from window `pointerdown`/`keydown` INSIDE the hook, and re-resumed on `statechange`. This is required: MIDI messages are not user-activation gestures in Chromium, so a context first created by an incoming MIDI note can be born `suspended` and the first notes go silent. Keep the priming listener in the hook, not in `App`.
- Electron minimum window size is intentionally `820x680` as a practical small-tablet-style floor. Below that, the app should not try to preserve every major region.
- Electron hardening (`electron/main.ts`): `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`. The permission handler grants only `midi` (sysex is not requested). Web MIDI works without `experimentalFeatures`, so that flag was removed.
- Navigation is locked down in `createMainWindow`: `setWindowOpenHandler` denies every `window.open` (an unhandled one would create a child window with webPreferences we did not choose), and `will-navigate` cancels any navigation whose origin is not `app://bundle` (or the Vite dev origin in dev). The CSP does NOT restrict navigation, so these handlers are the only thing stopping the renderer from being navigated off-origin. http/https URLs are handed to the system browser via `shell.openExternal`; everything else is dropped.
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

The engine was substantially rewritten during the adversarial-review wave. Specifics worth preserving (all in `src/music/chords.ts`):

- Templates added: `7sus4 [0,5,7,10]`, `9sus4 [0,5,7,10,2]`, `dimMaj7 [0,3,6,11]`. Without these, those voicings were only nameable as contorted additions on some other root.
- `allowOmitFifth` was REMOVED from `6` and `m6`. A 6 chord minus its fifth is note-for-note a minor triad (`C E A` = `Am`), so allowing the omission made the two templates set-indistinguishable and every one of the 12 minor first inversions came out as `X6(no5)`. The comment above those templates says so; do not re-add the flag.
- `completeToneBonus` counts MATCHED tones (`template.intervals.length - missing.length`), not the template's slot count. Counting slots credited a three-note sound for a fourth tone it was omitting, so bigger templates won by being bigger.
- `describeExtraInterval` labels EVERY interval - there are no `''` returns left. Previously intervals 4, 7, and 3-without-a-major-3rd returned the empty string, so those notes vanished from the displayed name while still being drawn on the staff AND cost the candidate zero addition penalty, which meant lying names outranked honest ones.
- An extra's spelling degree comes from the chosen addition LABEL via `ADDITION_DEGREES`, not from `template.suffix`. A `#11` must therefore spell as an F# over C, never a Gb, even when the template suffix mentions no eleventh.
- Dedupe is keyed on the resolved pitch-class set plus the root, which reduces to the root: every candidate resolves to the same sounding set (that set IS the input), so at most ONE candidate survives per root. This is what kills `C9(no5)` vs `C7(no5)add9` twins.
- Ranking uses `compareCandidates`: score, then root-equals-bass, then fewest additions+omissions, then shorter display name, then alphabetical. The last two exist purely so ties are deterministic.
- Two-note voicings never go through the template path at all. `describeDyad` names them from the BASS as an interval (`C P4`, `C M3`), except the perfect fifth which keeps the idiomatic `C5` power-chord label. A fourth must not come back as an inverted `F5/C`.
- Inversion ordinals apply only to stacked-third chord tones (3rd/5th/7th, via `isStackedThirdDegree`). A 9th/11th/13th in the bass is a tension, not an inversion, and stays slash-notated rather than inventing a high ordinal.
- `chooseRootName` respells the root enharmonically ONLY when the preferred spelling would force a double accidental somewhere in the chord, and `dim7`/`aug` are exempted (symmetric chords cannot avoid double accidentals from any root, so their spelling is correct rather than broken). NOTE: this is a deliberate, narrow deviation from the documented binary sharp/flat spelling setting - the setting is otherwise absolute. Keep the deviation narrow; do not grow it into general key-signature spelling without a product decision.
- KNOWN GAP: 12 of the 55 three-note pitch-class sets are chromatic clusters with no matching template (e.g. `C-C#-D`, `C-E-F#`) and still render a blank readout. Two-note and four-note sets are fully covered. `chords.corpus.test.ts` ("names every two-note interval and every four-note pitch-class set") pins the three-note gap at <= 12 so it cannot silently grow; it asserts 0 for the two- and four-note sweeps.
- There is no separate `add13` template: an added 13th is enharmonically a major 6th, so the `6`/`m6` templates cover it. `describeExtraInterval` returns `'6'` (not `'add13'`) for a 6/13 interval added to a triad with no seventh, which dedupes onto the `6` templates and avoids a redundant `Cadd13` twin in the alternatives. Over a seventh chord the same interval is named `add13`.
- `dim7`'s 9-semitone interval is spelled as a diminished 7th (7th degree, e.g. `Bbb` in `Cdim7`), not a 6th. See the `dim7` branch in `degreeForInterval`.
- Inversion-text ("full" mode) uses the exported `inversionOrdinalIndex` helper; a bass that is not actually a chord tone returns `null` and falls back to slash notation instead of being mislabeled as an inversion.

## Notation Notes

- Use VexFlow unless there is a strong reason not to.
- Render only currently held notes for MVP.
- Use grand staff.
- Split notes by pitch between bass and treble clefs.
- Accidentals should come from chord spelling metadata where available.
- `StaffNotation` derives the WRITTEN octave from the spelled letter (`spelledOctave`), not from `midiToOctave`. MIDI octaves break at C but spellings can cross that seam: `B#3` sounds as MIDI 60 (C4) and `Cb4` sounds as MIDI 59 (B3). Taking the letter from the spelling and the octave from MIDI drew those a seventh away from where they belong. Spellings that stay inside their MIDI octave - including `Bbb`, the diminished 7th of `Cdim7` - must NOT be shifted; `spelledOctave` only moves when the letter's natural pitch class plus its alteration falls outside 0-11.
- VexFlow 5 emits no `.vf-modifiers` and no `.vf-accidental` class. Accidentals are bare SMuFL `<text>` glyphs (sharp U+E262, flat U+E260, double-flat U+E264) nested inside the `.vf-notehead` group, which is inside `.vf-stavenote`. The full set of classes this app's rendered SVG carries is `vf-stave`, `vf-stavebarline`, `vf-clef`, `vf-stavenote`, `vf-notehead` (verified by dumping the rendered SVG). This matters twice: CSS fading only needs `.vf-stavenote` (a dead `.vf-modifiers` rule was removed from `styles.css`), and tests that want to assert an accidental must look at the extra `<text>` inside a notehead, not at a class.

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
