import test from 'node:test';
import assert from 'node:assert/strict';
import { validateFormations, validateDraftPlayers } from '../src/data/validateApi.ts';

const slots = [{ x: 0.08, y: 0.5 }, { x: 0.25, y: 0.5 }, { x: 0.55, y: 0.2 }, { x: 0.55, y: 0.8 }, { x: 0.85, y: 0.5 }];
const formation = { _id: 'abc', name: '1-2-1', slots };
const players = Array.from({ length: 10 }, (_, i) => ({ name: 'Player ' + i, pace: 60 + i, shot: 50 + i }));

test('accepts valid formations', () => {
  assert.deepEqual(validateFormations([formation]), [formation]);
});
test('rejects empty and malformed formations', () => {
  for (const x of [null, [], {}, [{ ...formation, slots: [] }], [{ ...formation, slots: [{ x: 1.5, y: 0.5 }, ...slots.slice(1)] }], [{ ...formation, slots: [{ x: NaN, y: 0.5 }, ...slots.slice(1)] }]]) assert.throws(() => validateFormations(x));
});
test('accepts valid draft players', () => {
  assert.deepEqual(validateDraftPlayers(players), players);
  assert.deepEqual(validateDraftPlayers(players.slice(0, 5)), players.slice(0, 5));
});
test('rejects empty and malformed draft responses', () => {
  for (const x of [null, [], players.slice(0, 4), [{ ...players[0], pace: NaN }, ...players.slice(1)], [{ ...players[0], shot: '99' }, ...players.slice(1)], [{ ...players[0], name: '' }, ...players.slice(1)]]) assert.throws(() => validateDraftPlayers(x));
});
