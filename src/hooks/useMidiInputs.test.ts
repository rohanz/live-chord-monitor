import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useMidiInputs, type MidiDeviceInfo } from './useMidiInputs';

function input(id: string) {
  return { id, name: id, state: 'connected', onmidimessage: null as ((event: MIDIMessageEvent) => void) | null, close: vi.fn(async () => undefined) };
}
function message(port: ReturnType<typeof input>, data: number[], handler = port.onmidimessage) {
  handler?.({ data: new Uint8Array(data) } as MIDIMessageEvent);
}
function setup() {
  const a = input('A');
  const b = input('B');
  const access = { inputs: new Map([[a.id, a], [b.id, b]]), onstatechange: null as ((event: object) => void) | null };
  const request = vi.fn().mockResolvedValueOnce(access).mockImplementation(() => new Promise(() => {}));
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: request });
  const on = vi.fn();
  const off = vi.fn();
  const hook = renderHook(({ enabled }) => useMidiInputs(on, off, enabled), {
    initialProps: { enabled: (device: MidiDeviceInfo) => device.state !== 'disconnected' },
  });
  return { a, b, access, request, on, off, ...hook };
}

describe('MIDI subscription lifecycle', () => {
  it('keeps A listening during a B toggle without reacquiring access', async () => {
    const { a, request, off, rerender } = setup();
    await waitFor(() => expect(a.onmidimessage).toBeTypeOf('function'));
    act(() => message(a, [0x90, 60, 100]));
    rerender({ enabled: (device) => device.id !== 'B' });
    act(() => message(a, [0x80, 60, 0]));
    expect(off).toHaveBeenCalledWith(60, 'midi:A:0:60');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('releases missing IDs and all remaining holds on permanent teardown', async () => {
    const { a, b, access, off, unmount } = setup();
    await waitFor(() => expect(a.onmidimessage).toBeTypeOf('function'));
    act(() => { message(a, [0x90, 60, 100]); message(b, [0x90, 64, 100]); });
    act(() => { access.inputs.delete('A'); access.onstatechange?.({}); });
    expect(off).toHaveBeenCalledWith(60, 'midi:A:0:60');
    unmount();
    expect(off).toHaveBeenCalledWith(64, 'midi:B:0:64');
    expect(a.close).toHaveBeenCalled();
    expect(b.close).toHaveBeenCalled();
  });

  it('closes disconnected wrappers and invalidates their callbacks across replug and disable', async () => {
    const { a, access, on, off, rerender } = setup();
    await waitFor(() => expect(a.onmidimessage).toBeTypeOf('function'));
    const retired = a.onmidimessage;
    act(() => message(a, [0x90, 60, 100]));
    act(() => { a.state = 'disconnected'; access.inputs.delete('A'); access.onstatechange?.({ port: a }); });
    expect(off).toHaveBeenCalledWith(60, 'midi:A:0:60');
    expect(a.onmidimessage).toBeNull();
    expect(a.close).toHaveBeenCalledTimes(1);
    rerender({ enabled: (device) => device.id !== 'B' });
    const replacement = input('A');
    act(() => { access.inputs.set('A', replacement); access.onstatechange?.({}); });
    rerender({ enabled: () => false });
    on.mockClear();
    act(() => message(a, [0x90, 62, 100], retired));
    expect(on).not.toHaveBeenCalled();
    expect(replacement.onmidimessage).toBeNull();
  });

  it('does not abandon held notes to a replacement permission rejection', async () => {
    const { a, request, off, rerender } = setup();
    await waitFor(() => expect(a.onmidimessage).toBeTypeOf('function'));
    request.mockReset().mockRejectedValue(new DOMException('denied', 'SecurityError'));
    act(() => message(a, [0x90, 60, 100]));
    rerender({ enabled: (device) => device.id === 'A' });
    act(() => message(a, [0x90, 60, 0]));
    expect(off).toHaveBeenCalledWith(60, 'midi:A:0:60');
    expect(request).not.toHaveBeenCalled();
  });
});
