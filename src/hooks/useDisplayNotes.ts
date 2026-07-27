import { useEffect, useRef, useState } from 'react';

/** How long the chord text/notes fade once they start disappearing. */
export const FADE_OUT_MS = 100;
/**
 * Grace window before accepting a release-only reduction in the displayed note set. This stops a
 * full chord release from briefly collapsing to whichever note happened to lift last.
 */
export const RELEASE_SETTLE_MS = 60;

type DisplayNotesState = {
  displayNotes: number[];
  fading: boolean;
};

/**
 * Derives the notes shown in the readout/staff from the currently held notes, decoupled from audio
 * and key lighting (which stay immediate). Additions show instantly; release-only reductions settle
 * briefly; a full release lingers solid and then fades before clearing.
 *
 * `activeNotes` must be referentially stable across unrelated renders (memoize it in the caller).
 */
export function useDisplayNotes(activeNotes: number[], lingerMs: number): DisplayNotesState {
  const [displayNotes, setDisplayNotes] = useState<number[]>([]);
  const [fading, setFading] = useState(false);
  const displayNotesRef = useRef<number[]>([]);
  /**
   * True while `displayNotes` still reflects notes that are actually held. Once everything is
   * released the display keeps showing the chord (linger/fade), but it is no longer "live" - and a
   * press arriving then is a brand new chord, never a release-only reduction of the stale one.
   */
  const displayIsLiveRef = useRef(false);

  useEffect(() => {
    displayNotesRef.current = displayNotes;
  }, [displayNotes]);

  useEffect(() => {
    if (activeNotes.length > 0) {
      setFading(false);

      const currentDisplayNotes = displayNotesRef.current;
      const isReleaseOnlyChange = displayIsLiveRef.current
        && activeNotes.length < currentDisplayNotes.length
        && activeNotes.every((note) => currentDisplayNotes.includes(note));

      if (!isReleaseOnlyChange) {
        displayIsLiveRef.current = true;
        setDisplayNotes(activeNotes);
        return;
      }

      const settleTimeout = window.setTimeout(() => {
        displayIsLiveRef.current = true;
        setDisplayNotes(activeNotes);
      }, RELEASE_SETTLE_MS);
      return () => window.clearTimeout(settleTimeout);
    }

    displayIsLiveRef.current = false;

    if (displayNotesRef.current.length === 0) {
      setFading(false);
      return;
    }

    if (lingerMs === 0) {
      setFading(false);
      setDisplayNotes([]);
      return;
    }

    setFading(false);
    const holdMs = Math.max(0, lingerMs - FADE_OUT_MS);
    const fadeTimeout = window.setTimeout(() => setFading(true), holdMs);
    const clearDisplayTimeout = window.setTimeout(() => {
      setFading(false);
      setDisplayNotes([]);
    }, lingerMs);

    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(clearDisplayTimeout);
    };
  }, [activeNotes, lingerMs]);

  return { displayNotes, fading };
}
