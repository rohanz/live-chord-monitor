import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';

/**
 * Drop-in replacement for useState that mirrors its value to localStorage under `key` and restores
 * it on the next mount. Storage failures (private mode, quota, corrupt JSON) fall back silently to
 * the in-memory default so the app never breaks on a bad persisted value.
 */
export function usePersistentState<T>(key: string, initialValue: T): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readStored(key, initialValue));

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Persisting is best-effort; ignore storage write failures.
    }
  }, [key, value]);

  return [value, setValue];
}

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
