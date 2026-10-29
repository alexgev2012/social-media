import assert from 'node:assert/strict';
import test from 'node:test';
import { validateImageUpload, validateMediaUpload } from './uploadValidation.mjs';

const file = (name, type, size = 1024) => ({ name, type, size });

test('accepts supported mobile and desktop image formats', () => {
  for (const [name, type] of [['photo.jpg', 'image/jpeg'], ['photo.webp', 'image/webp'], ['photo.png', '']]) {
    assert.deepEqual(validateMediaUpload(file(name, type)), { kind: 'image', error: null });
    assert.equal(validateImageUpload(file(name, type)), null);
  }
});

test('rejects unsupported image formats and files larger than the image limit', () => {
  assert.match(validateImageUpload(file('photo.heic', 'image/heic')), /JPG, PNG, GIF or WebP/);
  assert.match(validateMediaUpload(file('photo.png', 'image/png', 5 * 1024 * 1024 + 1)).error, /5 MB/);
});

test('accepts the supported video containers and enforces the configured limit', () => {
  for (const extension of ['mp4', 'mov', 'webm', 'ogg', 'mkv', 'avi']) {
    assert.deepEqual(validateMediaUpload(file(`clip.${extension}`, `video/${extension}`)), { kind: 'video', error: null });
  }
  assert.match(validateMediaUpload(file('clip.mp4', 'video/mp4', 11), 10).error, /1 MB/);
  assert.match(validateMediaUpload(file('clip.mp4', 'video/mp4', 51 * 1024 * 1024)).error, /50 MB/);
});

test('rejects unsupported file types', () => {
  assert.equal(validateMediaUpload(file('archive.zip', 'application/zip')).kind, null);
});
