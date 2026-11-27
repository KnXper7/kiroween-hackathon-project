// Property-style tests for v2's pure logic.
import test from 'node:test';
import assert from 'node:assert/strict';
import { HALL_PATH, initialLap, lapReducer, LAPS, look, pathLength, rollAt, samplePath, walk } from '../v2/js/path.js';

const rand = (a, b) => a + Math.random() * (b - a);

test('the path is continuous and always on the floor plan', () => {
  const L = pathLength();
  let prev = samplePath(0);
  for (let s = 0; s <= L; s += 0.05) {
    const p = samplePath(s);
    assert.ok(Math.hypot(p.x - prev.x, p.z - prev.z) <= 0.051, 'jumped');
    prev = p;
  }
  assert.deepEqual([samplePath(-5).x, samplePath(-5).z], HALL_PATH[0]);
});

test('walking never exceeds the speed cap, a lock, or the end', () => {
  const L = pathLength();
  for (let run = 0; run < 2000; run += 1) {
    const s = rand(0, L);
    const dt = rand(0.001, 0.1);
    const stop = Math.random() < 0.5 ? rand(0, L) : Infinity;
    const out = walk(Math.min(s, stop), rand(-50, 50), dt, { maxSpeed: 1.6, stop });
    assert.ok(out >= 0 && out <= L && out <= Math.max(stop, 0) + 1e-9);
    assert.ok(Math.abs(out - Math.min(s, stop)) <= 1.6 * dt + 1e-9);
  }
});

test('looking stays inside the cone', () => {
  let v = { yaw: 0, pitch: 0 };
  for (let i = 0; i < 500; i += 1) {
    v = look(v, { yaw: rand(-10, 10), pitch: rand(-10, 10) }, rand(0, 0.2));
    assert.ok(Math.abs(v.yaw) <= 1.05 + 1e-9 && Math.abs(v.pitch) <= 0.5 + 1e-9);
  }
});

test('a lap only advances once its lock is solved, and never past the last lap', () => {
  let s = initialLap;
  for (let i = 0; i < 200; i += 1) {
    const before = s;
    s = lapReducer(s, { type: Math.random() < 0.5 ? 'SOLVE' : 'END_REACHED' });
    if (s.lap > before.lap) assert.ok(before.solved);
    assert.ok(s.lap >= 1 && s.lap <= LAPS);
  }
});

test('the world turns over smoothly, exactly once', () => {
  let prev = -1;
  for (let x = -1; x <= 10; x += 0.01) {
    const r = rollAt(x);
    assert.ok(r >= prev - 1e-12 && r >= 0 && r <= Math.PI);
    prev = r;
  }
  assert.equal(rollAt(100), Math.PI);
});
