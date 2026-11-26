// After escaping the Underside, something follows you: a second cursor that trails yours,
// and a tab title that changes when you look away. Lasts for the rest of the browser session.
import { UNDERSIDE } from './config.js';

export function startStinger() {
  if (document.querySelector('.ghost-cursor')) return;
  const ghost = document.createElement('div');
  ghost.className = 'ghost-cursor';
  ghost.setAttribute('aria-hidden', 'true');
  document.body.append(ghost);

  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const trail = [];
  let x = -50;
  let y = -50;
  addEventListener('pointermove', (event) => {
    trail.push({ x: event.clientX, y: event.clientY, t: performance.now() });
  }, { passive: true });

  const frame = (now) => {
    // Replay where your cursor was about 0.7 s ago.
    while (trail.length > 1 && now - trail[1].t > 700) trail.shift();
    if (trail.length && now - trail[0].t > 700) {
      x = trail[0].x;
      y = trail[0].y;
    }
    ghost.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    if (!reduced) requestAnimationFrame(frame);
  };
  if (!reduced) requestAnimationFrame(frame);

  const originalTitle = document.title;
  document.addEventListener('visibilitychange', () => {
    document.title = document.hidden ? 'it followed you' : originalTitle;
  });
}

export function hasEscaped() {
  try {
    return sessionStorage.getItem(UNDERSIDE.escapedKey) === '1';
  } catch {
    return false;
  }
}

if (hasEscaped()) startStinger();
document.addEventListener('underside:escaped', startStinger);
