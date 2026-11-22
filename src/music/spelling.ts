import type { ChordCandidate } from './chords';
import { midiNoteName, midiToOctave, midiToPitchClass, pitchClassName } from './notes';

export type VexKey = {
  key: string;
  accidental: string | null;
};

/** Pitch class of each natural letter, used to detect spellings that cross the B/C octave seam. */
const LETTER_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * The octave a spelling is *written* in, which is not always the MIDI octave. MIDI octaves break at
 * C, but spellings can cross that seam: B#3 sounds as MIDI 60 (C4) and Cb4 sounds as MIDI 59 (B3).
 * Taking the letter from the spelling and the octave from MIDI would then place the note a seventh
 * away. Spellings that stay inside their MIDI octave (including Bbb) are unaffected.
 */
function spelledOctave(note: number, letter: string, accidental: string): number {
  const alteration = accidental.split('').reduce((total, mark) => total + (mark === '#' ? 1 : -1), 0);
  const soundingDegree = LETTER_PITCH_CLASSES[letter] + alteration;
  const midiOctave = midiToOctave(note);

  if (soundingDegree > 11) {
    // e.g. B# / B##: the letter belongs to the octave below the pitch it sounds.
    return midiOctave - 1;
  }

  if (soundingDegree < 0) {
    // e.g. Cb / Cbb: the letter belongs to the octave above the pitch it sounds.
    return midiOctave + 1;
  }

  return midiOctave;
}

export function midiToVexKey(note: number, chord: ChordCandidate | null): VexKey {
  const pitchClass = midiToPitchClass(note);
  // Without chord context, fall back to flat spelling (matches conventional accidental display).
  const spelled = chord?.spelling[pitchClass] ?? pitchClassName(pitchClass, true);
  const match = spelled.match(/^([A-G])([b#]{0,2})$/);

  if (!match) {
    return { key: `c/${midiToOctave(note)}`, accidental: null };
  }

  const [, letter, accidental] = match;

  return {
    key: `${letter.toLowerCase()}/${spelledOctave(note, letter, accidental)}`,
    accidental: accidental || null,
  };
}

/** A held note named the way the staff writes it (chord-aware: E♭ in Cm7), else by the spelling setting. */
export function spelledNoteName(note: number, chord: ChordCandidate | null, preferFlats: boolean): string {
  if (!chord) return midiNoteName(note, preferFlats);
  const { key, accidental } = midiToVexKey(note, chord);
  const [letter, octave] = key.split('/');
  return `${letter.toUpperCase()}${accidental ?? ''}${octave}`;
}
