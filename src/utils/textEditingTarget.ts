/**
 * Targets where a bare letter keystroke means "type into a control", so note keys
 * (`A`-`L`) must not fire and must not `preventDefault` (that would kill native
 * behavior such as `<select>` type-ahead).
 */
export function isTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('textarea, select, [contenteditable="true"]')) {
    return true;
  }

  const input = target.closest('input') as HTMLInputElement | null;
  return Boolean(input && !['range', 'checkbox', 'radio', 'button'].includes(input.type));
}

/**
 * Narrower check for targets that consume every character as literal text.
 * The `Z`/`X` octave shortcuts stay available everywhere else - including
 * `<select>`, checkboxes and sliders - because they are range controls.
 */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  if (target.closest('textarea, [contenteditable="true"]')) {
    return true;
  }

  const input = target.closest('input') as HTMLInputElement | null;
  return Boolean(input && !['range', 'checkbox', 'radio', 'button'].includes(input.type));
}
