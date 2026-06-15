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

```sh
npm run dist:mac
```

Current arm64 artifacts are generated in `dist/`:

- `dist/mac-arm64/Live Chord Monitor.app`
- `dist/Live Chord Monitor-0.1.0-arm64.dmg`
- `dist/Live Chord Monitor-0.1.0-arm64-mac.zip`

The app signs with the available local Developer ID identity during packaging. Notarization is not configured yet.

## Controls

- MIDI input: all connected MIDI inputs are listened to automatically.
- Computer keyboard: `A W S E D F T G Y H U J K O L`, mapped from C through D.
- `Z` shifts the computer keyboard down an octave; `X` shifts it up.
- Default visible piano range: `C3-C6`.
- `C4` is middle C.
- Settings include a `Spelling` control grouped into Sharps/Flats. `C` is the default and prefers sharps; flat keys prefer flats.
- Settings (sound, spelling, chord style, inversions, notation, linger) persist across restarts.
