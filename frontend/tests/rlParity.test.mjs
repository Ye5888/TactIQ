import test from 'node:test';
import assert from 'node:assert/strict';
import { buildActionMask } from '../src/rl/actionMask.ts';
import { buildObservation } from '../src/rl/observation.ts';

globalThis.Phaser = { Math: { Clamp: (value, lo, hi) => Math.max(lo, Math.min(hi, value)) } };
const team = Array.from({ length: 5 }, (_, i) => ({ x: 100 + 20 * i, y: 100 }));
const opponents = Array.from({ length: 5 }, (_, i) => ({ x: 900, y: 100 + 30 * i }));
const ball = { x: 600, y: 300, body: { velocity: { x: 200, y: -200 } } };

test('RL action mask has 75 entries; players without ball cannot shoot or pass', () => {
  const mask = buildActionMask(opponents, null);
  assert.equal(mask.length, 75);
  for (let i = 0; i < 5; i++) {
    assert.deepEqual(mask.slice(i * 15, i * 15 + 9), Array(9).fill(true));
    assert.deepEqual(mask.slice(i * 15 + 9, (i + 1) * 15), Array(6).fill(false));
  }
});

test('possession unlocks shoot and teammate passes but not a self-pass', () => {
  for (let owner = 0; owner < 5; owner++) {
    const mask = buildActionMask(opponents, opponents[owner]);
    for (let i = 0; i < 5; i++) {
      assert.equal(mask[i * 15 + 9], i === owner);
      for (let target = 0; target < 5; target++) {
        assert.equal(mask[i * 15 + 10 + target], i === owner && target !== owner);
      }
    }
  }
});

test('browser observation matches Python policy 37-value field layout', () => {
  const obs = buildObservation(team, opponents, ball, null, 2, 1, 60);
  assert.equal(obs.length, 37);
  assert.ok(obs.every(Number.isFinite));
  assert.equal(obs[20], 0); // Ball X normalized
  assert.equal(obs[21], 0); // Ball Y normalized
  assert.equal(obs[22], 0.5); // Ball velocity X normalized
  assert.equal(obs[23], -0.5); // Ball velocity Y normalized
  assert.deepEqual(Array.from(obs.slice(24, 35)), [1, ...Array(10).fill(0)]);
  assert.ok(Math.abs(obs[35] - 0.2) < 1e-6); // Score differential
  assert.equal(obs[36], 0.5); // Time remaining
});

test('possession one-hot encodes user and RL owner in correct slots', () => {
  let obs = buildObservation(team, opponents, ball, team[3], 0, 0, 120);
  assert.equal(obs[24 + 1 + 3], 1);
  assert.equal(Array.from(obs.slice(24, 35)).reduce((a, b) => a + b, 0), 1);
  obs = buildObservation(team, opponents, ball, opponents[2], 0, 0, 120);
  assert.equal(obs[24 + 6 + 2], 1);
  assert.equal(Array.from(obs.slice(24, 35)).reduce((a, b) => a + b, 0), 1);
});

test('observation clamps score difference, remaining time, and ball velocity', () => {
  const extremeBall = { x: 600, y: 300, body: { velocity: { x: 10000, y: -10000 } } };
  const obs = buildObservation(team, opponents, extremeBall, null, 100, 0, -1);
  assert.equal(obs[22], 1);
  assert.equal(obs[23], -1);
  assert.equal(obs[35], 1);
  assert.equal(obs[36], 0);
});
