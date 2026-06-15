import { useEffect, useState } from 'react';

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

  useEffect(() => {
    if (!navigator.requestMIDIAccess) {
      setStatus('unsupported');
      return;
    }

    let cancelled = false;
    let access: MIDIAccess | null = null;

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
          const source = `midi:${input.id}:${note}`;

          if (command === 0x90 && velocity > 0) {
            onNoteOn(note, source);
          } else if (command === 0x80 || command === 0x90 && velocity === 0) {
            onNoteOff(note, source);
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
        nextAccess.onstatechange = () => refreshDevices(nextAccess);
      })
      .catch((error) => {
        console.error('Could not access MIDI devices', error);
        setStatus(error instanceof DOMException && error.name === 'SecurityError' ? 'denied' : 'error');
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
