import { NOTE_NAMES_FLAT, NOTE_NAMES_SHARP, midiToPitchClass, pitchClassName, type PitchClass } from './notes';

export type ChordNameStyle = 'maj' | 'capitalM' | 'delta';
export type InversionMode = 'root-only' | 'slash' | 'full';

export type ChordTemplate = {
  id: string;
  suffix: string;
  fullName: string;
  intervals: number[];
  priority: number;
  allowOmitFifth?: boolean;
};

export type ChordCandidate = {
  root: PitchClass;
  bass?: PitchClass;
  suffix: string;
  fullName: string;
  intervals: number[];
  omissions: string[];
  additions: string[];
  score: number;
  displayName: string;
  spelling: Record<number, string>;
};

export type ChordResult = {
  primary: ChordCandidate | null;
  alternatives: ChordCandidate[];
};

const TEMPLATES: ChordTemplate[] = [
  { id: '13', suffix: '13', fullName: 'dominant thirteenth', intervals: [0, 4, 7, 10, 2, 5, 9], priority: 72, allowOmitFifth: true },
  { id: 'maj13', suffix: 'maj13', fullName: 'major thirteenth', intervals: [0, 4, 7, 11, 2, 5, 9], priority: 72, allowOmitFifth: true },
  { id: 'm13', suffix: 'm13', fullName: 'minor thirteenth', intervals: [0, 3, 7, 10, 2, 5, 9], priority: 72, allowOmitFifth: true },
  { id: '11', suffix: '11', fullName: 'dominant eleventh', intervals: [0, 4, 7, 10, 2, 5], priority: 64, allowOmitFifth: true },
  { id: 'maj11', suffix: 'maj11', fullName: 'major eleventh', intervals: [0, 4, 7, 11, 2, 5], priority: 64, allowOmitFifth: true },
  { id: 'm11', suffix: 'm11', fullName: 'minor eleventh', intervals: [0, 3, 7, 10, 2, 5], priority: 64, allowOmitFifth: true },
  { id: '9', suffix: '9', fullName: 'dominant ninth', intervals: [0, 4, 7, 10, 2], priority: 56, allowOmitFifth: true },
  { id: 'maj9', suffix: 'maj9', fullName: 'major ninth', intervals: [0, 4, 7, 11, 2], priority: 56, allowOmitFifth: true },
  { id: 'm9', suffix: 'm9', fullName: 'minor ninth', intervals: [0, 3, 7, 10, 2], priority: 56, allowOmitFifth: true },
  { id: '7b9', suffix: '7b9', fullName: 'dominant flat ninth', intervals: [0, 4, 7, 10, 1], priority: 55, allowOmitFifth: true },
  { id: '7#9', suffix: '7#9', fullName: 'dominant sharp ninth', intervals: [0, 4, 7, 10, 3], priority: 55, allowOmitFifth: true },
  { id: '7#11', suffix: '7#11', fullName: 'dominant sharp eleventh', intervals: [0, 4, 7, 10, 6], priority: 55, allowOmitFifth: true },
  { id: '7b13', suffix: '7b13', fullName: 'dominant flat thirteenth', intervals: [0, 4, 7, 10, 8], priority: 55, allowOmitFifth: true },
  { id: '9sus4', suffix: '9sus4', fullName: 'dominant ninth suspended fourth', intervals: [0, 5, 7, 10, 2], priority: 54, allowOmitFifth: true },
  { id: '7b5', suffix: '7b5', fullName: 'dominant flat fifth', intervals: [0, 4, 6, 10], priority: 49 },
  { id: '7#5', suffix: '7#5', fullName: 'dominant sharp fifth', intervals: [0, 4, 8, 10], priority: 49 },
  { id: 'maj7#5', suffix: 'maj7#5', fullName: 'major seventh sharp fifth', intervals: [0, 4, 8, 11], priority: 49 },
  { id: 'mMaj7', suffix: 'mMaj7', fullName: 'minor-major seventh', intervals: [0, 3, 7, 11], priority: 48, allowOmitFifth: true },
  { id: 'maj7', suffix: 'maj7', fullName: 'major seventh', intervals: [0, 4, 7, 11], priority: 47, allowOmitFifth: true },
  { id: '7', suffix: '7', fullName: 'dominant seventh', intervals: [0, 4, 7, 10], priority: 47, allowOmitFifth: true },
  { id: 'm7', suffix: 'm7', fullName: 'minor seventh', intervals: [0, 3, 7, 10], priority: 47, allowOmitFifth: true },
  { id: 'm7b5', suffix: 'm7b5', fullName: 'half-diminished seventh', intervals: [0, 3, 6, 10], priority: 47 },
  { id: 'dim7', suffix: 'dim7', fullName: 'diminished seventh', intervals: [0, 3, 6, 9], priority: 47 },
  { id: 'dimMaj7', suffix: 'dimMaj7', fullName: 'diminished major seventh', intervals: [0, 3, 6, 11], priority: 46 },
  { id: '7sus4', suffix: '7sus4', fullName: 'dominant seventh suspended fourth', intervals: [0, 5, 7, 10], priority: 46 },
  // `6`/`m6` deliberately do NOT allow an omitted fifth: a sixth chord minus its fifth is note-for-note
  // a minor/diminished triad, so allowing the omission made `[C E A]` indistinguishable from `Am/C`.
  { id: '6', suffix: '6', fullName: 'major sixth', intervals: [0, 4, 7, 9], priority: 42 },
  { id: 'm6', suffix: 'm6', fullName: 'minor sixth', intervals: [0, 3, 7, 9], priority: 42 },
  { id: 'add9', suffix: 'add9', fullName: 'added ninth', intervals: [0, 4, 7, 2], priority: 39, allowOmitFifth: true },
  { id: 'madd9', suffix: 'madd9', fullName: 'minor added ninth', intervals: [0, 3, 7, 2], priority: 39, allowOmitFifth: true },
  { id: 'add11', suffix: 'add11', fullName: 'added eleventh', intervals: [0, 4, 7, 5], priority: 37, allowOmitFifth: true },
  // No `add13` template: an added 13th is enharmonically a major 6th, so the `6` template above already
  // covers that voicing. A separate add13 entry would only ever surface as a redundant duplicate alternative.
  { id: 'maj', suffix: '', fullName: 'major', intervals: [0, 4, 7], priority: 30 },
  { id: 'm', suffix: 'm', fullName: 'minor', intervals: [0, 3, 7], priority: 30 },
  { id: 'dim', suffix: 'dim', fullName: 'diminished', intervals: [0, 3, 6], priority: 30 },
  { id: 'aug', suffix: 'aug', fullName: 'augmented', intervals: [0, 4, 8], priority: 30 },
  { id: 'sus4', suffix: 'sus4', fullName: 'suspended fourth', intervals: [0, 5, 7], priority: 28 },
  { id: 'sus2', suffix: 'sus2', fullName: 'suspended second', intervals: [0, 2, 7], priority: 28 },
  { id: '5', suffix: '5', fullName: 'power chord', intervals: [0, 7], priority: 18 },
];

const ORDINALS = [
  'root position',
  'first inversion',
  'second inversion',
  'third inversion',
  'fourth inversion',
  'fifth inversion',
  'sixth inversion',
];
const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

/** Scoring weights. An omission is cheaper than an addition: a missing fifth is idiomatic, a note the
 * name does not mention is not. Contradictions (two thirds, two fifths, two sevenths) cost more still. */
const OMISSION_COST = 11;
const ADDITION_COST = 14;
const CONTRADICTION_COST = 12;
const ROOT_BASS_BONUS = 8;
const MATCHED_TONE_BONUS = 3;
/** Alternatives more than this far below the primary are noise, not interpretations. */
const ALTERNATIVE_WINDOW = 20;

/** Compact interval names for two-note voicings, which no chord template can describe honestly. */
const DYAD_INTERVALS: Record<number, { label: string; fullName: string; degree: number }> = {
  1: { label: 'm2', fullName: 'minor second', degree: 1 },
  2: { label: 'M2', fullName: 'major second', degree: 1 },
  3: { label: 'm3', fullName: 'minor third', degree: 2 },
  4: { label: 'M3', fullName: 'major third', degree: 2 },
  5: { label: 'P4', fullName: 'perfect fourth', degree: 3 },
  6: { label: 'TT', fullName: 'tritone', degree: 3 },
  7: { label: '5', fullName: 'power chord', degree: 4 },
  8: { label: 'm6', fullName: 'minor sixth', degree: 5 },
  9: { label: 'M6', fullName: 'major sixth', degree: 5 },
  10: { label: 'm7', fullName: 'minor seventh', degree: 6 },
  11: { label: 'M7', fullName: 'major seventh', degree: 6 },
};

/** Scale degree (0-based, 0 = root) implied by each addition label, so an added note is spelled with the
 * letter its NAME claims: a `#11` must be an F#, never a Gb, even when the template suffix says nothing. */
const ADDITION_DEGREES: Record<string, number> = {
  b9: 1,
  add9: 1,
  '#9': 1,
  addb3: 2,
  add3: 2,
  add11: 3,
  '#11': 3,
  b5: 4,
  add5: 4,
  '#5': 4,
  b13: 5,
  '6': 5,
  add13: 5,
  addb7: 6,
  addmaj7: 6,
};

export function detectChord(activeMidiNotes: number[], style: ChordNameStyle, inversionMode: InversionMode, preferFlats = false): ChordResult {
  const uniquePitchClasses = Array.from(new Set(activeMidiNotes.map(midiToPitchClass))).sort((a, b) => a - b);

  if (uniquePitchClasses.length === 0) {
    return { primary: null, alternatives: [] };
  }

  if (uniquePitchClasses.length === 1) {
    const root = uniquePitchClasses[0];
    const displayName = pitchClassName(root, preferFlats);
    return {
      primary: {
        root,
        bass: root,
        suffix: '',
        fullName: 'single note',
        intervals: [0],
        omissions: [],
        additions: [],
        score: 1,
        displayName,
        spelling: { [root]: displayName },
      },
      alternatives: [],
    };
  }

  const bass = midiToPitchClass(Math.min(...activeMidiNotes));

  if (uniquePitchClasses.length === 2) {
    return { primary: describeDyad(uniquePitchClasses, bass, preferFlats), alternatives: [] };
  }

  const candidates = uniquePitchClasses.flatMap((root) => {
    const intervals = uniquePitchClasses.map((pc) => normalizedInterval(pc - root));
    const intervalSet = new Set(intervals);

    return TEMPLATES.flatMap((template) => {
      const missing = template.intervals.filter((interval) => !intervalSet.has(interval));
      const missingAllowed = missing.every((interval) => interval === 7 && template.allowOmitFifth);

      if (missing.length > 0 && !missingAllowed) {
        return [];
      }

      // Extras are sorted so two spellings of the same chord can never differ only in addition order.
      const extras = intervals.filter((interval) => !template.intervals.includes(interval)).sort((a, b) => a - b);
      const additions = extras.map((interval) => describeExtraInterval(interval, template));
      const omissions = missing.map((interval) => describeOmission(interval));
      const contradictions = extras.filter((interval) => contradictsTemplate(interval, template)).length;
      const matchedTones = template.intervals.length - missing.length;
      const exactness = 100
        - missing.length * OMISSION_COST
        - additions.length * ADDITION_COST
        - contradictions * CONTRADICTION_COST;
      const rootBassBonus = bass === root ? ROOT_BASS_BONUS : 0;
      // Count the tones actually SOUNDING, not the template's slot count: a three-note sound must not be
      // credited for a fourth tone it omits.
      const completeToneBonus = matchedTones * MATCHED_TONE_BONUS;
      const score = exactness + template.priority + rootBassBonus + completeToneBonus;

      const sounding = [
        ...template.intervals.filter((interval) => !missing.includes(interval)),
        ...extras,
      ];
      const degrees = new Map<number, number>();
      for (const interval of template.intervals) {
        degrees.set(interval, degreeForInterval(interval, template));
      }
      extras.forEach((interval, index) => {
        degrees.set(interval, ADDITION_DEGREES[additions[index]] ?? degreeForInterval(interval, template));
      });

      const rootName = chooseRootName(root, sounding, degrees, template, preferFlats);
      const spelling = buildSpelling(root, rootName, sounding, degrees);
      const displayName = formatChordName({
        rootName,
        bassName: bassNameFor(bass, spelling, preferFlats),
        root,
        bass,
        suffix: template.suffix,
        intervals: template.intervals,
        template,
        omissions,
        additions,
        style,
        inversionMode,
      });

      return [{
        root,
        bass,
        suffix: template.suffix,
        fullName: template.fullName,
        intervals: template.intervals,
        omissions,
        additions,
        score,
        displayName,
        spelling,
      }];
    });
  });

  const deduped = dedupeCandidates(candidates.sort(compareCandidates));
  const primary = deduped[0] ?? null;
  const alternatives = primary === null
    ? []
    : deduped.slice(1, 5).filter((candidate) => candidate.score >= primary.score - ALTERNATIVE_WINDOW);

  return { primary, alternatives };
}

function compareCandidates(a: ChordCandidate, b: ChordCandidate): number {
  if (a.score !== b.score) {
    return b.score - a.score;
  }

  const aRooted = a.root === a.bass ? 1 : 0;
  const bRooted = b.root === b.bass ? 1 : 0;
  if (aRooted !== bRooted) {
    return bRooted - aRooted;
  }

  const aDecoration = a.additions.length + a.omissions.length;
  const bDecoration = b.additions.length + b.omissions.length;
  if (aDecoration !== bDecoration) {
    return aDecoration - bDecoration;
  }

  // Prefer the plainer label on a genuine tie; ties are broken deterministically by name.
  if (a.displayName.length !== b.displayName.length) {
    return a.displayName.length - b.displayName.length;
  }

  return a.displayName.localeCompare(b.displayName);
}

function dedupeCandidates(candidates: ChordCandidate[]): ChordCandidate[] {
  const seen = new Set<string>();
  const result: ChordCandidate[] = [];

  for (const candidate of candidates) {
    // Every candidate resolves to the same sounding pitch-class set (template minus omissions plus
    // extras IS the input), so the resolved set plus the root reduces to the root: two labels for the
    // same root are the same chord wearing two hats (`C9(no5)` vs `C7(no5)add9`, `C7b5add9#5` vs
    // `C7#5add9b5`). Candidates arrive pre-sorted, so the best-scoring label per root survives.
    const key = `${candidate.root}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(candidate);
  }

  return result;
}

function normalizedInterval(interval: number): number {
  return ((interval % 12) + 12) % 12;
}

function describeDyad(pitchClasses: PitchClass[], bass: PitchClass, preferFlats: boolean): ChordCandidate {
  const other = pitchClasses.find((pc) => pc !== bass) ?? pitchClasses[0];
  const interval = normalizedInterval(other - bass);
  const descriptor = DYAD_INTERVALS[interval];
  const rootName = pitchClassName(bass, preferFlats);
  const degrees = new Map<number, number>([[0, 0], [interval, descriptor.degree]]);
  const spelling = buildSpelling(bass, rootName, [0, interval], degrees);

  // The perfect fifth keeps its idiomatic power-chord label; every other dyad is named as an interval
  // above the bass, so a fourth reads as `C P4` rather than an inverted `F5/C`.
  const displayName = interval === 7 ? `${rootName}5` : `${rootName} ${descriptor.label}`;

  return {
    root: bass,
    bass,
    suffix: interval === 7 ? '5' : descriptor.label,
    fullName: descriptor.fullName,
    intervals: [0, interval],
    omissions: [],
    additions: [],
    score: 100,
    displayName,
    spelling,
  };
}

/** The slash bass follows the chord's own spelling so the name matches the staff (`Cm7/Eb`, not
 * `Cm7/D#`), except where that spelling is a double accidental - `Cdim7/A` reads better than
 * `Cdim7/Bbb` even though the staff draws the doubly flatted seventh. */
function bassNameFor(bass: PitchClass, spelling: Record<number, string>, preferFlats: boolean): string {
  const spelled = spelling[bass];

  if (spelled === undefined || spelled.endsWith('##') || spelled.endsWith('bb')) {
    return pitchClassName(bass, preferFlats);
  }

  return spelled;
}

function formatChordName(input: {
  rootName: string;
  bassName: string;
  root: PitchClass;
  bass: PitchClass;
  suffix: string;
  intervals: number[];
  template: ChordTemplate;
  omissions: string[];
  additions: string[];
  style: ChordNameStyle;
  inversionMode: InversionMode;
}): string {
  const suffix = applyNameStyle(input.suffix, input.style);
  const additions = formatAdditions(input.additions.map((addition) => applyNameStyle(addition, input.style)), suffix);
  const omissions = input.omissions.length > 0 ? `(${input.omissions.join(',')})` : '';
  const base = `${input.rootName}${suffix}${additions}${omissions}`;

  if (input.inversionMode === 'root-only' || input.bass === input.root) {
    return base;
  }

  if (input.inversionMode === 'slash') {
    return `${base}/${input.bassName}`;
  }

  const bassInterval = normalizedInterval(input.bass - input.root);
  // Only stacked-third chord tones (3rd, 5th, 7th) bear an inversion ordinal. A 9th/11th/13th in the
  // bass is a tension, not an inversion, so it stays slash-notated instead of inventing a high ordinal.
  const chordToneOrder = input.intervals.filter(
    (interval) => interval !== 0 && isStackedThirdDegree(interval, input.template),
  );
  const inversionIndex = inversionOrdinalIndex(bassInterval, chordToneOrder);

  // A bass that is not actually a chord tone (e.g. an added-tension note in the bass) has no
  // meaningful inversion ordinal, so fall back to slash notation instead of mislabeling it.
  if (inversionIndex === null || inversionIndex >= ORDINALS.length) {
    return `${base}/${input.bassName}`;
  }

  return `${base} ${ORDINALS[inversionIndex]}`;
}

/** Additions are parenthesised whenever bare concatenation would read as a different chord: `C` + `#9`
 * must never render as `C#9` (a chord on C sharp), and `Gadd11` + `6` must never render as `Gadd116`. */
function formatAdditions(additions: string[], suffix: string): string {
  if (additions.length === 0) {
    return '';
  }

  const ambiguous = additions.length > 1
    || suffix === ''
    || additions.some((addition) => /^\d/.test(addition));

  return ambiguous ? `(${additions.join(',')})` : additions[0];
}

function isStackedThirdDegree(interval: number, template: ChordTemplate): boolean {
  const degree = degreeForInterval(interval, template);
  return degree === 2 || degree === 4 || degree === 6;
}

export function inversionOrdinalIndex(bassInterval: number, chordToneIntervals: number[]): number | null {
  const position = chordToneIntervals.findIndex((interval) => interval === bassInterval);
  return position === -1 ? null : position + 1;
}

// Ordered rewrites for the jazz lead-sheet symbol style. Order is load-bearing: `m7b5` must be
// consumed before anything else can chew on its `m`/`b5`, and `dim7` before the bare `dim` (so
// `dim7` does not become `°7` via two passes, and `dimMaj7` still reaches `°Δ7`).
//
// A half-diminished seventh is the slashed circle rather than `m7b5`, and the `7` is written: `Cø7`.
// Minor deliberately stays `m` rather than becoming the minus sign `−`. Charts using Δ often pair it
// with `C−7`, but the minus is easy to misread as a hyphen or a flat at a glance, and `Cm7` is
// unambiguous in every vocabulary. Change SYMBOL_REWRITES if you want the minus.
const SYMBOL_REWRITES: [RegExp, string][] = [
  [/m7b5/g, 'ø7'],
  [/dim7/g, '°7'],
  [/dim/g, '°'],
  [/aug/g, '+'],
  [/maj/gi, 'Δ'],
];

/**
 * Render a suffix in the user's chosen vocabulary. The two text styles differ only in how a major
 * seventh is spelled; the symbol style is a whole vocabulary, so it must rewrite the diminished,
 * half-diminished and augmented qualities too. Leaving those spelled out produced names that mixed
 * both vocabularies at once, e.g. "CdimΔ7".
 */
function applyNameStyle(suffix: string, style: ChordNameStyle): string {
  if (style === 'capitalM') {
    return suffix.replaceAll('maj', 'M').replaceAll('Maj', 'M');
  }

  if (style === 'delta') {
    return SYMBOL_REWRITES.reduce((text, [pattern, symbol]) => text.replace(pattern, symbol), suffix);
  }

  return suffix;
}

function describeOmission(interval: number): string {
  if (interval === 7) {
    return 'no5';
  }

  return `no${interval}`;
}

/** Every extra note gets a label. Returning `''` here used to let a sounding note vanish from the name
 * while still being drawn on the staff, and cost the candidate nothing in the ranking. */
function describeExtraInterval(interval: number, template: ChordTemplate): string {
  const has = (value: number) => template.intervals.includes(value);
  const hasSeventh = has(10) || has(11);

  if (interval === 1) return 'b9';
  if (interval === 2) return 'add9';
  if (interval === 3) return has(4) ? '#9' : 'addb3';
  if (interval === 4) return 'add3';
  if (interval === 5) return 'add11';
  // Over a template that already asserts some fifth, a 6-semitone extra is a raised eleventh; only a
  // template with no fifth at all can call it a flat fifth.
  if (interval === 6) return has(7) || has(8) ? '#11' : 'b5';
  if (interval === 7) return 'add5';
  // Likewise `#5` would contradict a template that already spells a diminished or perfect fifth.
  if (interval === 8) return has(7) || has(6) ? 'b13' : '#5';
  // An added 6th over a seventh chord is a 13; over a plain triad it is just a 6 (which collapses
  // onto the dedicated `6`/`m6` templates and avoids a redundant "add13" twin in the alternatives).
  if (interval === 9) return hasSeventh ? 'add13' : '6';
  if (interval === 10) return 'addb7';
  if (interval === 11) return 'addmaj7';
  return `add${interval}`;
}

/** True when the extra note directly contradicts a quality the template already asserts. */
function contradictsTemplate(interval: number, template: ChordTemplate): boolean {
  const has = (value: number) => template.intervals.includes(value);

  if (interval === 4 && has(3)) return true;
  if (interval === 7 && (has(6) || has(8))) return true;
  if (interval === 10 && has(11)) return true;
  if (interval === 11 && has(10)) return true;

  return false;
}

/** Pick the root spelling that avoids double accidentals. Spelling stays a binary sharp/flat preference
 * (see AGENTS.md); this only overrides it when honouring it would force an `F##` or a `Dbb` chord tone. */
function chooseRootName(
  root: PitchClass,
  intervals: number[],
  degrees: Map<number, number>,
  template: ChordTemplate,
  preferFlats: boolean,
): string {
  const preferred = pitchClassName(root, preferFlats);

  // Symmetric chords cannot avoid double accidentals from every root (Cdim7 = C Eb Gb Bbb, G#aug =
  // G# B# D##). Those spellings are correct rather than broken, so they keep the requested preference.
  if (template.id === 'dim7' || template.id === 'aug') {
    return preferred;
  }

  const alternative = preferFlats ? NOTE_NAMES_SHARP[root] : NOTE_NAMES_FLAT[root];
  if (alternative === preferred) {
    return preferred;
  }

  const preferredDoubles = countDoubleAccidentals(root, preferred, intervals, degrees);
  if (preferredDoubles === 0) {
    return preferred;
  }

  return countDoubleAccidentals(root, alternative, intervals, degrees) < preferredDoubles ? alternative : preferred;
}

function countDoubleAccidentals(
  root: PitchClass,
  rootName: string,
  intervals: number[],
  degrees: Map<number, number>,
): number {
  const spelling = buildSpelling(root, rootName, intervals, degrees);
  return Object.values(spelling).filter((name) => name.endsWith('##') || name.endsWith('bb')).length;
}

function buildSpelling(
  root: PitchClass,
  rootName: string,
  intervals: number[],
  degrees: Map<number, number>,
): Record<number, string> {
  const spelling: Record<number, string> = {};
  const rootLetterIndex = LETTERS.indexOf(rootName[0]);

  for (const interval of intervals) {
    const targetPc = normalizedInterval(root + interval);
    const degreeOffset = degrees.get(interval) ?? 0;
    const letter = LETTERS[(rootLetterIndex + degreeOffset) % LETTERS.length];
    const naturalPc = LETTER_TO_PC[letter];
    const accidental = accidentalFor(normalizedInterval(targetPc - naturalPc));
    spelling[targetPc] = `${letter}${accidental}`;
  }

  return spelling;
}

function degreeForInterval(interval: number, template: ChordTemplate): number {
  if (interval === 0) return 0;
  if (interval === 1 || interval === 2) return 1;
  if (interval === 3 && template.suffix.includes('#9')) return 1;
  if (interval === 3 || interval === 4) return 2;
  if (interval === 5) return 3;
  if (interval === 6 && template.suffix.includes('#11')) return 3;
  if (interval === 6 || interval === 7 || (interval === 8 && !template.suffix.includes('b13'))) return 4;
  // In a diminished seventh the 9-semitone interval is a diminished 7th (7th degree, e.g. Bbb in Cdim7),
  // not a major 6th, so it must spell up a seventh rather than a sixth.
  if (interval === 9 && template.suffix.includes('dim7')) return 6;
  if (interval === 8 || interval === 9) return 5;
  return 6;
}

function accidentalFor(diff: number): string {
  if (diff === 0) return '';
  if (diff === 1) return '#';
  if (diff === 2) return '##';
  if (diff === 10) return 'bb';
  if (diff === 11) return 'b';
  return '';
}
