import { describe, expect, it } from 'vitest';
import { detectChord, type ChordNameStyle, type InversionMode } from './chords';

type Case = {
  notes: number[];
  expected: string;
  preferFlats?: boolean;
  mode?: InversionMode;
  style?: ChordNameStyle;
};

function nameOf(testCase: Case): string | undefined {
  return detectChord(
    testCase.notes,
    testCase.style ?? 'maj',
    testCase.mode ?? 'slash',
    testCase.preferFlats ?? false,
  ).primary?.displayName;
}

// MIDI reference: C4 = 60. Every voicing below is written low-to-high so the first note is the bass,
// because the engine resolves ambiguous pitch-class sets from the bass note.
const TRIADS: Case[] = [
  { notes: [60, 64, 67], expected: 'C' },
  { notes: [64, 67, 72], expected: 'C/E' },
  { notes: [67, 72, 76], expected: 'C/G' },
  { notes: [65, 69, 72], expected: 'F' },
  { notes: [69, 72, 77], expected: 'F/A' },
  { notes: [72, 77, 81], expected: 'F/C' },
  { notes: [63, 67, 70], expected: 'Eb', preferFlats: true },
  { notes: [67, 70, 75], expected: 'Eb/G', preferFlats: true },
  { notes: [70, 75, 79], expected: 'Eb/Bb', preferFlats: true },
  { notes: [61, 65, 68], expected: 'C#' },
  { notes: [61, 65, 68], expected: 'Db', preferFlats: true },
  { notes: [69, 72, 76], expected: 'Am' },
  { notes: [60, 64, 69], expected: 'Am/C' },
  { notes: [64, 69, 72], expected: 'Am/E' },
  { notes: [62, 65, 69], expected: 'Dm' },
  { notes: [65, 69, 74], expected: 'Dm/F' },
  { notes: [69, 74, 77], expected: 'Dm/A' },
  { notes: [71, 74, 77], expected: 'Bdim' },
  { notes: [74, 77, 83], expected: 'Bdim/D' },
  { notes: [77, 83, 86], expected: 'Bdim/F' },
  { notes: [60, 63, 66], expected: 'Cdim' },
  // The slash bass follows the chord's own spelling: Cdim draws an Eb on the staff, so it reads Eb here.
  { notes: [63, 66, 72], expected: 'Cdim/Eb' },
  { notes: [60, 64, 68], expected: 'Caug' },
  { notes: [64, 68, 72], expected: 'Eaug' },
  { notes: [68, 72, 76], expected: 'G#aug' },
  { notes: [60, 65, 67], expected: 'Csus4' },
  { notes: [65, 67, 72], expected: 'Fsus2' },
  // A bare fourth stack: the shortest honest reading wins over the more decorated sus2 twin.
  { notes: [60, 65, 70], expected: 'Fsus4/C', preferFlats: true },
];

const SEVENTH_INVERSIONS: Case[] = [
  { notes: [60, 64, 67, 71], expected: 'Cmaj7' },
  { notes: [64, 67, 71, 72], expected: 'Cmaj7/E' },
  { notes: [67, 71, 72, 76], expected: 'Cmaj7/G' },
  { notes: [71, 72, 76, 79], expected: 'Cmaj7/B' },
  { notes: [60, 64, 67, 70], expected: 'C7' },
  { notes: [64, 67, 70, 72], expected: 'C7/E' },
  { notes: [67, 70, 72, 76], expected: 'C7/G' },
  { notes: [70, 72, 76, 79], expected: 'C7/Bb', preferFlats: true },
  { notes: [60, 63, 67, 70], expected: 'Cm7' },
  // First inversion of Cm7 is pitch-identical to Eb6; the bass picks Eb, exactly as A-C-E-G picks Am7.
  { notes: [63, 67, 70, 72], expected: 'Eb6', preferFlats: true },
  { notes: [67, 70, 72, 75], expected: 'Cm7/G', preferFlats: true },
  { notes: [70, 72, 75, 79], expected: 'Cm7/Bb', preferFlats: true },
  { notes: [60, 63, 66, 70], expected: 'Cm7b5' },
  // Likewise the first inversion of Cm7b5 is pitch-identical to Ebm6.
  { notes: [63, 66, 70, 72], expected: 'Ebm6', preferFlats: true },
  { notes: [66, 70, 72, 75], expected: 'Cm7b5/Gb', preferFlats: true },
  { notes: [70, 72, 75, 78], expected: 'Cm7b5/Bb', preferFlats: true },
  { notes: [60, 63, 66, 69], expected: 'Cdim7' },
  { notes: [63, 66, 69, 72], expected: 'Ebdim7', preferFlats: true },
  { notes: [66, 69, 72, 75], expected: 'Gbdim7', preferFlats: true },
  { notes: [69, 72, 75, 78], expected: 'Adim7', preferFlats: true },
  { notes: [60, 63, 67, 71], expected: 'CmMaj7' },
  { notes: [63, 67, 71, 72], expected: 'CmMaj7/Eb', preferFlats: true },
  { notes: [67, 71, 72, 75], expected: 'CmMaj7/G', preferFlats: true },
  { notes: [71, 72, 75, 79], expected: 'CmMaj7/B', preferFlats: true },
];

const ROOTLESS_AND_OMITTED: Case[] = [
  { notes: [60, 64, 70], expected: 'C7(no5)' },
  { notes: [60, 64, 71], expected: 'Cmaj7(no5)' },
  { notes: [60, 63, 70], expected: 'Cm7(no5)' },
  { notes: [60, 64, 70, 74], expected: 'C9(no5)' },
  { notes: [60, 63, 70, 74], expected: 'Cm9(no5)' },
  { notes: [60, 64, 71, 74], expected: 'Cmaj9(no5)' },
];

const EXTENSIONS: Case[] = [
  { notes: [60, 64, 67, 70, 74], expected: 'C9' },
  { notes: [60, 64, 67, 71, 74], expected: 'Cmaj9' },
  { notes: [60, 63, 67, 70, 74], expected: 'Cm9' },
  { notes: [60, 64, 67, 70, 74, 77], expected: 'C11' },
  { notes: [60, 63, 67, 70, 74, 77], expected: 'Cm11' },
  { notes: [60, 64, 67, 70, 74, 77, 81], expected: 'C13' },
  { notes: [60, 64, 67, 74], expected: 'Cadd9' },
  { notes: [60, 64, 65, 67], expected: 'Cadd11' },
  { notes: [60, 64, 67, 69, 70], expected: 'C7add13' },
];

const AMBIGUOUS: Case[] = [
  { notes: [60, 64, 67, 69], expected: 'C6' },
  { notes: [69, 72, 76, 79], expected: 'Am7' },
  { notes: [62, 65, 69, 72], expected: 'Dm7' },
  { notes: [65, 69, 72, 74], expected: 'F6' },
];

const DYADS: Case[] = [
  { notes: [60, 67], expected: 'C5' },
  { notes: [55, 60], expected: 'G P4' },
  { notes: [60, 65], expected: 'C P4' },
  { notes: [60, 61], expected: 'C m2' },
  { notes: [60, 62], expected: 'C M2' },
  { notes: [60, 63], expected: 'C m3' },
  { notes: [60, 64], expected: 'C M3' },
  { notes: [60, 66], expected: 'C TT' },
  { notes: [60, 68], expected: 'C m6' },
  { notes: [60, 69], expected: 'C M6' },
  { notes: [60, 70], expected: 'C m7' },
  { notes: [60, 71], expected: 'C M7' },
];

const TENSIONS: Case[] = [
  { notes: [60, 64, 66, 67, 71], expected: 'Cmaj7#11' },
  { notes: [60, 63, 64, 67, 71], expected: 'Cmaj7#9' },
  { notes: [60, 64, 67, 68, 71], expected: 'Cmaj7b13' },
  { notes: [60, 63, 66, 67, 70], expected: 'Cm7#11' },
  { notes: [60, 64, 66, 67, 70], expected: 'C7#11' },
  { notes: [60, 63, 64, 67, 70], expected: 'C7#9' },
  { notes: [60, 61, 64, 67, 70], expected: 'C7b9' },
  { notes: [60, 63, 64, 67], expected: 'C(#9)' },
  { notes: [60, 65, 67, 70], expected: 'C7sus4' },
  { notes: [60, 62, 65, 67, 70], expected: 'C9sus4' },
  { notes: [60, 63, 66, 71], expected: 'CdimMaj7' },
];

// Alterations print in ascending tension order (9 before 11 before 13, flat before sharp within a
// degree) as ONE parenthesised group, regardless of whether an alteration came from the template's own
// suffix or from an extra note. No fake book prints "C7#11b9".
const ALTERATION_ORDER: Case[] = [
  { notes: [60, 64, 67, 70, 73, 78], expected: 'C7(b9,#11)' },
  { notes: [60, 64, 67, 70, 73, 80], expected: 'C7(b9,b13)' },
  { notes: [60, 64, 67, 70, 73, 75], expected: 'C7(b9,#9)' },
  { notes: [60, 64, 68, 70, 75], expected: 'C7(#9,#5)' },
  { notes: [60, 64, 67, 70, 73, 78, 80], expected: 'C7(b9,#11,b13)' },
];

// Three sounds the idiom uses constantly that previously resolved to a different root entirely.
const IDIOMATIC_SOUNDS: Case[] = [
  { notes: [60, 64, 67, 69, 74], expected: 'C6/9' },
  { notes: [55, 60, 64, 69, 74], expected: 'C6/9/G' },
  { notes: [60, 64, 69, 74], expected: 'Cadd9(6,no5)' },
  { notes: [60, 63, 67, 69, 74], expected: 'Cm6/9' },
  { notes: [60, 65, 67, 70, 74, 81], expected: 'C13sus4' },
  { notes: [60, 64, 70, 73, 75, 80], expected: 'C7alt' },
];

const GROUPS: [string, Case[]][] = [
  ['triads in root position and both inversions', TRIADS],
  ['seventh chords in all four inversions', SEVENTH_INVERSIONS],
  ['rootless and omitted-fifth voicings', ROOTLESS_AND_OMITTED],
  ['ninth, eleventh and thirteenth chords', EXTENSIONS],
  ['bass-driven ambiguity resolution', AMBIGUOUS],
  ['two-note intervals', DYADS],
  ['altered and added tensions', TENSIONS],
  ['alterations in ascending tension order', ALTERATION_ORDER],
  ['idiomatic sixth-ninth, sus thirteenth and altered dominant', IDIOMATIC_SOUNDS],
];

describe('chord recognition corpus', () => {
  for (const [groupName, cases] of GROUPS) {
    describe(groupName, () => {
      for (const testCase of cases) {
        const flavour = testCase.preferFlats ? ' [flats]' : '';
        it(`names [${testCase.notes.join(' ')}]${flavour} as ${testCase.expected}`, () => {
          expect(nameOf(testCase)).toBe(testCase.expected);
        });
      }
    });
  }
});

describe('chord spelling corpus', () => {
  it('spells a diminished seventh with a doubly flatted seventh', () => {
    expect(detectChord([60, 63, 66, 69], 'maj', 'slash').primary?.spelling[9]).toBe('Bbb');
  });

  it('spells a flat ninth as a flatted second degree', () => {
    expect(detectChord([60, 61, 64, 67, 70], 'maj', 'slash').primary?.spelling[1]).toBe('Db');
  });

  it('spells a #11 added over a major seventh as a raised fourth degree, not a flat fifth', () => {
    const chord = detectChord([60, 64, 66, 67, 71], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('Cmaj7#11');
    expect(chord?.spelling[6]).toBe('F#');
  });

  it('spells a #9 added over a major seventh as a raised second degree, not a minor third', () => {
    const chord = detectChord([60, 63, 64, 67, 71], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('Cmaj7#9');
    expect(chord?.spelling[3]).toBe('D#');
  });

  it('still spells a dominant #11 as a raised fourth degree after the alteration regrouping', () => {
    const chord = detectChord([60, 64, 66, 67, 70], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('C7#11');
    expect(chord?.spelling[6]).toBe('F#');
  });

  it('still spells a dominant #9 as a raised second degree after the alteration regrouping', () => {
    const chord = detectChord([60, 63, 64, 67, 70], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('C7#9');
    expect(chord?.spelling[3]).toBe('D#');
  });

  it('spells an altered dominant with a raised ninth and a flat thirteenth, not a doubled E letter', () => {
    const chord = detectChord([60, 64, 70, 73, 75, 80], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('C7alt');
    expect(chord?.spelling[1]).toBe('Db');
    expect(chord?.spelling[3]).toBe('D#');
    expect(chord?.spelling[4]).toBe('E');
    expect(chord?.spelling[8]).toBe('Ab');
  });

  it('spells a rootless-fifth #11 voicing without inventing a Cb', () => {
    const chord = detectChord([65, 71, 76, 81], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('Fmaj7#11(no5)');
    expect(chord?.spelling[11]).toBe('B');
  });

  it('keeps flat-key minor triads spelled with their flat third and fifth', () => {
    const chord = detectChord([68, 71, 75], 'maj', 'slash', true).primary;

    expect(chord?.displayName).toBe('Abm');
    expect(chord?.spelling[8]).toBe('Ab');
    expect(chord?.spelling[11]).toBe('Cb');
    expect(chord?.spelling[3]).toBe('Eb');
  });

  it('keeps sharp-key major triads spelled with sharps', () => {
    const chord = detectChord([61, 65, 68], 'maj', 'slash').primary;

    expect(chord?.spelling[1]).toBe('C#');
    expect(chord?.spelling[5]).toBe('E#');
    expect(chord?.spelling[8]).toBe('G#');
  });

  it('never spells a chord with a double accidental when an enharmonic root avoids it', () => {
    const chord = detectChord([63, 67, 70, 72], 'maj', 'slash', false).primary;

    expect(chord?.displayName).toBe('Eb6');
    expect(Object.values(chord?.spelling ?? {})).toEqual(expect.arrayContaining(['Eb', 'G', 'Bb', 'C']));
  });
});

describe('chord naming hygiene', () => {
  it('never emits an addition that is glued ambiguously onto the root name', () => {
    const chord = detectChord([60, 63, 64, 67], 'maj', 'slash').primary;

    expect(chord?.displayName).toBe('C(#9)');
    expect(chord?.displayName).not.toBe('C#9');
  });

  it('never stacks two parenthesised groups side by side', () => {
    // "Cadd9(6)(no5)" is nobody's notation: additions and omissions belong in one group.
    for (let a = 1; a < 12; a += 1) {
      for (let b = a + 1; b < 12; b += 1) {
        for (let c = b + 1; c < 12; c += 1) {
          for (let d = c + 1; d < 12; d += 1) {
            for (const voicing of [[60, 60 + a, 60 + b, 60 + c], [60, 60 + a, 60 + b, 60 + c, 60 + d]]) {
              const result = detectChord(voicing, 'maj', 'slash');
              const names = [result.primary, ...result.alternatives]
                .map((candidate) => candidate?.displayName ?? '');

              for (const name of names) {
                expect(name, `stacked groups in ${name}`).not.toMatch(/\)\(/);
              }
            }
          }
        }
      }
    }
  });

  it('never silently drops a sounding note from the chord name', () => {
    // Sweep every three- and four-note pitch-class set rooted on C: the name must account for exactly
    // as many tones as are sounding, and the staff spelling must cover every one of them.
    const voicings: number[][] = [];
    for (let a = 1; a < 12; a += 1) {
      for (let b = a + 1; b < 12; b += 1) {
        voicings.push([60, 60 + a, 60 + b]);
        for (let c = b + 1; c < 12; c += 1) {
          voicings.push([60, 60 + a, 60 + b, 60 + c]);
        }
      }
    }

    for (const voicing of voicings) {
      const chord = detectChord(voicing, 'maj', 'slash').primary;
      const sounding = new Set(voicing.map((note) => note % 12));

      if (chord === null) {
        // A handful of chromatic clusters have no template at all; see the coverage test below.
        continue;
      }

      for (const pitchClass of sounding) {
        expect(chord?.spelling[pitchClass], `unspelled pc ${pitchClass} in ${chord?.displayName}`).toBeDefined();
      }

      const namedToneCount = chord!.intervals.length - chord!.omissions.length + chord!.additions.length;
      expect(namedToneCount, `${chord!.displayName} names ${namedToneCount} of ${sounding.size} tones`)
        .toBe(sounding.size);
    }
  });

  it('names every two-note interval and every four-note pitch-class set', () => {
    const unnamed = { two: 0, three: 0, four: 0 };

    for (let a = 1; a < 12; a += 1) {
      if (detectChord([60, 60 + a], 'maj', 'slash').primary === null) unnamed.two += 1;
      for (let b = a + 1; b < 12; b += 1) {
        if (detectChord([60, 60 + a, 60 + b], 'maj', 'slash').primary === null) unnamed.three += 1;
        for (let c = b + 1; c < 12; c += 1) {
          if (detectChord([60, 60 + a, 60 + b, 60 + c], 'maj', 'slash').primary === null) unnamed.four += 1;
        }
      }
    }

    expect(unnamed.two).toBe(0);
    expect(unnamed.four).toBe(0);
    // Known gap: 12 of the 55 three-note pitch-class sets are chromatic clusters with no template
    // (e.g. C-C#-D, C-E-F#). This asserts the gap does not silently grow.
    expect(unnamed.three).toBeLessThanOrEqual(12);
  });

  it('does not return contradictory or duplicated alternatives', () => {
    const result = detectChord([60, 62, 64, 66, 68, 70], 'maj', 'slash');
    const names = [result.primary!.displayName, ...result.alternatives.map((candidate) => candidate.displayName)];

    expect(new Set(names).size).toBe(names.length);
    for (const name of names) {
      expect(name).not.toMatch(/b5.*#5|#5.*b5/);
      expect(name).not.toMatch(/dim.*#5/);
    }
  });

  it('gives at most one interpretation per root', () => {
    const result = detectChord([60, 64, 67, 70, 74], 'maj', 'slash');
    const roots = [result.primary!.root, ...result.alternatives.map((candidate) => candidate.root)];

    expect(new Set(roots).size).toBe(roots.length);
  });
});

describe('inversion display', () => {
  it('labels stacked-third inversions with words', () => {
    expect(detectChord([64, 67, 72], 'maj', 'full').primary?.displayName).toBe('C first inversion');
    expect(detectChord([64, 67, 71, 72], 'maj', 'full').primary?.displayName).toBe('Cmaj7 first inversion');
    expect(detectChord([67, 71, 72, 76], 'maj', 'full').primary?.displayName).toBe('Cmaj7 second inversion');
    expect(detectChord([71, 72, 76, 79], 'maj', 'full').primary?.displayName).toBe('Cmaj7 third inversion');
  });

  it('slash-notates a tension in the bass instead of inventing a high inversion ordinal', () => {
    expect(detectChord([62, 63, 67, 72], 'maj', 'full').primary?.displayName).toBe('Cmadd9/D');
    expect(detectChord([57, 60, 64, 67, 70, 74, 77], 'maj', 'full').primary?.displayName).toBe('C13/A');
  });

  it('never mixes word and numeric inversion styles', () => {
    const chord = detectChord([57, 60, 64, 67, 70, 74, 77], 'maj', 'full').primary;

    expect(chord?.displayName).not.toMatch(/\dth inversion/);
  });
});
