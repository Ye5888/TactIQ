import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchValidated } from '../src/data/fetchApi.ts';
import { validateFormations, validateDraftPlayers } from '../src/data/validateApi.ts';

const slots = Array.from({ length: 5 }, (_, i) => ({ x: i / 5, y: 0.5 }));
const formation = [{ _id: 'f1', name: '1-2-1', slots }];
const players = Array.from({ length: 10 }, (_, i) => ({ name: 'P' + i, pace: 60, shot: 70 }));
function mockFetch(fn) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  return () => { globalThis.fetch = original; };
}
test('loads and validates formations', async () => {
  const restore = mockFetch(async () => ({ ok: true, json: async () => formation }));
  try { assert.deepEqual(await fetchValidated('/formations', validateFormations), formation); }
  finally { restore(); }
});
test('loads and validates draft data', async () => {
  const restore = mockFetch(async () => ({ ok: true, json: async () => players }));
  try { assert.deepEqual(await fetchValidated('/draft/players', validateDraftPlayers), players); }
  finally { restore(); }
});
test('rejects HTTP errors and network failures', async () => {
  let restore = mockFetch(async () => ({ ok: false, status: 503 }));
  try { await assert.rejects(fetchValidated('/formations', validateFormations), /HTTP 503/); }
  finally { restore(); }
  restore = mockFetch(async () => { throw new TypeError('Network error'); });
  try { await assert.rejects(fetchValidated('/draft/players', validateDraftPlayers), /Network error/); }
  finally { restore(); }
});
test('rejects invalid JSON and empty API responses', async () => {
  let restore = mockFetch(async () => ({ ok: true, json: async () => { throw new SyntaxError('Invalid JSON'); } }));
  try { await assert.rejects(fetchValidated('/formations', validateFormations), SyntaxError); }
  finally { restore(); }
  restore = mockFetch(async () => ({ ok: true, json: async () => [] }));
  try { await assert.rejects(fetchValidated('/draft/players', validateDraftPlayers), /Not enough players/); }
  finally { restore(); }
});
test('supports recovery on retry after initial failure', async () => {
  let calls = 0;
  const restore = mockFetch(async () => ++calls === 1 ? { ok: false, status: 503 } : { ok: true, json: async () => formation });
  try {
    await assert.rejects(fetchValidated('/formations', validateFormations), /HTTP 503/);
    assert.deepEqual(await fetchValidated('/formations', validateFormations), formation);
    assert.equal(calls, 2);
  } finally { restore(); }
});
test('forwards abort signal and propagates cancellation', async () => {
  const controller = new AbortController();
  const restore = mockFetch(async (_url, options) => {
    assert.equal(options.signal, controller.signal);
    controller.abort();
    throw new DOMException('Aborted', 'AbortError');
  });
  try { await assert.rejects(fetchValidated('/formations', validateFormations, controller.signal), { name: 'AbortError' }); }
  finally { restore(); }
});
