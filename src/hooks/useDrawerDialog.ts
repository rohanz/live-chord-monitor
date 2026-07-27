import { useCallback, useLayoutEffect, useRef, type KeyboardEvent as ReactKeyboardEvent } from 'react';

/**
 * Drawer plumbing shared by the Help and Settings panels: move focus into the panel when it opens,
 * close on Escape, and hand focus back to whatever opened it.
 *
 * The drawers are deliberately NON-modal - no `aria-modal`, no Tab trap. They are small corner
 * panels over a live instrument, and adjusting volume/linger while still playing is a supported
 * workflow, so the app behind them stays fully interactive. Claiming `aria-modal` while leaving the
 * rest of the app clickable would just be a lie to assistive tech; a Tab trap would contradict the
 * same thing for keyboard users.
 *
 * Escape is handled on the panel itself (not on `window`) so it can never shadow the global note /
 * octave shortcuts, and only Escape stops propagation - `Z`/`X` still reach the window listener
 * from a drawer control, as documented.
 */
export function useDrawerDialog<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T | null>(null);

  useLayoutEffect(() => {
    const drawer = ref.current;
    if (!drawer) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    drawer.focus();

    return () => {
      // Only reclaim focus if it is still inside the panel being closed. If the user already moved
      // on (clicking the other drawer's trigger, say) yanking focus backwards would be worse than
      // leaving it be.
      if (!drawer.contains(document.activeElement)) return;
      if (previouslyFocused && previouslyFocused.isConnected) {
        previouslyFocused.focus();
      }
    };
  }, []);

  const onKeyDown = useCallback((event: ReactKeyboardEvent<T>) => {
    if (event.key !== 'Escape') return;

    event.preventDefault();
    event.stopPropagation();
    onClose();
  }, [onClose]);

  return { ref, onKeyDown };
}
