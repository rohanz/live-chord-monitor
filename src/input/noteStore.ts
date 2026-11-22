export type NoteTransition = { type: 'on' | 'off'; note: number };

/** Input events are ordered; React display snapshots may be batched. Keep audio on the former. */
export function createNoteStore() {
  const sources = new Map<number, Set<string>>();
  const listeners = new Set<() => void>();
  const transitionListeners = new Set<(event: NoteTransition) => void>();
  let snapshot: number[] = [];

  function publish(type: NoteTransition['type'], note: number) {
    snapshot = Array.from(sources.keys()).sort((a, b) => a - b);
    for (const listener of transitionListeners) listener({ type, note });
    for (const listener of listeners) listener();
  }

  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    subscribeTransitions(listener: (event: NoteTransition) => void) {
      transitionListeners.add(listener);
      return () => { transitionListeners.delete(listener); };
    },
    noteOn(note: number, source: string) {
      const held = sources.get(note);
      if (held) {
        held.add(source);
        return;
      }
      sources.set(note, new Set([source]));
      publish('on', note);
    },
    noteOff(note: number, source: string) {
      const held = sources.get(note);
      if (!held?.delete(source) || held.size > 0) return;
      sources.delete(note);
      publish('off', note);
    },
    clear() {
      for (const note of sources.keys()) {
        sources.delete(note);
        publish('off', note);
      }
    },
  };
}

export type NoteStore = ReturnType<typeof createNoteStore>;
