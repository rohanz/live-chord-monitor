import { useEffect, useRef, useState } from 'react';
import { midiToFrequency } from '../music/notes';

/**
 * Overall headroom applied on top of the user volume so stacked voices do not clip.
 *
 * Signal graph (deliberate):
 *
 *   per-voice osc -> filter -> voice envelope gain (peaks at 1.0)
 *        -> shared master gain (volume * MASTER_GAIN, or 0 when muted)
 *        -> shared limiter (DynamicsCompressor)
 *        -> destination
 *
 * Two things fall out of this that used to be broken:
 *  - Voices no longer connect straight to `destination`, so a ten-note voicing cannot sum past the
 *    +/-1 ceiling unchecked; the limiter catches the low-register in-phase worst case.
 *  - Volume/mute only ever writes to the ONE master gain, so changing volume mid-chord can never
 *    re-attack a held voice or wipe out its decay envelope.
 */
const MASTER_GAIN = 0.28;
/** Below this the exponential ramps are undefined, so every envelope target is floored here. */
const MIN_GAIN = 0.0001;
const ATTACK_S = 0.018;
const DECAY_START_S = 0.08;
const DECAY_TIME_CONSTANT = 0.32;
const SUSTAIN_LEVEL = 0.68;
const RELEASE_TIME_CONSTANT = 0.045;
/** How long after the release ramp we tear the voice's nodes down. */
const RELEASE_TEARDOWN_MS = 220;
const VOLUME_TIME_CONSTANT = 0.015;

type Voice = {
  oscillators: OscillatorNode[];
  gain: GainNode;
};

/**
 * The Web Audio side of the hook, kept as a plain object with stable identity so the React effects
 * below have no changing dependencies (and so the graph can be reasoned about without React).
 */
function createPianoEngine() {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let level = 0;
  const voices = new Map<number, Voice>();
  const releaseTimers = new Set<number>();

  // The OS can interrupt/suspend the context (device change, sleep, audio focus loss).
  const handleStateChange = () => {
    if (context && context.state === 'suspended') {
      void context.resume();
    }
  };

  function ensureContext(): AudioContext {
    if (!context) {
      context = new AudioContext({ latencyHint: 'interactive' });

      master = context.createGain();
      master.gain.setValueAtTime(level, context.currentTime);

      const limiter = context.createDynamicsCompressor?.();

      if (limiter) {
        limiter.threshold.value = -6;
        limiter.knee.value = 6;
        limiter.ratio.value = 12;
        limiter.attack.value = 0.003;
        limiter.release.value = 0.25;
        master.connect(limiter);
        limiter.connect(context.destination);
      } else {
        master.connect(context.destination);
      }

      context.addEventListener?.('statechange', handleStateChange);
    }

    if (context.state === 'suspended') {
      void context.resume();
    }

    return context;
  }

  function disposeVoice(voice: Voice) {
    for (const oscillator of voice.oscillators) {
      oscillator.stop();
      oscillator.disconnect();
    }

    voice.gain.disconnect();
  }

  return {
    /**
     * Called from a real user gesture. MIDI messages are NOT user-activation gestures in Chromium,
     * so a context first built from an incoming MIDI note can be born `suspended`, and resume() off
     * a non-gesture path is not guaranteed - the first note(s) go silent.
     */
    prime() {
      ensureContext();
    },

    /** Volume/mute writes ONLY here; voice envelopes are never rescheduled. */
    setLevel(nextLevel: number) {
      level = nextLevel;

      if (context && master) {
        master.gain.setTargetAtTime(level, context.currentTime, VOLUME_TIME_CONSTANT);
      }
    },

    startNote(note: number) {
      if (voices.has(note)) {
        return;
      }

      const audio = ensureContext();

      if (!master) {
        return;
      }

      const now = audio.currentTime;
      const gain = audio.createGain();
      const filter = audio.createBiquadFilter();
      const frequency = midiToFrequency(note);

      filter.type = 'lowpass';
      filter.frequency.value = 2600;
      filter.Q.value = 0.6;

      // Envelope is unit-scaled; audibility is entirely the master gain's job.
      gain.gain.setValueAtTime(MIN_GAIN, now);
      gain.gain.exponentialRampToValueAtTime(1, now + ATTACK_S);
      gain.gain.setTargetAtTime(SUSTAIN_LEVEL, now + DECAY_START_S, DECAY_TIME_CONSTANT);

      const oscA = audio.createOscillator();
      oscA.type = 'triangle';
      oscA.frequency.value = frequency;

      const oscB = audio.createOscillator();
      oscB.type = 'sine';
      oscB.frequency.value = frequency * 2;

      const harmonicGain = audio.createGain();
      harmonicGain.gain.value = 0.24;

      oscA.connect(filter);
      oscB.connect(harmonicGain);
      harmonicGain.connect(filter);
      filter.connect(gain);
      gain.connect(master);

      oscA.start(now);
      oscB.start(now);

      voices.set(note, { oscillators: [oscA, oscB], gain });
    },

    stopNote(note: number) {
      const voice = voices.get(note);

      if (!voice) {
        return;
      }

      const now = context ? context.currentTime : 0;

      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setTargetAtTime(MIN_GAIN, now, RELEASE_TIME_CONSTANT);

      // Deleting the map entry now (while the timer closes over the OLD voice) is what makes
      // retriggering the same note inside the release window safe. Keep it before the timer setup.
      voices.delete(note);

      const timer = window.setTimeout(() => {
        releaseTimers.delete(timer);
        disposeVoice(voice);
      }, RELEASE_TEARDOWN_MS);

      releaseTimers.add(timer);
    },

    dispose() {
      // Tear voices down synchronously: the deferred teardown timers would otherwise fire after
      // unmount, and the context is about to be closed out from under them anyway.
      for (const timer of releaseTimers) {
        window.clearTimeout(timer);
      }
      releaseTimers.clear();

      for (const voice of voices.values()) {
        disposeVoice(voice);
      }
      voices.clear();

      const closing = context;
      context = null;
      master = null;

      if (closing) {
        closing.removeEventListener?.('statechange', handleStateChange);
        // Leaving this open leaks a live hardware audio stream for the process lifetime.
        void closing.close?.();
      }
    },
  };
}

type PianoEngine = ReturnType<typeof createPianoEngine>;

export function usePianoAudio(activeNotes: number[], volume: number, muted: boolean) {
  // useState (not useRef) purely so the engine is created exactly once and can be read during
  // render without touching a ref mid-render. It is never set again.
  const [engine] = useState<PianoEngine>(createPianoEngine);
  const activeRef = useRef<Set<number>>(new Set());

  // Declared FIRST on purpose: effects run in order, so the engine knows the current level before
  // the note effect below can create the AudioContext. A context built later (by a gesture or by
  // the first note) then starts at the right level instead of at full volume.
  useEffect(() => {
    engine.setLevel(muted ? 0 : volume * MASTER_GAIN);
  }, [engine, muted, volume]);

  useEffect(() => {
    const nextActive = new Set(activeNotes);
    const previousActive = activeRef.current;

    for (const note of nextActive) {
      if (!previousActive.has(note)) {
        engine.startNote(note);
      }
    }

    for (const note of previousActive) {
      if (!nextActive.has(note)) {
        engine.stopNote(note);
      }
    }

    activeRef.current = nextActive;
  }, [activeNotes, engine]);

  useEffect(() => {
    const prime = () => engine.prime();

    window.addEventListener('pointerdown', prime);
    window.addEventListener('keydown', prime);

    return () => {
      window.removeEventListener('pointerdown', prime);
      window.removeEventListener('keydown', prime);
    };
  }, [engine]);

  useEffect(() => {
    return () => {
      engine.dispose();
      activeRef.current = new Set();
    };
  }, [engine]);
}
