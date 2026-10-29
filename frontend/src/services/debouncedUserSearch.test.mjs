import assert from 'node:assert/strict';
import test from 'node:test';
import { scheduleUserSearch } from './debouncedUserSearch.mjs';

const wait = (duration = 25) => new Promise((resolve) => setTimeout(resolve, duration));

test('debounces and trims user searches', async () => {
  const calls = [];
  const results = [];
  scheduleUserSearch('  Alice  ', async (query) => {
    calls.push(query);
    return [{ username: 'alice' }];
  }, (result) => results.push(result), 5);
  await wait();
  assert.deepEqual(calls, ['Alice']);
  assert.deepEqual(results, [{ query: 'Alice', results: [{ username: 'alice' }], error: null }]);
});

test('does not send empty or hashtag queries to the people endpoint', async () => {
  let calls = 0;
  const search = async () => { calls += 1; return []; };
  scheduleUserSearch('  ', search, () => {}, 1);
  scheduleUserSearch(' #design ', search, () => {}, 1);
  await wait();
  assert.equal(calls, 0);
});

test('aborts stale searches so their results cannot replace newer state', async () => {
  let receivedSignal;
  let resolveSearch;
  const updates = [];
  const cleanup = scheduleUserSearch('older', (_query, signal) => {
    receivedSignal = signal;
    return new Promise((resolve) => { resolveSearch = resolve; });
  }, (result) => updates.push(result), 1);
  await wait();
  cleanup();
  resolveSearch([{ username: 'old-result' }]);
  await wait();
  assert.equal(receivedSignal.aborted, true);
  assert.deepEqual(updates, []);
});

test('returns a useful error state when the search request fails', async () => {
  const updates = [];
  scheduleUserSearch('nobody', async () => { throw new Error('Search unavailable'); }, (result) => updates.push(result), 1);
  await wait();
  assert.deepEqual(updates, [{ query: 'nobody', results: [], error: 'Search unavailable' }]);
});
