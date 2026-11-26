// Pure rules for the Underside. No DOM, audio, or GSAP here, so everything can be tested in Node.

export const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (edge0, edge1, x) => {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
};

/**
 * Story beats along the scroll, as fractions of the whole track.
 * Each beat starts where the previous one ends.
 */
export const BEATS = Object.freeze([
  Object.freeze({ id: 'gallery', end: 0.15 }),
  Object.freeze({ id: 'tapes', end: 0.36 }),
  Object.freeze({ id: 'eyes', end: 0.47 }),
  Object.freeze({ id: 'rooms', end: 0.62 }),
  Object.freeze({ id: 'errors', end: 0.74 }),
  Object.freeze({ id: 'broadcast', end: 0.92 }),
  Object.freeze({ id: 'exit', end: 1 })
]);

export function beatAt(progress) {
  const p = clamp(progress);
  return (BEATS.find((beat) => p < beat.end) ?? BEATS[BEATS.length - 1]).id;
}

/**
 * Dread grows slowly, with plateaus, so the build-up never feels linear.
 * It is monotonic, bounded to [0, 1], and reaches its peak just before the broadcast ends.
 */
export function dreadAt(progress) {
  const p = clamp(progress);
  const slow = 0.35 * smoothstep(0, 0.4, p);
  const climb = 0.4 * smoothstep(0.38, 0.75, p);
  const peak = 0.25 * smoothstep(0.72, 0.88, p);
  return clamp(slow + climb + peak);
}

/** Room counter that breaks: "1/7" … "7/7", then "8/7", "9/7". */
export function roomLabel(index, total = 7) {
  return `${index + 1}/${total}`;
}

/**
 * Discrete steps of the approaching figure (the static cuts between them hide the movement).
 * Returns a step from 0 (far) to steps - 1 (closest). It never goes backwards in progress.
 */
export function figureStep(localProgress, steps = 5) {
  return Math.min(steps - 1, Math.floor(clamp(localProgress) * steps));
}

/**
 * Flash limiter: no more than `max` flashes in any `windowMs` (WCAG 2.3.1: three per second).
 * Gentle mode never flashes.
 */
export function createFlashLimiter({ max = 3, windowMs = 1000, gentle = false } = {}) {
  const history = [];
  return {
    tryFlash(now) {
      if (gentle) return false;
      while (history.length && now - history[0] >= windowMs) history.shift();
      if (history.length >= max) return false;
      history.push(now);
      return true;
    },
    count: () => history.length
  };
}

/**
 * Jumpscare rules: at most `maxPerRun`, at least `minGapMs` apart, never in gentle mode.
 */
export function createScareGate({ maxPerRun = 2, minGapMs = 45000, gentle = false } = {}) {
  let fired = 0;
  let last = -Infinity;
  return {
    tryScare(now) {
      if (gentle || fired >= maxPerRun || now - last < minGapMs) return false;
      fired += 1;
      last = now;
      return true;
    },
    fired: () => fired
  };
}

/**
 * Detects the visitor scrolling back up after being told not to.
 * Returns true once the upward travel since the last downward movement exceeds `threshold` px.
 */
export function createBacktrackDetector(threshold = 120) {
  let lowest = 0;
  return {
    update(scrollY) {
      if (scrollY > lowest) lowest = scrollY;
      if (lowest - scrollY >= threshold) {
        lowest = scrollY;
        return true;
      }
      return false;
    },
    reset(scrollY = 0) {
      lowest = scrollY;
    }
  };
}

/** "11:42 PM" from a Date, for the intrusions that know what time it is. */
export function clockLabel(date) {
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${minutes} ${suffix}`;
}

/** First name only, upper-cased, letters/spaces/hyphens/apostrophes, at most 24 chars. */
export function guestName(details) {
  const raw = typeof details?.name === 'string' ? details.name.trim().split(/\s+/)[0] : '';
  // Upper-case first: some letters grow (ß → SS), so the length cap must come after.
  return raw.replace(/[^\p{L}'-]/gu, '').toUpperCase().slice(0, 24);
}

/** VHS-style timecode "00:03:17:12" from milliseconds (25 fps). */
export function timecode(ms) {
  const total = Math.max(0, Math.floor(ms));
  const frames = Math.floor((total % 1000) / 40);
  const seconds = Math.floor(total / 1000);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}:${pad(frames)}`;
}

/** Hold-to-escape progress. Holding fills it; releasing drains it slowly. Bounded to [0, 1]. */
export function holdProgress(current, dtMs, holding, { fillMs = 2600, drainMs = 5200 } = {}) {
  const delta = holding ? dtMs / fillMs : -dtMs / drainMs;
  return clamp(current + delta);
}

/**
 * The Smile Tapes: three tapes share the tapes beat. For a local progress q, returns which tape is
 * playing, which phase it is in ('label' → 'blue' → 'play'), and how far through that phase.
 */
export function tapeAt(q, count = 3) {
  const p = clamp(q) * count;
  const index = Math.min(count - 1, Math.floor(p));
  const local = p - index;
  if (local < 0.16) return { index, phase: 'label', t: local / 0.16 };
  if (local < 0.24) return { index, phase: 'blue', t: (local - 0.16) / 0.08 };
  return { index, phase: 'play', t: (local - 0.24) / 0.76 };
}

/**
 * The camcorder clock drifts from the visitor's real time to 3:00 AM as they go deeper,
 * then stays there. Returns minutes past midnight (0–1439).
 */
export function minutesTowardThree(realMinutes, progress, arriveBy = 0.7) {
  const target = 180; // 3:00 AM
  const ahead = (((target - realMinutes) % 1440) + 1440) % 1440; // always move forward in time
  const t = smoothstep(0, arriveBy, clamp(progress));
  return Math.round(realMinutes + ahead * t) % 1440;
}

/** "3:00 AM" from minutes past midnight. */
export function minutesLabel(minutes) {
  const m = ((Math.round(minutes) % 1440) + 1440) % 1440;
  const hours = Math.floor(m / 60);
  return `${hours % 12 || 12}:${String(m % 60).padStart(2, '0')} ${hours >= 12 ? 'PM' : 'AM'}`;
}

/** How many error dialogs should be open at local progress q of the errors beat. */
export function errorCount(q, max = 7) {
  return Math.min(max, Math.floor(clamp(q / 0.7) * max));
}
