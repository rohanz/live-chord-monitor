import { describe, expect, it } from 'vitest';
import { isControlPortName } from './midiPorts';

describe('isControlPortName', () => {
  it('flags known DAW-control ports that emit fake note-ons', () => {
    // Real capture: the Launchkey MK2 InControl port sends note-on ch16 note 12
    // (a low C) as part of its handshake, which is not a musical note.
    expect(isControlPortName('Launchkey MK2 25 Launchkey InControl')).toBe(true);
    expect(isControlPortName('Launchkey Mini InControl')).toBe(true);
    expect(isControlPortName('MPK249 DAW')).toBe(true);
    expect(isControlPortName('Some Controller HUI')).toBe(true);
  });

  it('keeps ordinary keyboard ports', () => {
    expect(isControlPortName('Launchkey MK2 25 Launchkey MIDI')).toBe(false);
    expect(isControlPortName('KeyLab Essential 61')).toBe(false);
    expect(isControlPortName('Roland Digital Piano')).toBe(false);
    // Substrings inside words must not match ("hui"/"daw" as fragments).
    expect(isControlPortName('Dawson Keys')).toBe(false);
    expect(isControlPortName('Shuiqin Synth')).toBe(false);
  });
});
