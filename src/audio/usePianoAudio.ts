import { useEffect, useRef } from 'react';
import { midiToFrequency } from '../music/notes';

type Voice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
};

export function usePianoAudio(activeNotes: number[], volume: number, muted: boolean) {
  const contextRef = useRef<AudioContext | null>(null);
  const voicesRef = useRef<Map<number, Voice>>(new Map());
  const activeRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const nextActive = new Set(activeNotes);
    const previousActive = activeRef.current;

    for (const note of nextActive) {
      if (!previousActive.has(note)) {
        startNote(note);
      }
    }

    for (const note of previousActive) {
      if (!nextActive.has(note)) {
        stopNote(note);
      }
    }

    activeRef.current = nextActive;
  }, [activeNotes]);

  useEffect(() => {
    const gainValue = muted ? 0 : volume;

    for (const voice of voicesRef.current.values()) {
      const context = voice.gain.context;
      voice.gain.gain.cancelScheduledValues(context.currentTime);
      voice.gain.gain.setTargetAtTime(gainValue * 0.28, context.currentTime, 0.015);
    }
  }, [muted, volume]);

  useEffect(() => {
    return () => {
      for (const note of voicesRef.current.keys()) {
        stopNote(note);
      }
    };
  }, []);

  function ensureContext(): AudioContext {
    if (!contextRef.current) {
      contextRef.current = new AudioContext({ latencyHint: 'interactive' });
    }

    if (contextRef.current.state === 'suspended') {
      void contextRef.current.resume();
    }

    return contextRef.current;
  }

  function startNote(note: number) {
    if (voicesRef.current.has(note)) {
      return;
    }

    const context = ensureContext();
    const now = context.currentTime;
    const gain = context.createGain();
    const filter = context.createBiquadFilter();
    const frequency = midiToFrequency(note);
    const level = muted ? 0 : volume * 0.28;

    filter.type = 'lowpass';
    filter.frequency.value = 2600;
    filter.Q.value = 0.6;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(level, 0.0001), now + 0.018);
    gain.gain.setTargetAtTime(Math.max(level * 0.68, 0.0001), now + 0.08, 0.32);

    const oscA = context.createOscillator();
    oscA.type = 'triangle';
    oscA.frequency.value = frequency;

    const oscB = context.createOscillator();
    oscB.type = 'sine';
    oscB.frequency.value = frequency * 2;

    const harmonicGain = context.createGain();
    harmonicGain.gain.value = 0.24;

    oscA.connect(filter);
    oscB.connect(harmonicGain);
    harmonicGain.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);

    oscA.start(now);
    oscB.start(now);

    voicesRef.current.set(note, { oscillators: [oscA, oscB], gain });
  }

  function stopNote(note: number) {
    const voice = voicesRef.current.get(note);

    if (!voice) {
      return;
    }

    const context = voice.gain.context;
    const now = context.currentTime;

    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setTargetAtTime(0.0001, now, 0.045);

    window.setTimeout(() => {
      for (const oscillator of voice.oscillators) {
        oscillator.stop();
        oscillator.disconnect();
      }

      voice.gain.disconnect();
    }, 220);

    voicesRef.current.delete(note);
  }
}
