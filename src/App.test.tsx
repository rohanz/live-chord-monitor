import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';

vi.mock('./components/StaffNotation', () => ({
  StaffNotation: ({ notes, fading }: { notes: number[]; fading: boolean }) => (
    <div data-fading={fading ? 'true' : 'false'} data-notes={notes.join(',')} data-testid="staff" />
  ),
}));

type TestMidiInput = {
  id: string;
  name: string;
  manufacturer: string;
  state: string;
  onmidimessage: ((event: MIDIMessageEvent) => void) | null;
};

function installMidiMock(inputs: TestMidiInput[] = []) {
  const access = {
    inputs: new Map(inputs.map((input) => [input.id, input as unknown as MIDIInput])),
    onstatechange: null,
  } as unknown as MIDIAccess;

  Object.defineProperty(navigator, 'requestMIDIAccess', {
    configurable: true,
    value: vi.fn(async () => access),
  });

  return { access, inputs };
}

function makeMidiInput(id = 'input-1'): TestMidiInput {
  return {
    id,
    name: 'Test MIDI',
    manufacturer: 'Test',
    state: 'connected',
    onmidimessage: null,
  };
}

function midiMessage(data: number[], target: TestMidiInput): MIDIMessageEvent {
  return {
    data: new Uint8Array(data),
    target: target as unknown as MIDIInput,
  } as unknown as MIDIMessageEvent;
}

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
    installMidiMock();
  });

  it('starts with an empty chord readout, permanent staff, 3-octave default range, and integrated range slider', async () => {
    const { container } = render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('');
    expect(screen.getByTestId('staff')).toBeInTheDocument();
    expect(screen.getByText('C3')).toBeInTheDocument();
    expect(screen.getByText('C6')).toBeInTheDocument();
    expect(container.querySelector('.keyboard-range-slider input[type="range"]')).toBeInTheDocument();
    expect(container.querySelector('.range-overview')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('0 MIDI inputs')).toBeInTheDocument());
  });

  it('keeps shortcut guidance in Help instead of the bottom control strip', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(screen.queryByText('A W S E D F T G Y H U J K O L')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Help' }));

    const help = screen.getByLabelText('Help panel');
    expect(within(help).getByText('A W S E D F T G Y H U J K O L')).toBeInTheDocument();
    expect(within(help).getByText('Z moves down. X moves up.')).toBeInTheDocument();
  });

  it('uses a resettable volume slider', () => {
    render(<App />);
    const volume = screen.getByLabelText('Volume') as HTMLInputElement;

    expect(volume.value).toBe('0.72');
    fireEvent.change(volume, { target: { value: '0.25' } });
    expect(volume.value).toBe('0.25');

    fireEvent.doubleClick(volume);
    expect(volume.value).toBe('0.72');
  });

  it('opens Settings with chord style, inversion, key spelling, pressed labels, notation, and linger controls', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByLabelText('Settings panel');

    expect(within(settings).getByText('Chord style')).toBeInTheDocument();
    expect(within(settings).getByText('Inversions')).toBeInTheDocument();
    expect(within(settings).getByText('Spelling')).toBeInTheDocument();
    expect(within(settings).getByText('Pressed key names')).toBeInTheDocument();
    expect(within(settings).getByText('Grand staff')).toBeInTheDocument();
    expect(within(settings).getByText('Linger')).toBeInTheDocument();
  });

  it('groups the spelling options into Sharps and Flats so the binary behavior is visible', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const settings = screen.getByLabelText('Settings panel');

    expect(settings.querySelector('optgroup[label="Sharps"]')).toBeInTheDocument();
    expect(settings.querySelector('optgroup[label="Flats"]')).toBeInTheDocument();
  });

  it('persists settings across app restarts', async () => {
    const user = userEvent.setup();
    const first = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(within(screen.getByLabelText('Settings panel')).getByLabelText('Chord style'), 'delta');
    first.unmount();

    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const reopened = within(screen.getByLabelText('Settings panel')).getByLabelText('Chord style') as HTMLSelectElement;
    expect(reopened.value).toBe('delta');
  });

  it('plays computer-keyboard chords immediately and maps O/L above K', () => {
    render(<App />);

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyDown(window, { code: 'KeyG' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');

    fireEvent.keyUp(window, { code: 'KeyA' });
    fireEvent.keyUp(window, { code: 'KeyD' });
    fireEvent.keyUp(window, { code: 'KeyG' });

    fireEvent.keyDown(window, { code: 'KeyO' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C#');

    fireEvent.keyDown(window, { code: 'KeyL' });
    expect(screen.getByTestId('staff')).toHaveAttribute('data-notes', '73,74');
  });

  it('plays notes by clicking piano keys with the mouse', () => {
    const { container } = render(<App />);
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;

    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(firstWhiteKey, { pointerId: 1 });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');
    expect(firstWhiteKey).toHaveClass('is-active');

    fireEvent.pointerUp(firstWhiteKey, { pointerId: 1 });
    expect(firstWhiteKey).not.toHaveClass('is-active');
  });

  it('uses the selected key to prefer flats or sharps in display labels', async () => {
    const user = userEvent.setup();
    render(<App />);

    fireEvent.keyDown(window, { code: 'KeyO' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C#');

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.selectOptions(within(screen.getByLabelText('Settings panel')).getByLabelText('Spelling'), 'F');

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Db');
  });

  it('keeps Z/X octave shortcuts working after a button has focus', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.keyDown(window, { code: 'KeyZ' });
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('C5')).toBeInTheDocument();

    fireEvent.keyDown(window, { code: 'KeyX' });
    expect(screen.getByText('C3')).toBeInTheDocument();
    expect(screen.getByText('C6')).toBeInTheDocument();
  });

  it('syncs manual visible range changes to the middle computer-keyboard octave', () => {
    const { container } = render(<App />);
    const slider = container.querySelector('.keyboard-range-slider input[type="range"]') as HTMLInputElement;

    fireEvent.change(slider, { target: { value: '36' } });
    expect(screen.getByText('C2')).toBeInTheDocument();
    expect(screen.getByText('C5')).toBeInTheDocument();
  });

  it('settles release-only chord changes so quick chord release lingers the full chord', () => {
    vi.useFakeTimers();
    render(<App />);

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyDown(window, { code: 'KeyG' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');

    fireEvent.keyUp(window, { code: 'KeyA' });
    fireEvent.keyUp(window, { code: 'KeyD' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');

    act(() => {
      vi.advanceTimersByTime(59);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('G');

    fireEvent.keyUp(window, { code: 'KeyG' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('G');

    act(() => {
      vi.advanceTimersByTime(399);
    });
    expect(screen.getByTestId('staff')).toHaveAttribute('data-fading', 'false');

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByTestId('staff')).toHaveAttribute('data-fading', 'true');

    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('');
  });

  it('listens to all MIDI inputs and treats note-on zero velocity as note-off', async () => {
    const input = makeMidiInput();
    installMidiMock([input]);
    render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 64, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 67, 100], input));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 0], input));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');
  });

  it('releases notes still held by a MIDI device when it disconnects', async () => {
    const input = makeMidiInput();
    const { access } = installMidiMock([input]);
    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 64, 100], input));
    });
    expect(container.querySelectorAll('.white-key.is-active, .black-key.is-active').length).toBeGreaterThan(0);

    // Controller unplugged without sending any note-offs.
    act(() => {
      input.state = 'disconnected';
      access.onstatechange?.({ port: input as unknown as MIDIInput } as unknown as MIDIConnectionEvent);
    });
    expect(container.querySelectorAll('.white-key.is-active, .black-key.is-active').length).toBe(0);
  });
});
