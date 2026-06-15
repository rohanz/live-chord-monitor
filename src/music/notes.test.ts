import { describe, expect, it } from 'vitest';
import { COMPUTER_KEY_OFFSETS, clampMidiStart, midiToOctave, midiToPitchClass, midiNoteName } from './notes';

describe('notes', () => {
  it('uses scientific pitch notation where C4 is middle C', () => {
    expect(midiNoteName(60)).toBe('C4');
    expect(midiToOctave(60)).toBe(4);
    expect(midiToPitchClass(60)).toBe(0);
  });

  it('maps the computer keyboard from C through D', () => {
    expect(COMPUTER_KEY_OFFSETS.KeyA).toBe(0);
    expect(COMPUTER_KEY_OFFSETS.KeyW).toBe(1);
    expect(COMPUTER_KEY_OFFSETS.KeyK).toBe(12);
    expect(COMPUTER_KEY_OFFSETS.KeyO).toBe(13);
    expect(COMPUTER_KEY_OFFSETS.KeyL).toBe(14);
  });

  it('clamps visible ranges to the playable piano area', () => {
    expect(clampMidiStart(0, 36)).toBe(24);
    expect(clampMidiStart(96, 36)).toBe(72);
    expect(clampMidiStart(48, 36)).toBe(48);
  });
});
