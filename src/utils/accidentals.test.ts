import { describe, expect, it } from 'vitest';
import { toAccidentalGlyphs } from './accidentals';

describe('toAccidentalGlyphs', () => {
  it('converts root and bass accidentals', () => {
    expect(toAccidentalGlyphs('Bb')).toBe('B♭');
    expect(toAccidentalGlyphs('F#')).toBe('F♯');
    expect(toAccidentalGlyphs('Bbmaj7')).toBe('B♭maj7');
    expect(toAccidentalGlyphs('Cmaj7/Bb')).toBe('Cmaj7/B♭');
    expect(toAccidentalGlyphs('Db4')).toBe('D♭4');
  });

  it('converts double accidentals', () => {
    expect(toAccidentalGlyphs('Bbb')).toBe('B♭♭');
    expect(toAccidentalGlyphs('F##')).toBe('F♯♯');
  });

  it('converts altered degrees, including after a word', () => {
    expect(toAccidentalGlyphs('C7(b9,#11)')).toBe('C7(♭9,♯11)');
    expect(toAccidentalGlyphs('C7b13')).toBe('C7♭13');
    expect(toAccidentalGlyphs('Cm7b5')).toBe('Cm7♭5');
    expect(toAccidentalGlyphs('C7#5')).toBe('C7♯5');
    // `addb7` has no note letter before the accidental - the degree rule must still catch it.
    expect(toAccidentalGlyphs('Cmaj7(addb7)')).toBe('Cmaj7(add♭7)');
  });

  it('leaves quality words alone', () => {
    // These contain b/#-adjacent letters or uppercase that must never be read as an accidental.
    for (const name of ['Cadd9', 'Csus4', 'Cdim7', 'Caug', 'C7alt', 'CM7', 'CmMaj7', 'C6/9', 'C7(no5)']) {
      expect(toAccidentalGlyphs(name)).toBe(name);
    }
  });

  it('handles the symbol vocabulary', () => {
    expect(toAccidentalGlyphs('Cø7')).toBe('Cø7');
    expect(toAccidentalGlyphs('C°Δ7')).toBe('C°Δ7');
    expect(toAccidentalGlyphs('Ebø7')).toBe('E♭ø7');
  });

  it('is idempotent', () => {
    const once = toAccidentalGlyphs('Bb7(b9,#11)');
    expect(toAccidentalGlyphs(once)).toBe(once);
  });
});
