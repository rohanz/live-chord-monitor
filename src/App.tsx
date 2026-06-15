import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Music2, Settings, SlidersHorizontal, Volume2, VolumeX, X } from 'lucide-react';
import { PianoKeyboard, RangeOverview } from './components/PianoKeyboard';
import { StaffNotation } from './components/StaffNotation';
import { usePianoAudio } from './audio/usePianoAudio';
import { detectChord, type ChordNameStyle, type InversionMode } from './music/chords';
import { clampMidiStart, keyPrefersFlats, midiNoteName, SPELLING_KEYS, type SpellingKey } from './music/notes';
import { useComputerKeyboard } from './hooks/useComputerKeyboard';
import { useMidiInputs } from './hooks/useMidiInputs';

const VISIBLE_SEMITONES = 36;
const DEFAULT_START = 48;
const COMPUTER_KEY_BASE = 60;
const MIN_KEYBOARD_BASE = 36;
const MAX_KEYBOARD_BASE = 84;
const FADE_OUT_MS = 100;
const RELEASE_SETTLE_MS = 60;
const DEFAULT_VOLUME = 0.72;

type HeldSources = Record<number, string[]>;

export function App() {
  const [heldSources, setHeldSources] = useState<HeldSources>({});
  const [rangeStart, setRangeStart] = useState(DEFAULT_START);
  const [volume, setVolume] = useState(DEFAULT_VOLUME);
  const [muted, setMuted] = useState(false);
  const [showPressedLabels, setShowPressedLabels] = useState(false);
  const [notationEnabled, setNotationEnabled] = useState(true);
  const [nameStyle, setNameStyle] = useState<ChordNameStyle>('maj');
  const [inversionMode, setInversionMode] = useState<InversionMode>('slash');
  const [spellingKey, setSpellingKey] = useState<SpellingKey>('C');
  const [computerKeyBase, setComputerKeyBase] = useState(COMPUTER_KEY_BASE);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [lingerMs, setLingerMs] = useState(500);
  const [displayNotes, setDisplayNotes] = useState<number[]>([]);
  const [displayFadeOut, setDisplayFadeOut] = useState(false);
  const displayNotesRef = useRef<number[]>([]);

  const activeNotes = useMemo(() => (
    Object.entries(heldSources)
      .filter(([, sources]) => sources.length > 0)
      .map(([note]) => Number(note))
      .sort((a, b) => a - b)
  ), [heldSources]);

  const activeNoteSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const preferFlats = keyPrefersFlats(spellingKey);
  const chord = useMemo(() => detectChord(displayNotes, nameStyle, inversionMode, preferFlats), [displayNotes, inversionMode, nameStyle, preferFlats]);

  useEffect(() => {
    displayNotesRef.current = displayNotes;
  }, [displayNotes]);

  useEffect(() => {
    if (activeNotes.length > 0) {
      setDisplayFadeOut(false);

      const currentDisplayNotes = displayNotesRef.current;
      const isReleaseOnlyChange = activeNotes.length < currentDisplayNotes.length
        && activeNotes.every((note) => currentDisplayNotes.includes(note));

      if (!isReleaseOnlyChange) {
        setDisplayNotes(activeNotes);
        return;
      }

      const settleTimeout = window.setTimeout(() => setDisplayNotes(activeNotes), RELEASE_SETTLE_MS);
      return () => window.clearTimeout(settleTimeout);
    }

    if (displayNotesRef.current.length === 0) {
      setDisplayFadeOut(false);
      return;
    }

    if (lingerMs === 0) {
      setDisplayFadeOut(false);
      setDisplayNotes([]);
      return;
    }

    setDisplayFadeOut(false);
    const holdMs = Math.max(0, lingerMs - FADE_OUT_MS);
    const fadeTimeout = window.setTimeout(() => setDisplayFadeOut(true), holdMs);
    const clearTimeout = window.setTimeout(() => {
      setDisplayFadeOut(false);
      setDisplayNotes([]);
    }, lingerMs);

    return () => {
      window.clearTimeout(fadeTimeout);
      window.clearTimeout(clearTimeout);
    };
  }, [activeNotes, lingerMs]);

  const handleNoteOn = useCallback((note: number, source: string) => {
    setHeldSources((current) => {
      const nextSources = new Set(current[note] ?? []);
      nextSources.add(source);
      return { ...current, [note]: Array.from(nextSources) };
    });
  }, []);

  const handleNoteOff = useCallback((note: number, source: string) => {
    setHeldSources((current) => {
      const nextSources = new Set(current[note] ?? []);
      nextSources.delete(source);

      if (nextSources.size === 0) {
        const { [note]: _removed, ...rest } = current;
        return rest;
      }

      return { ...current, [note]: Array.from(nextSources) };
    });
  }, []);

  const setVisibleRangeStart = useCallback((nextStart: number) => {
    const clampedStart = clampMidiStart(nextStart, VISIBLE_SEMITONES);
    setRangeStart(clampedStart);
    setComputerKeyBase(Math.min(MAX_KEYBOARD_BASE, Math.max(MIN_KEYBOARD_BASE, clampedStart + 12)));
  }, []);

  const shiftComputerOctave = useCallback((direction: -1 | 1) => {
    setComputerKeyBase((current) => {
      const next = Math.min(MAX_KEYBOARD_BASE, Math.max(MIN_KEYBOARD_BASE, current + direction * 12));
      setRangeStart(clampMidiStart(next - 12, VISIBLE_SEMITONES));
      return next;
    });
  }, []);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;

      if (isTextEditingTarget(target) || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
        return;
      }

      if (event.code === 'KeyZ') {
        event.preventDefault();
        shiftComputerOctave(-1);
      }

      if (event.code === 'KeyX') {
        event.preventDefault();
        shiftComputerOctave(1);
      }
    }

    window.addEventListener('keydown', handleGlobalShortcut);
    return () => window.removeEventListener('keydown', handleGlobalShortcut);
  }, [shiftComputerOctave]);

  const midi = useMidiInputs(handleNoteOn, handleNoteOff);
  useComputerKeyboard(true, computerKeyBase, handleNoteOn, handleNoteOff);
  usePianoAudio(activeNotes, volume, muted);

  const rangeEnd = rangeStart + VISIBLE_SEMITONES;

  function shiftRange(semitones: number) {
    setVisibleRangeStart(rangeStart + semitones);
  }

  return (
    <main className="app-shell">
      <section className="app-chrome">
        <div className="header-left">
          <div className="app-title">Live Chord Monitor</div>
          <div className="status-cluster" aria-label="Input status">
            <div className={`status-pill status-${midi.status}`}>
              <Music2 size={16} />
              <span>{formatMidiStatus(midi.status, midi.devices.length)}</span>
            </div>
          </div>
        </div>

        <section className="control-strip" aria-label="Controls">
          <div className="control-group">
            <button className={`mute-button ${muted ? 'is-muted' : ''}`} type="button" onClick={() => setMuted((value) => !value)}>
              {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              <span>{muted ? 'Muted' : 'Sound'}</span>
            </button>
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={(event) => setVolume(Number(event.target.value))}
              onDoubleClick={() => setVolume(DEFAULT_VOLUME)}
              aria-label="Volume"
            />
          </div>

          <div className="panel-buttons">
            <button className="settings-button" type="button" onClick={() => setHelpOpen(true)}>
              <CircleHelp size={18} />
              <span>Help</span>
            </button>
            <button className="settings-button" type="button" onClick={() => setSettingsOpen(true)}>
              <SlidersHorizontal size={18} />
              <span>Settings</span>
            </button>
          </div>
        </section>
      </section>

      <section className="readout-area">
        <div
          className={`chord-readout ${displayFadeOut ? 'is-fading' : ''}`}
          style={{ '--fade-duration': `${FADE_OUT_MS}ms` } as React.CSSProperties}
          aria-live="polite"
        >
          <h1>{chord.primary?.displayName ?? ''}</h1>
          <div className="alternatives">
            {chord.alternatives.length > 0
              ? chord.alternatives.map((candidate) => candidate.displayName).join('  |  ')
              : ''}
          </div>
        </div>

        <div className="work-area">
          {notationEnabled ? (
            <StaffNotation notes={displayNotes} chord={chord.primary} fading={displayFadeOut} />
          ) : (
            <div className="notation-disabled">
              <Music2 size={22} />
              <span>Notation hidden</span>
            </div>
          )}
        </div>
      </section>

      <section className="keyboard-section">
        <PianoKeyboard
          startNote={rangeStart}
          endNote={rangeEnd}
          activeNotes={activeNoteSet}
          showPressedLabels={showPressedLabels}
          preferFlats={preferFlats}
          onPointerNoteOn={(note) => handleNoteOn(note, `pointer:${note}`)}
          onPointerNoteOff={(note) => handleNoteOff(note, `pointer:${note}`)}
        />
        <div className="range-controls">
          <button className="icon-button" type="button" onClick={() => shiftRange(-12)} aria-label="Shift visible keyboard down one octave">
            <ChevronLeft size={18} />
          </button>
          <span className="range-end-label">{midiNoteName(rangeStart, preferFlats)}</span>
          <div className="keyboard-range-slider">
            <RangeOverview startNote={rangeStart} endNote={rangeEnd} activeNotes={activeNoteSet} />
            <input
              className="range-slider-overlay"
              type="range"
              min={24}
              max={72}
              step={12}
              value={rangeStart}
              onChange={(event) => setVisibleRangeStart(Number(event.target.value))}
              aria-label="Visible keyboard octave range"
            />
          </div>
          <span className="range-end-label">{midiNoteName(rangeEnd, preferFlats)}</span>
          <button className="icon-button" type="button" onClick={() => shiftRange(12)} aria-label="Shift visible keyboard up one octave">
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {helpOpen ? (
        <aside className="settings-drawer" aria-label="Help panel">
          <div className="settings-title">
            <CircleHelp size={17} />
            <span>Help</span>
            <button className="drawer-close" type="button" onClick={() => setHelpOpen(false)} aria-label="Close help">
              <X size={17} />
            </button>
          </div>

          <div className="help-section">
            <strong>Computer keyboard</strong>
            <p>A W S E D F T G Y H U J K O L</p>
          </div>

          <div className="help-section">
            <strong>Octave</strong>
            <p>Z moves down. X moves up.</p>
          </div>

          <div className="help-section">
            <strong>MIDI</strong>
            <p>All connected MIDI inputs are listened to automatically.</p>
          </div>
        </aside>
      ) : null}

      {settingsOpen ? (
        <aside className="settings-drawer" aria-label="Settings panel">
          <div className="settings-title">
            <Settings size={17} />
            <span>Settings</span>
            <button className="drawer-close" type="button" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
              <X size={17} />
            </button>
          </div>

          <label>
            Chord style
            <select value={nameStyle} onChange={(event) => setNameStyle(event.target.value as ChordNameStyle)}>
              <option value="maj">Cmaj7</option>
              <option value="capitalM">CM7</option>
              <option value="delta">CΔ7</option>
            </select>
          </label>

          <label>
            Inversions
            <select value={inversionMode} onChange={(event) => setInversionMode(event.target.value as InversionMode)}>
              <option value="slash">Slash chords</option>
              <option value="root-only">Root only</option>
              <option value="full">Full text</option>
            </select>
          </label>

          <label>
            Key
            <select value={spellingKey} onChange={(event) => setSpellingKey(event.target.value as SpellingKey)}>
              {SPELLING_KEYS.map((key) => (
                <option key={key} value={key}>{key}</option>
              ))}
            </select>
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={showPressedLabels}
              onChange={(event) => setShowPressedLabels(event.target.checked)}
            />
            Pressed key names
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={notationEnabled}
              onChange={(event) => setNotationEnabled(event.target.checked)}
            />
            Grand staff
          </label>

          <label>
            Linger
            <select value={lingerMs} onChange={(event) => setLingerMs(Number(event.target.value))}>
              <option value={0}>Off</option>
              <option value={250}>0.25s</option>
              <option value={500}>0.5s</option>
              <option value={750}>0.75s</option>
              <option value={1000}>1s</option>
            </select>
          </label>
        </aside>
      ) : null}
    </main>
  );
}

function formatMidiStatus(status: string, deviceCount: number): string {
  if (status === 'ready') {
    return deviceCount === 1 ? '1 MIDI input' : `${deviceCount} MIDI inputs`;
  }

  if (status === 'requesting') return 'MIDI loading';
  if (status === 'unsupported') return 'MIDI unavailable';
  if (status === 'denied') return 'MIDI denied';
  return 'MIDI error';
}

function isTextEditingTarget(target: HTMLElement | null): boolean {
  if (!target || !(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('textarea, select, [contenteditable="true"]')) {
    return true;
  }

  const input = target.closest('input') as HTMLInputElement | null;
  return Boolean(input && !['range', 'checkbox', 'radio', 'button'].includes(input.type));
}
