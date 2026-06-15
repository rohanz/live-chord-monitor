import { midiToPitchClass, pitchClassName, type PitchClass } from './notes';

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
  { id: '7b5', suffix: '7b5', fullName: 'dominant flat fifth', intervals: [0, 4, 6, 10], priority: 49 },
  { id: '7#5', suffix: '7#5', fullName: 'dominant sharp fifth', intervals: [0, 4, 8, 10], priority: 49 },
  { id: 'maj7#5', suffix: 'maj7#5', fullName: 'major seventh sharp fifth', intervals: [0, 4, 8, 11], priority: 49 },
  { id: 'mMaj7', suffix: 'mMaj7', fullName: 'minor-major seventh', intervals: [0, 3, 7, 11], priority: 48, allowOmitFifth: true },
  { id: 'maj7', suffix: 'maj7', fullName: 'major seventh', intervals: [0, 4, 7, 11], priority: 47, allowOmitFifth: true },
  { id: '7', suffix: '7', fullName: 'dominant seventh', intervals: [0, 4, 7, 10], priority: 47, allowOmitFifth: true },
  { id: 'm7', suffix: 'm7', fullName: 'minor seventh', intervals: [0, 3, 7, 10], priority: 47, allowOmitFifth: true },
  { id: 'm7b5', suffix: 'm7b5', fullName: 'half-diminished seventh', intervals: [0, 3, 6, 10], priority: 47 },
  { id: 'dim7', suffix: 'dim7', fullName: 'diminished seventh', intervals: [0, 3, 6, 9], priority: 47 },
  { id: '6', suffix: '6', fullName: 'major sixth', intervals: [0, 4, 7, 9], priority: 42, allowOmitFifth: true },
  { id: 'm6', suffix: 'm6', fullName: 'minor sixth', intervals: [0, 3, 7, 9], priority: 42, allowOmitFifth: true },
  { id: 'add9', suffix: 'add9', fullName: 'added ninth', intervals: [0, 4, 7, 2], priority: 39, allowOmitFifth: true },
  { id: 'madd9', suffix: 'madd9', fullName: 'minor added ninth', intervals: [0, 3, 7, 2], priority: 39, allowOmitFifth: true },
  { id: 'add11', suffix: 'add11', fullName: 'added eleventh', intervals: [0, 4, 7, 5], priority: 37, allowOmitFifth: true },
  { id: 'add13', suffix: 'add13', fullName: 'added thirteenth', intervals: [0, 4, 7, 9], priority: 37, allowOmitFifth: true },
  { id: 'maj', suffix: '', fullName: 'major', intervals: [0, 4, 7], priority: 30 },
  { id: 'm', suffix: 'm', fullName: 'minor', intervals: [0, 3, 7], priority: 30 },
  { id: 'dim', suffix: 'dim', fullName: 'diminished', intervals: [0, 3, 6], priority: 30 },
  { id: 'aug', suffix: 'aug', fullName: 'augmented', intervals: [0, 4, 8], priority: 30 },
  { id: 'sus4', suffix: 'sus4', fullName: 'suspended fourth', intervals: [0, 5, 7], priority: 28 },
  { id: 'sus2', suffix: 'sus2', fullName: 'suspended second', intervals: [0, 2, 7], priority: 28 },
  { id: '5', suffix: '5', fullName: 'power chord', intervals: [0, 7], priority: 18 },
];

const ORDINALS = ['root position', 'first inversion', 'second inversion', 'third inversion', 'fourth inversion'];
const LETTER_TO_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];

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
  const candidates = uniquePitchClasses.flatMap((root) => {
    const intervals = uniquePitchClasses.map((pc) => normalizedInterval(pc - root));
    const intervalSet = new Set(intervals);

    return TEMPLATES.flatMap((template) => {
      const missing = template.intervals.filter((interval) => !intervalSet.has(interval));
      const missingAllowed = missing.every((interval) => interval === 7 && template.allowOmitFifth);

      if (missing.length > 0 && !missingAllowed) {
        return [];
      }

      if (!intervalSet.has(0)) {
        return [];
      }

      const extras = intervals.filter((interval) => !template.intervals.includes(interval));
      const additions = extras.map((interval) => describeExtraInterval(interval, template)).filter(Boolean);
      const omissions = missing.map((interval) => describeOmission(interval)).filter(Boolean);
      const exactness = 100 - missing.length * 11 - additions.length * 7;
      const rootBassBonus = bass === root ? 8 : 0;
      const completeToneBonus = template.intervals.length * 3;
      const score = exactness + template.priority + rootBassBonus + completeToneBonus;
      const spelling = buildSpelling(root, [...template.intervals, ...extras], template, preferFlats);
      const displayName = formatChordName({
        root,
        bass,
        suffix: template.suffix,
        intervals: template.intervals,
        omissions,
        additions,
        style,
        inversionMode,
        preferFlats,
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

  const deduped = dedupeCandidates(candidates).sort((a, b) => b.score - a.score || b.displayName.length - a.displayName.length);

  return {
    primary: deduped[0] ?? null,
    alternatives: deduped.slice(1, 5),
  };
}

function dedupeCandidates(candidates: ChordCandidate[]): ChordCandidate[] {
  const seen = new Set<string>();
  const result: ChordCandidate[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.displayName)) {
      continue;
    }

    seen.add(candidate.displayName);
    result.push(candidate);
  }

  return result;
}

function normalizedInterval(interval: number): number {
  return ((interval % 12) + 12) % 12;
}

function formatChordName(input: {
  root: PitchClass;
  bass: PitchClass;
  suffix: string;
  intervals: number[];
  omissions: string[];
  additions: string[];
  style: ChordNameStyle;
  inversionMode: InversionMode;
  preferFlats: boolean;
}): string {
  const rootName = pitchClassName(input.root, input.preferFlats);
  const suffix = applyNameStyle(input.suffix, input.style);
  const additions = input.additions.length > 0 ? input.additions.join('') : '';
  const omissions = input.omissions.length > 0 ? `(${input.omissions.join(',')})` : '';
  const base = `${rootName}${suffix}${additions}${omissions}`;

  if (input.inversionMode === 'root-only' || input.bass === input.root) {
    return base;
  }

  if (input.inversionMode === 'slash') {
    return `${base}/${pitchClassName(input.bass, input.preferFlats)}`;
  }

  const bassInterval = normalizedInterval(input.bass - input.root);
  const chordToneOrder = input.intervals.filter((interval) => interval !== 0);
  const inversionIndex = Math.max(1, chordToneOrder.findIndex((interval) => interval === bassInterval) + 1);
  const ordinal = ORDINALS[inversionIndex] ?? `${inversionIndex}th inversion`;
  return `${base} ${ordinal}`;
}

function applyNameStyle(suffix: string, style: ChordNameStyle): string {
  if (style === 'capitalM') {
    return suffix.replaceAll('maj', 'M').replaceAll('Maj', 'M');
  }

  if (style === 'delta') {
    return suffix.replaceAll('maj', 'Δ').replaceAll('Maj', 'Δ');
  }

  return suffix;
}

function describeOmission(interval: number): string {
  if (interval === 7) {
    return 'no5';
  }

  return `no${interval}`;
}

function describeExtraInterval(interval: number, template: ChordTemplate): string {
  if (interval === 1) return 'b9';
  if (interval === 2) return 'add9';
  if (interval === 3 && template.intervals.includes(4)) return '#9';
  if (interval === 5) return 'add11';
  if (interval === 6 && template.intervals.includes(7)) return '#11';
  if (interval === 6) return 'b5';
  if (interval === 8 && template.intervals.includes(7)) return 'b13';
  if (interval === 8) return '#5';
  if (interval === 9) return 'add13';
  if (interval === 10) return 'addb7';
  if (interval === 11) return 'addmaj7';
  return '';
}

function buildSpelling(root: PitchClass, intervals: number[], template: ChordTemplate, preferFlats: boolean): Record<number, string> {
  const spelling: Record<number, string> = {};
  const rootName = pitchClassName(root, preferFlats);
  const rootLetterIndex = LETTERS.indexOf(rootName[0]);

  for (const interval of intervals) {
    const targetPc = normalizedInterval(root + interval);
    const degreeOffset = degreeForInterval(interval, template);
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
  if (interval === 6 || interval === 7 || interval === 8 && !template.suffix.includes('b13')) return 4;
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
