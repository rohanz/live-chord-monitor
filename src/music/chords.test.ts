import { describe, expect, it } from 'vitest';
import { detectChord, inversionOrdinalIndex } from './chords';

describe('inversionOrdinalIndex', () => {
  it('returns the 1-based inversion ordinal when the bass is a chord tone', () => {
    expect(inversionOrdinalIndex(4, [4, 7])).toBe(1);
    expect(inversionOrdinalIndex(7, [4, 7])).toBe(2);
    expect(inversionOrdinalIndex(7, [3, 7, 10])).toBe(2);
  });

  it('returns null when the bass is not one of the chord tones', () => {
    expect(inversionOrdinalIndex(1, [4, 7])).toBeNull();
    expect(inversionOrdinalIndex(9, [4, 7])).toBeNull();
  });
});

describe('detectChord', () => {
  it('returns no chord for silence', () => {
    expect(detectChord([], 'maj', 'slash')).toEqual({ primary: null, alternatives: [] });
  });

  it('names single notes without placeholder chord text', () => {
    expect(detectChord([60], 'maj', 'slash').primary?.displayName).toBe('C');
  });

  it('detects common triads', () => {
    expect(detectChord([60, 64, 67], 'maj', 'slash').primary?.displayName).toBe('C');
    expect(detectChord([57, 60, 64], 'maj', 'slash').primary?.displayName).toBe('Am');
    expect(detectChord([59, 62, 65], 'maj', 'slash').primary?.displayName).toBe('Bdim');
    expect(detectChord([56, 60, 64], 'maj', 'slash').primary?.displayName).toBe('G#aug');
  });

  it('supports suspended, seventh, and extended chords', () => {
    expect(detectChord([60, 65, 67], 'maj', 'slash').primary?.displayName).toBe('Csus4');
    expect(detectChord([60, 64, 67, 70], 'maj', 'slash').primary?.displayName).toBe('C7');
    expect(detectChord([60, 64, 70, 74], 'maj', 'slash').primary?.displayName).toBe('C9(no5)');
  });

  it('uses the configured chord naming style', () => {
    expect(detectChord([60, 64, 67, 71], 'maj', 'slash').primary?.displayName).toBe('Cmaj7');
    expect(detectChord([60, 64, 67, 71], 'capitalM', 'slash').primary?.displayName).toBe('CM7');
    expect(detectChord([60, 64, 67, 71], 'delta', 'slash').primary?.displayName).toBe('CΔ7');
  });

  it('supports inversion display modes', () => {
    expect(detectChord([64, 67, 72], 'maj', 'slash').primary?.displayName).toBe('C/E');
    expect(detectChord([64, 67, 72], 'maj', 'root-only').primary?.displayName).toBe('C');
    expect(detectChord([64, 67, 72], 'maj', 'full').primary?.displayName).toBe('C first inversion');
  });

  it('spells notation accidentals from chord context', () => {
    const chord = detectChord([60, 64, 67, 70], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('C7');
    expect(chord?.spelling[10]).toBe('Bb');
  });

  it('spells a diminished seventh as a stacked seventh (Bbb), not a sixth', () => {
    const chord = detectChord([60, 63, 66, 69], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('Cdim7');
    expect(chord?.spelling[9]).toBe('Bbb');
  });

  it('uses key spelling preference for enharmonic chord roots and single notes', () => {
    expect(detectChord([61], 'maj', 'slash', false).primary?.displayName).toBe('C#');
    expect(detectChord([61], 'maj', 'slash', true).primary?.displayName).toBe('Db');
    expect(detectChord([61, 65, 68], 'maj', 'slash', false).primary?.displayName).toBe('C#');
    expect(detectChord([61, 65, 68], 'maj', 'slash', true).primary?.displayName).toBe('Db');
  });

  it('returns alternate interpretations for ambiguous voicings', () => {
    const result = detectChord([60, 64, 67, 69], 'maj', 'slash');

    expect(result.primary).not.toBeNull();
    expect(result.alternatives.length).toBeGreaterThan(0);
  });

  it('names a major-sixth voicing as a 6 chord without a redundant add13 twin', () => {
    const result = detectChord([60, 64, 67, 69], 'maj', 'slash');
    const names = [result.primary?.displayName, ...result.alternatives.map((candidate) => candidate.displayName)];

    expect(result.primary?.displayName).toBe('C6');
    expect(names).not.toContain('Cadd13');
  });
});
