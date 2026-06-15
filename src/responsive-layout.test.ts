import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');

describe('responsive layout CSS contracts', () => {
  it('does not force a wide body minimum that would obscure content on resize', () => {
    expect(css).toContain('body {\n  margin: 0;\n  min-width: 0;');
    expect(css).toContain('overflow: hidden;');
  });

  it('uses viewport-fit app sizing and bounded responsive piano/slider dimensions', () => {
    expect(css).toContain('height: 100dvh;');
    expect(css).toContain('overflow: hidden;');
    expect(css).toContain('width: min(960px, 100%);');
    expect(css).toContain('min-height: 96px;');
    expect(css).toContain('max-height: 280px;');
    expect(css).toContain('grid-template-columns: 36px 44px minmax(280px, 520px) 44px 36px;');
  });

  it('has a small-window media query that reflows header and controls', () => {
    expect(css).toContain('@media (max-width: 980px)');
    expect(css).toContain('.control-strip {\n    flex-direction: row;');
    expect(css).toContain('grid-template-columns: 36px 44px 1fr 44px 36px;');
  });
});
