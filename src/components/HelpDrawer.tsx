import { CircleHelp, X } from 'lucide-react';

type HelpDrawerProps = {
  onClose: () => void;
};

export function HelpDrawer({ onClose }: HelpDrawerProps) {
  return (
    <aside className="settings-drawer" aria-label="Help panel">
      <div className="settings-title">
        <CircleHelp size={17} />
        <span>Help</span>
        <button className="drawer-close" type="button" onClick={onClose} aria-label="Close help">
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
  );
}
