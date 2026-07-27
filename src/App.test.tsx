import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { INVERSION_MODES, LINGER_OPTIONS, NAME_STYLES, SPELLING_KEY_OPTIONS } from './settings-options';

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

const ALL_88 = Array.from({ length: 88 }, (_, index) => 21 + index);
const isBlack = (note: number) => [1, 3, 6, 8, 10].includes(note % 12);
const MINI_WHITE = ALL_88.filter((note) => !isBlack(note));
const MINI_BLACK = ALL_88.filter(isBlack);

/**
 * Notes currently lit in the always-rendered 88-key overview. This reflects the
 * immediate held-note state (no linger/settle), and covers notes outside the
 * visible range, so it is a real state assertion rather than a chord-text one.
 */
function activeNotes(container: HTMLElement): number[] {
  const notes: number[] = [];

  container.querySelectorAll('.mini-white-key').forEach((element, index) => {
    if (element.classList.contains('is-active')) notes.push(MINI_WHITE[index]);
  });
  container.querySelectorAll('.mini-black-key').forEach((element, index) => {
    if (element.classList.contains('is-active')) notes.push(MINI_BLACK[index]);
  });

  return notes.sort((a, b) => a - b);
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

    for (const label of ['Chord style', 'Inversions', 'Spelling', 'Pressed key names', 'Grand staff', 'Linger']) {
      expect(within(settings).getByLabelText(label)).toBeInTheDocument();
    }
  });

  it('wires the settings controls to real behavior', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);
    const settingsOf = () => within(screen.getByLabelText('Settings panel'));

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    // Grand staff toggles the notation region.
    expect(screen.getByTestId('staff')).toBeInTheDocument();
    await user.click(settingsOf().getByLabelText('Grand staff'));
    expect(screen.queryByTestId('staff')).not.toBeInTheDocument();

    // Pressed key names controls the on-key labels.
    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(container.querySelector('.white-key.is-active')).toHaveTextContent('');
    await user.click(settingsOf().getByLabelText('Pressed key names'));
    expect(container.querySelector('.white-key.is-active')).toHaveTextContent('C4');

    // Linger off clears the readout as soon as the last note is released.
    await user.selectOptions(settingsOf().getByLabelText('Linger'), '0');
    expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent('');
    fireEvent.keyUp(window, { code: 'KeyA' });
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(''));
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

  it('stops computer-keyboard notes when the setting is turned off', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await user.click(within(screen.getByLabelText('Settings panel')).getByLabelText('Computer keyboard notes'));

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.keyDown(window, { code: 'KeyD' });
    fireEvent.keyDown(window, { code: 'KeyG' });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('');
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
    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 64, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 67, 100], input));
    });
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('C');
    expect(activeNotes(container)).toEqual([60, 64, 67]);

    // Zero-velocity note-on must actually drop the note (key lighting is immediate,
    // so this asserts a state CHANGE rather than the lingering chord text).
    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 0], input));
    });
    expect(activeNotes(container)).toEqual([64, 67]);
  });

  it('handles standard 0x80 note-off, non-zero channels, and messages without data', async () => {
    const input = makeMidiInput();
    installMidiMock([input]);
    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x94, 64, 100], input));
      input.onmidimessage?.(midiMessage([0x9f, 67, 100], input));
    });
    expect(activeNotes(container)).toEqual([60, 64, 67]);

    act(() => {
      // Realtime clock/active-sensing spam and a data-less message must be ignored.
      input.onmidimessage?.(midiMessage([0xf8], input));
      input.onmidimessage?.(midiMessage([0xfe], input));
      input.onmidimessage?.({ target: input } as unknown as MIDIMessageEvent);
    });
    expect(activeNotes(container)).toEqual([60, 64, 67]);

    act(() => {
      input.onmidimessage?.(midiMessage([0x80, 60, 64], input));
      input.onmidimessage?.(midiMessage([0x84, 64, 0], input));
      input.onmidimessage?.(midiMessage([0x8f, 67, 0], input));
    });
    expect(activeNotes(container)).toEqual([]);
  });

  it('releases every held note on MIDI All Notes Off / All Sound Off', async () => {
    const input = makeMidiInput();
    installMidiMock([input]);
    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x90, 64, 100], input));
    });
    expect(activeNotes(container)).toEqual([60, 64]);

    act(() => {
      input.onmidimessage?.(midiMessage([0xb0, 123, 0], input));
    });
    expect(activeNotes(container)).toEqual([]);

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0xb0, 120, 0], input));
    });
    expect(activeNotes(container)).toEqual([]);
  });

  it('refcounts the same pitch arriving on two MIDI channels', async () => {
    const input = makeMidiInput();
    installMidiMock([input]);
    const { container } = render(<App />);

    await waitFor(() => expect(screen.getByText('1 MIDI input')).toBeInTheDocument());

    act(() => {
      input.onmidimessage?.(midiMessage([0x90, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x91, 60, 100], input));
      input.onmidimessage?.(midiMessage([0x80, 60, 0], input));
    });
    expect(activeNotes(container)).toEqual([60]);

    act(() => {
      input.onmidimessage?.(midiMessage([0x81, 60, 0], input));
    });
    expect(activeNotes(container)).toEqual([]);
  });

  it('refcounts a note held by two sources at once', () => {
    const { container } = render(<App />);
    const middleC = container.querySelectorAll('.white-key')[7] as HTMLElement;
    middleC.setPointerCapture = vi.fn();
    middleC.releasePointerCapture = vi.fn();

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.pointerDown(middleC, { pointerId: 1 });
    expect(activeNotes(container)).toEqual([60]);

    fireEvent.keyUp(window, { code: 'KeyA' });
    expect(activeNotes(container)).toEqual([60]);

    fireEvent.pointerUp(middleC, { pointerId: 1 });
    expect(activeNotes(container)).toEqual([]);
  });

  it('releases a mouse-held key when the visible range changes mid-press', () => {
    const { container } = render(<App />);
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;
    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();

    fireEvent.pointerDown(firstWhiteKey, { pointerId: 1 });
    expect(activeNotes(container)).toEqual([48]);

    // X shifts the visible range up an octave, unmounting the key element under the pointer.
    fireEvent.keyDown(window, { code: 'KeyX' });
    fireEvent.pointerUp(window, { pointerId: 1 });

    expect(activeNotes(container)).toEqual([]);
  });

  it('releases computer-keyboard notes when the window loses focus', () => {
    const { container } = render(<App />);

    fireEvent.keyDown(window, { code: 'KeyA' });
    fireEvent.keyDown(window, { code: 'KeyD' });
    expect(activeNotes(container)).toEqual([60, 64]);

    fireEvent.blur(window);
    expect(activeNotes(container)).toEqual([]);
  });

  it('keeps physically held computer keys sounding at the new pitch after an octave shift', () => {
    const { container } = render(<App />);

    fireEvent.keyDown(window, { code: 'KeyA' });
    expect(activeNotes(container)).toEqual([60]);

    fireEvent.keyDown(window, { code: 'KeyX' });
    expect(activeNotes(container)).toEqual([72]);

    fireEvent.keyUp(window, { code: 'KeyA' });
    expect(activeNotes(container)).toEqual([]);
  });

  it('does not play notes or hijack typing while a settings control has focus', async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const chordStyle = within(screen.getByLabelText('Settings panel')).getByLabelText('Chord style');
    chordStyle.focus();

    const prevented = !fireEvent.keyDown(chordStyle, { code: 'KeyA', bubbles: true, cancelable: true });
    expect(activeNotes(container)).toEqual([]);
    expect(prevented).toBe(false);
  });

  it('keeps Z/X octave shortcuts available from a settings control, as documented', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const chordStyle = within(screen.getByLabelText('Settings panel')).getByLabelText('Chord style');
    chordStyle.focus();

    fireEvent.keyDown(chordStyle, { code: 'KeyZ', bubbles: true });
    expect(screen.getByText('C2')).toBeInTheDocument();

    fireEvent.keyDown(chordStyle, { code: 'KeyX', bubbles: true });
    expect(screen.getByText('C3')).toBeInTheDocument();
  });

  describe('persisted settings contract', () => {
    function storedKeys(): string[] {
      return Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index) as string).sort();
    }

    it('writes exactly the documented `lcm:` keys', async () => {
      render(<App />);

      // Literal key names are a compatibility contract: renaming or re-prefixing any of these
      // silently wipes every existing user's saved settings on upgrade.
      await waitFor(() => expect(storedKeys()).toEqual([
        'lcm:computerKeyboardNotes',
        'lcm:inversionMode',
        'lcm:lingerMs',
        'lcm:muted',
        'lcm:nameStyle',
        'lcm:notationEnabled',
        'lcm:showPressedLabels',
        'lcm:spellingKey',
        'lcm:volume',
      ]));
    });

    it('ignores an out-of-range persisted volume instead of driving the gain with it', async () => {
      window.localStorage.setItem('lcm:volume', '99');
      render(<App />);

      expect((screen.getByLabelText('Volume') as HTMLInputElement).value).toBe('0.72');
      // And the poisoned value must not survive the restart that follows.
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('lcm:volume') as string)).toBe(0.72));
    });

    it('ignores a negative persisted linger instead of scheduling a negative timeout', async () => {
      window.localStorage.setItem('lcm:lingerMs', '-1');
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const linger = within(screen.getByLabelText('Settings panel')).getByLabelText('Linger') as HTMLSelectElement;
      expect(linger.value).toBe('500');
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('lcm:lingerMs') as string)).toBe(500));
    });

    it('ignores an unknown persisted spelling key rather than diverging from the shown option', async () => {
      window.localStorage.setItem('lcm:spellingKey', '"H#"');
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const spelling = within(screen.getByLabelText('Settings panel')).getByLabelText('Spelling') as HTMLSelectElement;
      expect(spelling.value).toBe('C');
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('lcm:spellingKey') as string)).toBe('C'));
    });

    it('ignores an unknown persisted chord style and a non-boolean persisted toggle', async () => {
      window.localStorage.setItem('lcm:nameStyle', '"sharp9"');
      // `0` is a falsy non-boolean: unvalidated it would hide the staff.
      window.localStorage.setItem('lcm:notationEnabled', '0');
      const user = userEvent.setup();
      render(<App />);

      expect(screen.getByTestId('staff')).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const style = within(screen.getByLabelText('Settings panel')).getByLabelText('Chord style') as HTMLSelectElement;
      expect(style.value).toBe('maj');
      await waitFor(() => expect(JSON.parse(window.localStorage.getItem('lcm:nameStyle') as string)).toBe('maj'));
      expect(JSON.parse(window.localStorage.getItem('lcm:notationEnabled') as string)).toBe(true);
    });

    it('offers exactly the option values its validators accept', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const settings = screen.getByLabelText('Settings panel');
      const valuesOf = (label: string) =>
        Array.from((within(settings).getByLabelText(label) as HTMLSelectElement).options).map((option) => option.value);

      // Membership is the contract; display order is presentation.
      expect(valuesOf('Chord style').sort()).toEqual([...NAME_STYLES].sort());
      expect(valuesOf('Inversions').sort()).toEqual([...INVERSION_MODES].sort());
      expect(valuesOf('Spelling').sort()).toEqual([...SPELLING_KEY_OPTIONS].sort());
      expect(valuesOf('Linger')).toEqual(LINGER_OPTIONS.map(String));
    });
  });

  describe('drawers', () => {
    it('closes Help when Settings opens so the two never stack invisibly', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Help' }));
      expect(screen.getByLabelText('Help panel')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      expect(screen.getByLabelText('Settings panel')).toBeInTheDocument();
      expect(screen.queryByLabelText('Help panel')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Help' }));
      expect(screen.queryByLabelText('Settings panel')).not.toBeInTheDocument();
      expect(screen.getAllByRole('dialog')).toHaveLength(1);
    });

    it('exposes each drawer as a named, deliberately non-modal dialog', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const dialog = screen.getByRole('dialog', { name: 'Settings panel' });
      // The app behind the drawer stays interactive (you can adjust settings while playing), so
      // claiming aria-modal would misrepresent the app to assistive tech.
      expect(dialog).not.toHaveAttribute('aria-modal');
    });

    it('moves focus into the drawer on open and back to the trigger on close', async () => {
      const user = userEvent.setup();
      render(<App />);

      const trigger = screen.getByRole('button', { name: 'Settings' });
      await user.click(trigger);
      expect(screen.getByLabelText('Settings panel').contains(document.activeElement)).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Close settings' }));
      expect(screen.queryByLabelText('Settings panel')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(trigger);
    });

    it('closes on Escape and restores focus, for both drawers', async () => {
      const user = userEvent.setup();
      render(<App />);

      const helpTrigger = screen.getByRole('button', { name: 'Help' });
      await user.click(helpTrigger);
      await user.keyboard('{Escape}');
      expect(screen.queryByLabelText('Help panel')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(helpTrigger);

      const settingsTrigger = screen.getByRole('button', { name: 'Settings' });
      await user.click(settingsTrigger);
      await user.keyboard('{Escape}');
      expect(screen.queryByLabelText('Settings panel')).not.toBeInTheDocument();
      expect(document.activeElement).toBe(settingsTrigger);
    });

    it('lets Tab leave the open drawer instead of trapping it', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const settings = screen.getByLabelText('Settings panel');
      const focusable = Array.from(settings.querySelectorAll<HTMLElement>('button, select, input'));

      // Tabbing off the last control must escape the panel: the drawer is non-modal, so the app
      // behind it stays reachable and the drawer stays open.
      focusable[focusable.length - 1].focus();
      await user.tab();

      expect(settings.contains(document.activeElement)).toBe(false);
      expect(screen.getByLabelText('Settings panel')).toBeInTheDocument();
    });

    it('keeps note keys suppressed and Z/X live while a drawer holds focus', async () => {
      const user = userEvent.setup();
      const { container } = render(<App />);

      await user.click(screen.getByRole('button', { name: 'Settings' }));
      const spelling = within(screen.getByLabelText('Settings panel')).getByLabelText('Spelling');
      spelling.focus();

      // A-L must stay inert while a <select> has focus (native type-ahead wins).
      fireEvent.keyDown(spelling, { code: 'KeyA', bubbles: true });
      expect(activeNotes(container)).toEqual([]);

      // Z/X remain live from a drawer control - the drawer's Escape handler must not swallow them.
      fireEvent.keyDown(spelling, { code: 'KeyZ', bubbles: true });
      expect(screen.getByText('C2')).toBeInTheDocument();
      fireEvent.keyDown(spelling, { code: 'KeyX', bubbles: true });
      expect(screen.getByText('C3')).toBeInTheDocument();

      // Escape still closes rather than being eaten by the shortcut handlers.
      fireEvent.keyDown(spelling, { key: 'Escape', bubbles: true });
      expect(screen.queryByLabelText('Settings panel')).not.toBeInTheDocument();
    });

    it('keeps Z/X live from the Help drawer close button', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(screen.getByRole('button', { name: 'Help' }));
      const close = screen.getByRole('button', { name: 'Close help' });
      close.focus();

      fireEvent.keyDown(close, { code: 'KeyZ', bubbles: true });
      expect(screen.getByText('C2')).toBeInTheDocument();
    });
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
