/**
 * DAW-integration ports masquerade as regular MIDI inputs but speak a control
 * protocol in note-on/CC messages that are not musical notes. Captured example:
 * the Novation Launchkey MK2 "InControl" port announces itself on connect with
 * note-on ch16 note 12 (velocity 127) and never sends a note-off, which showed
 * up as a permanently stuck low C.
 */
const CONTROL_PORT_MARKERS = [
  /incontrol/i, // Novation
  /\bdaw\b/i, // Akai and others
  /\bhui\b/i, // Mackie HUI control surfaces
];

export function isControlPortName(name: string): boolean {
  return CONTROL_PORT_MARKERS.some((marker) => marker.test(name));
}
