import { useEffect, useRef, useState } from 'react';
import { Accidental, Renderer, Stave, StaveConnector, StaveNote, TickContext } from 'vexflow';
import type { ChordCandidate } from '../music/chords';
import { MIDDLE_C } from '../music/notes';
import { midiToVexKey } from '../music/spelling';

// Re-exported so existing imports (and tests) of the staff spelling keep working.
export { midiToVexKey };

type StaffNotationProps = {
  notes: number[];
  chord: ChordCandidate | null;
  fading: boolean;
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

    // VexFlow pins the SVG with an inline px width/height. Drop it so the CSS box (plus the viewBox
    // VexFlow also sets) scales the whole staff uniformly. In a large window or full screen the staff
    // then grows with its cell instead of staying capped at 640x242.
    const svg = container.querySelector('svg');
    if (svg) {
      svg.style.removeProperty('width');
      svg.style.removeProperty('height');
    }

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

    const bounds = [
      drawChord(trebleNotes, 'treble', treble, chord),
      drawChord(bassNotes, 'bass', bass, chord),
    ];
    // Keep normal-range geometry unchanged. For ledger notes outside the cell, expand the viewBox
    // to the actual written bounds (including accidentals), so SVG's uniform scaling fits them.
    const padding = 12;
    const top = Math.min(0, ...bounds.map((box) => box ? box.getY() - padding : 0));
    const bottom = Math.max(height, ...bounds.map((box) => box ? box.getY() + box.getH() + padding : height));
    svg?.setAttribute('viewBox', `0 ${top} ${width} ${bottom - top}`);
  }, [notes, chord, size.height, size.width]);

  return <div className={`notation-surface ${fading ? 'is-fading' : ''}`} ref={containerRef} />;
}

function drawChord(notes: number[], clef: 'treble' | 'bass', stave: Stave, chord: ChordCandidate | null) {
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
  return staveNote.getBoundingBox();
}
