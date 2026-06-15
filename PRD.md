# Live Chord Monitor PRD

## Overview

Build a macOS desktop app inspired by Chordio's live MIDI chord recognition workflow: connect a MIDI keyboard, light up currently pressed keys, display the detected chord name in real time, and show the currently held notes on a grand staff.

This is not a full Chordio clone. The MVP is a focused live chord monitor for personal use, with a clean path to later distribution.

Reference: https://chordio.co.uk/

## Product Goals

- Provide immediate visual feedback for notes played on a connected MIDI keyboard.
- Display the best detected chord name for the currently held notes.
- Show alternate chord interpretations in smaller secondary text.
- Render standard music notation for the currently held notes.
- Provide simple, smooth, low-latency piano audio feedback.
- Support both MIDI keyboard input and computer keyboard input.
- Package as a macOS app from day one.

## Non-Goals For MVP

- Chord progression recording.
- MIDI export.
- PDF export.
- DAW integration.
- Interactive sheet music.
- Lessons, scales, modes, or music theory workspaces.
- Sustain pedal support.
- Velocity sensitivity.
- Multiple sounds or instruments.
- Cloud sync, accounts, or collaboration.

## Platform And Stack

Use Electron from day one.

Recommended stack:

- Electron
- React
- TypeScript
- Vite
- Web MIDI API through Electron/Chromium
- Web Audio API for simple piano feedback
- VexFlow for notation rendering

Rationale:

- Chromium gives predictable Web MIDI support.
- Electron gives a straightforward path to signed/notarized macOS distribution.
- React/TypeScript keeps the UI and chord engine maintainable.
- Web Audio is sufficient for low-latency feedback without native audio complexity.
- VexFlow handles notation without building staff rendering from scratch.

## Responsive Layout

- The app should not show page scrollbars during normal use.
- Electron should enforce a practical small-tablet-style minimum window size of roughly `820x680`.
- Above that minimum, the chord readout, staff, keyboard, and controls should scale down proportionally rather than overlap or obscure one another.

## Target User

The initial target user is the owner/developer using the app personally on macOS with a connected MIDI keyboard. Later distribution to other users should remain feasible.

## Core User Flow

1. User opens the app.
2. App automatically listens to all available MIDI input devices.
3. User plays notes on a MIDI keyboard or computer keyboard.
4. Pressed keys light up in the visible piano keyboard view.
5. The currently held notes accumulate into the active note set.
6. App detects the technically complete best chord name.
7. App shows alternate chord interpretations in smaller secondary text.
8. App renders the active notes on a grand staff.
9. App plays a simple piano sound unless muted or volume is set to zero.

## Input Requirements

### MIDI Keyboard

- Listen to all connected MIDI inputs automatically.
- Treat `note on` with velocity greater than zero as press.
- Treat `note off` and `note on` with velocity zero as release.
- Ignore velocity for volume and expression in MVP.
- No sustain pedal support in MVP.

### Computer Keyboard

Support a piano-style mapping from C through D:

- White keys: `A S D F G H J K`
- Black keys: `W E T Y U`
- Next octave extension: `O` is C# and `L` is D.
- Combined mapping: `A W S E D F T G Y H U J K O L`

The exact octave should follow the currently selected computer-keyboard base octave.
`Z` should shift the computer-keyboard octave down. `X` should shift it up.
For the 3-octave visible range, the computer-keyboard octave should be the middle octave of the selected visible range.

## Keyboard View

- Show a fixed visible piano range by default.
- Default range: `C3-C6`.
- `C4` is middle C in scientific pitch notation.
- Provide both:
  - octave left/right controls
  - a stepped range slider
- The stepped slider itself should visually represent the full 88-key keyboard range so the user can see which section of the piano is currently visible.
- The range selector should move in discrete semitone or octave steps, not continuous scrolling.
- Pressed keys should visibly light up red. Use the same active color for black and white keys.
- Key styling should be restrained and instrument-like: flat surfaces, subtle separators, and no glossy/tacky gradients.
- Key names are hidden by default.
- Settings can enable key names for pressed keys only.

## Chord Display

### Primary Chord

- Show one best-guess chord name prominently.
- When nothing is active, the chord display should be visually empty rather than showing placeholder copy.
- The last chord/note display should fade out smoothly after release, with an adjustable setting.
- Linger options: off, 0.25s, 0.5s, 0.75s, 1s. Default: 0.5s.
- The displayed chord/notes should remain solid during linger and fade only during the final 0.1s.
- When notes are released from a chord, use a short release-settle window before shrinking the displayed chord, so tiny timing differences between key releases do not cause only the final released note/subset to linger.
- Prefer technically complete names over simpler/common names.
- Example preference: if the notes imply `C9(no5)`, prefer that over a simplified `C9` when the omission is meaningful.

### Alternatives

- Show alternate valid interpretations in smaller secondary text.
- Alternatives should be visually subordinate and not compete with the primary chord.
- If there are no alternatives, show no explanatory text.

### Chord Naming Settings

Provide settings for chord name style:

- `Cmaj7`
- `CM7`
- `CΔ7`

Provide settings for inversion display:

- root-only
- slash chord, e.g. `C/E`
- full inversion text, e.g. `C major first inversion`

Default should favor slash chords.

## Chord Detection Requirements

The chord engine should support broad practical chord recognition, including:

- major, minor, diminished, augmented
- sus2, sus4
- 5/no3 power-style chords
- major 6, minor 6
- dominant 7, major 7, minor 7
- minor-major 7
- diminished 7
- half-diminished 7
- add9, add11, add13
- 9, major 9, minor 9
- 11, major 11, minor 11
- 13, major 13, minor 13
- altered tones: b5, #5, b9, #9, #11, b13
- omitted tones where musically reasonable
- slash chords and inversions

Ambiguity is expected. The engine should rank candidates and return:

- primary best candidate
- alternate candidates
- chord spelling metadata for notation

## Notation

- Render currently held notes on a grand staff.
- The grand staff itself should always remain visible when notation is enabled, even when no notes are displayed.
- Staff should be compact and centered because the app only displays one chord at a time.
- Notes should render at a stable horizontal position; introducing accidentals should not shift the chord to the right.
- Notes should sit horizontally centered on the staff.
- Staff placement should be based on note pitch:
  - lower notes on bass clef
  - higher notes on treble clef
  - mixed chords split across both
- Accidentals should follow chord spelling where possible, not raw pitch-class defaults.
- Example: a detected `C7` should spell the seventh as `Bb`, not `A#`.
- Notation can be disabled in settings.
- MVP notation is static for the currently held notes only. It is not a sequencer or sheet music editor.

## Audio

- Use a simple piano-like sound.
- Sound quality can be basic.
- Latency should not be noticeably distracting.
- No velocity sensitivity in MVP.
- Include:
  - volume slider
  - mute button
- Audio output follows all MIDI and computer-keyboard note presses.

## Settings

MVP settings:

- chord name style: `Cmaj7`, `CM7`, `CΔ7`
- inversion display mode
- key / spelling context; default `C`, with C preferring sharps
- show pressed key names
- notation on/off
- volume
- mute
- linger duration for last chord display

Settings should live in a separate settings panel/drawer. Sound controls can remain directly visible.

Keyboard shortcuts and MIDI input guidance should live in a separate Help panel, not in the main bottom control strip.

Possible later settings:

- light/dark mode
- computer-keyboard base octave
- visible keyboard range default
- show/hide alternate chord names
- follow MIDI input: automatically shift the visible keyboard range to include active external MIDI notes

## Test Coverage Expectations

Maintain automated tests for:

- note naming and computer-keyboard mapping
- chord detection basics and edge cases
- inversion and chord-name style display
- key-based sharp/flat spelling
- piano-key rendering and active state
- integrated full-range slider
- settings/help drawer behavior
- MIDI input handling
- release-settle and linger behavior
- staff note centering math
- responsive layout CSS contracts

## Distribution

Initial development can run through Electron dev mode.

Later distribution steps:

- build macOS app
- sign with Apple Developer ID
- notarize with Apple
- distribute `.dmg` or `.zip`

Auto-update is out of scope for MVP.

## Open Decisions

- Final app name.
- Whether the stepped range slider should move by semitone or octave. Current leaning: octave steps for MVP.
- Exact default computer-keyboard octave. Current leaning: C4-C5 or matched to visible keyboard center.
- Exact visual style.
- Whether alternate chord interpretations should be always visible or collapsible.
