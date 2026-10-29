import assert from 'node:assert/strict';
import test from 'node:test';
import { getApiRoot } from './apiConfig.mjs';

test('uses the local relative API path when no environment URL is configured', () => {
  assert.equal(getApiRoot(undefined), '/api');
  assert.equal(getApiRoot('  '), '/api');
});

test('adds one API prefix to a production backend origin', () => {
  assert.equal(getApiRoot('https://backend.example.com/'), 'https://backend.example.com/api');
});

test('does not duplicate an existing API prefix', () => {
  assert.equal(getApiRoot('https://backend.example.com/api/'), 'https://backend.example.com/api');
});
