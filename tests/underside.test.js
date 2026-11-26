// Property-style tests for the Underside rules. Run with: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BEATS, beatAt, dreadAt, figureStep, createFlashLimiter, createScareGate,
  createBacktrackDetector, clockLabel, guestName, timecode, holdProgress,
  tapeAt, minutesTowardThree, minutesLabel, errorCount
} from '../js/logic/underside.js';
import { underside as COPY } from '../js/content.js';

const RUNS = 2000;
const rand = (min, max) => min + Math.random() * (max - min);

test('dread is bounded and never decreases as you go deeper', () => {
  let previous = -1;
  for (let i = 0; i <= 1000; i += 1) {
    const d = dreadAt(i / 1000);
    assert.ok(d >= 0 && d <= 1, `dread ${d} out of range`);
    assert.ok(d >= previous - 1e-12, 'dread decreased');
    previous = d;
  }
  assert.equal(dreadAt(-5), dreadAt(0));
  assert.equal(dreadAt(9), dreadAt(1));
});

test('beats come in story order and cover the whole track', () => {
  const order = BEATS.map((b) => b.id);
  let index = 0;
  for (let i = 0; i <= 1000; i += 1) {
    const at = order.indexOf(beatAt(i / 1000));
    assert.ok(at >= index, 'beat went backwards');
    index = at;
  }
  assert.equal(beatAt(0), 'gallery');
  assert.equal(beatAt(1), 'exit');
});

test('never more than 3 flashes in any one-second window (WCAG 2.3.1)', () => {
  for (let run = 0; run < 200; run += 1) {
    const limiter = createFlashLimiter();
    const accepted = [];
    let now = 0;
    for (let i = 0; i < 200; i += 1) {
      now += rand(0, 400);
      if (limiter.tryFlash(now)) accepted.push(now);
    }
    for (let i = 3; i < accepted.length; i += 1) {
      assert.ok(accepted[i] - accepted[i - 3] >= 1000, 'four flashes inside one second');
    }
  }
});

test('gentle mode never flashes or jumpscares', () => {
  const limiter = createFlashLimiter({ gentle: true });
  const gate = createScareGate({ gentle: true });
  for (let i = 0; i < RUNS; i += 1) {
    assert.equal(limiter.tryFlash(i * 1000), false);
    assert.equal(gate.tryScare(i * 100000), false);
  }
});

test('jumpscares are capped per run and spaced apart', () => {
  for (let run = 0; run < 200; run += 1) {
    const gate = createScareGate({ maxPerRun: 2, minGapMs: 12000 });
    const fired = [];
    let now = 0;
    for (let i = 0; i < 100; i += 1) {
      now += rand(0, 20000);
      if (gate.tryScare(now)) fired.push(now);
    }
    assert.ok(fired.length <= 2);
    if (fired.length === 2) assert.ok(fired[1] - fired[0] >= 12000);
  }
});

test('the approaching figure only ever gets closer', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const a = Math.random();
    const b = a + Math.random() * (1 - a);
    assert.ok(figureStep(b) >= figureStep(a));
    assert.ok(figureStep(a) >= 0 && figureStep(a) <= 4);
  }
});

test('scrolling back up past the threshold is always noticed', () => {
  const detector = createBacktrackDetector(140);
  assert.equal(detector.update(1000), false);
  assert.equal(detector.update(900), false);
  assert.equal(detector.update(850), true);
  assert.equal(detector.update(840), false, 'it re-arms after noticing');
});

test('hold-to-escape progress stays within [0, 1]', () => {
  for (let run = 0; run < 200; run += 1) {
    let p = 0;
    for (let i = 0; i < 300; i += 1) {
      p = holdProgress(p, rand(0, 100), Math.random() > 0.4);
      assert.ok(p >= 0 && p <= 1);
    }
  }
});

test('guest names are short, safe, and upper-case', () => {
  assert.equal(guestName({ name: 'ada lovelace' }), 'ADA');
  assert.equal(guestName({ name: '<script>alert(1)</script>' }), 'SCRIPTALERTSCRIPT'.slice(0, 24));
  assert.equal(guestName(null), '');
  for (let i = 0; i < RUNS; i += 1) {
    const raw = Array.from({ length: Math.floor(rand(0, 60)) }, () => String.fromCharCode(Math.floor(rand(32, 0x2fff)))).join('');
    const out = guestName({ name: raw });
    assert.ok(out.length <= 24);
    assert.ok(!/[<>&"]/.test(out));
  }
});

test('clock and timecode formats', () => {
  assert.equal(clockLabel(new Date(2026, 9, 31, 23, 42)), '11:42 PM');
  assert.equal(clockLabel(new Date(2026, 9, 31, 0, 5)), '12:05 AM');
  assert.equal(timecode(3_723_480), '01:02:03:12');
  assert.equal(timecode(-5), '00:00:00:00');
});

test('every broadcast card is eight words or fewer', () => {
  const texts = Object.entries(COPY)
    .filter(([, value]) => typeof value === 'string' || typeof value === 'function')
    .map(([, value]) => (typeof value === 'function' ? value('ALEXANDRA', '11:42 PM') : value));
  [...texts, ...COPY.smileRules].forEach((text) => assert.ok(text.split(/\s+/).length <= 8, `"${text}" is too long`));
});

test('each Smile Tape plays label, then blue screen, then footage, in order', () => {
  const order = { label: 0, blue: 1, play: 2 };
  let last = { index: 0, phase: 0 };
  for (let i = 0; i <= 3000; i += 1) {
    const { index, phase, t } = tapeAt(i / 3000);
    assert.ok(t >= 0 && t <= 1.0000001);
    const cur = { index, phase: order[phase] };
    assert.ok(cur.index > last.index || (cur.index === last.index && cur.phase >= last.phase), 'tapes went backwards');
    last = cur;
  }
  assert.equal(tapeAt(1).index, 2);
});

test('the clock always arrives at 3:00 AM and only moves forward in time', () => {
  for (let i = 0; i < RUNS; i += 1) {
    const real = Math.floor(rand(0, 1440));
    assert.equal(minutesLabel(minutesTowardThree(real, 1)), '3:00 AM');
    assert.equal(minutesTowardThree(real, 0), real);
    let previousAhead = 0;
    for (let p = 0; p <= 1; p += 0.05) {
      const ahead = (minutesTowardThree(real, p) - real + 1440) % 1440;
      assert.ok(ahead >= previousAhead, 'clock went backwards');
      previousAhead = ahead;
    }
  }
});

test('error windows only pile up, and never past the cap', () => {
  let previous = 0;
  for (let i = 0; i <= 1000; i += 1) {
    const n = errorCount(i / 1000);
    assert.ok(n >= previous && n <= 7);
    previous = n;
  }
});
