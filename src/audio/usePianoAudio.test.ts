import { renderHook } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePianoAudio } from './usePianoAudio';

// A recording AudioContext so we can assert on the exact oscillators/gains the hook creates.
const oscillators: RecordingOscillator[] = [];
const gains: RecordingGain[] = [];

class RecordingParam {
  value = 0;
  cancelScheduledValues = vi.fn();
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  exponentialRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
}

class RecordingNode {
  connect = vi.fn(() => this);
  disconnect = vi.fn();
}

class RecordingGain extends RecordingNode {
  gain = new RecordingParam();
  context: RecordingContext;
  constructor(context: RecordingContext) {
    super();
    this.context = context;
    gains.push(this);
  }
}

class RecordingOscillator extends RecordingNode {
  type = 'sine';
  frequency = new RecordingParam();
  start = vi.fn();
  stop = vi.fn();
  constructor() {
    super();
    oscillators.push(this);
  }
}

class RecordingFilter extends RecordingNode {
  type = 'lowpass';
  frequency = new RecordingParam();
  Q = new RecordingParam();
}

class RecordingContext {
  currentTime = 0;
  state = 'running';
  destination = new RecordingNode();
  resume = vi.fn(async () => undefined);
  createGain = vi.fn(() => new RecordingGain(this));
  createOscillator = vi.fn(() => new RecordingOscillator());
  createBiquadFilter = vi.fn(() => new RecordingFilter());
}

describe('usePianoAudio', () => {
  beforeEach(() => {
    oscillators.length = 0;
    gains.length = 0;
    vi.stubGlobal('AudioContext', RecordingContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts a two-oscillator voice when a note becomes active', () => {
    renderHook(({ notes }) => usePianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    expect(oscillators).toHaveLength(2);
    expect(oscillators[0].start).toHaveBeenCalled();
    expect(oscillators[1].start).toHaveBeenCalled();
  });

  it('stops the oscillators after the note is released', () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ notes }) => usePianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    act(() => rerender({ notes: [] }));
    act(() => vi.advanceTimersByTime(220));

    expect(oscillators[0].stop).toHaveBeenCalled();
    expect(oscillators[1].stop).toHaveBeenCalled();
  });

  it('ramps the voice gain to zero when muted', () => {
    const { rerender } = renderHook(({ muted }) => usePianoAudio([60], 0.5, muted), { initialProps: { muted: false } });

    act(() => rerender({ muted: true }));

    expect(gains[0].gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
  });
});
