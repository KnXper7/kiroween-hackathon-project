// The Underside: an upside-down, scroll-driven descent after the title sequence.
//
// The whole world is rotated 180°. Scrolling down drags it the "wrong" way, so new things arrive from
// the top of the screen. The build-up follows six beats (see logic/underside.js):
//   gallery   → old photographs and paintings in a quiet museum; they change when you are not looking
//   tapes     → the Smile Tapes: three found VHS tapes play upright on the TV; the faces start to grin
//   eyes      → darkness; eyes open one pair at a time and follow the pointer
//   rooms     → the same doorway again and again; the count breaks; someone is peeking
//   errors    → old system error windows pile up, smear across the screen, and the system crashes
//   broadcast → signal hijack; a figure gets closer between static cuts; then silence; then the scare
//   exit      → hold to escape; the world turns right side up … and something follows you out
//
// The camcorder clock drifts from the visitor's real time to 3:00 AM, and then it stays 3:00 AM.
// Things that make the visitor feel watched: it uses their RSVP name and local time, notices if they
// scroll back up, stop scrolling, or switch tabs, and answers in upright "broadcast" cards.

import {
  BEATS,
  beatAt,
  clamp,
  clockLabel,
  createBacktrackDetector,
  createFlashLimiter,
  createScareGate,
  dreadAt,
  errorCount,
  figureStep,
  minutesLabel,
  minutesTowardThree,
  tapeAt,
  guestName,
  holdProgress,
  roomLabel,
  timecode
} from '../logic/underside.js';
import { createUndersideAudio } from './audio.js';
import {
  createEyeField,
  drawCorridor,
  drawDoorway,
  drawEyeField,
  drawFoundFrame,
  drawGrinner,
  grain,
  tear
} from './creatures.js';
import { createSplineLayer } from './spline-layer.js';
import { drawTape } from './tapes.js';
import { createErrorLayer } from './errors.js';
import { UNDERSIDE } from '../config.js';
import { underside as COPY } from '../content.js';
import { loadDetails } from '../storage.js';

const $ = (selector, scope = document) => scope.querySelector(selector);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export function createUnderside({ gentle = false } = {}) {
  const root = $('#underside');
  const world = $('#underside-world');
  const track = $('#underside-track');
  const spacer = $('#underside-spacer');
  const staticCanvas = $('#underside-static');
  const tracking = $('#underside-tracking');
  const osdMode = $('#osd-mode');
  const osdTime = $('#osd-time');
  const osdDate = $('#osd-date');
  const tapesCanvas = $('#tapes-canvas');
  const intrusion = $('#intrusion');
  const intrusionText = $('#intrusion-text');
  const scareCanvas = $('#scare-canvas');
  const escapeUi = $('#escape-ui');
  const escapeButton = $('#escape-hold');
  const escapeMeter = $('#escape-meter');
  const live = $('#underside-live');
  const outside = $('#outside');

  const audio = createUndersideAudio({ gentle });
  const flashes = createFlashLimiter({ max: 3, windowMs: 1000, gentle });
  const scares = createScareGate({ maxPerRun: 2, minGapMs: UNDERSIDE.scareGapMs, gentle });
  const backtrack = createBacktrackDetector(UNDERSIDE.backtrackPx);
  const spline = createSplineLayer($('#underside-spline'));
  const name = guestName(loadDetails());
  const eyes = createEyeField(UNDERSIDE.eyePairs);
  const familyImage = new Image();
  familyImage.src = UNDERSIDE.familyImage;
  // Found photographs for wall pictures and single-frame flashes. Loaded lazily, after the gallery.
  const foundImages = UNDERSIDE.foundImages.map((src) => {
    const img = new Image();
    img.decoding = 'async';
    img.dataset.src = src;
    return img;
  });
  const loadFound = () => foundImages.forEach((img) => {
    if (!img.src) img.src = img.dataset.src;
  });
  const pickFound = () => foundImages[Math.floor(Math.random() * foundImages.length)];
  const errorLayer = createErrorLayer($('#errors-layer'), {
    messages: COPY.errors,
    fatal: COPY.fatal,
    onChime: () => audio?.errorChime(),
    onCrash: () => {
      audio?.staticBurst(0.9, 0.5);
      staticBoost = 1;
    }
  });

  // ---------- layout ----------
  let vw = innerWidth;
  let vh = innerHeight;
  let sections = [];
  let trackHeight = 0;
  const rooms = [...track.querySelectorAll('.u-room')].map((el, index) => ({
    el,
    index,
    canvas: el.querySelector('canvas'),
    top: 0,
    height: 0
  }));
  const frames = [...track.querySelectorAll('.u-frame')].filter((el) => el.querySelector('img')).map((el) => ({
    el,
    ghost: el.querySelector('.u-frame__ghost'),
    img: el.querySelector('img'),
    seen: false,
    changed: false,
    top: 0,
    height: 0
  }));
  const pinned = {
    eyes: $('#eyes-canvas'),
    broadcast: $('#broadcast-canvas'),
    exit: $('#exit-canvas')
  };

  function measure() {
    vw = innerWidth;
    vh = innerHeight;
    sections = BEATS.map(({ id }) => {
      const el = track.querySelector(`[data-beat="${id}"]`);
      return { id, el, top: el.offsetTop, height: el.offsetHeight };
    });
    trackHeight = track.offsetHeight;
    spacer.style.height = `${trackHeight}px`;
    rooms.forEach((room) => {
      room.top = room.el.offsetTop + room.el.offsetParent.offsetTop;
      room.height = room.el.offsetHeight;
      sizeCanvas(room.canvas, UNDERSIDE.roomResolution);
    });
    frames.forEach((frame) => {
      frame.top = frame.el.offsetTop + frame.el.offsetParent.offsetTop;
      frame.height = frame.el.offsetHeight;
    });
    Object.values(pinned).forEach((canvas) => sizeCanvas(canvas, UNDERSIDE.pinnedResolution));
    sizeCanvas(staticCanvas, 0.25);
    sizeCanvas(tapesCanvas, UNDERSIDE.pinnedResolution);
    sizeCanvas(scareCanvas, 0.6);
  }

  function sizeCanvas(canvas, scale) {
    // clientWidth/Height ignore the 180° rotation and the track's translate.
    const width = Math.max(2, Math.round((canvas.clientWidth || vw) * scale));
    const height = Math.max(2, Math.round((canvas.clientHeight || vh) * scale));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  const section = (id) => sections.find((s) => s.id === id);

  /**
   * Story progress: where the middle of the screen is, mapped onto the BEATS scale. This keeps cards,
   * dread, and sound in step with the real sections, whatever height each one ends up with.
   */
  function storyProgress(y) {
    const mid = y + vh * 0.5;
    let previousEnd = 0;
    for (let i = 0; i < sections.length; i += 1) {
      const s = sections[i];
      const end = BEATS[i].end;
      if (mid < s.top + s.height || i === sections.length - 1) {
        return previousEnd + clamp((mid - s.top) / s.height) * (end - previousEnd);
      }
      previousEnd = end;
    }
    return 1;
  }

  /** Local progress through a pinned section (0 at its start, 1 when its end leaves). */
  const localProgress = (s, y) => clamp((y - s.top) / Math.max(1, s.height - vh));

  /** -1 … 0 while approaching (within one screen), 0 … 1 visible amount, 0 after it has gone. */
  function visibility(s, y) {
    if (y + vh < s.top) return Math.max(-1, (y + vh - s.top) / vh);
    if (y > s.top + s.height) return 0;
    const shown = Math.min(y + vh, s.top + s.height) - Math.max(y, s.top);
    return clamp(shown / vh);
  }

  // ---------- state ----------
  let running = false;
  let smoothY = 0;
  let lastTime = performance.now();
  let startTime = 0;
  let pausedTimecode = null;
  let locked = false;
  let shake = 0;
  let rotation = 180;
  let staticBoost = 0;
  let lastInput = performance.now();
  let hiddenAt = 0;
  let lookedAwayBoost = 0;
  let broadcastStep = -1;
  let broadcastDone = false;
  let escapeHold = 0;
  let holding = false;
  let exiting = false;
  let backtrackCount = 0;
  let lastTape = '';
  let realMinutes = 0;
  let muted = false;
  let nextSubliminal = performance.now() + 9000;
  const shownCards = new Set();
  const pointer = { x: vw / 2, y: vh / 2 };

  // ---------- intrusions: upright broadcast cards that talk to the visitor ----------
  let cardTimer = 0;
  async function card(text, { ms = 2200, sound = true, flash = false } = {}) {
    clearTimeout(cardTimer);
    intrusionText.textContent = text;
    intrusion.hidden = false;
    intrusion.classList.remove('is-on');
    void intrusion.offsetWidth;
    intrusion.classList.add('is-on');
    if (sound) audio?.staticBurst(0.25, 0.3);
    if (flash) subliminal(true);
    staticBoost = Math.max(staticBoost, 0.6);
    cardTimer = setTimeout(() => {
      intrusion.classList.remove('is-on');
      cardTimer = setTimeout(() => {
        intrusion.hidden = true;
      }, 400);
    }, ms);
  }

  function cardOnce(key, text, options) {
    if (shownCards.has(key)) return false;
    shownCards.add(key);
    card(text, options);
    return true;
  }

  // ---------- subliminal frames ----------
  const staticCtx = staticCanvas.getContext('2d');
  let subliminalFrames = 0;
  let subliminalImage = null;
  function subliminal(force = false) {
    if (gentle) return;
    if (!force && Math.random() > 0.5) return;
    if (!flashes.tryFlash(performance.now())) return;
    subliminalFrames = 3; // about 50 ms at 60 fps
    // Half the time it is the Grinner; the other half, one of the found photographs.
    subliminalImage = Math.random() < 0.5 ? pickFound() : null;
  }

  // ---------- jumpscare ----------
  const scareCtx = scareCanvas.getContext('2d');
  async function jumpscare({ duration = UNDERSIDE.scareMs } = {}) {
    const allowed = scares.tryScare(performance.now()) && flashes.tryFlash(performance.now());
    scareCanvas.hidden = false;
    root.classList.add('is-scaring');
    if (allowed) {
      audio?.stab();
      spline.trigger('figure');
      const start = performance.now();
      await new Promise((resolve) => {
        const frame = (now) => {
          const t = (now - start) / duration;
          const { width: w, height: h } = scareCanvas;
          drawGrinner(scareCtx, w, h, { t: now / 1000, scale: 0.95 + t * 0.45 });
          tear(scareCtx, w, h, 6, w * 0.06);
          grain(scareCtx, w, h, 0.25);
          shake = 1;
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    } else {
      // Gentle mode, or the scare budget is spent: the face surfaces slowly, then sinks away.
      const start = performance.now();
      const length = 2600;
      await new Promise((resolve) => {
        const frame = (now) => {
          const t = (now - start) / length;
          const { width: w, height: h } = scareCanvas;
          drawGrinner(scareCtx, w, h, { t: now / 1000, scale: 0.8, alpha: Math.sin(Math.PI * clamp(t)) * 0.45 });
          if (t < 1) requestAnimationFrame(frame);
          else resolve();
        };
        requestAnimationFrame(frame);
      });
    }
    shake = 0;
    scareCtx.fillStyle = '#000';
    scareCtx.fillRect(0, 0, scareCanvas.width, scareCanvas.height);
    await wait(600);
    scareCanvas.hidden = true;
    root.classList.remove('is-scaring');
  }

  // ---------- scroll lock (the visitor loses control right before the scare) ----------
  function lock() {
    locked = true;
    document.documentElement.classList.add('is-underside-locked');
  }
  function unlock() {
    locked = false;
    document.documentElement.classList.remove('is-underside-locked');
  }

  async function silenceAndScare() {
    broadcastDone = true;
    lock();
    audio?.silence(0.04);
    pausedTimecode = osdTime.textContent;
    osdMode.textContent = '❚❚ PAUSE';
    await wait(900);
    card(COPY.dontTurn, { ms: 1800, sound: false });
    await wait(2200);
    audio?.breath(1.4);
    await wait(1100);
    await jumpscare();
    pausedTimecode = null;
    osdMode.textContent = 'PLAY ▶';
    audio?.restore();
    audio?.setHeartRate(0);
    unlock();
    announce(COPY.live.exit);
  }

  // ---------- escape ----------
  function setHolding(value) {
    if (exiting) return;
    holding = value;
    escapeButton.classList.toggle('is-holding', value);
    if (value) audio?.setHeartRate(150);
    else audio?.setHeartRate(0);
  }

  async function finishEscape() {
    exiting = true;
    holding = false;
    lock();
    escapeUi.hidden = true;
    audio?.staticBurst(0.6, 0.4);
    audio?.fadeOut(1.6);
    root.classList.add('is-exiting');
    const gsap = window.gsap;
    const turn = { r: rotation };
    if (gsap && !gentle) {
      await new Promise((resolve) => gsap.to(turn, {
        r: 360,
        duration: 1.6,
        ease: 'power3.inOut',
        onUpdate: () => {
          rotation = turn.r;
        },
        onComplete: resolve
      }));
    } else {
      rotation = 360;
      await wait(800);
    }
    running = false;
    root.hidden = true;
    spacer.style.height = '0px';
    unlock();
    window.scrollTo(0, 0);
    outside.hidden = false;
    $('#outside-title')?.focus();
    try {
      sessionStorage.setItem(UNDERSIDE.escapedKey, '1');
    } catch {
      // Private mode; the stinger simply will not follow them to the party page.
    }
    document.dispatchEvent(new CustomEvent('underside:escaped'));
    spline.dispose();

    // It is not over. Once the visitor relaxes, it comes back for one second.
    await wait(UNDERSIDE.afterEscapeMs);
    if (!outside.hidden) {
      outside.classList.add('is-haunted');
      const finalAudio = createUndersideAudio({ gentle });
      await finalAudio?.start().catch(() => {});
      finalAudio?.silence(0.01);
      if (!gentle) setTimeout(() => finalAudio?.stab(), 20);
      scareCanvas.hidden = false;
      root.hidden = false;
      root.classList.add('is-final');
      await jumpscare({ duration: 700 });
      root.hidden = true;
      root.classList.remove('is-final');
      outside.classList.remove('is-haunted');
      finalAudio?.fadeOut(0.5);
      setTimeout(() => finalAudio?.close(), 1500);
    }
    audio?.close();
  }

  // ---------- input ----------
  const onPointer = (event) => {
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    lastInput = performance.now();
  };
  const onScrollInput = () => {
    lastInput = performance.now();
  };
  const onKey = (event) => {
    lastInput = performance.now();
    if (!escapeUi.hidden && (event.code === 'Space' || event.code === 'Enter')) {
      event.preventDefault();
      if (event.type === 'keydown' && !event.repeat) setHolding(true);
      if (event.type === 'keyup') setHolding(false);
    }
    if (event.type === 'keydown' && document.querySelector('.fatal-screen')) {
      audio?.staticBurst(0.3, 0.4);
      subliminal(true);
    }
    if (event.type === 'keydown' && event.key === 'Escape') {
      muted = !muted;
      audio?.setMuted(muted);
      $('#underside-leave')?.focus();
    }
  };
  const onVisibility = () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      return;
    }
    if (hiddenAt && performance.now() - hiddenAt > 1200 && running && !exiting) {
      lookedAwayBoost = Math.min(1, lookedAwayBoost + 0.5);
      card(COPY.lookedAway, { ms: 2400, flash: true });
    }
    hiddenAt = 0;
  };

  function announce(text) {
    live.textContent = '';
    setTimeout(() => {
      live.textContent = text;
    }, 50);
  }

  // ---------- frame loop ----------
  let lastBeat = '';
  let lastStatic = 0;

  function update(now) {
    if (!running) return;
    const dt = Math.min(0.05, (now - lastTime) / 1000);
    lastTime = now;

    const targetY = window.scrollY;
    smoothY += (targetY - smoothY) * (1 - Math.exp(-dt * 9));
    const y = smoothY;
    const progress = storyProgress(y);
    const dread = dreadAt(progress);
    const beat = beatAt(progress);

    // World transform: upside down, plus a little camera shake.
    const shakePx = gentle ? 0 : shake * 14 + dread * dread * 1.5;
    const sx = (Math.random() - 0.5) * shakePx;
    const sy = (Math.random() - 0.5) * shakePx;
    world.style.transform = `rotate(${rotation}deg) translate3d(${sx}px, ${sy}px, 0)`;
    track.style.transform = `translate3d(0, ${-y}px, 0)`;
    root.style.setProperty('--dread', dread.toFixed(3));

    audio?.setDread(dread);
    audio?.tick(dt);

    // OSD
    osdTime.textContent = pausedTimecode ?? timecode(now - startTime);
    const elapsedMinutes = (now - startTime) / 60000;
    const clock = minutesLabel(minutesTowardThree(realMinutes + elapsedMinutes, progress));
    osdDate.textContent = `OCT 31  ${clock}`;

    // Beat changes
    if (beat !== lastBeat) {
      lastBeat = beat;
      if (beat !== 'gallery') loadFound();
      announce(COPY.live[beat]);
      if (beat === 'eyes') audio?.setHeartRate(62);
      if (beat === 'rooms') audio?.setHeartRate(74);
      if (beat === 'errors') audio?.setHeartRate(86);
      if (beat === 'broadcast') audio?.setHeartRate(96);
    }

    // Story cards along the way
    if (progress > 0.03) cardOnce('continue', COPY.continueScrolling, { ms: 2400 });
    if (progress > 0.1 && cardOnce('noUp', COPY.doNotScrollUp, { ms: 2600 })) backtrack.reset(targetY);
    if (progress > 0.155) cardOnce('smileBack', COPY.smileBack, { ms: 2400 });
    if (progress > 0.4) cardOnce('see', name ? COPY.weSeeName(name) : COPY.weSee, { ms: 2600, flash: true });
    if (progress > 0.52) {
      const real = new Date();
      cardOnce('time', real.getHours() === 3 ? COPY.awakeAtThree : COPY.itIsLate(clockLabel(real)), { ms: 3000 });
    }
    if (progress > 0.625) cardOnce('three', COPY.alwaysThree, { ms: 2600 });
    if (progress > 0.75) cardOnce('broadcast', COPY.notForYou, { ms: 2600 });

    // Scrolling back up after being told not to
    if (shownCards.has('noUp') && !locked && backtrack.update(targetY)) {
      backtrackCount += 1;
      if (backtrackCount <= 2) {
        card(backtrackCount === 1 ? COPY.weAsked : COPY.lastWarning, { ms: 2200, flash: true });
        window.scrollBy({ top: vh * 0.5, behavior: 'smooth' });
      }
    }

    // Stopping is noticed too
    if (!locked && !exiting && now - lastInput > UNDERSIDE.idleMs && progress > 0.05 && progress < 0.9) {
      if (cardOnce('stop', COPY.whyStop, { ms: 2400 })) audio?.breath(2);
    }

    // Random subliminal frames while things still look calm
    if (now > nextSubliminal && (beat === 'gallery' || beat === 'rooms')) {
      nextSubliminal = now + 11000 + Math.random() * 14000;
      subliminal();
    }

    drawGallery(y, now);
    drawTapesBeat(y, now);
    drawEyesBeat(y, now);
    drawRooms(y, now);
    drawErrorsBeat(y);
    drawBroadcast(y, now, dt);
    drawExit(y, now, progress);

    // Hold to escape
    if (!escapeUi.hidden && !exiting) {
      escapeHold = holdProgress(escapeHold, dt * 1000, holding);
      escapeMeter.style.setProperty('--hold', escapeHold.toFixed(3));
      shake = holding ? escapeHold * 0.5 : Math.max(0, shake - dt * 2);
      if (escapeHold > 0.45) cardOnce('dontLeave', COPY.dontLeave, { ms: 1600 });
      if (escapeHold >= 1) finishEscape();
    }

    // Static overlay (upright, low resolution, never a full-screen white flash)
    if (now - lastStatic > 33) {
      lastStatic = now;
      staticBoost = Math.max(0, staticBoost - 0.08);
      drawStatic(dread);
    }
    tracking.style.opacity = gentle ? '0' : String(clamp(dread * 0.9 + staticBoost * 0.4 - 0.25));

    requestAnimationFrame(update);
  }

  function drawStatic(dread) {
    const { width: w, height: h } = staticCanvas;
    staticCtx.clearRect(0, 0, w, h);
    if (subliminalFrames > 0) {
      subliminalFrames -= 1;
      if (!subliminalImage || !drawFoundFrame(staticCtx, w, h, subliminalImage, { alpha: 0.75 })) {
        drawGrinner(staticCtx, w, h, { t: performance.now() / 1000, scale: 1.1, alpha: 0.5 });
      }
      return;
    }
    const amount = 0.015 + dread * 0.05 + staticBoost * 0.3;
    const img = staticCtx.createImageData(w, h);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = Math.random() < amount ? 120 + Math.random() * 100 : 0;
    }
    staticCtx.putImageData(img, 0, 0);
  }

  // ---------- beats ----------
  function pin(canvas, s, y) {
    const offset = clamp(y - s.top, 0, Math.max(0, s.height - vh));
    canvas.style.transform = `translate3d(0, ${offset}px, 0)`;
  }

  /** Pointer position in a pinned, upside-down canvas's own pixels. */
  function pointerIn(canvas) {
    const sxScale = canvas.width / vw;
    const syScale = canvas.height / vh;
    return { x: (vw - pointer.x) * sxScale, y: (vh - pointer.y) * syScale };
  }

  function drawGallery(y) {
    frames.forEach((frame, i) => {
      const onScreen = frame.top < y + vh && frame.top + frame.height > y;
      if (onScreen) frame.seen = true;
      // It changes only once you have seen it and it has left the screen.
      if (!onScreen && frame.seen && !frame.changed && frame.top + frame.height < y) {
        frame.changed = true;
        paintGhost(frame, i);
      }
    });
  }

  function paintGhost(frame, i) {
    const { ghost, img } = frame;
    ghost.width = img.clientWidth || 300;
    ghost.height = img.clientHeight || 400;
    const ctx = ghost.getContext('2d');
    ctx.globalCompositeOperation = 'source-over';
    const corner = [[0.78, 0.25], [0.2, 0.3], [0.75, 0.7], [0.3, 0.72]][i % 4];
    drawGrinner(ctx, ghost.width, ghost.height, {
      t: i,
      scale: 0.32,
      alpha: 0.42,
      cx: ghost.width * corner[0],
      cy: ghost.height * corner[1],
      dark: false
    });
    frame.el.classList.add('is-changed');
  }

  function drawTapesBeat(y, now) {
    const s = section('tapes');
    const vis = visibility(s, y);
    tapesCanvas.style.opacity = vis > 0 ? String(clamp(vis * 1.4)) : '0';
    if (vis <= 0) return;
    const q = localProgress(s, y);
    const info = tapeAt(q, COPY.tapes.length);
    const key = `${info.index}:${info.phase}`;
    if (key !== lastTape) {
      if (info.phase === 'label') audio?.clunk();
      if (info.phase === 'blue' || info.phase === 'play') {
        audio?.staticBurst(0.2, 0.25);
        staticBoost = Math.max(staticBoost, 0.5);
      }
      lastTape = key;
    }
    drawTape(tapesCanvas.getContext('2d'), tapesCanvas.width, tapesCanvas.height, {
      ...info,
      tape: COPY.tapes[info.index],
      name,
      image: familyImage,
      now,
      rules: COPY.smileRules
    });
  }

  function drawErrorsBeat(y) {
    const s = section('errors');
    const active = y > s.top - vh * 0.2 && y < s.top + s.height - vh * 0.4 && !exiting;
    const q = localProgress(s, y);
    errorLayer.update(q, errorCount(q), active);
  }

  function drawEyesBeat(y, now) {
    const s = section('eyes');
    const vis = visibility(s, y);
    spline.update('watcher', vis, { dread: dreadAt(storyProgress(y)) * 100 });
    if (vis <= 0) return;
    const canvas = pinned.eyes;
    pin(canvas, s, y);
    const q = clamp(localProgress(s, y) + lookedAwayBoost * 0.4);
    const ctx = canvas.getContext('2d');
    drawEyeField(ctx, canvas.width, canvas.height, eyes, { progress: q, pointer: pointerIn(canvas), t: now / 1000 });
    if (spline.isReady('watcher')) canvas.style.opacity = '0.35';
  }

  function drawRooms(y, now) {
    const s = section('rooms');
    const vis = visibility(s, y);
    spline.update('door', vis, { dread: 60 + vis * 20 });
    if (vis <= 0) return;
    rooms.forEach((room) => {
      if (room.top > y + vh || room.top + room.height < y) return;
      const ctx = room.canvas.getContext('2d');
      const n = room.index;
      const flick = n > 5 ? (Math.random() > 0.92 ? 0.25 : 1) : Math.random() > 0.985 ? 0.5 : 1;
      // Every room has a picture by the door. In the rooms that should not exist, it is the Grinner.
      const picture = n >= UNDERSIDE.roomTotal ? 'grinner' : foundImages[n % foundImages.length];
      drawDoorway(ctx, room.canvas.width, room.canvas.height, {
        picture,
        open: Math.min(0.95, 0.08 + n * 0.1),
        peek: clamp((n - 3) / 3 + lookedAwayBoost * 0.3) * (n === rooms.length - 1 ? 0 : 1),
        light: flick * (1 - n * 0.06),
        t: now / 1000
      });
      grain(ctx, room.canvas.width, room.canvas.height, 0.12);
      const label = room.el.querySelector('.u-room__label');
      const text = `ROOM ${roomLabel(n, UNDERSIDE.roomTotal)}`;
      if (label.textContent !== text) label.textContent = text;
    });
  }

  function drawBroadcast(y, now) {
    const s = section('broadcast');
    const vis = visibility(s, y);
    const q = localProgress(s, y);
    const corridorQ = clamp((q - 0.12) / 0.68);
    const step = figureStep(corridorQ, 5);
    const near = [0.04, 0.22, 0.42, 0.64, 0.88][step];
    spline.update('figure', vis, { dread: 90, near: near * 100 });
    if (vis <= 0) return;
    const canvas = pinned.broadcast;
    pin(canvas, s, y);
    const ctx = canvas.getContext('2d');
    const { width: w, height: h } = canvas;

    if (q < 0.12) {
      drawBars(ctx, w, h);
    } else if (q < 0.8 && !broadcastDone) {
      if (step !== broadcastStep) {
        broadcastStep = step;
        audio?.staticBurst(0.22, 0.35);
        staticBoost = 1;
        // Between cuts, a found photograph flickers through the signal.
        if (step > 0 && !gentle && flashes.tryFlash(now)) {
          subliminalImage = pickFound();
          subliminalFrames = 2;
        }
      }
      const flicker = Math.random() > 0.96 ? 0.35 : 1;
      drawCorridor(ctx, w, h, { near, flicker, t: now / 1000, figure: !spline.isReady('figure') });
      if (staticBoost > 0.6) tear(ctx, w, h, 5, w * 0.05);
    } else {
      // It's gone. The corridor is empty. That is worse.
      drawCorridor(ctx, w, h, { near: 0, flicker: broadcastDone && locked ? 0.15 : 0.8, figure: false, t: now / 1000 });
      if (!broadcastDone) silenceAndScare();
    }
    grain(ctx, w, h, 0.14);
  }

  function drawBars(ctx, w, h) {
    const colors = ['#c0c0c0', '#c0c000', '#00c0c0', '#00c000', '#c000c0', '#c00000', '#0000c0'];
    colors.forEach((color, i) => {
      ctx.fillStyle = color;
      ctx.fillRect((w / 7) * i, 0, w / 7 + 1, h * 0.72);
    });
    ctx.fillStyle = '#0b0b0b';
    ctx.fillRect(0, h * 0.72, w, h * 0.28);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, w, h);
  }

  function drawExit(y, now, progress) {
    const s = section('exit');
    const vis = visibility(s, y);
    if (vis <= 0) {
      if (!exiting) escapeUi.hidden = true;
      return;
    }
    const canvas = pinned.exit;
    const ctx = canvas.getContext('2d');
    drawDoorway(ctx, canvas.width, canvas.height, { open: 0.9, peek: 0, light: 0.6 + escapeHold * 0.4, t: now / 1000 });
    // Light pours through the open door: the way out.
    const { width: w, height: h } = canvas;
    const glow = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, h * 0.6);
    glow.addColorStop(0, `rgba(255,236,200,${0.25 + escapeHold * 0.5})`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, w, h);
    if (y > trackHeight - vh * 1.08 && broadcastDone && !locked && escapeUi.hidden && !exiting) {
      escapeUi.hidden = false;
      escapeButton.focus({ preventScroll: true });
    }
  }

  // ---------- public ----------
  return {
    async start() {
      root.hidden = false;
      document.documentElement.classList.add('is-underside');
      measure();
      running = true;
      window.scrollTo(0, 0);
      smoothY = 0;
      startTime = performance.now();
      const real = new Date();
      realMinutes = real.getHours() * 60 + real.getMinutes();
      lastTime = performance.now();
      await audio?.start().catch(() => {});
      announce(COPY.live.gallery);

      addEventListener('resize', measure);
      addEventListener('pointermove', onPointer, { passive: true });
      addEventListener('wheel', onScrollInput, { passive: true });
      addEventListener('touchmove', onScrollInput, { passive: true });
      addEventListener('keydown', onKey);
      addEventListener('keyup', onKey);
      document.addEventListener('visibilitychange', onVisibility);
      escapeButton.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        escapeButton.setPointerCapture?.(event.pointerId);
        setHolding(true);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((type) =>
        escapeButton.addEventListener(type, () => setHolding(false))
      );
      track.querySelectorAll('img').forEach((img) => img.addEventListener('load', measure, { once: true }));

      requestAnimationFrame(update);
    }
  };
}
