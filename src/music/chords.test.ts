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

describe('alteration grouping', () => {
  const name = (notes: number[]) => detectChord(notes, 'maj', 'slash').primary?.displayName;

  it('merges a suffix alteration with the extra ones into one ascending group', () => {
    expect(name([60, 64, 67, 70, 73, 78])).toBe('C7(b9,#11)');
    expect(name([60, 64, 67, 70, 73, 78])).not.toBe('C7#11b9');
  });

  it('leaves a lone suffix alteration attached to the suffix', () => {
    expect(name([60, 64, 66, 67, 70])).toBe('C7#11');
    expect(name([60, 61, 64, 67, 70])).toBe('C7b9');
    expect(detectChord([60, 64, 68, 71], 'delta', 'slash').primary?.displayName).toBe('CΔ7#5');
  });

  it('puts additions and omissions in a single parenthesised group', () => {
    expect(name([60, 64, 69, 74])).toBe('Cadd9(6,no5)');
    expect(name([60, 64, 69, 74])).not.toBe('Cadd9(6)(no5)');
    // A lone addition glued to the suffix keeps the conventional spelling of the omission group.
    expect(name([65, 71, 76, 81])).toBe('Fmaj7#11(no5)');
  });

  it('names the idiomatic sixth-ninth, sus thirteenth and altered dominant on their own root', () => {
    expect(name([60, 64, 67, 69, 74])).toBe('C6/9');
    expect(name([60, 63, 67, 69, 74])).toBe('Cm6/9');
    expect(name([60, 65, 67, 70, 74, 81])).toBe('C13sus4');
    expect(name([60, 64, 70, 73, 75, 80])).toBe('C7alt');
  });

  it('keeps the 6/9 suffix intact under a slash bass and an inversion ordinal', () => {
    expect(detectChord([55, 60, 64, 69, 74], 'maj', 'slash').primary?.displayName).toBe('C6/9/G');
    expect(detectChord([55, 60, 64, 69, 74], 'maj', 'root-only').primary?.displayName).toBe('C6/9');
    expect(detectChord([55, 60, 64, 69, 74], 'maj', 'full').primary?.displayName).toBe('C6/9 second inversion');
    for (const style of ['maj', 'capitalM', 'delta'] as const) {
      expect(detectChord([60, 64, 67, 69, 74], style, 'slash').primary?.displayName).toBe('C6/9');
      expect(detectChord([60, 64, 70, 73, 75, 80], style, 'slash').primary?.displayName).toBe('C7alt');
    }
  });
});

describe('chord name styles', () => {
  const name = (notes: number[], style: 'maj' | 'capitalM' | 'delta') =>
    detectChord(notes, style, 'root-only', false).primary?.displayName;

  const DIM = [60, 63, 66];
  const DIM7 = [60, 63, 66, 69];
  const HALF_DIM = [60, 63, 66, 70];
  const AUG = [60, 64, 68];
  const DIM_MAJ7 = [60, 63, 66, 71];
  const MAJ7 = [60, 64, 67, 71];

  it('uses jazz lead-sheet symbols in the symbol style', () => {
    expect(name(DIM, 'delta')).toBe('C°');
    expect(name(DIM7, 'delta')).toBe('C°7');
    expect(name(HALF_DIM, 'delta')).toBe('Cø7');
    expect(name(AUG, 'delta')).toBe('C+');
    expect(name(MAJ7, 'delta')).toBe('CΔ7');
  });

  it('does not mix a symbol and a spelled-out quality in one name', () => {
    // "CdimΔ7" is incoherent: pick one vocabulary and stay in it.
    expect(name(DIM_MAJ7, 'delta')).toBe('C°Δ7');
  });

  it('keeps the text styles spelled out, including the diminished family', () => {
    for (const style of ['maj', 'capitalM'] as const) {
      expect(name(DIM, style)).toBe('Cdim');
      expect(name(DIM7, style)).toBe('Cdim7');
      expect(name(HALF_DIM, style)).toBe('Cm7b5');
      expect(name(AUG, style)).toBe('Caug');
    }

    expect(name(MAJ7, 'maj')).toBe('Cmaj7');
    expect(name(MAJ7, 'capitalM')).toBe('CM7');
    expect(name(DIM_MAJ7, 'maj')).toBe('CdimMaj7');
    expect(name(DIM_MAJ7, 'capitalM')).toBe('CdimM7');
  });
});
