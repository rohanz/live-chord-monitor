import { useEffect, useRef } from 'react';
import { COMPUTER_KEY_OFFSETS } from '../music/notes';

export function useComputerKeyboard(
  enabled: boolean,
  baseMidiNote: number,
  onNoteOn: (note: number, source: string) => void,
  onNoteOff: (note: number, source: string) => void,
) {
  const pressedKeysRef = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }

      const offset = COMPUTER_KEY_OFFSETS[event.code];

      if (offset === undefined || pressedKeysRef.current.has(event.code)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.add(event.code);
      onNoteOn(baseMidiNote + offset, `keyboard:${event.code}`);
    }

    function handleKeyUp(event: KeyboardEvent) {
      const offset = COMPUTER_KEY_OFFSETS[event.code];

      if (offset === undefined || !pressedKeysRef.current.has(event.code)) {
        return;
      }

      event.preventDefault();
      pressedKeysRef.current.delete(event.code);
      onNoteOff(baseMidiNote + offset, `keyboard:${event.code}`);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);

      for (const code of pressedKeysRef.current) {
        const offset = COMPUTER_KEY_OFFSETS[code];
        onNoteOff(baseMidiNote + offset, `keyboard:${code}`);
      }

      pressedKeysRef.current.clear();
    };
  }, [baseMidiNote, enabled, onNoteOff, onNoteOn]);
}
