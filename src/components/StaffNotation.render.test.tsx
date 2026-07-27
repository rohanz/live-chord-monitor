import { render } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChordCandidate } from '../music/chords';
import { StaffNotation } from './StaffNotation';

function spelledAs(spelling: Record<number, string>): ChordCandidate {
  return { spelling } as unknown as ChordCandidate;
}

type ResizeCallback = () => void;

const resizeCallbacks = new Set<ResizeCallback>();

class CapturingResizeObserver {
  callback: ResizeCallback;

  constructor(callback: ResizeCallback) {
    this.callback = callback;
  }

  observe() {
    resizeCallbacks.add(this.callback);
  }

  unobserve() {
    resizeCallbacks.delete(this.callback);
  }

  disconnect() {
    resizeCallbacks.delete(this.callback);
  }
}

/** jsdom gives every element a zero-size rect; stub a real one so the layout math is exercised. */
function stubContainerSize(width: number, height: number) {
  vi.spyOn(HTMLDivElement.prototype, 'getBoundingClientRect').mockReturnValue({
    width,
    height,
    top: 0,
    left: 0,
    right: width,
    bottom: height,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

function flushResize() {
  act(() => {
    resizeCallbacks.forEach((callback) => callback());
  });
  // The hardened observer defers work to the next animation frame.
  act(() => {
    vi.advanceTimersByTime(32);
  });
}

function surfaceOf(container: HTMLElement): HTMLElement {
  const surface = container.querySelector('.notation-surface');
  if (!surface) {
    throw new Error('notation surface not rendered');
  }
  return surface as HTMLElement;
}

function svgOf(container: HTMLElement): SVGElement {
  const svgs = container.querySelectorAll('svg');
  expect(svgs).toHaveLength(1);
  return svgs[0];
}

/**
 * VexFlow 5 draws accidentals as SMuFL glyph <text> nodes (there is no `.vf-accidental` class), so
 * assert on the Bravura codepoints.
 */
const GLYPH = {
  sharp: '\uE262',
  flat: '\uE260',
  doubleFlat: '\uE264',
} as const;

function glyphCount(svg: SVGElement, glyph: string): number {
  return Array.from(svg.querySelectorAll('text')).filter((text) => text.textContent === glyph).length;
}

function noteheadCount(svg: SVGElement, group: 'treble' | 'bass'): number {
  // VexFlow tags each StaveNote group with its clef via the `vf-stavenote` class; count noteheads
  // by their rendered path elements inside each stavenote group.
  const staveNotes = Array.from(svg.querySelectorAll('.vf-stavenote'));
  const index = group === 'treble' ? 0 : staveNotes.length - 1;
  const target = staveNotes[index];
  return target ? target.querySelectorAll('.vf-notehead').length : 0;
}

describe('StaffNotation rendering', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    resizeCallbacks.clear();
    Object.defineProperty(window, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: CapturingResizeObserver,
    });
    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      writable: true,
      value: CapturingResizeObserver,
    });
    stubContainerSize(600, 220);
  });

  afterEach(() => {
    vi.useRealTimers();
    resizeCallbacks.clear();
  });

  it('draws an empty grand staff with both clefs when no notes are held', () => {
    const { container } = render(<StaffNotation notes={[]} chord={null} fading={false} />);
    const svg = svgOf(container);

    expect(svg.querySelectorAll('.vf-stave').length).toBeGreaterThanOrEqual(2);
    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(0);
  });

  it('renders one notehead per held note', () => {
    const { container } = render(
      <StaffNotation notes={[60, 64, 67]} chord={null} fading={false} />,
    );

    expect(svgOf(container).querySelectorAll('.vf-notehead')).toHaveLength(3);
  });

  it('puts middle C on the treble stave and the note below it on the bass stave', () => {
    const { container } = render(<StaffNotation notes={[59, 60]} chord={null} fading={false} />);
    const svg = svgOf(container);

    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(2);
    expect(noteheadCount(svg, 'treble')).toBe(1);
    expect(noteheadCount(svg, 'bass')).toBe(1);
  });

  it('sends every note to the treble stave when all are at or above middle C', () => {
    const { container } = render(<StaffNotation notes={[60, 64]} chord={null} fading={false} />);
    const svg = svgOf(container);

    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(2);
  });

  it('sends every note to the bass stave when all are below middle C', () => {
    const { container } = render(<StaffNotation notes={[52, 59]} chord={null} fading={false} />);
    const svg = svgOf(container);

    expect(svg.querySelectorAll('.vf-stavenote')).toHaveLength(1);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(2);
  });

  it('applies accidentals taken from the chord spelling', () => {
    const { container } = render(
      <StaffNotation
        notes={[61, 65, 68]}
        chord={spelledAs({ 1: 'C#', 5: 'F', 8: 'G#' })}
        fading={false}
      />,
    );

    const svg = svgOf(container);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(3);
    expect(glyphCount(svg, GLYPH.sharp)).toBe(2);
    expect(glyphCount(svg, GLYPH.flat)).toBe(0);
  });

  it('renders double accidentals from the spelling without crashing', () => {
    const { container } = render(
      <StaffNotation
        notes={[60, 63, 66, 69]}
        chord={spelledAs({ 0: 'C', 3: 'Eb', 6: 'Gb', 9: 'Bbb' })}
        fading={false}
      />,
    );

    const svg = svgOf(container);
    expect(svg.querySelectorAll('.vf-notehead')).toHaveLength(4);
    expect(glyphCount(svg, GLYPH.flat)).toBe(2);
    expect(glyphCount(svg, GLYPH.doubleFlat)).toBe(1);
  });

  it('renders a B#-spelled middle C without crashing', () => {
    const { container } = render(
      <StaffNotation notes={[60, 61, 64]} chord={spelledAs({ 0: 'B#', 1: 'C#', 4: 'E' })} fading={false} />,
    );

    expect(svgOf(container).querySelectorAll('.vf-notehead')).toHaveLength(3);
  });

  it('draws a B#-spelled note on the same staff line as the plain B below it', () => {
    // B#4 (MIDI 72) is written on the B line of octave 4, exactly where plain B4 (MIDI 71) sits.
    const sharpened = render(<StaffNotation notes={[72]} chord={spelledAs({ 0: 'B#' })} fading={false} />);
    const sharpenedY = svgOf(sharpened.container).querySelector('.vf-notehead text')?.getAttribute('y');
    sharpened.unmount();

    const plain = render(<StaffNotation notes={[71]} chord={spelledAs({ 11: 'B' })} fading={false} />);
    const plainY = svgOf(plain.container).querySelector('.vf-notehead text')?.getAttribute('y');

    expect(sharpenedY).toBe(plainY);
  });

  it('survives extreme and wide MIDI input', () => {
    const cases: number[][] = [
      [0, 1, 2],
      [105, 106, 107, 108],
      [21, 108],
      Array.from({ length: 24 }, (_, index) => 48 + index),
    ];

    cases.forEach((notes) => {
      const { container, unmount } = render(
        <StaffNotation notes={notes} chord={null} fading={false} />,
      );
      expect(svgOf(container).querySelectorAll('.vf-notehead')).toHaveLength(notes.length);
      unmount();
    });
  });

  it('applies the fading class to the surface', () => {
    const { container, rerender } = render(
      <StaffNotation notes={[60]} chord={null} fading={false} />,
    );
    expect(surfaceOf(container).classList.contains('is-fading')).toBe(false);

    rerender(<StaffNotation notes={[60]} chord={null} fading />);
    expect(surfaceOf(container).classList.contains('is-fading')).toBe(true);
  });

  it('keeps exactly one svg after many redraws', () => {
    const { container, rerender } = render(
      <StaffNotation notes={[60]} chord={null} fading={false} />,
    );

    for (let index = 0; index < 20; index += 1) {
      rerender(<StaffNotation notes={[60 + index]} chord={null} fading={false} />);
    }

    expect(container.querySelectorAll('svg')).toHaveLength(1);
  });

  it('redraws at the new size when the container is resized', () => {
    const { container } = render(<StaffNotation notes={[60]} chord={null} fading={false} />);
    expect(svgOf(container).getAttribute('width')).toBe('600');

    stubContainerSize(420, 200);
    flushResize();

    expect(svgOf(container).getAttribute('width')).toBe('420');
  });

  it('does not redraw when a resize notification reports the same rounded size', () => {
    const { container } = render(<StaffNotation notes={[60]} chord={null} fading={false} />);
    const first = svgOf(container);

    stubContainerSize(600.2, 220.1);
    flushResize();

    expect(svgOf(container)).toBe(first);
  });

  it('coalesces a burst of resize notifications into a single redraw', () => {
    const { container } = render(<StaffNotation notes={[60]} chord={null} fading={false} />);

    const sizes = [500, 480, 460, 440];
    act(() => {
      sizes.forEach((width) => {
        stubContainerSize(width, 220);
        resizeCallbacks.forEach((callback) => callback());
      });
    });
    // The burst is deferred, not applied synchronously per notification.
    expect(svgOf(container).getAttribute('width')).toBe('600');

    act(() => {
      vi.advanceTimersByTime(32);
    });

    expect(svgOf(container).getAttribute('width')).toBe('440');
  });

  it('stops observing on unmount', () => {
    const { unmount } = render(<StaffNotation notes={[60]} chord={null} fading={false} />);
    expect(resizeCallbacks.size).toBe(1);

    unmount();
    expect(resizeCallbacks.size).toBe(0);
  });
});
