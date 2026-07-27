import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDisplayNotes } from './useDisplayNotes';

function setup(notes: number[], linger: number) {
  return renderHook(({ activeNotes, lingerMs }) => useDisplayNotes(activeNotes, lingerMs), {
    initialProps: { activeNotes: notes, lingerMs: linger },
  });
}

describe('useDisplayNotes', () => {
  afterEach(() => vi.useRealTimers());

  it('shows newly pressed notes immediately and not fading', () => {
    const { result } = setup([60, 64, 67], 500);

    expect(result.current.displayNotes).toEqual([60, 64, 67]);
    expect(result.current.fading).toBe(false);
  });

  it('settles a release-only reduction before shrinking the displayed set', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [67], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);

    act(() => vi.advanceTimersByTime(59));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);

    act(() => vi.advanceTimersByTime(1));
    expect(result.current.displayNotes).toEqual([67]);
  });

  it('holds solid, then fades, then clears across the linger window after full release', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60]);
    expect(result.current.fading).toBe(false);

    act(() => vi.advanceTimersByTime(400));
    expect(result.current.fading).toBe(true);
    expect(result.current.displayNotes).toEqual([60]);

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.displayNotes).toEqual([]);
    expect(result.current.fading).toBe(false);
  });

  it('clears instantly when linger is off', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60], 0);

    act(() => rerender({ activeNotes: [], lingerMs: 0 }));
    expect(result.current.displayNotes).toEqual([]);
    expect(result.current.fading).toBe(false);
  });

  it('never settles a press that lands while a released chord is lingering', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));
    act(() => vi.advanceTimersByTime(150));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);

    // A fresh press during the linger is NOT a release-only reduction, even though it is a
    // subset of the stale display. It must show immediately.
    act(() => rerender({ activeNotes: [60], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60]);
  });

  it('lingers the tapped note, not the previous chord, after a staccato tap during linger', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));
    act(() => vi.advanceTimersByTime(150));

    // 40ms staccato tap of C alone - shorter than RELEASE_SETTLE_MS.
    act(() => rerender({ activeNotes: [60], lingerMs: 500 }));
    act(() => vi.advanceTimersByTime(40));
    act(() => rerender({ activeNotes: [], lingerMs: 500 }));

    expect(result.current.displayNotes).toEqual([60]);

    act(() => vi.advanceTimersByTime(499));
    expect(result.current.displayNotes).toEqual([60]);
    act(() => vi.advanceTimersByTime(1));
    expect(result.current.displayNotes).toEqual([]);
  });

  it('does not latch the old chord across repeated staccato taps', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));

    for (let tap = 0; tap < 5; tap += 1) {
      act(() => vi.advanceTimersByTime(150));
      act(() => rerender({ activeNotes: [60], lingerMs: 500 }));
      expect(result.current.displayNotes).toEqual([60]);
      act(() => vi.advanceTimersByTime(40));
      act(() => rerender({ activeNotes: [], lingerMs: 500 }));
      expect(result.current.displayNotes).toEqual([60]);
    }
  });

  it('shows a single held note immediately when pressed during the fade phase', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));
    act(() => vi.advanceTimersByTime(450));
    expect(result.current.fading).toBe(true);

    act(() => rerender({ activeNotes: [64], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([64]);
    expect(result.current.fading).toBe(false);
  });

  it('updates a same-size substitution immediately rather than settling it', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [60, 64, 69], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60, 64, 69]);
  });

  it('adopts a re-emitted identical note set immediately (settle is for reductions only)', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    // Same notes, new array identity. A same-size set can only ever be a "subset" of the display
    // when it is the identical set, so this is the case that separates `<` from `<=`.
    const resent = [60, 64, 67];
    act(() => rerender({ activeNotes: resent, lingerMs: 500 }));
    expect(result.current.displayNotes).toBe(resent);
  });

  it('updates immediately when a note is added while holding a chord', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64], 500);

    act(() => rerender({ activeNotes: [60, 64, 67], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);
  });

  it('shows a note added during the settle window immediately', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [60], lingerMs: 500 }));
    act(() => vi.advanceTimersByTime(30));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);

    act(() => rerender({ activeNotes: [60, 72], lingerMs: 500 }));
    expect(result.current.displayNotes).toEqual([60, 72]);

    // The cancelled settle timer must not fire and revert the display to [60].
    act(() => vi.advanceTimersByTime(60));
    expect(result.current.displayNotes).toEqual([60, 72]);
  });

  it('re-presses a note immediately when linger is off', () => {
    vi.useFakeTimers();
    const { result, rerender } = setup([60, 64, 67], 0);

    act(() => rerender({ activeNotes: [], lingerMs: 0 }));
    expect(result.current.displayNotes).toEqual([]);

    act(() => rerender({ activeNotes: [64], lingerMs: 0 }));
    expect(result.current.displayNotes).toEqual([64]);
  });

  it('clears pending timers on unmount and never sets state afterwards', () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { result, rerender, unmount } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [], lingerMs: 500 }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(1000));
    expect(result.current.displayNotes).toEqual([60, 64, 67]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('clears a pending settle timer on unmount', () => {
    vi.useFakeTimers();
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender, unmount } = setup([60, 64, 67], 500);

    act(() => rerender({ activeNotes: [60], lingerMs: 500 }));
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);

    act(() => vi.advanceTimersByTime(1000));
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
