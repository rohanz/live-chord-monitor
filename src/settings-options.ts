import type { ChordNameStyle, InversionMode } from './music/chords';
import { SPELLING_KEYS, type SpellingKey } from './music/notes';

/**
 * Single source of truth for the legal values of every persisted setting.
 *
 * These arrays back both the `<option>` lists rendered in the settings drawer and the validators
 * applied to values restored from localStorage, so the UI can never offer a value the validator
 * rejects (or silently accept one it does not offer).
 */
export const NAME_STYLES: readonly ChordNameStyle[] = ['maj', 'capitalM', 'delta'];
export const INVERSION_MODES: readonly InversionMode[] = ['root-only', 'slash', 'full'];
export const SPELLING_KEY_OPTIONS: readonly SpellingKey[] = SPELLING_KEYS;

export const LINGER_OPTIONS: readonly number[] = [0, 250, 500, 750, 1000];
export const LINGER_LABELS: Record<number, string> = {
  0: 'Off',
  250: '0.25s',
  500: '0.5s',
  750: '0.75s',
  1000: '1s',
};

export const MIN_VOLUME = 0;
export const MAX_VOLUME = 1;
