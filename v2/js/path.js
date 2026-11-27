// Pure logic for v2: the walking path, movement, and the lap state. No DOM, no three.js.

export const clamp = (v, min = 0, max = 1) => Math.min(max, Math.max(min, v));

/**
 * The walk through the L-shaped hallway, as points on the floor (x, z). The camera follows it at
 * eye height. The corner is rounded with extra points so the turn feels like a turn, not a snap.
 */
export const HALL_PATH = Object.freeze([
  [0, 0.4], [0, -2], [0, -5], [0, -8.2], [0.15, -8.85], [0.6, -9.3], [1.3, -9.55], [2.4, -9.6], [3.3, -9.6]
]);

export function pathLength(points = HALL_PATH) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}

/** Position and heading (radians, 0 = facing −z) at distance s along the path. */
export function samplePath(s, points = HALL_PATH) {
  let remaining = clamp(s, 0, pathLength(points));
  for (let i = 1; i < points.length; i += 1) {
    const [x0, z0] = points[i - 1];
    const [x1, z1] = points[i];
    const seg = Math.hypot(x1 - x0, z1 - z0);
    if (remaining <= seg || i === points.length - 1) {
      const k = seg ? clamp(remaining / seg) : 0;
      return { x: x0 + (x1 - x0) * k, z: z0 + (z1 - z0) * k, heading: Math.atan2(-(x1 - x0), -(z1 - z0)) };
    }
    remaining -= seg;
  }
  const [x, z] = points[points.length - 1];
  return { x, z, heading: 0 };
}

/**
 * Walking: intent is metres the visitor asked to move this frame (from wheel, keys or touch).
 * The step is capped by maxSpeed, and you cannot pass `stop` (an unsolved lock) or the end.
 * Walking backwards is allowed but slower.
 */
export function walk(s, intent, dt, { maxSpeed = 1.6, stop = Infinity, length = pathLength() } = {}) {
  const cap = maxSpeed * dt;
  const step = intent >= 0 ? Math.min(intent, cap) : Math.max(intent, -cap * 0.5);
  return clamp(s + step, 0, Math.min(length, stop));
}

/** Smoothly interpolated yaw/pitch for looking around, limited to a cone. */
export function look(current, target, dt, { yawLimit = 1.05, pitchLimit = 0.5, rate = 6 } = {}) {
  const k = 1 - Math.exp(-dt * rate);
  const yaw = current.yaw + (clamp(target.yaw, -yawLimit, yawLimit) - current.yaw) * k;
  const pitch = current.pitch + (clamp(target.pitch, -pitchLimit, pitchLimit) - current.pitch) * k;
  return { yaw, pitch };
}

export const LAPS = 6;

/** Lap state: you can only start the next lap once this lap's lock is solved. */
export function lapReducer(state, event) {
  switch (event.type) {
    case 'SOLVE':
      return state.solved ? state : { ...state, solved: true };
    case 'END_REACHED':
      if (!state.solved) return state;
      return state.lap >= LAPS ? { ...state, done: true } : { lap: state.lap + 1, solved: false, done: false };
    default:
      return state;
  }
}

export const initialLap = Object.freeze({ lap: 1, solved: false, done: false });

/** The inversion roll on lap 4: 0 → π as you walk from `from` to `to` metres. Monotonic. */
export function rollAt(s, { from = 2, to = 6 } = {}) {
  const k = clamp((s - from) / (to - from));
  return Math.PI * k * k * (3 - 2 * k);
}
