import { render, renderHook, waitFor, fireEvent, screen } from '@testing-library/react';
import { App } from '../App';
import { act, createElement, useEffect, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { midiToFrequency } from '../music/notes';
import { usePianoAudio } from './usePianoAudio';
import { createNoteStore } from '../input/noteStore';

// A recording AudioContext so we can assert on the exact values written to the graph, not just
// that nodes were constructed. (It stays local to this file rather than living in the shared
// src/test/setup.ts because only these tests need the per-instance registries.)
vi.mock('../components/StaffNotation', () => ({ StaffNotation: () => null }));

const contexts: RecordingContext[] = [];
const gains: RecordingGain[] = [];
const oscillators: RecordingOscillator[] = [];
const compressors: RecordingCompressor[] = [];

/** Overridden per-test to simulate a context that is born suspended (no user gesture yet). */
let initialState: AudioContextState = 'running';

class RecordingParam {
  value = 0;
  cancelScheduledValues = vi.fn();
  cancelAndHoldAtTime = vi.fn();
  setTargetAtTime = vi.fn((value: number) => { this.value = value; });
  setValueAtTime = vi.fn((value: number) => { this.value = value; });
  exponentialRampToValueAtTime = vi.fn((value: number) => { this.value = value; });
}

class RecordingNode {
  connectedTo: unknown[] = [];
  connect = vi.fn((target: unknown) => { this.connectedTo.push(target); return target; });
  disconnect = vi.fn();
}

class RecordingGain extends RecordingNode {
  gain = new RecordingParam();
  constructor() {
    super();
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

class RecordingCompressor extends RecordingNode {
  threshold = new RecordingParam();
  knee = new RecordingParam();
  ratio = new RecordingParam();
  attack = new RecordingParam();
  release = new RecordingParam();
  constructor() {
    super();
    compressors.push(this);
  }
}

class RecordingContext {
  currentTime = 0;
  state: AudioContextState;
  destination = new RecordingNode();
  listeners = new Map<string, Set<() => void>>();

  resume = vi.fn(async () => { this.state = 'running'; });
  close = vi.fn(async () => { this.state = 'closed'; });
  createGain = vi.fn(() => new RecordingGain());
  createOscillator = vi.fn(() => new RecordingOscillator());
  createBiquadFilter = vi.fn(() => new RecordingFilter());
  createDynamicsCompressor = vi.fn(() => new RecordingCompressor());
  addEventListener = vi.fn((type: string, handler: () => void) => {
    const set = this.listeners.get(type) ?? new Set();
    set.add(handler);
    this.listeners.set(type, set);
  });
  removeEventListener = vi.fn((type: string, handler: () => void) => {
    this.listeners.get(type)?.delete(handler);
  });

  constructor() {
    this.state = initialState;
    contexts.push(this);
  }

  emit(type: string) {
    for (const handler of this.listeners.get(type) ?? []) {
      handler();
    }
  }
}

/** The shared master gain is the first gain the hook ever creates (built with the context). */
const masterGain = () => gains[0];
/** Then the per-voice envelope gain, then that voice's harmonic mix gain. */
const voiceGain = (index = 0) => gains[1 + index * 2];

function useSnapshotPianoAudio(notes: number[], volume: number, muted: boolean) {
  const [store] = useState(createNoteStore);
  usePianoAudio(store, volume, muted);
  useEffect(() => {
    for (const note of store.getSnapshot()) {
      if (!notes.includes(note)) store.noteOff(note, 'test');
    }
    for (const note of notes) store.noteOn(note, 'test');
  }, [notes, store]);
}

describe('usePianoAudio', () => {
  beforeEach(() => {
    contexts.length = 0;
    gains.length = 0;
    oscillators.length = 0;
    compressors.length = 0;
    initialState = 'running';
    vi.stubGlobal('AudioContext', RecordingContext);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('starts a two-oscillator voice tuned to the note and its octave', () => {
    renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    expect(oscillators).toHaveLength(2);

    const [oscA, oscB] = oscillators;
    expect(oscA.frequency.value).toBeCloseTo(midiToFrequency(60), 6);
    expect(oscA.type).toBe('triangle');
    // The timbre is a fundamental plus its second harmonic; any other ratio is a different instrument.
    expect(oscB.frequency.value).toBeCloseTo(midiToFrequency(60) * 2, 6);
    expect(oscB.type).toBe('sine');
    expect(oscA.start).toHaveBeenCalled();
    expect(oscB.start).toHaveBeenCalled();
  });

  it('routes voices through a shared master gain and limiter instead of straight to the destination', () => {
    renderHook(() => useSnapshotPianoAudio([60], 0.5, false));

    const context = contexts[0];
    expect(compressors).toHaveLength(1);
    expect(masterGain().connectedTo).toEqual([compressors[0]]);
    expect(compressors[0].connectedTo).toEqual([context.destination]);
    // The voice must land on the master gain; nothing but the limiter touches the destination.
    expect(voiceGain().connectedTo).toEqual([masterGain()]);
    expect(context.destination.connect).not.toHaveBeenCalled();
  });

  it('applies the master headroom to the user volume', () => {
    renderHook(() => useSnapshotPianoAudio([60], 0.5, false));

    // 0.5 volume * 0.28 headroom. A stacked ten-note voicing would clip without this attenuation.
    expect(masterGain().gain.value).toBeCloseTo(0.14, 6);
    expect(masterGain().gain.setValueAtTime).toHaveBeenCalledWith(0.14, 0);
  });

  it('is silent when a note starts while muted', () => {
    renderHook(() => useSnapshotPianoAudio([60], 0.5, true));

    expect(oscillators).toHaveLength(2);
    expect(masterGain().gain.value).toBe(0);
    expect(masterGain().gain.setValueAtTime).toHaveBeenCalledWith(0, 0);
  });

  it('ramps the output to zero when muted mid-chord', () => {
    const { rerender } = renderHook(({ muted }) => useSnapshotPianoAudio([60], 0.5, muted), { initialProps: { muted: false } });

    act(() => rerender({ muted: true }));

    expect(masterGain().gain.setTargetAtTime).toHaveBeenCalledWith(0, expect.any(Number), expect.any(Number));
    expect(masterGain().gain.value).toBe(0);
  });

  it('changes volume without re-attacking or rescheduling held voices', () => {
    const { rerender } = renderHook(({ volume }) => useSnapshotPianoAudio([60], volume, false), { initialProps: { volume: 0.5 } });

    const envelope = voiceGain().gain;
    const envelopeWritesAfterAttack = envelope.setTargetAtTime.mock.calls.length;

    act(() => rerender({ volume: 0.9 }));

    // The master gain absorbs the change...
    expect(masterGain().gain.value).toBeCloseTo(0.9 * 0.28, 6);
    // ...and the sustaining voice's envelope is left completely alone.
    expect(envelope.setTargetAtTime.mock.calls.length).toBe(envelopeWritesAfterAttack);
    expect(envelope.cancelScheduledValues).not.toHaveBeenCalled();
    expect(envelope.exponentialRampToValueAtTime).toHaveBeenCalledTimes(1);
  });

  it('gives the voice a unit-scaled attack/decay envelope', () => {
    renderHook(() => useSnapshotPianoAudio([60], 0.5, false));

    const envelope = voiceGain().gain;
    expect(envelope.setValueAtTime).toHaveBeenCalledWith(0.0001, 0);
    expect(envelope.exponentialRampToValueAtTime).toHaveBeenCalledWith(1, 0.018);
    expect(envelope.setTargetAtTime).toHaveBeenCalledWith(0.68, 0.08, 0.32);
  });

  it('stops the oscillators after the note is released', () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    act(() => rerender({ notes: [] }));
    expect(oscillators[0].stop).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(220));

    expect(oscillators[0].stop).toHaveBeenCalled();
    expect(oscillators[1].stop).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('retriggering inside the release window keeps the new voice alive', () => {
    vi.useFakeTimers();
    const { rerender } = renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    act(() => rerender({ notes: [] }));
    act(() => rerender({ notes: [60] }));
    act(() => vi.advanceTimersByTime(220));

    // The old voice's teardown must not stop the freshly retriggered oscillators.
    expect(oscillators[0].stop).toHaveBeenCalled();
    expect(oscillators[2].stop).not.toHaveBeenCalled();
    expect(oscillators[3].stop).not.toHaveBeenCalled();
  });

  it('tears voices down and closes the context on unmount without leaving timers pending', () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useSnapshotPianoAudio([60], 0.5, false));
    const context = contexts[0];

    unmount();

    expect(oscillators[0].stop).toHaveBeenCalled();
    expect(oscillators[1].stop).toHaveBeenCalled();
    expect(context.close).toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clears the pending release timer on unmount', () => {
    vi.useFakeTimers();
    const { rerender, unmount } = renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });

    act(() => rerender({ notes: [] }));
    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('primes the audio context from a user gesture before any note arrives', () => {
    initialState = 'suspended';
    renderHook(() => useSnapshotPianoAudio([], 0.5, false));

    expect(contexts).toHaveLength(0);

    act(() => {
      window.dispatchEvent(new Event('pointerdown'));
    });

    expect(contexts).toHaveLength(1);
    expect(contexts[0].resume).toHaveBeenCalled();
  });

  it('re-resumes the context when the OS suspends it', () => {
    renderHook(() => useSnapshotPianoAudio([60], 0.5, false));

    const context = contexts[0];
    context.state = 'suspended';
    act(() => context.emit('statechange'));

    expect(context.resume).toHaveBeenCalled();
  });

  it('holds the instantaneous envelope value when released during its attack', () => {
    const { rerender } = renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });
    contexts[0].currentTime = 0.009;
    rerender({ notes: [] });
    const envelope = voiceGain().gain;
    expect(envelope.cancelAndHoldAtTime).toHaveBeenCalledWith(0.009);
    expect(envelope.cancelAndHoldAtTime.mock.invocationCallOrder[0]).toBeLessThan(envelope.setTargetAtTime.mock.invocationCallOrder.at(-1)!);
    expect(envelope.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0.009, 0.045);
  });

  it('preserves the analytic attack value when cancelAndHoldAtTime is unavailable', () => {
    const { rerender } = renderHook(({ notes }) => useSnapshotPianoAudio(notes, 0.5, false), { initialProps: { notes: [60] } });
    const envelope = voiceGain().gain;
    Object.defineProperty(envelope, 'cancelAndHoldAtTime', { value: undefined });
    contexts[0].currentTime = 0.009;
    rerender({ notes: [] });
    expect(envelope.cancelScheduledValues).toHaveBeenCalledWith(0.009);
    expect(envelope.setValueAtTime).toHaveBeenLastCalledWith(0.01, 0.009);
    expect(envelope.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0.009, 0.045);
  });

  async function midiApp() {
    const input = { id: 'A', name: 'Keys', state: 'connected', onmidimessage: null as ((event: MIDIMessageEvent) => void) | null };
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => ({ inputs: new Map([['A', input]]), onstatechange: null })) });
    window.localStorage.clear();
    render(createElement(App));
    await waitFor(() => expect(input.onmidimessage).toBeTypeOf('function'));
    return (data: number[]) => input.onmidimessage?.({ data: new Uint8Array(data) } as MIDIMessageEvent);
  }

  it('re-attacks MIDI notes released and pressed again inside one React batch', async () => {
    const send = await midiApp();
    act(() => send([0x90, 60, 100]));
    expect(oscillators).toHaveLength(2);
    act(() => { send([0x80, 60, 0]); send([0x90, 60, 100]); });
    expect(oscillators).toHaveLength(4);
    expect(voiceGain().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
  });

  it('sounds a complete MIDI tap delivered in one batch and panic releases all sources', async () => {
    const send = await midiApp();
    act(() => { send([0x90, 60, 100]); send([0x80, 60, 0]); });
    expect(oscillators).toHaveLength(2);
    expect(voiceGain().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
    act(() => send([0x90, 64, 100]));
    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.click(screen.getByRole('button', { name: /All notes off/ }));
    expect(voiceGain(1).gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
    expect(voiceGain(2).gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
    act(() => send([0x90, 67, 100]));
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(voiceGain(3).gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
  });

  it('does not release or re-attack a pitch while another MIDI channel still holds it', async () => {
    const send = await midiApp();
    act(() => { send([0x90, 60, 100]); send([0x91, 60, 100]); });
    expect(oscillators).toHaveLength(2);
    act(() => send([0x80, 60, 0]));
    expect(voiceGain().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.68, 0.08, 0.32);
    act(() => send([0x81, 60, 0]));
    expect(voiceGain().gain.setTargetAtTime).toHaveBeenLastCalledWith(0.0001, 0, 0.045);
  });

});
