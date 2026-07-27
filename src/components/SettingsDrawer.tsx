import { Settings, X } from 'lucide-react';
import type { ChordNameStyle, InversionMode } from '../music/chords';
import { FLAT_KEYS, SHARP_KEYS, type SpellingKey } from '../music/notes';
import { toAccidentalGlyphs } from '../utils/accidentals';
import { useDrawerDialog } from '../hooks/useDrawerDialog';
import { LINGER_LABELS, LINGER_OPTIONS } from '../settings-options';

type SettingsDrawerProps = {
  onClose: () => void;
  nameStyle: ChordNameStyle;
  onNameStyleChange: (value: ChordNameStyle) => void;
  inversionMode: InversionMode;
  onInversionModeChange: (value: InversionMode) => void;
  spellingKey: SpellingKey;
  onSpellingKeyChange: (value: SpellingKey) => void;
  showPressedLabels: boolean;
  onShowPressedLabelsChange: (value: boolean) => void;
  notationEnabled: boolean;
  onNotationEnabledChange: (value: boolean) => void;
  computerKeyboardNotes: boolean;
  onComputerKeyboardNotesChange: (value: boolean) => void;
  lingerMs: number;
  onLingerMsChange: (value: number) => void;
};

export function SettingsDrawer({
  onClose,
  nameStyle,
  onNameStyleChange,
  inversionMode,
  onInversionModeChange,
  spellingKey,
  onSpellingKeyChange,
  showPressedLabels,
  onShowPressedLabelsChange,
  notationEnabled,
  onNotationEnabledChange,
  computerKeyboardNotes,
  onComputerKeyboardNotesChange,
  lingerMs,
  onLingerMsChange,
}: SettingsDrawerProps) {
  const { ref, onKeyDown } = useDrawerDialog<HTMLElement>(onClose);

  return (
    <aside
      className="settings-drawer"
      role="dialog"
      aria-label="Settings panel"
      tabIndex={-1}
      ref={ref}
      onKeyDown={onKeyDown}
    >
      <div className="settings-title">
        <Settings size={17} />
        <span>Settings</span>
        <button className="drawer-close" type="button" onClick={onClose} aria-label="Close settings">
          <X size={17} />
        </button>
      </div>

      <label>
        Chord style
        <select value={nameStyle} onChange={(event) => onNameStyleChange(event.target.value as ChordNameStyle)}>
          <option value="maj">Text — Cmaj7, Cdim7, Cm7♭5</option>
          <option value="capitalM">Short — CM7, Cdim7, Cm7♭5</option>
          <option value="delta">Symbols — CΔ7, C°7, Cø7</option>
        </select>
      </label>

      <label>
        Inversions
        <select value={inversionMode} onChange={(event) => onInversionModeChange(event.target.value as InversionMode)}>
          <option value="slash">Slash chords</option>
          <option value="root-only">Root only</option>
          <option value="full">Full text</option>
        </select>
      </label>

      <label>
        Spelling
        <select value={spellingKey} onChange={(event) => onSpellingKeyChange(event.target.value as SpellingKey)}>
          <optgroup label="Sharps">
            {SHARP_KEYS.map((key) => (
              <option key={key} value={key}>{toAccidentalGlyphs(key)}</option>
            ))}
          </optgroup>
          <optgroup label="Flats">
            {FLAT_KEYS.map((key) => (
              <option key={key} value={key}>{toAccidentalGlyphs(key)}</option>
            ))}
          </optgroup>
        </select>
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={showPressedLabels}
          onChange={(event) => onShowPressedLabelsChange(event.target.checked)}
        />
        Pressed key names
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={notationEnabled}
          onChange={(event) => onNotationEnabledChange(event.target.checked)}
        />
        Grand staff
      </label>

      <label className="checkbox-label">
        <input
          type="checkbox"
          checked={computerKeyboardNotes}
          onChange={(event) => onComputerKeyboardNotesChange(event.target.checked)}
        />
        Computer keyboard notes
      </label>

      <label>
        Linger
        <select value={lingerMs} onChange={(event) => onLingerMsChange(Number(event.target.value))}>
          {LINGER_OPTIONS.map((option) => (
            <option key={option} value={option}>{LINGER_LABELS[option]}</option>
          ))}
        </select>
      </label>
    </aside>
  );
}
