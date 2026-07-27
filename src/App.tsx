import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CircleHelp, Music2, SlidersHorizontal, Volume2, VolumeX } from 'lucide-react';
import { PianoKeyboard, RangeOverview } from './components/PianoKeyboard';
import { StaffNotation } from './components/StaffNotation';
import { SettingsDrawer } from './components/SettingsDrawer';
import { HelpDrawer } from './components/HelpDrawer';
import { usePianoAudio } from './audio/usePianoAudio';
import { detectChord, type ChordNameStyle, type InversionMode } from './music/chords';
import { clampMidiStart, keyPrefersFlats, midiNoteName, type SpellingKey } from './music/notes';
import { useComputerKeyboard } from './hooks/useComputerKeyboard';
import { useMidiInputs } from './hooks/useMidiInputs';
import { useDisplayNotes, FADE_OUT_MS } from './hooks/useDisplayNotes';
import { isBoolean, numberInRange, oneOf, usePersistentState } from './hooks/usePersistentState';
import { toAccidentalGlyphs } from './utils/accidentals';
import { isTextEntryTarget } from './utils/textEditingTarget';
import {
  INVERSION_MODES,
  LINGER_OPTIONS,
  MAX_VOLUME,
  MIN_VOLUME,
  NAME_STYLES,
  SPELLING_KEY_OPTIONS,
} from './settings-options';

const VISIBLE_SEMITONES = 36;
const DEFAULT_START = 48;
const COMPUTER_KEY_BASE = 60;
const MIN_KEYBOARD_BASE = 36;
const MAX_KEYBOARD_BASE = 84;
const DEFAULT_VOLUME = 0.72;
const EMPTY_NOTES: number[] = [];

// Validators are hoisted so each is a stable identity across renders.
const isVolume = numberInRange(MIN_VOLUME, MAX_VOLUME);
const isLingerMs = oneOf(LINGER_OPTIONS);
const isNameStyle = oneOf(NAME_STYLES);
const isInversionMode = oneOf(INVERSION_MODES);
const isSpellingKey = oneOf(SPELLING_KEY_OPTIONS);

type HeldSources = Record<number, string[]>;
type OpenDrawer = 'help' | 'settings' | null;

export function App() {
  const [heldSources, setHeldSources] = useState<HeldSources>({});
  const [rangeStart, setRangeStart] = useState(DEFAULT_START);
  const [computerKeyBase, setComputerKeyBase] = useState(COMPUTER_KEY_BASE);
  // One drawer at a time: Help and Settings occupy the exact same fixed slot, so two independent
  // booleans let them stack invisibly on top of each other.
  const [openDrawer, setOpenDrawer] = useState<OpenDrawer>(null);

  // Persisted user settings so preferences survive app restarts. Every key gets a validator:
  // localStorage is user-writable, and an unvalidated value (e.g. `lcm:volume = 99`) would drive
  // the audio gain or leave the UI showing something other than the real state.
  const [volume, setVolume] = usePersistentState('lcm:volume', DEFAULT_VOLUME, isVolume);
  const [muted, setMuted] = usePersistentState('lcm:muted', false, isBoolean);
  const [showPressedLabels, setShowPressedLabels] = usePersistentState('lcm:showPressedLabels', false, isBoolean);
  const [notationEnabled, setNotationEnabled] = usePersistentState('lcm:notationEnabled', true, isBoolean);
  const [nameStyle, setNameStyle] = usePersistentState<ChordNameStyle>('lcm:nameStyle', 'maj', isNameStyle);
  const [inversionMode, setInversionMode] = usePersistentState<InversionMode>('lcm:inversionMode', 'slash', isInversionMode);
  const [spellingKey, setSpellingKey] = usePersistentState<SpellingKey>('lcm:spellingKey', 'C', isSpellingKey);
  const [lingerMs, setLingerMs] = usePersistentState('lcm:lingerMs', 500, isLingerMs);
  const [computerKeyboardNotes, setComputerKeyboardNotes] = usePersistentState('lcm:computerKeyboardNotes', true, isBoolean);

  // Keyed on note CONTENT, not on `heldSources` identity: a refcount-only change
  // (second source added/removed for an already-held note) must not hand VexFlow a
  // new array and force a full staff teardown/rebuild.
  const activeNotesKey = useMemo(() => (
    Object.entries(heldSources)
      .filter(([, sources]) => sources.length > 0)
      .map(([note]) => Number(note))
      .sort((a, b) => a - b)
      .join(',')
  ), [heldSources]);

  const activeNotes = useMemo(() => (
    activeNotesKey === '' ? EMPTY_NOTES : activeNotesKey.split(',').map(Number)
  ), [activeNotesKey]);

  const activeNoteSet = useMemo(() => new Set(activeNotes), [activeNotes]);
  const preferFlats = keyPrefersFlats(spellingKey);
  const { displayNotes, fading } = useDisplayNotes(activeNotes, lingerMs);
  const chord = useMemo(() => detectChord(displayNotes, nameStyle, inversionMode, preferFlats), [displayNotes, inversionMode, nameStyle, preferFlats]);

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
        const rest = { ...current };
        delete rest[note];
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

  // `computerKeyBase` is read from state (not mutated inside the updater) so the
  // dependent `setRangeStart` stays a plain side effect rather than a hidden one.
  const shiftComputerOctave = useCallback((direction: -1 | 1) => {
    const next = Math.min(MAX_KEYBOARD_BASE, Math.max(MIN_KEYBOARD_BASE, computerKeyBase + direction * 12));
    setComputerKeyBase(next);
    setRangeStart(clampMidiStart(next - 12, VISIBLE_SEMITONES));
  }, [computerKeyBase]);

  useEffect(() => {
    function handleGlobalShortcut(event: KeyboardEvent) {
      // Z/X are range controls, deliberately available even while a settings
      // control has focus; only literal text entry swallows them.
      if (isTextEntryTarget(event.target) || event.metaKey || event.ctrlKey || event.altKey || event.repeat) {
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
  useComputerKeyboard(computerKeyboardNotes, computerKeyBase, handleNoteOn, handleNoteOff);
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
            <button
              className="settings-button"
              type="button"
              aria-expanded={openDrawer === 'help'}
              onClick={() => setOpenDrawer('help')}
            >
              <CircleHelp size={18} />
              <span>Help</span>
            </button>
            <button
              className="settings-button"
              type="button"
              aria-expanded={openDrawer === 'settings'}
              onClick={() => setOpenDrawer('settings')}
            >
              <SlidersHorizontal size={18} />
              <span>Settings</span>
            </button>
          </div>
        </section>
      </section>

      <section className="readout-area">
        <div
          className={`chord-readout ${fading ? 'is-fading' : ''}`}
          style={{ '--fade-duration': `${FADE_OUT_MS}ms` } as React.CSSProperties}
          aria-live="polite"
          aria-atomic="true"
        >
          <h1>{chord.primary ? toAccidentalGlyphs(chord.primary.displayName) : ''}</h1>
          <div className="alternatives">
            {chord.alternatives.length > 0
              ? chord.alternatives.map((candidate) => toAccidentalGlyphs(candidate.displayName)).join('  |  ')
              : ''}
          </div>
        </div>

        <div className="work-area">
          {notationEnabled ? (
            <StaffNotation notes={displayNotes} chord={chord.primary} fading={fading} />
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
          <span className="range-end-label">{toAccidentalGlyphs(midiNoteName(rangeStart, preferFlats))}</span>
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
          <span className="range-end-label">{toAccidentalGlyphs(midiNoteName(rangeEnd, preferFlats))}</span>
          <button className="icon-button" type="button" onClick={() => shiftRange(12)} aria-label="Shift visible keyboard up one octave">
            <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {openDrawer === 'help' ? <HelpDrawer onClose={() => setOpenDrawer(null)} /> : null}

      {openDrawer === 'settings' ? (
        <SettingsDrawer
          onClose={() => setOpenDrawer(null)}
          nameStyle={nameStyle}
          onNameStyleChange={setNameStyle}
          inversionMode={inversionMode}
          onInversionModeChange={setInversionMode}
          spellingKey={spellingKey}
          onSpellingKeyChange={setSpellingKey}
          showPressedLabels={showPressedLabels}
          onShowPressedLabelsChange={setShowPressedLabels}
          notationEnabled={notationEnabled}
          onNotationEnabledChange={setNotationEnabled}
          computerKeyboardNotes={computerKeyboardNotes}
          onComputerKeyboardNotesChange={setComputerKeyboardNotes}
          lingerMs={lingerMs}
          onLingerMsChange={setLingerMs}
        />
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

