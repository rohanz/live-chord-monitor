export const NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;
export const NOTE_NAMES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const;

export type PitchClass = number;
export type SpellingKey = 'C' | 'G' | 'D' | 'A' | 'E' | 'B' | 'F#' | 'C#' | 'F' | 'Bb' | 'Eb' | 'Ab' | 'Db' | 'Gb' | 'Cb';

export const SPELLING_KEYS: SpellingKey[] = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb'];
const FLAT_SPELLING_KEYS = new Set<SpellingKey>(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Cb']);

// Keys whose spelling prefers sharps vs flats. Spelling is intentionally a binary sharp/flat choice
// (see PRD: "C preferring sharps"); these groupings let the UI surface that honestly.
export const SHARP_KEYS: SpellingKey[] = SPELLING_KEYS.filter((key) => !FLAT_SPELLING_KEYS.has(key));
export const FLAT_KEYS: SpellingKey[] = SPELLING_KEYS.filter((key) => FLAT_SPELLING_KEYS.has(key));

const BLACK_PITCH_CLASSES = new Set([1, 3, 6, 8, 10]);

/** MIDI note number for middle C (C4); the boundary between bass and treble clef placement. */
export const MIDDLE_C = 60;

export function midiToPitchClass(midiNote: number): PitchClass {
  return ((midiNote % 12) + 12) % 12;
}

export function midiToOctave(midiNote: number): number {
  return Math.floor(midiNote / 12) - 1;
}

export function midiToFrequency(midiNote: number): number {
  return 440 * 2 ** ((midiNote - 69) / 12);
}

export function isBlackKey(midiNote: number): boolean {
  return BLACK_PITCH_CLASSES.has(midiToPitchClass(midiNote));
}

export function pitchClassName(pitchClass: PitchClass, preferFlats = false): string {
  const names = preferFlats ? NOTE_NAMES_FLAT : NOTE_NAMES_SHARP;
  return names[midiToPitchClass(pitchClass)];
}

export function midiNoteName(midiNote: number, preferFlats = false): string {
  return `${pitchClassName(midiNote, preferFlats)}${midiToOctave(midiNote)}`;
}

export function keyPrefersFlats(key: SpellingKey): boolean {
  return FLAT_SPELLING_KEYS.has(key);
}

export function midiRange(start: number, endInclusive: number): number[] {
  return Array.from({ length: endInclusive - start + 1 }, (_, index) => start + index);
}

export const COMPUTER_KEY_OFFSETS: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
};

export function clampMidiStart(start: number, visibleSemitones: number): number {
  const min = 24;
  const max = 108 - visibleSemitones;
  return Math.min(max, Math.max(min, start));
}
