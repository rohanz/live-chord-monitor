import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { isBoolean, numberInRange, oneOf, usePersistentState } from './usePersistentState';

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

  describe('validation of restored values', () => {
    const isVolume = numberInRange(0, 1);
    const isNameStyle = oneOf(['maj', 'capitalM', 'delta'] as const);

    it('adopts a valid stored value unchanged', () => {
      window.localStorage.setItem('lcm:volume', '0.25');
      const { result } = renderHook(() => usePersistentState('lcm:volume', 0.72, isVolume));

      expect(result.current[0]).toBe(0.25);
      expect(JSON.parse(window.localStorage.getItem('lcm:volume') as string)).toBe(0.25);
    });

    it('rejects an out-of-range number and does not re-persist it', () => {
      // The bug this guards: `99 * 0.28` master gain, i.e. ~28x full scale, with the slider
      // clamping only its DISPLAY to 1 so nothing on screen shows the real value.
      window.localStorage.setItem('lcm:volume', '99');
      const { result } = renderHook(() => usePersistentState('lcm:volume', 0.72, isVolume));

      expect(result.current[0]).toBe(0.72);
      expect(JSON.parse(window.localStorage.getItem('lcm:volume') as string)).toBe(0.72);
    });

    it('rejects a negative number that would flow into a timeout', () => {
      window.localStorage.setItem('lcm:lingerMs', '-1');
      const { result } = renderHook(() => usePersistentState('lcm:lingerMs', 500, oneOf([0, 250, 500, 750, 1000])));

      expect(result.current[0]).toBe(500);
    });

    it('rejects a wrong-typed value (numeric setting stored as a string)', () => {
      window.localStorage.setItem('lcm:volume', '"loud"');
      const { result } = renderHook(() => usePersistentState('lcm:volume', 0.72, isVolume));

      expect(result.current[0]).toBe(0.72);
    });

    it('rejects an invalid enum member', () => {
      window.localStorage.setItem('lcm:nameStyle', '"sharp9"');
      const { result } = renderHook(() => usePersistentState('lcm:nameStyle', 'maj', isNameStyle));

      expect(result.current[0]).toBe('maj');
    });

    it('rejects null', () => {
      window.localStorage.setItem('lcm:lingerMs', 'null');
      const { result } = renderHook(() => usePersistentState('lcm:lingerMs', 500, oneOf([0, 250, 500, 750, 1000])));

      expect(result.current[0]).toBe(500);
    });

    it('rejects non-boolean truthiness for a boolean setting', () => {
      window.localStorage.setItem('lcm:muted', '1');
      const { result } = renderHook(() => usePersistentState('lcm:muted', false, isBoolean));

      expect(result.current[0]).toBe(false);
    });

    it('keeps a legitimately stored `false` rather than treating it as missing', () => {
      window.localStorage.setItem('lcm:notationEnabled', 'false');
      const { result } = renderHook(() => usePersistentState('lcm:notationEnabled', true, isBoolean));

      expect(result.current[0]).toBe(false);
    });
  });
});

describe('validators', () => {
  it('numberInRange rejects NaN, Infinity, numeric strings and out-of-range values', () => {
    const inUnit = numberInRange(0, 1);

    expect(inUnit(0)).toBe(true);
    expect(inUnit(1)).toBe(true);
    expect(inUnit(0.5)).toBe(true);
    expect(inUnit(-0.01)).toBe(false);
    expect(inUnit(1.01)).toBe(false);
    expect(inUnit(Number.NaN)).toBe(false);
    expect(inUnit(Number.POSITIVE_INFINITY)).toBe(false);
    expect(inUnit('0.5')).toBe(false);
    expect(inUnit(null)).toBe(false);
    expect(inUnit(undefined)).toBe(false);
  });

  it('oneOf accepts only listed members, by strict identity', () => {
    const isMode = oneOf(['slash', 'root-only', 'full'] as const);

    expect(isMode('slash')).toBe(true);
    expect(isMode('Slash')).toBe(false);
    expect(isMode('')).toBe(false);
    expect(isMode(0)).toBe(false);

    const isLinger = oneOf([0, 250, 500]);
    expect(isLinger(0)).toBe(true);
    expect(isLinger('0')).toBe(false);
    expect(isLinger(-1)).toBe(false);
  });

  it('isBoolean rejects boolean-ish values', () => {
    expect(isBoolean(true)).toBe(true);
    expect(isBoolean(false)).toBe(true);
    expect(isBoolean(1)).toBe(false);
    expect(isBoolean('true')).toBe(false);
    expect(isBoolean(null)).toBe(false);
  });
});
