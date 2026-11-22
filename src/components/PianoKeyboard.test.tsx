import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PianoKeyboard, RangeOverview } from './PianoKeyboard';

function pointerEvent(type: string, pointerId = 1) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'pointerId', { value: pointerId });
  return event;
}

describe('PianoKeyboard', () => {
  it('renders the selected visible range and lights active white and black keys with the same active class', () => {
    const { container } = render(
      <PianoKeyboard startNote={60} endNote={72} activeNotes={new Set([60, 61])} showPressedLabels={false} preferFlats={false} />,
    );

    expect(container.querySelectorAll('.white-key')).toHaveLength(8);
    expect(container.querySelectorAll('.black-key')).toHaveLength(5);
    expect(container.querySelector('.white-key.is-active')).not.toBeNull();
    expect(container.querySelector('.black-key.is-active')).not.toBeNull();
  });

  it('shows pressed key names only when the setting is enabled', () => {
    const { rerender } = render(
      <PianoKeyboard startNote={60} endNote={72} activeNotes={new Set([61])} showPressedLabels={false} preferFlats={false} />,
    );

    expect(screen.queryByText('C♯4')).not.toBeInTheDocument();

    rerender(<PianoKeyboard startNote={60} endNote={72} activeNotes={new Set([61])} showPressedLabels preferFlats={false} />);
    expect(screen.getByText('C♯4')).toBeInTheDocument();

    rerender(<PianoKeyboard startNote={60} endNote={72} activeNotes={new Set([61])} showPressedLabels preferFlats />);
    expect(screen.getByText('D♭4')).toBeInTheDocument();
  });
  it('emits pointer note-on and note-off from keys', () => {
    const onPointerNoteOn = vi.fn();
    const onPointerNoteOff = vi.fn();
    const { container } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOn={onPointerNoteOn}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;

    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    firstWhiteKey.dispatchEvent(pointerEvent('pointerdown'));
    firstWhiteKey.dispatchEvent(pointerEvent('pointerup'));

    expect(onPointerNoteOn).toHaveBeenCalledWith(60, expect.anything());
    expect(onPointerNoteOff).toHaveBeenCalledWith(60, expect.anything());
  });

  it('allows pointer interaction on black keys above the white-key row', () => {
    const onPointerNoteOn = vi.fn();
    const onPointerNoteOff = vi.fn();
    const { container } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOn={onPointerNoteOn}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstBlackKey = container.querySelector('.black-key') as HTMLElement;

    firstBlackKey.setPointerCapture = vi.fn();
    firstBlackKey.releasePointerCapture = vi.fn();
    firstBlackKey.dispatchEvent(pointerEvent('pointerdown'));
    firstBlackKey.dispatchEvent(pointerEvent('pointerup'));

    expect(onPointerNoteOn).toHaveBeenCalledWith(61, expect.anything());
    expect(onPointerNoteOff).toHaveBeenCalledWith(61, expect.anything());
  });

  it('releases a pointer-held note when the visible range scrolls the key out of view', () => {
    const onPointerNoteOff = vi.fn();
    const { container, rerender } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;
    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    fireEvent(firstWhiteKey, pointerEvent('pointerdown'));
    expect(onPointerNoteOff).not.toHaveBeenCalled();

    rerender(
      <PianoKeyboard
        startNote={72}
        endNote={84}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );

    expect(onPointerNoteOff).toHaveBeenCalledWith(60, expect.anything());
  });

  it('releases a pointer-held note from a window pointerup that never reaches the key', () => {
    const onPointerNoteOff = vi.fn();
    const { container } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;
    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    fireEvent(firstWhiteKey, pointerEvent('pointerdown'));

    fireEvent(window, pointerEvent('pointerup'));
    expect(onPointerNoteOff).toHaveBeenCalledWith(60, expect.anything());
    expect(onPointerNoteOff).toHaveBeenCalledTimes(1);
  });

  it('releases a pointer-held note exactly once when the key handles the pointerup', () => {
    const onPointerNoteOff = vi.fn();
    const { container } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;
    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    fireEvent(firstWhiteKey, pointerEvent('pointerdown'));
    fireEvent(firstWhiteKey, pointerEvent('pointerup'));

    expect(onPointerNoteOff).toHaveBeenCalledTimes(1);
  });

  it('releases pointer-held notes when the keyboard unmounts', () => {
    const onPointerNoteOff = vi.fn();
    const { container, unmount } = render(
      <PianoKeyboard
        startNote={60}
        endNote={72}
        activeNotes={new Set()}
        showPressedLabels={false}
        preferFlats={false}
        onPointerNoteOff={onPointerNoteOff}
      />,
    );
    const firstWhiteKey = container.querySelector('.white-key') as HTMLElement;
    firstWhiteKey.setPointerCapture = vi.fn();
    firstWhiteKey.releasePointerCapture = vi.fn();
    fireEvent(firstWhiteKey, pointerEvent('pointerdown'));

    unmount();
    expect(onPointerNoteOff).toHaveBeenCalledWith(60, expect.anything());
  });
});

describe('RangeOverview', () => {
  it('represents the full 88-key range and current visible window inside the slider control', () => {
    const { container } = render(<RangeOverview startNote={48} endNote={84} activeNotes={new Set([60])} />);

    expect(container.querySelector('.range-window')).toBeInTheDocument();
    expect(container.querySelectorAll('.mini-white-key')).toHaveLength(52);
    expect(container.querySelectorAll('.mini-black-key')).toHaveLength(36);
    expect(container.querySelector('.mini-white-key.is-active')).toBeInTheDocument();
  });
});
