import { describe, expect, it } from 'vitest';
import {
  COMPUTER_KEY_OFFSETS,
  clampMidiStart,
  midiToFrequency,
  midiToOctave,
  midiToPitchClass,
  midiNoteName,
} from './notes';

describe('notes', () => {
  it('uses scientific pitch notation where C4 is middle C', () => {
    expect(midiNoteName(60)).toBe('C4');
    expect(midiToOctave(60)).toBe(4);
    expect(midiToPitchClass(60)).toBe(0);
  });

  it('lays the computer keyboard out like a piano across an octave plus a whole tone', () => {
    const homeRow = ['KeyA', 'KeyS', 'KeyD', 'KeyF', 'KeyG', 'KeyH', 'KeyJ', 'KeyK', 'KeyL'];
    const upperRow = ['KeyW', 'KeyE', 'KeyT', 'KeyY', 'KeyU', 'KeyO'];
    const offsetsOf = (keys: string[]) => keys.map((key) => COMPUTER_KEY_OFFSETS[key]);

    // The home row is the white keys: a C major scale up to the octave, then one more whole tone.
    expect(offsetsOf(homeRow)).toEqual([0, 2, 4, 5, 7, 9, 11, 12, 14]);
    // The upper row is the black keys sitting between them, in the same left-to-right order.
    expect(offsetsOf(upperRow)).toEqual([1, 3, 6, 8, 10, 13]);
    for (const offset of offsetsOf(upperRow)) {
      expect([1, 3, 6, 8, 10].includes(offset % 12)).toBe(true);
    }
    // Every mapped key must reach a distinct note inside the mapped span.
    const offsets = Object.values(COMPUTER_KEY_OFFSETS);
    expect(new Set(offsets).size).toBe(offsets.length);
    expect(Math.min(...offsets)).toBe(0);
    expect(Math.max(...offsets)).toBe(14);
  });

  it('tunes MIDI note numbers to A440 equal temperament', () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(60)).toBeCloseTo(261.6256, 4);
    expect(midiToFrequency(81)).toBeCloseTo(880, 6);
    expect(midiToFrequency(57)).toBeCloseTo(220, 6);
    // An octave is exactly a doubling at every pitch.
    for (const midiNote of [24, 48, 60, 72, 100]) {
      expect(midiToFrequency(midiNote + 12)).toBeCloseTo(midiToFrequency(midiNote) * 2, 6);
    }
  });

  it('clamps visible ranges to the playable piano area', () => {
    expect(clampMidiStart(0, 36)).toBe(24);
    expect(clampMidiStart(96, 36)).toBe(72);
    expect(clampMidiStart(48, 36)).toBe(48);
  });
});
