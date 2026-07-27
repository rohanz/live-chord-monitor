import { useEffect, useRef, useState } from 'react';
import { Accidental, Renderer, Stave, StaveConnector, StaveNote, TickContext } from 'vexflow';
import type { ChordCandidate } from '../music/chords';
import { MIDDLE_C, midiToOctave, midiToPitchClass, pitchClassName } from '../music/notes';

type StaffNotationProps = {
  notes: number[];
  chord: ChordCandidate | null;
  fading: boolean;
};

type VexKey = {
  key: string;
  accidental: string | null;
};

export function centeredNoteheadTickX(staveCenterX: number, currentTickX: number, noteheadBeginX: number, noteheadEndX: number): number {
  const noteheadCenterX = (noteheadBeginX + noteheadEndX) / 2;
  return currentTickX + staveCenterX - noteheadCenterX;
}

export function StaffNotation({ notes, chord, fading }: StaffNotationProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    const observedContainer = container;

    function measure() {
      const rect = observedContainer.getBoundingClientRect();
      setSize((current) => {
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);

        if (current.width === width && current.height === height) {
          return current;
        }

        return { width, height };
      });
    }

    measure();

    // Redrawing writes a fixed-size <svg> back into the observed container, which can notify the
    // observer again. The rounded-size early return above already stops the state from changing,
    // but coalescing notifications into the next animation frame also keeps that echo from being
    // delivered inside the same observation cycle ("ResizeObserver loop completed with undelivered
    // notifications"). Redraw-on-resize itself is preserved: a real size change still lands within
    // a frame, so drag-resizing cannot leave stale SVG geometry.
    let pendingFrame = 0;

    function scheduleMeasure() {
      if (pendingFrame) {
        return;
      }

      pendingFrame = window.requestAnimationFrame(() => {
        pendingFrame = 0;
        measure();
      });
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(observedContainer);

    return () => {
      if (pendingFrame) {
        window.cancelAnimationFrame(pendingFrame);
      }

      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.innerHTML = '';

    const width = Math.min(Math.max(size.width || container.clientWidth, 260), 640);
    const height = Math.min(Math.max(size.height || container.clientHeight || 242, 148), 242);
    const renderer = new Renderer(container, Renderer.Backends.SVG);
    renderer.resize(width, height);

    const context = renderer.getContext();
    const treble = new Stave(24, Math.max(16, Math.round(height * 0.08)), width - 48);
    const bass = new Stave(24, Math.round(height * 0.50), width - 48);

    treble.addClef('treble');
    bass.addClef('bass');
    treble.setContext(context).draw();
    bass.setContext(context).draw();

    new StaveConnector(treble, bass).setType(StaveConnector.type.BRACE).setContext(context).draw();
    new StaveConnector(treble, bass).setType(StaveConnector.type.SINGLE_LEFT).setContext(context).draw();

    if (notes.length === 0) {
      return;
    }

    const trebleNotes = notes.filter((note) => note >= MIDDLE_C).sort((a, b) => a - b);
    const bassNotes = notes.filter((note) => note < MIDDLE_C).sort((a, b) => a - b);

    drawChord(trebleNotes, 'treble', treble, width, chord);
    drawChord(bassNotes, 'bass', bass, width, chord);
  }, [notes, chord, size.height, size.width]);

  return <div className={`notation-surface ${fading ? 'is-fading' : ''}`} ref={containerRef} />;
}

function drawChord(notes: number[], clef: 'treble' | 'bass', stave: Stave, width: number, chord: ChordCandidate | null) {
  if (notes.length === 0) {
    return;
  }

  const vexKeys = notes.map((note) => midiToVexKey(note, chord));
  const staveNote = new StaveNote({
    clef,
    keys: vexKeys.map((vexKey) => vexKey.key),
    duration: 'w',
  });

  vexKeys.forEach((vexKey, index) => {
    if (vexKey.accidental) {
      staveNote.addModifier(new Accidental(vexKey.accidental), index);
    }
  });

  const context = stave.getContext();
  const tickContext = new TickContext();
  tickContext.addTickable(staveNote).preFormat();
  staveNote.setContext(context).setStave(stave);
  const staveCenterX = stave.getX() + stave.getWidth() / 2;
  tickContext.setX(staveCenterX);
  tickContext.setX(centeredNoteheadTickX(
    staveCenterX,
    tickContext.getX(),
    staveNote.getNoteHeadBeginX(),
    staveNote.getNoteHeadEndX(),
  ));
  staveNote.draw();
}

/** Pitch class of each natural letter, used to detect spellings that cross the B/C octave seam. */
const LETTER_PITCH_CLASSES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/**
 * The octave a spelling is *written* in, which is not always the MIDI octave. MIDI octaves break at
 * C, but spellings can cross that seam: B#3 sounds as MIDI 60 (C4) and Cb4 sounds as MIDI 59 (B3).
 * Taking the letter from the spelling and the octave from MIDI would then place the note a seventh
 * away. Spellings that stay inside their MIDI octave (including Bbb) are unaffected.
 */
function spelledOctave(note: number, letter: string, accidental: string): number {
  const alteration = accidental.split('').reduce((total, mark) => total + (mark === '#' ? 1 : -1), 0);
  const soundingDegree = LETTER_PITCH_CLASSES[letter] + alteration;
  const midiOctave = midiToOctave(note);

  if (soundingDegree > 11) {
    // e.g. B# / B##: the letter belongs to the octave below the pitch it sounds.
    return midiOctave - 1;
  }

  if (soundingDegree < 0) {
    // e.g. Cb / Cbb: the letter belongs to the octave above the pitch it sounds.
    return midiOctave + 1;
  }

  return midiOctave;
}

export function midiToVexKey(note: number, chord: ChordCandidate | null): VexKey {
  const pitchClass = midiToPitchClass(note);
  // Without chord context, fall back to flat spelling (matches conventional accidental display).
  const spelled = chord?.spelling[pitchClass] ?? pitchClassName(pitchClass, true);
  const match = spelled.match(/^([A-G])([b#]{0,2})$/);

  if (!match) {
    return { key: `c/${midiToOctave(note)}`, accidental: null };
  }

  const [, letter, accidental] = match;

  return {
    key: `${letter.toLowerCase()}/${spelledOctave(note, letter, accidental)}`,
    accidental: accidental || null,
  };
}
