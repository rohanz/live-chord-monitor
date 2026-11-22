import { useEffect, useRef, useState } from 'react';
import { isControlPortName } from '../utils/midiPorts';

export type MidiDeviceInfo = {
  id: string;
  name: string;
  manufacturer?: string;
  state?: string;
};

export type MidiStatus = 'unsupported' | 'requesting' | 'ready' | 'denied' | 'error';

/** DAW-control ports send protocol chatter rather than musical notes. */
export function defaultMidiInputEnabled(device: MidiDeviceInfo): boolean {
  return !isControlPortName(device.name);
}

export function useMidiInputs(
  onNoteOn: (note: number, source: string) => void,
  onNoteOff: (note: number, source: string) => void,
  isInputEnabled: (device: MidiDeviceInfo, devices: MidiDeviceInfo[]) => boolean = defaultMidiInputEnabled,
) {
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [status, setStatus] = useState<MidiStatus>(() => (
    typeof navigator !== 'undefined' && navigator.requestMIDIAccess ? 'requesting' : 'unsupported'
  ));
  const callbacks = useRef({ onNoteOn, onNoteOff, isInputEnabled });
  const reconcileRef = useRef<(() => void) | null>(null);

  // Changing a switch or callback must not tear down an unrelated input, even briefly.
  useEffect(() => {
    callbacks.current = { onNoteOn, onNoteOff, isInputEnabled };
    reconcileRef.current?.();
  }, [onNoteOn, onNoteOff, isInputEnabled]);

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;

    let cancelled = false;
    let access: MIDIAccess | null = null;
    const held = new Map<string, Map<string, number>>();
    // Track actual wrappers, not just access.inputs: disconnected open/pending ports
    // can disappear from enumeration and still retain callbacks inside Chromium.
    const subscriptions = new Map<string, { input: MIDIInput; active: boolean }>();

    function releaseInput(id: string) {
      const notes = held.get(id);
      held.delete(id);
      for (const [source, note] of notes ?? []) callbacks.current.onNoteOff(note, source);
    }

    function retire(id: string) {
      const subscription = subscriptions.get(id);
      if (subscription) {
        subscription.active = false;
        subscriptions.delete(id);
        subscription.input.onmidimessage = null;
        // close() is asynchronous and can fail if a device has vanished. The callback
        // is already invalidated, so neither outcome can resurrect the subscription.
        void subscription.input.close?.().catch(() => {});
      }
      releaseInput(id);
    }

    function reconcile() {
      if (!access || cancelled) return;
      const inputs = Array.from(access.inputs.values()).filter((input) => input.state !== 'disconnected');
      const infos = inputs.map((input) => ({
        id: input.id,
        name: input.name || 'MIDI input',
        manufacturer: input.manufacturer ?? undefined,
        state: input.state ? String(input.state) : undefined,
      }));
      setDevices((previous) => JSON.stringify(previous) === JSON.stringify(infos) ? previous : infos);
      const enabled = new Map(inputs.filter((_, index) => callbacks.current.isInputEnabled(infos[index], infos)).map((input) => [input.id, input]));

      for (const [id, subscription] of subscriptions) {
        if (enabled.get(id) !== subscription.input) retire(id);
      }
      for (const id of held.keys()) {
        if (!enabled.has(id)) releaseInput(id);
      }
      for (const [id, input] of enabled) {
        if (subscriptions.has(id)) continue;
        const subscription = { input, active: true };
        subscriptions.set(id, subscription);
        input.onmidimessage = (event) => {
          if (cancelled || !subscription.active || subscriptions.get(id) !== subscription || !event.data) return;
          const [statusByte, note, velocity] = event.data;
          const command = statusByte & 0xf0;
          const source = `midi:${id}:${statusByte & 0x0f}:${note}`;
          if (command === 0x90 && velocity > 0) {
            const notes = held.get(id) ?? new Map<string, number>();
            notes.set(source, note);
            held.set(id, notes);
            callbacks.current.onNoteOn(note, source);
          } else if (command === 0x80 || command === 0x90 && velocity === 0) {
            held.get(id)?.delete(source);
            callbacks.current.onNoteOff(note, source);
          } else if (command === 0xb0 && (note === 120 || note === 123)) {
            releaseInput(id);
          }
        };
      }
    }

    reconcileRef.current = reconcile;
    navigator.requestMIDIAccess({ sysex: false }).then((nextAccess) => {
      if (cancelled) return;
      access = nextAccess;
      setStatus('ready');
      reconcile();
      nextAccess.onstatechange = () => reconcile();
    }).catch((error) => {
      if (cancelled) return;
      for (const id of subscriptions.keys()) retire(id);
      for (const id of held.keys()) releaseInput(id);
      console.error('Could not access MIDI devices', error);
      const denied = error instanceof DOMException
        && (error.name === 'SecurityError' || error.name === 'NotAllowedError');
      setStatus(denied ? 'denied' : 'error');
    });

    return () => {
      cancelled = true;
      reconcileRef.current = null;
      if (access) access.onstatechange = null;
      for (const id of subscriptions.keys()) retire(id);
      for (const id of held.keys()) releaseInput(id);
    };
  }, []);

  return { devices, status };
}
