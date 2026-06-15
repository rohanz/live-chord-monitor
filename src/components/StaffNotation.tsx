import { useEffect, useRef, useState } from 'react';
import { Accidental, Renderer, Stave, StaveConnector, StaveNote, TickContext } from 'vexflow';
import type { ChordCandidate } from '../music/chords';
import { midiToOctave, midiToPitchClass } from '../music/notes';

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

    const observer = new ResizeObserver(measure);
    observer.observe(observedContainer);

    return () => observer.disconnect();
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

    const trebleNotes = notes.filter((note) => note >= 60).sort((a, b) => a - b);
    const bassNotes = notes.filter((note) => note < 60).sort((a, b) => a - b);

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

function midiToVexKey(note: number, chord: ChordCandidate | null): VexKey {
  const pitchClass = midiToPitchClass(note);
  const spelled = chord?.spelling[pitchClass] ?? fallbackSpelling(pitchClass);
  const match = spelled.match(/^([A-G])([b#]{0,2})$/);
  const octave = midiToOctave(note);

  if (!match) {
    return { key: `c/${octave}`, accidental: null };
  }

  return {
    key: `${match[1].toLowerCase()}/${octave}`,
    accidental: match[2] || null,
  };
}

function fallbackSpelling(pitchClass: number): string {
  return ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'][pitchClass];
}
