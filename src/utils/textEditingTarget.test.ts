import { afterEach, describe, expect, it } from 'vitest';
import { isTextEditingTarget, isTextEntryTarget } from './textEditingTarget';

function mount(html: string): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.append(host);
  return host.firstElementChild as HTMLElement;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('isTextEditingTarget', () => {
  it('treats text-like inputs, textareas, selects and contenteditable as editing targets', () => {
    expect(isTextEditingTarget(mount('<input type="text" />'))).toBe(true);
    expect(isTextEditingTarget(mount('<input type="search" />'))).toBe(true);
    expect(isTextEditingTarget(mount('<input type="number" />'))).toBe(true);
    expect(isTextEditingTarget(mount('<textarea></textarea>'))).toBe(true);
    expect(isTextEditingTarget(mount('<select><option>a</option></select>'))).toBe(true);
    expect(isTextEditingTarget(mount('<div contenteditable="true"></div>'))).toBe(true);
  });

  it('does not treat sliders, checkboxes, radios, buttons or plain elements as editing targets', () => {
    expect(isTextEditingTarget(mount('<input type="range" />'))).toBe(false);
    expect(isTextEditingTarget(mount('<input type="checkbox" />'))).toBe(false);
    expect(isTextEditingTarget(mount('<input type="radio" />'))).toBe(false);
    expect(isTextEditingTarget(mount('<input type="button" />'))).toBe(false);
    expect(isTextEditingTarget(mount('<button>press</button>'))).toBe(false);
    expect(isTextEditingTarget(mount('<div contenteditable="false"></div>'))).toBe(false);
    expect(isTextEditingTarget(mount('<div></div>'))).toBe(false);
    expect(isTextEditingTarget(null)).toBe(false);
  });

  it('matches nested targets inside an editing container', () => {
    const option = mount('<select><option>a</option></select>').querySelector('option') as HTMLElement;
    expect(isTextEditingTarget(option)).toBe(true);

    const span = mount('<div contenteditable="true"><span>x</span></div>').querySelector('span') as HTMLElement;
    expect(isTextEditingTarget(span)).toBe(true);
  });
});

describe('isTextEntryTarget', () => {
  it('excludes selects so Z/X octave shortcuts still work in the settings drawer', () => {
    expect(isTextEntryTarget(mount('<select><option>a</option></select>'))).toBe(false);
    expect(isTextEntryTarget(mount('<input type="range" />'))).toBe(false);
    expect(isTextEntryTarget(mount('<input type="checkbox" />'))).toBe(false);
  });

  it('still blocks real text entry', () => {
    expect(isTextEntryTarget(mount('<input type="text" />'))).toBe(true);
    expect(isTextEntryTarget(mount('<textarea></textarea>'))).toBe(true);
    expect(isTextEntryTarget(mount('<div contenteditable="true"></div>'))).toBe(true);
    expect(isTextEntryTarget(null)).toBe(false);
  });
});
