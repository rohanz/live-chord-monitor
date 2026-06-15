import { fireEvent, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useComputerKeyboard } from './useComputerKeyboard';

describe('useComputerKeyboard', () => {
  it('emits note-on for a mapped key and releases still-held notes on unmount', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    const { unmount } = renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(onNoteOn).toHaveBeenCalledWith(60, 'keyboard:KeyA');
    expect(onNoteOff).not.toHaveBeenCalled();

    unmount();
    expect(onNoteOff).toHaveBeenCalledWith(60, 'keyboard:KeyA');
  });

  it('ignores keys outside the piano mapping', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyP' });
    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('does not attach listeners when disabled', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(false, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(onNoteOn).not.toHaveBeenCalled();
  });
});
