import { useEffect, useRef, useState } from 'react';

export type MidiDeviceInfo = {
  id: string;
  name: string;
  manufacturer?: string;
  state?: string;
};

export type MidiStatus = 'unsupported' | 'requesting' | 'ready' | 'denied' | 'error';

export function useMidiInputs(
  onNoteOn: (note: number, source: string) => void,
  onNoteOff: (note: number, source: string) => void,
) {
  const [devices, setDevices] = useState<MidiDeviceInfo[]>([]);
  const [status, setStatus] = useState<MidiStatus>(() => (
    typeof navigator !== 'undefined' && navigator.requestMIDIAccess ? 'requesting' : 'unsupported'
  ));
  // Notes each input currently has sounding, keyed by source id (which includes the MIDI
  // channel, so a split/layer setup sounding the same pitch on two channels refcounts as
  // two holds). Used to release everything if the device disconnects without sending its
  // own note-offs (otherwise a held note stays stuck forever).
  const notesByInputRef = useRef<Map<string, Map<string, number>>>(new Map());

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let access: MIDIAccess | null = null;
    const notesByInput = notesByInputRef.current;

    function releaseInput(inputId: string) {
      const held = notesByInput.get(inputId);

      if (!held) {
        return;
      }

      for (const [source, note] of held) {
        onNoteOff(note, source);
      }

      notesByInput.delete(inputId);
    }

    function refreshDevices(nextAccess: MIDIAccess) {
      const inputs = Array.from(nextAccess.inputs.values());
      setDevices(inputs.map((input) => ({
        id: input.id,
        name: input.name || 'MIDI input',
        manufacturer: input.manufacturer ?? undefined,
        state: input.state ? String(input.state) : undefined,
      })));

      for (const input of inputs) {
        input.onmidimessage = (event) => {
          if (!event.data) {
            return;
          }

          const [statusByte, note, velocity] = event.data;
          const command = statusByte & 0xf0;
          const channel = statusByte & 0x0f;
          const source = `midi:${input.id}:${channel}:${note}`;

          if (command === 0x90 && velocity > 0) {
            onNoteOn(note, source);
            let held = notesByInput.get(input.id);
            if (!held) {
              held = new Map();
              notesByInput.set(input.id, held);
            }
            held.set(source, note);
          } else if (command === 0x80 || command === 0x90 && velocity === 0) {
            onNoteOff(note, source);
            notesByInput.get(input.id)?.delete(source);
          } else if (command === 0xb0 && (note === 120 || note === 123)) {
            // All Sound Off / All Notes Off - also the user's panic path for any note
            // this app still thinks is held. Deliberately released across every channel
            // of the input rather than just this one: as a panic path, broader is better.
            releaseInput(input.id);
          }
        };
      }
    }

    navigator.requestMIDIAccess({ sysex: false })
      .then((nextAccess) => {
        if (cancelled) {
          return;
        }

        access = nextAccess;
        setStatus('ready');
        refreshDevices(nextAccess);
        nextAccess.onstatechange = (event) => {
          const port = event.port;
          if (port && port.state === 'disconnected') {
            releaseInput(port.id);
          }
          refreshDevices(nextAccess);
        };
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }

        console.error('Could not access MIDI devices', error);
        // Chromium historically rejects a denied MIDI permission with SecurityError
        // and is migrating toward NotAllowedError; treat both as "denied".
        const denied = error instanceof DOMException
          && (error.name === 'SecurityError' || error.name === 'NotAllowedError');
        setStatus(denied ? 'denied' : 'error');
      });

    return () => {
      cancelled = true;

      if (access) {
        for (const input of access.inputs.values()) {
          input.onmidimessage = null;
        }

        access.onstatechange = null;
      }
    };
  }, [onNoteOff, onNoteOn]);

  return { devices, status };
}
