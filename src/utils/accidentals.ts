const GLYPHS: Record<string, string> = {
  bb: '♭♭',
  '##': '♯♯',
  b: '♭',
  '#': '♯',
};

/**
 * Rewrite ASCII accidentals to their engraved glyphs for DISPLAY ONLY: `Bb` -> `B♭`, `C7(b9,#11)` ->
 * `C7(♭9,♯11)`.
 *
 * This is strictly a presentation layer. The ASCII forms are load-bearing everywhere else and must
 * not be touched:
 *   - `StaffNotation` parses a spelling with /^([A-G])([b#]{0,2})$/ and hands the accidental to
 *     VexFlow, which only understands `b`/`#`/`bb`/`##`.
 *   - `chords.ts` string-matches ASCII throughout (SYMBOL_REWRITES, degreeForInterval's
 *     `suffix.includes('#9')`, ADDITION_DEGREES keys, the double-accidental guards).
 *   - `SpellingKey` values ('Bb', 'F#') are persisted settings.
 * So call this at the point of render and nowhere else.
 *
 * Doubled single glyphs (♭♭) rather than U+1D12B/U+1D12A, whose font coverage is unreliable.
 */
export function toAccidentalGlyphs(text: string): string {
  return text
    // A root/bass accidental: a note letter followed by one or two accidentals (`Bb`, `F##`, `Bbb`).
    // Restricted to uppercase A-G so it cannot fire inside `add`, `sus`, `dim`, `aug` or `alt`.
    .replace(/([A-G])(bb|##|b|#)/g, (_match, letter: string, accidental: string) => letter + GLYPHS[accidental])
    // An altered degree: an accidental immediately before its number (`b9`, `#11`, `addb7`).
    .replace(/(bb|##|b|#)(?=\d)/g, (accidental) => GLYPHS[accidental]);
}
