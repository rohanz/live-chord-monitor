import { describe, expect, it, vi } from 'vitest';
import { createNoteStore } from './noteStore';

describe('ordered source-count transitions', () => {
  it('emits only the first hold and last release and preserves snapshot identity between them', () => {
    const store = createNoteStore();
    const listener = vi.fn();
    const display = vi.fn();
    store.subscribeTransitions(listener);
    store.subscribe(display);
    store.noteOn(60, 'midi:A:0:60');
    const snapshot = store.getSnapshot();
    store.noteOn(60, 'midi:A:0:60');
    store.noteOn(60, 'pointer:2:60');
    store.noteOff(60, 'missing');
    store.noteOff(60, 'midi:A:0:60');
    expect(store.getSnapshot()).toBe(snapshot);
    expect(listener.mock.calls).toEqual([[{ type: 'on', note: 60 }]]);
    store.noteOff(60, 'pointer:2:60');
    expect(store.getSnapshot()).toEqual([]);
    expect(listener.mock.calls).toEqual([[{ type: 'on', note: 60 }], [{ type: 'off', note: 60 }]]);
    expect(display).toHaveBeenCalledTimes(2);
  });

  it('preserves a tap and re-attack in order even when the final snapshot is unchanged', () => {
    const store = createNoteStore();
    const listener = vi.fn();
    store.subscribeTransitions(listener);
    store.noteOn(60, 'A');
    store.noteOff(60, 'A');
    store.noteOn(60, 'A');
    store.noteOff(60, 'A');
    expect(listener.mock.calls.map(([event]) => event.type)).toEqual(['on', 'off', 'on', 'off']);
    expect(store.getSnapshot()).toEqual([]);
  });

  it('panic releases each pitch once, forgets every source, and accepts a fresh press', () => {
    const store = createNoteStore();
    const listener = vi.fn();
    store.noteOn(64, 'A');
    store.noteOn(60, 'B');
    store.noteOn(60, 'C');
    expect(store.getSnapshot()).toEqual([60, 64]);
    const unsubscribe = store.subscribeTransitions(listener);
    store.clear();
    expect(store.getSnapshot()).toEqual([]);
    expect(listener.mock.calls).toEqual([[{ type: 'off', note: 64 }], [{ type: 'off', note: 60 }]]);
    store.noteOff(60, 'C');
    store.noteOn(60, 'C');
    expect(listener).toHaveBeenLastCalledWith({ type: 'on', note: 60 });
    unsubscribe();
    listener.mockClear();
    store.clear();
    expect(listener).not.toHaveBeenCalled();
  });
});
