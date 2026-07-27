import { useCallback, useEffect, useRef } from 'react';
import type { PointerEvent } from 'react';
import { isBlackKey, midiNoteName, midiRange } from '../music/notes';

type PianoKeyboardProps = {
  startNote: number;
  endNote: number;
  activeNotes: Set<number>;
  showPressedLabels: boolean;
  preferFlats: boolean;
  onPointerNoteOn?: (note: number) => void;
  onPointerNoteOff?: (note: number) => void;
};

export function PianoKeyboard({
  startNote,
  endNote,
  activeNotes,
  showPressedLabels,
  preferFlats,
  onPointerNoteOn,
  onPointerNoteOff,
}: PianoKeyboardProps) {
  const keys = midiRange(startNote, endNote);
  const whiteKeys = keys.filter((note) => !isBlackKey(note));

  // Which note each active pointer is holding. A key element can unmount mid-press
  // (octave shift, range slider), so releases must not depend on that element still
  // existing - hence the window-level and range-change safety nets below.
  const pointerNotesRef = useRef(new Map<number, number>());
  const noteOffRef = useRef(onPointerNoteOff);

  useEffect(() => {
    noteOffRef.current = onPointerNoteOff;
  });

  const releasePointer = useCallback((pointerId: number) => {
    const note = pointerNotesRef.current.get(pointerId);

    if (note === undefined) {
      return;
    }

    pointerNotesRef.current.delete(pointerId);
    noteOffRef.current?.(note);
  }, []);

  useEffect(() => {
    const held = pointerNotesRef.current;

    function handleWindowPointerEnd(event: globalThis.PointerEvent) {
      releasePointer(event.pointerId);
    }

    window.addEventListener('pointerup', handleWindowPointerEnd);
    window.addEventListener('pointercancel', handleWindowPointerEnd);

    return () => {
      window.removeEventListener('pointerup', handleWindowPointerEnd);
      window.removeEventListener('pointercancel', handleWindowPointerEnd);

      for (const note of held.values()) {
        noteOffRef.current?.(note);
      }

      held.clear();
    };
  }, [releasePointer]);

  // A held key that scrolls out of the visible range loses its element (and its
  // pointer capture), so release it as soon as it disappears.
  useEffect(() => {
    for (const [pointerId, note] of Array.from(pointerNotesRef.current)) {
      if (note < startNote || note > endNote) {
        releasePointer(pointerId);
      }
    }
  }, [endNote, releasePointer, startNote]);

  function pointerHandlers(note: number) {
    return {
      onPointerDown: (event: PointerEvent<HTMLElement>) => {
        event.preventDefault();
        // Capture keeps the press bound to the key it started on (no glissando);
        // see the note in AGENTS.md on why drag-across is deliberately not supported.
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pointerNotesRef.current.set(event.pointerId, note);
        onPointerNoteOn?.(note);
      },
      onPointerUp: (event: PointerEvent<HTMLElement>) => {
        event.preventDefault();
        if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
        releasePointer(event.pointerId);
      },
      onPointerCancel: (event: PointerEvent<HTMLElement>) => releasePointer(event.pointerId),
    };
  }

  return (
    <div className="piano" aria-label="Piano keyboard">
      <div className="white-key-row">
        {whiteKeys.map((note) => (
          <div
            key={note}
            className={`white-key ${activeNotes.has(note) ? 'is-active' : ''}`}
            style={{ width: `${100 / whiteKeys.length}%` }}
            {...pointerHandlers(note)}
          >
            {showPressedLabels && activeNotes.has(note) ? <span>{midiNoteName(note, preferFlats)}</span> : null}
          </div>
        ))}
      </div>
      <div className="black-key-row" aria-hidden="true">
        {keys.filter(isBlackKey).map((note) => (
            <div
              key={note}
              className={`black-key ${activeNotes.has(note) ? 'is-active' : ''}`}
              style={blackKeyLayout(note, whiteKeys)}
              {...pointerHandlers(note)}
            >
              {showPressedLabels && activeNotes.has(note) ? <span>{midiNoteName(note, preferFlats)}</span> : null}
            </div>
        ))}
      </div>
    </div>
  );
}

type RangeOverviewProps = {
  startNote: number;
  endNote: number;
  activeNotes: Set<number>;
};

export function RangeOverview({ startNote, endNote, activeNotes }: RangeOverviewProps) {
  const low = 21;
  const high = 108;
  const keys = midiRange(low, high);
  const whiteKeys = keys.filter((note) => !isBlackKey(note));
  const rangeLeft = whiteKeyPosition(startNote, whiteKeys);
  const rangeRight = whiteKeyPosition(endNote + 1, whiteKeys);

  return (
    <div className="range-overview" aria-label="Full keyboard range overview">
      <div
        className="range-window"
        style={{
          left: `${rangeLeft}%`,
          width: `${Math.max(rangeRight - rangeLeft, 4)}%`,
        }}
      />
      <div className="mini-white-row">
        {whiteKeys.map((note) => (
          <div
            key={note}
            className={`mini-white-key ${note >= startNote && note <= endNote ? 'is-in-range' : ''} ${activeNotes.has(note) ? 'is-active' : ''}`}
            style={{ width: `${100 / whiteKeys.length}%` }}
          />
        ))}
      </div>
      <div className="mini-black-row">
        {keys.filter(isBlackKey).map((note) => (
          <div
            key={note}
            className={`mini-black-key ${note >= startNote && note <= endNote ? 'is-in-range' : ''} ${activeNotes.has(note) ? 'is-active' : ''}`}
            style={blackKeyLayout(note, whiteKeys)}
          />
        ))}
      </div>
    </div>
  );
}

function whiteKeyPosition(note: number, whiteKeys: number[]): number {
  const preceding = whiteKeys.filter((whiteNote) => whiteNote < note).length;
  return preceding / whiteKeys.length * 100;
}

/** Horizontal placement (as CSS percentages) for a black key floating above the white-key row. */
function blackKeyLayout(note: number, whiteKeys: number[]): { left: string; width: string } {
  const precedingWhiteCount = whiteKeys.filter((whiteNote) => whiteNote < note).length;
  const leftPercent = precedingWhiteCount / whiteKeys.length * 100;
  const blackWidthPercent = 100 / whiteKeys.length * 0.56;

  return {
    left: `calc(${leftPercent}% - ${blackWidthPercent / 2}%)`,
    width: `${blackWidthPercent}%`,
  };
}
