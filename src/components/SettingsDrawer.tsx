import { Settings, X } from 'lucide-react';
import type { ChordNameStyle, InversionMode } from '../music/chords';
import { FLAT_KEYS, SHARP_KEYS, type SpellingKey } from '../music/notes';

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
  return (
    <aside className="settings-drawer" aria-label="Settings panel">
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
          <option value="maj">Cmaj7</option>
          <option value="capitalM">CM7</option>
          <option value="delta">CΔ7</option>
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
              <option key={key} value={key}>{key}</option>
            ))}
          </optgroup>
          <optgroup label="Flats">
            {FLAT_KEYS.map((key) => (
              <option key={key} value={key}>{key}</option>
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
          <option value={0}>Off</option>
          <option value={250}>0.25s</option>
          <option value={500}>0.5s</option>
          <option value={750}>0.75s</option>
          <option value={1000}>1s</option>
        </select>
      </label>
    </aside>
  );
}
