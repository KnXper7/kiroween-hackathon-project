import {
  TITLE_FONT,
  TITLE_LINES,
  TITLE_PULL_FROM,
  TITLE_SHOTS,
  TITLE_TIMING
} from './config.js';
import {
  buildSchedule,
  clamp,
  closeUpScale,
  drift,
  intensity,
  letterMotion,
  masterAlpha,
  pullCamera,
  shotAt,
  shotCamera,
  smooth
} from './logic/title-sequence.js';

const FONT_WEIGHT = 800;
const MAX_PIXEL_RATIO = 1.5;

// Neon palette: one red hue, from deep crimson glow to a bright red tube. No white core, no fill.
const NEON = Object.freeze({
  outerGlow: '#9e0b06',
  innerGlow: '#e0170e',
  tube: '#ff2b1c',
  highlight: '#ff6a55'
});

/**
 * Draws the Nocturne Night title sequence on a canvas.
 * elements: { canvas, bloom, haze, grain }. options: { onEnd({ skipped }) }.
 * Returns { start, skip, destroy }.
 */
export function createTitleSequence(elements, { onEnd } = {}) {
  const { canvas, bloom, haze, grain } = elements;
  const ctx = canvas.getContext('2d');
  const bloomCtx = bloom.getContext('2d');
  const schedule = buildSchedule(TITLE_SHOTS, TITLE_TIMING);

  let width = 0;
  let height = 0;
  let pixelRatio = 1;
  let letters = [];
  let bounds = null;
  let startTime = 0;
  let pausedAt = null;
  let frameId = 0;
  let running = false;
  let finished = false;
  let tabShown = !document.hidden;
  // The canvas fills the viewport, so assume it is visible until the observer says otherwise.
  let inView = true;
  let observer = null;

  // Film grain: one noise tile that CSS moves around, so there is no per-frame work.
  const buildGrain = () => {
    const tile = document.createElement('canvas');
    tile.width = 256;
    tile.height = 256;
    const tileCtx = tile.getContext('2d');
    const image = tileCtx.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.random() * 255 | 0;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
    tileCtx.putImageData(image, 0, 0);
    grain.style.backgroundImage = `url(${tile.toDataURL()})`;
  };

  const resize = () => {
    pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_PIXEL_RATIO);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    bloom.width = Math.max(1, Math.round(width / 4));
    bloom.height = Math.max(1, Math.round(height / 4));
  };

  // Measures every letter once, in world units.
  const layout = () => {
    letters = [];
    let baseline = 0;
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;

    TITLE_LINES.forEach((line, lineIndex) => {
      ctx.font = `${FONT_WEIGHT} ${line.size}px ${TITLE_FONT}`;
      const chars = [...line.text];
      const advances = chars.map((char) => ctx.measureText(char).width);
      const total = advances.reduce((sum, value) => sum + value, 0) + line.track * (chars.length - 1);
      if (lineIndex > 0) baseline += line.size * 1.1;
      let x = -total / 2;

      chars.forEach((char, charIndex) => {
        const metrics = ctx.measureText(char);
        const box = {
          x0: x - metrics.actualBoundingBoxLeft,
          x1: x + metrics.actualBoundingBoxRight,
          y0: baseline - metrics.actualBoundingBoxAscent,
          y1: baseline + metrics.actualBoundingBoxDescent
        };
        letters.push({
          ch: char,
          size: line.size,
          x,
          y: baseline,
          b: box,
          font: `${FONT_WEIGHT} ${line.size}px ${TITLE_FONT}`,
          cx: (box.x0 + box.x1) / 2,
          cy: (box.y0 + box.y1) / 2,
          ...letterMotion(letters.length)
        });
        x0 = Math.min(x0, box.x0);
        x1 = Math.max(x1, box.x1);
        y0 = Math.min(y0, box.y0);
        y1 = Math.max(y1, box.y1);
        x += advances[charIndex] + line.track;
      });
    });

    bounds = { x0, x1, y0, y1, w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  };

  // Fit the whole title inside the letterboxed frame.
  const fitScale = () => Math.min(width * 0.84 / bounds.w, height * 0.56 / bounds.h);

  // Layered strokes make the neon tube. Blur is faked by widening and dimming strokes.
  const drawLetter = (letter, index, camera, alpha, time) => {
    const light = intensity(letter, time, schedule);
    if (alpha <= 0.001) return;

    const offset = drift(letter, time, schedule);
    const scale = offset.s;
    const k = camera.s * scale;
    const ox = letter.cx + offset.x + (letter.x - letter.cx) * scale;
    const oy = letter.cy + offset.y + (letter.y - letter.cy) * scale;

    const sx0 = width / 2 + (letter.cx + offset.x + (letter.b.x0 - letter.cx) * scale - camera.x) * camera.s;
    const sx1 = width / 2 + (letter.cx + offset.x + (letter.b.x1 - letter.cx) * scale - camera.x) * camera.s;
    const sy0 = height / 2 + (letter.cy + offset.y + (letter.b.y0 - letter.cy) * scale - camera.y) * camera.s;
    const sy1 = height / 2 + (letter.cy + offset.y + (letter.b.y1 - letter.cy) * scale - camera.y) * camera.s;
    const margin = 160;
    if (sx1 < -margin || sx0 > width + margin || sy1 < -margin || sy0 > height + margin) return;

    // Depth of field: the focused letter racks from soft to sharp, neighbours stay soft.
    let blur = 0;
    if (camera.z > 1.4) {
      const distance = Math.abs(index - camera.focus) + (letters[camera.focus].size !== letter.size ? 2 : 0);
      blur = index === camera.focus
        ? camera.rack * 18
        : Math.min(26, 5 + distance * 3.5) * clamp((camera.z - 1.4) / 4);
    }

    const lineWidth = 2.8 * letter.size / 200;
    const spread = blur / k;
    const lineWidthPx = lineWidth * k;
    const sharp = 1 / (1 + blur / (lineWidthPx * 0.9 + 2));

    ctx.setTransform(
      k * pixelRatio, 0, 0, k * pixelRatio,
      (width / 2 + (ox - camera.x) * camera.s) * pixelRatio,
      (height / 2 + (oy - camera.y) * camera.s) * pixelRatio
    );
    ctx.font = letter.font;
    const a = clamp(alpha * light);

    ctx.strokeStyle = NEON.outerGlow;
    ctx.globalAlpha = a * 0.07 * (0.6 + 0.4 * sharp);
    ctx.lineWidth = lineWidth * 9 + spread * 2.4;
    ctx.strokeText(letter.ch, 0, 0);

    ctx.strokeStyle = NEON.innerGlow;
    ctx.globalAlpha = a * 0.18 * (0.5 + 0.5 * sharp);
    ctx.lineWidth = lineWidth * 3.4 + spread * 1.6;
    ctx.strokeText(letter.ch, 0, 0);

    ctx.strokeStyle = NEON.tube;
    ctx.globalAlpha = a * (0.3 + 0.65 * sharp);
    ctx.lineWidth = lineWidth + spread * 0.9;
    ctx.strokeText(letter.ch, 0, 0);

    if (sharp > 0.4) {
      ctx.strokeStyle = NEON.highlight;
      ctx.globalAlpha = a * 0.4 * sharp * sharp;
      ctx.lineWidth = lineWidth * 0.35;
      ctx.strokeText(letter.ch, 0, 0);
    }
  };

  const renderScene = (camera, alpha, time) => {
    for (let i = 0; i < letters.length; i += 1) drawLetter(letters[i], i, camera, alpha, time);
  };

  const drawAt = (time) => {
    const fit = fitScale();
    const alpha = masterAlpha(schedule, time);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineJoin = 'round';

    let hazeAmount = 0;
    const shot = shotAt(schedule, time);

    const closeFit = closeUpScale(fit, height, bounds);

    if (shot) {
      // Hard cut: exactly one framing at a time.
      const camera = shotCamera(shot, letters, time, closeFit, schedule);
      camera.z = camera.s / fit;
      renderScene(camera, alpha, time);
    } else if (time >= schedule.pullStart) {
      const camera = pullCamera(TITLE_PULL_FROM, letters, bounds, time, fit, schedule, closeFit);
      renderScene(camera, alpha, time);
      hazeAmount = smooth((camera.progress - 0.3) / 0.7);
    }

    haze.style.opacity = String(hazeAmount * alpha);

    // Cheap bloom: a quarter-size copy that CSS blurs on the GPU.
    bloomCtx.globalCompositeOperation = 'copy';
    bloomCtx.drawImage(canvas, 0, 0, bloom.width, bloom.height);
  };

  const end = (skipped) => {
    if (finished) return;
    finished = true;
    destroy();
    onEnd?.({ skipped });
  };

  const frame = (now) => {
    frameId = 0;
    if (!running) return;
    if (!tabShown || !inView) {
      // Record the pause so syncVisibility can resume from the same point.
      if (pausedAt === null) pausedAt = now;
      return;
    }

    const time = now - startTime;
    drawAt(Math.min(time, schedule.finish));

    if (time >= schedule.finish) {
      end(false);
      return;
    }
    frameId = window.requestAnimationFrame(frame);
  };

  // Pause while the tab is hidden or the sequence is off screen.
  const syncVisibility = () => {
    if (!running) return;
    const visible = tabShown && inView;

    if (!visible && pausedAt === null) {
      pausedAt = performance.now();
      window.cancelAnimationFrame(frameId);
      frameId = 0;
    } else if (visible && pausedAt !== null) {
      startTime += performance.now() - pausedAt;
      pausedAt = null;
      if (!frameId) frameId = window.requestAnimationFrame(frame);
    }
  };

  const onVisibility = () => {
    tabShown = !document.hidden;
    syncVisibility();
  };

  const handleResize = () => {
    resize();
    if (bounds) layout();
  };

  const start = async () => {
    buildGrain();
    resize();
    if (document.fonts) {
      try {
        await document.fonts.load(`${FONT_WEIGHT} 200px ${TITLE_FONT}`);
        await document.fonts.ready;
      } catch {
        // Fall back to the system serif already in the font stack.
      }
    }
    layout();

    if ('IntersectionObserver' in window) {
      observer = new IntersectionObserver((entries) => {
        inView = entries[entries.length - 1].isIntersecting;
        syncVisibility();
      }, { threshold: 0.2 });
      observer.observe(canvas);
    }
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('resize', handleResize);

    running = true;
    startTime = performance.now();
    frameId = window.requestAnimationFrame(frame);
  };

  const destroy = () => {
    running = false;
    window.cancelAnimationFrame(frameId);
    observer?.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('resize', handleResize);
  };

  const skip = () => end(true);

  return { start, skip, destroy };
}
