/// <reference types="vite/client" />

interface Window {
  liveChordMonitor?: {
    platform: string;
  };
}

type MIDIMessageEvent = {
  data: Uint8Array;
  target: MIDIInput;
};

type MIDIInput = {
  id: string;
  name?: string;
  manufacturer?: string;
  state?: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
};

type MIDIConnectionEvent = {
  port: MIDIInput;
};

type MIDIAccess = {
  inputs: Map<string, MIDIInput>;
  onstatechange: ((event: MIDIConnectionEvent) => void) | null;
};

interface Navigator {
  requestMIDIAccess?: (options?: { sysex?: boolean }) => Promise<MIDIAccess>;
}
