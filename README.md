# Live Chord Monitor

Electron MVP for a live MIDI/computer-keyboard chord monitor.

## Run

```sh
npm install
npm run dev
```

## Build

```sh
npm run build
```

## Test

```sh
npm test
```

## Package For macOS

Quick local build (signed, hardened runtime, not notarized; current architecture):

```sh
npm run dist:mac
```

Distribution build (universal `x86_64 arm64`, signed + notarized + stapled):

```sh
npm run dist:mac:release
```

Artifacts are written to `release/` (e.g. `release/Live Chord Monitor-0.1.0-universal.dmg`). Notarization uses the `apple-notary` keychain profile (App Store Connect API key); credentials live in the macOS keychain, never in the repo. Override the profile with `NOTARY_PROFILE=<name>`.

## Controls

- MIDI input: all connected MIDI inputs are listened to automatically.
- Computer keyboard: `A W S E D F T G Y H U J K O L`, mapped from C through D.
- `Z` shifts the computer keyboard down an octave; `X` shifts it up.
- Default visible piano range: `C3-C6`.
- `C4` is middle C.
- Settings include a `Spelling` control grouped into Sharps/Flats. `C` is the default and prefers sharps; flat keys prefer flats.
- Settings (sound, spelling, chord style, inversions, notation, linger) persist across restarts.
