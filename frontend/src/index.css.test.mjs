import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const css = await readFile(new URL('./index.css', import.meta.url), 'utf8');

test('mobile and narrow-phone layouts retain their key responsive rules', () => {
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /@media \(max-width: 360px\)/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /\.right-sidebar-col\.embedded-sidebar[\s\S]*?display: flex/);
  assert.match(css, /\.story-viewer-panel/);
});
