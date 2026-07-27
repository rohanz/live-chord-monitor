import { fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useComputerKeyboard } from './useComputerKeyboard';

afterEach(() => {
  document.body.innerHTML = '';
});

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
}

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

  it('releases held notes when the window loses focus', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.keyDown(window, { code: 'KeyD' });
    expect(onNoteOff).not.toHaveBeenCalled();

    fireEvent.blur(window);
    expect(onNoteOff).toHaveBeenCalledWith(60, 'keyboard:KeyA');
    expect(onNoteOff).toHaveBeenCalledWith(64, 'keyboard:KeyD');
    expect(onNoteOff).toHaveBeenCalledTimes(2);
  });

  it('does not resurrect notes after a blur when the real keyup finally arrives', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.blur(window);
    onNoteOff.mockClear();

    fireEvent.keyUp(window, { code: 'KeyA' });
    expect(onNoteOff).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(onNoteOn).toHaveBeenCalledTimes(2);
  });

  it('releases held notes when the document becomes hidden', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    fireEvent.keyDown(window, { code: 'KeyA' });
    setVisibility('hidden');
    fireEvent(document, new Event('visibilitychange'));
    setVisibility('visible');

    expect(onNoteOff).toHaveBeenCalledWith(60, 'keyboard:KeyA');
  });

  it('re-triggers physically held keys at the new pitch when the octave shifts', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    const { rerender } = renderHook(
      ({ base }) => useComputerKeyboard(true, base, onNoteOn, onNoteOff),
      { initialProps: { base: 60 } },
    );

    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(onNoteOn).toHaveBeenCalledWith(60, 'keyboard:KeyA');

    rerender({ base: 72 });
    // Old pitch released, new pitch re-armed - no stuck note, no silence.
    expect(onNoteOff).toHaveBeenCalledWith(60, 'keyboard:KeyA');
    expect(onNoteOn).toHaveBeenCalledWith(72, 'keyboard:KeyA');

    // The physical keyup still releases, and at the NEW pitch.
    onNoteOff.mockClear();
    fireEvent.keyUp(window, { code: 'KeyA' });
    expect(onNoteOff).toHaveBeenCalledWith(72, 'keyboard:KeyA');
  });

  it('ignores note keys while a settings control has focus and leaves native behavior intact', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    renderHook(() => useComputerKeyboard(true, 60, onNoteOn, onNoteOff));

    const select = document.createElement('select');
    document.body.append(select);

    const prevented = !fireEvent.keyDown(select, { code: 'KeyA', bubbles: true, cancelable: true });
    expect(onNoteOn).not.toHaveBeenCalled();
    expect(prevented).toBe(false);

    fireEvent.keyUp(select, { code: 'KeyA', bubbles: true });
    expect(onNoteOff).not.toHaveBeenCalled();
  });

  it('does not re-arm keys that were released while notes were disabled', () => {
    const onNoteOn = vi.fn();
    const onNoteOff = vi.fn();
    const { rerender } = renderHook(
      ({ enabled }) => useComputerKeyboard(enabled, 60, onNoteOn, onNoteOff),
      { initialProps: { enabled: true } },
    );

    fireEvent.keyDown(window, { code: 'KeyA' });
    rerender({ enabled: false });
    expect(onNoteOff).toHaveBeenCalledWith(60, 'keyboard:KeyA');

    fireEvent.keyUp(window, { code: 'KeyA' });
    onNoteOn.mockClear();
    rerender({ enabled: true });
    expect(onNoteOn).not.toHaveBeenCalled();
  });
});
