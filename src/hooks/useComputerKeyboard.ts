import { useEffect, useRef } from 'react';
import { COMPUTER_KEY_OFFSETS } from '../music/notes';
import { isTextEditingTarget } from '../utils/textEditingTarget';

export function useComputerKeyboard(
  enabled: boolean,
  baseMidiNote: number,
  onNoteOn: (note: number, source: string) => void,
  onNoteOff: (note: number, source: string) => void,
) {
  // Physically held key codes. Deliberately NOT cleared when the octave changes:
  // the effect re-subscribes on every `baseMidiNote` change, and a key the user is
  // still holding must keep sounding (at the new pitch) rather than go silent.
  const pressedKeysRef = useRef(new Set<string>());
  // Held via refs so a caller passing inline callbacks cannot tear down the
  // subscription (and retrigger every held note) on every render.
  const onNoteOnRef = useRef(onNoteOn);
  const onNoteOffRef = useRef(onNoteOff);

  useEffect(() => {
    onNoteOnRef.current = onNoteOn;
    onNoteOffRef.current = onNoteOff;
  });

  useEffect(() => {
    const pressedKeys = pressedKeysRef.current;

    if (!enabled) {
      // Notes are already released, but keep tracking physical key state so
      // re-enabling never resurrects a key the user has since let go of.
      const forget = (event: KeyboardEvent) => pressedKeys.delete(event.code);
      const forgetAll = () => pressedKeys.clear();

      window.addEventListener('keyup', forget);
      window.addEventListener('blur', forgetAll);

      return () => {
        window.removeEventListener('keyup', forget);
        window.removeEventListener('blur', forgetAll);
      };
    }

    function noteFor(code: string): number {
      return baseMidiNote + COMPUTER_KEY_OFFSETS[code];
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }

      const offset = COMPUTER_KEY_OFFSETS[event.code];

      if (offset === undefined || pressedKeys.has(event.code)) {
        return;
      }

      // Typing into a form control must stay typing: no note, and no preventDefault
      // (that would break native behavior such as `<select>` type-ahead).
      if (isTextEditingTarget(event.target)) {
        return;
      }

      event.preventDefault();
      pressedKeys.add(event.code);
      onNoteOnRef.current(baseMidiNote + offset, `keyboard:${event.code}`);
    }

    function handleKeyUp(event: KeyboardEvent) {
      const offset = COMPUTER_KEY_OFFSETS[event.code];

      if (offset === undefined || !pressedKeys.has(event.code)) {
        return;
      }

      event.preventDefault();
      pressedKeys.delete(event.code);
      onNoteOffRef.current(baseMidiNote + offset, `keyboard:${event.code}`);
    }

    /**
     * Safety net for every path where the keyup never arrives: Cmd+Tab, Spotlight,
     * clicking another app, or macOS swallowing keyup for other keys while Cmd is
     * held. Without this the note stays held and sounding forever.
     */
    function releaseAll() {
      for (const code of pressedKeys) {
        onNoteOffRef.current(noteFor(code), `keyboard:${code}`);
      }

      pressedKeys.clear();
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'hidden') {
        releaseAll();
      }
    }

    // Re-arm keys the user is still physically holding (octave shift re-ran this effect).
    for (const code of pressedKeys) {
      onNoteOnRef.current(noteFor(code), `keyboard:${code}`);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', releaseAll);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', releaseAll);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      // Release at the OLD base so nothing sticks and nothing is released at the
      // wrong pitch. `pressedKeys` itself survives so the keys can be re-armed.
      for (const code of pressedKeys) {
        onNoteOffRef.current(noteFor(code), `keyboard:${code}`);
      }
    };
  }, [baseMidiNote, enabled]);
}
