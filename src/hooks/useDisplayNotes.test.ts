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
});
