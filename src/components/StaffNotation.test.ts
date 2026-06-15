import { describe, expect, it } from 'vitest';
import { centeredNoteheadTickX } from './StaffNotation';

describe('centeredNoteheadTickX', () => {
  it('shifts the tick position so the visible notehead center lands on the staff center', () => {
    expect(centeredNoteheadTickX(320, 320, 300, 340)).toBe(320);
    expect(centeredNoteheadTickX(320, 320, 340, 360)).toBe(290);
    expect(centeredNoteheadTickX(320, 280, 295, 325)).toBe(290);
  });
});
