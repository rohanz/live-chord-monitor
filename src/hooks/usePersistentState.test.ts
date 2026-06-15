import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { usePersistentState } from './usePersistentState';

describe('usePersistentState', () => {
  beforeEach(() => window.localStorage.clear());

  it('falls back to the default when nothing is stored', () => {
    const { result } = renderHook(() => usePersistentState('lcm:test', 'maj'));

    expect(result.current[0]).toBe('maj');
  });

  it('writes updates to localStorage and restores them on a fresh mount', () => {
    const first = renderHook(() => usePersistentState('lcm:test', 'maj'));

    act(() => first.result.current[1]('delta'));
    expect(JSON.parse(window.localStorage.getItem('lcm:test') as string)).toBe('delta');

    const second = renderHook(() => usePersistentState('lcm:test', 'maj'));
    expect(second.result.current[0]).toBe('delta');
  });

  it('ignores corrupt stored JSON and uses the default', () => {
    window.localStorage.setItem('lcm:test', '{not json');
    const { result } = renderHook(() => usePersistentState('lcm:test', 7));

    expect(result.current[0]).toBe(7);
  });
});
