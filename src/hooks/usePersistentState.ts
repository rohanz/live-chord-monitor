import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/** Narrowing predicate used to accept or reject a value read back out of localStorage. */
export type PersistedValidator<T> = (value: unknown) => value is T;

/**
 * Drop-in replacement for useState that mirrors its value to localStorage under `key` and restores
 * it on the next mount.
 *
 * Anything the browser hands back is untrusted: a user (or a stale/newer build, or a corrupt
 * profile) can leave any JSON at that key. Pass `isValid` so a stored value is only adopted when it
 * is actually a legal `T` - without it, a well-formed but out-of-range value such as
 * `lcm:volume = 99` would sail straight into state and drive the audio gain.
 *
 * Missing keys, unparseable JSON, storage failures (private mode, quota) and values rejected by
 * `isValid` all fall back to the in-memory default. The rejected value is not preserved: the
 * write-back effect immediately overwrites the key with the default, so a bad value cannot survive
 * a restart.
 */
export function usePersistentState<T>(
  key: string,
  initialValue: T,
  isValid?: PersistedValidator<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(key, initialValue, isValid));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persisting is best-effort; ignore storage write failures.
    }
  }, [key, value]);

  return [value, setValue];
}

function readStored<T>(key: string, fallback: T, isValid?: PersistedValidator<T>): T {
  let parsed: unknown;

  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    parsed = JSON.parse(raw);
  } catch {
    return fallback;
  }

  if (isValid) {
    return isValid(parsed) ? parsed : fallback;
  }

  return parsed as T;
}

/** Accepts only the listed literals - use for every enum-shaped setting. */
export function oneOf<T extends string | number>(allowed: readonly T[]): PersistedValidator<T> {
  const permitted = new Set<unknown>(allowed);
  return (value: unknown): value is T => permitted.has(value);
}

/** Accepts finite numbers inside `[min, max]`. Rejects `NaN`, `Infinity`, numeric strings and `null`. */
export function numberInRange(min: number, max: number): PersistedValidator<number> {
  return (value: unknown): value is number =>
    typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
}

/** Accepts only real booleans (not `0`/`1`, not `"true"`). */
export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
