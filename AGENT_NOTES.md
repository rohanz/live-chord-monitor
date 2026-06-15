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
- Display logic uses a short release-settle window (`RELEASE_SETTLE_MS`, currently 60ms) before accepting release-only reductions in the displayed note set. This prevents a full chord release from briefly becoming a partial chord because one key was released milliseconds later than another. Audio and key lighting should remain immediate.
- The chord readout area reserves fixed vertical space so the staff does not shift when chord text or alternatives appear/disappear.
- Do not show "No alternate interpretations"; leave the alternatives row empty unless there are actual alternatives.
- Settings are in a separate drawer; sound controls remain directly visible.
- Keyboard shortcut text lives in a separate Help drawer, not in the main bottom control strip.
- Header layout: keep the app title and MIDI input status on the top left; keep Sound, Help, and Settings controls on the top right. Do not show a separate computer-keyboard octave/status pill in the header.
- Build command `npm run build` passes.
- macOS packaging command `npm run dist:mac` succeeds and produced:
  - `dist/mac-arm64/Live Chord Monitor.app`
  - `dist/Live Chord Monitor-0.1.0-arm64.dmg`
  - `dist/Live Chord Monitor-0.1.0-arm64-mac.zip`
- The app was signed by electron-builder using the available local Developer ID identity.
- `codesign --verify --deep --strict` passes for `dist/mac-arm64/Live Chord Monitor.app`.
- Notarization is not configured yet; electron-builder skipped notarization.
- Browser visual QA was attempted with the in-app browser, but the browser backend was unavailable in this session. Chrome automation fallback also failed to connect, even though Chrome was running and extension/native-host checks passed. Vite serving was verified with `curl`.
- `npm audit --omit=dev` reports 0 production vulnerabilities.
- Test suite uses Vitest + React Testing Library. `npm test` currently covers music logic, UI behavior, MIDI handling, mouse/pointer note input, release-settle/linger, staff-centering math, and responsive CSS contracts.
- Electron minimum window size is intentionally `820x680` as a practical small-tablet-style floor. Below that, the app should not try to preserve every major region.

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
