import { describe, expect, it } from 'vitest';
import type { ChordCandidate } from '../music/chords';
import { centeredNoteheadTickX, midiToVexKey } from './StaffNotation';

/**
 * A stub chord that only carries `spelling`, so these tests pin the MIDI-note -> VexFlow-key
 * mapping directly instead of depending on what the chord engine currently names a voicing.
 */
function spelledAs(spelling: Record<number, string>): ChordCandidate {
  return { spelling } as unknown as ChordCandidate;
}

describe('centeredNoteheadTickX', () => {
  it('shifts the tick position so the visible notehead center lands on the staff center', () => {
    expect(centeredNoteheadTickX(320, 320, 300, 340)).toBe(320);
    expect(centeredNoteheadTickX(320, 320, 340, 360)).toBe(290);
    expect(centeredNoteheadTickX(320, 280, 295, 325)).toBe(290);
  });
});

describe('midiToVexKey', () => {
  it('uses the chord spelling letter and accidental', () => {
    expect(midiToVexKey(61, spelledAs({ 1: 'C#' }))).toEqual({ key: 'c/4', accidental: '#' });
    expect(midiToVexKey(61, spelledAs({ 1: 'Db' }))).toEqual({ key: 'd/4', accidental: 'b' });
  });

  it('falls back to flat spelling without chord context', () => {
    expect(midiToVexKey(61, null)).toEqual({ key: 'd/4', accidental: 'b' });
    expect(midiToVexKey(60, null)).toEqual({ key: 'c/4', accidental: null });
  });

  it('drops an octave for B# / B##, which sound in the octave above their written letter', () => {
    // B#3 is enharmonic with C4 (MIDI 60): the letter B belongs to octave 3, not 4.
    expect(midiToVexKey(60, spelledAs({ 0: 'B#' }))).toEqual({ key: 'b/3', accidental: '#' });
    expect(midiToVexKey(72, spelledAs({ 0: 'B#' }))).toEqual({ key: 'b/4', accidental: '#' });
    expect(midiToVexKey(48, spelledAs({ 0: 'B#' }))).toEqual({ key: 'b/2', accidental: '#' });
    // B##3 is enharmonic with C#4 (MIDI 61).
    expect(midiToVexKey(61, spelledAs({ 1: 'B##' }))).toEqual({ key: 'b/3', accidental: '##' });
  });

  it('raises an octave for Cb / Cbb, which sound in the octave below their written letter', () => {
    // Cb4 is enharmonic with B3 (MIDI 59).
    expect(midiToVexKey(59, spelledAs({ 11: 'Cb' }))).toEqual({ key: 'c/4', accidental: 'b' });
    expect(midiToVexKey(71, spelledAs({ 11: 'Cb' }))).toEqual({ key: 'c/5', accidental: 'b' });
    // Cbb4 is enharmonic with Bb3 (MIDI 58).
    expect(midiToVexKey(58, spelledAs({ 10: 'Cbb' }))).toEqual({ key: 'c/4', accidental: 'bb' });
  });

  it('leaves spellings that do not cross the B/C seam on their MIDI octave', () => {
    // Bbb (e.g. the diminished 7th of Cdim7) shares a MIDI octave with B - do not shift it.
    expect(midiToVexKey(69, spelledAs({ 9: 'Bbb' }))).toEqual({ key: 'b/4', accidental: 'bb' });
    expect(midiToVexKey(71, spelledAs({ 11: 'B' }))).toEqual({ key: 'b/4', accidental: null });
    expect(midiToVexKey(65, spelledAs({ 5: 'E#' }))).toEqual({ key: 'e/4', accidental: '#' });
    expect(midiToVexKey(64, spelledAs({ 4: 'Fb' }))).toEqual({ key: 'f/4', accidental: 'b' });
    expect(midiToVexKey(63, spelledAs({ 3: 'D#' }))).toEqual({ key: 'd/4', accidental: '#' });
  });

  it('falls back to a plain c key for an unparseable spelling', () => {
    expect(midiToVexKey(60, spelledAs({ 0: 'wat' }))).toEqual({ key: 'c/4', accidental: null });
  });
});
