// Nocturne Night v2, "The Last Guest".
// A first-person walk through one L-shaped hallway, again and again, until 3:00 AM.
// It is scary because things can happen to you: you can die. Every threat warns you first, and
// every threat has a rule you have to obey under pressure:
//   THE LAMP EATER   the lights stutter and something growls: HIDE in a door before it comes
//   THE FACE         a whisper, a grin somewhere in the dark: LOOK at it (click it) before it bites
//   THE CHASE        eyes open on the walls and it comes from behind: RUN, don't stop
// The objective is always on screen, and the thing you need glows.

import * as THREE from '../../vendor/three/three.module.js';
import { GLTFLoader } from '../../vendor/three/addons/loaders/GLTFLoader.js';
import { createHouse, HOST_PHOTO } from './house.js';
import { clamp, initialLap, lapReducer, LAPS, look, pathLength, rollAt, samplePath, walk } from './path.js';
import { createUndersideAudio } from '../../js/underside/audio.js';
import { createPost } from '../../js/underside/post.js';
import { countdown, createFlashLimiter, guestName } from '../../js/logic/underside.js';
import { drawGrinner, grain, tear } from '../../js/underside/creatures.js';
import { drawNursery } from '../../js/underside/doll.js';
import { drawDevil, drawDevilClaw } from '../../js/underside/devil.js';
import { loadDetails } from '../../js/storage.js';
import { drawHandsOnGlass } from '../../js/underside/overlays.js';
import { leaveDialog, timerLie, typeByItself, watchTab } from './tricks.js';

const $ = (s) => document.querySelector(s);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const VOICE = '../assets/underside/voice/';
const EYE = 1.6;
const MAX_LIVES = 3;

const view = $('#view');
const overlay = $('#overlay');
const octx = overlay.getContext('2d');
const hud = $('#hud');
const cardEl = $('#card');
const cardText = $('#card-text');
const labelEl = $('#label');
const hint = $('#hint');
const lapEl = $('#lap');
const livesEl = $('#lives');
const timerEl = $('#timer');
const fadeEl = $('#fade');
const live = $('#live');
const objectiveBox = $('#objective-box');
const objectiveEl = $('#objective');
const alarmEl = $('#alarm');
const alarmText = $('#alarm-text');
const alarmBar = $('#alarm-bar');

const params = new URLSearchParams(location.search);
let gentle = matchMedia('(prefers-reduced-motion: reduce)').matches || new URLSearchParams(location.search).has('gentle');
const details = loadDetails();
const name = guestName(details);
const TIME_LIMIT = (Number(params.get('time')) || 600) * 1000;

const keyholeEl = $('#keyhole');
const keyholeCanvas = $('#keyhole-canvas');

$('#enter').addEventListener('click', () => start(false));
$('#enter-gentle').addEventListener('click', () => start(true));

function start(chosenGentle) {
  gentle = gentle || chosenGentle;
  $('#gate').hidden = true;
  hud.hidden = false;
  const root = document.documentElement;
  (root.requestFullscreen?.({ navigationUI: 'hide' }) ?? root.webkitRequestFullscreen?.())?.catch?.(() => {});
  run();
}

function run() {
  // ======================================================================================
  // RENDERING
  // ======================================================================================
  const renderer = new THREE.WebGLRenderer({ canvas: view, antialias: false, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  const camera = new THREE.PerspectiveCamera(62, innerWidth / innerHeight, 0.05, 40);
  camera.rotation.order = 'YXZ';
  const house = createHouse();
  const { scene } = house;
  const post = createPost(renderer, scene, camera, { bloom: 0.75, grain: 0.3, darkness: 0.82 });
  let quality = 0.75;
  function resize() {
    const w = Math.round(innerWidth * quality);
    const h = Math.round(innerHeight * quality);
    renderer.setPixelRatio(1);
    renderer.setSize(w, h, false);
    post.setSize(w, h);
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    overlay.width = Math.round(innerWidth * 0.6);
    overlay.height = Math.round(innerHeight * 0.6);
  }
  resize();
  addEventListener('resize', resize);

  const audio = createUndersideAudio({ gentle });
  audio?.start().catch(() => {});
  const flashes = createFlashLimiter({ max: 3, windowMs: 1000, gentle });

  // The glow on whatever you need to use next
  // The flashlight (lap 3): it lives on the camera and goes where you look
  scene.add(camera);
  const torch = new THREE.SpotLight(0xfff0d8, 0, 12, 0.36, 0.45, 1);
  torch.castShadow = true;
  torch.shadow.mapSize.set(512, 512);
  torch.position.set(0.14, -0.12, 0);
  torch.target.position.set(0, -0.05, -3);
  camera.add(torch, torch.target);
  let lightsOut = false;
  const ambientBase = house.ambient.intensity;

  const targetLight = new THREE.PointLight(0xffd8a0, 0, 1.6, 1.5);
  scene.add(targetLight);
  let target = null;

  // ======================================================================================
  // THE THING: a real rigged walker (Cesium Man, CC BY 4.0), pale, faceless, too tall
  // ======================================================================================
  const thing = { group: new THREE.Group(), mixer: null, action: null, ready: false };
  thing.group.visible = false;
  scene.add(thing.group);
  new GLTFLoader().load('../assets/underside/models/walker.glb', (gltf) => {
    const pale = new THREE.MeshStandardMaterial({ color: 0xcfc7ba, roughness: 0.7 });
    gltf.scene.traverse((c) => {
      if (c.isMesh) {
        c.material = pale;
        c.castShadow = true;
        c.frustumCulled = false;
      }
    });
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const k = 2.05 / (box.getSize(new THREE.Vector3()).y || 1);
    gltf.scene.scale.set(k * 0.82, k * 1.18, k * 0.82);
    thing.group.add(gltf.scene);
    thing.mixer = new THREE.AnimationMixer(gltf.scene);
    if (gltf.animations[0]) {
      thing.action = thing.mixer.clipAction(gltf.animations[0]);
      thing.action.timeScale = 0.45;
      thing.action.play();
    }
    thing.ready = true;
  });
  function placeThing(dist, { face = 'camera', speed = 0.45 } = {}) {
    const p = samplePath(clamp(dist, 0, L));
    thing.group.position.set(p.x, 0, p.z);
    thing.group.rotation.z = 0;
    thing.group.visible = true;
    if (thing.action) thing.action.timeScale = speed;
    if (face === 'camera') thing.group.lookAt(camera.position.x, 0, camera.position.z);
    else thing.group.rotation.y = p.heading + (face === 'backward' ? 0 : Math.PI);
  }

  // ======================================================================================
  // HUD HELPERS
  // ======================================================================================
  let cardTimer = 0;
  function card(text, ms = 2000) {
    clearTimeout(cardTimer);
    cardText.textContent = text;
    cardEl.hidden = false;
    audio?.staticBurst(0.2, 0.25);
    cardTimer = setTimeout(() => (cardEl.hidden = true), ms);
  }
  let hintTimer = 0;
  function objective(text, mesh = null, helpText = '') {
    objectiveEl.textContent = text;
    objectiveBox.classList.remove('is-flash');
    void objectiveBox.offsetWidth;
    objectiveBox.classList.add('is-flash');
    live.textContent = `Objective: ${text}`;
    target = mesh;
    hint.style.opacity = '0';
    clearTimeout(hintTimer);
    if (helpText) {
      // If you're stuck, a plainer hint
      hintTimer = setTimeout(() => {
        hint.textContent = helpText;
        hint.style.opacity = '1';
      }, 8000);
    }
  }
  function say(clip, fx = 'it') {
    return audio?.playClip(`${VOICE}${clip}.mp3`, { fx, level: 1 }).catch(() => {}) ?? Promise.resolve();
  }
  async function fade(on) {
    fadeEl.classList.toggle('is-on', on);
    await wait(950);
  }
  /** Big red instruction with a draining bar. Resolves true if check() became true in time. */
  function alarmWait(text, ms, check) {
    alarmText.textContent = text;
    alarmEl.hidden = false;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const left = 1 - (performance.now() - start) / ms;
        alarmBar.style.setProperty('--left', `${Math.max(0, left) * 100}%`);
        if (check()) {
          alarmEl.hidden = true;
          resolve(true);
        } else if (left <= 0) {
          alarmEl.hidden = true;
          resolve(false);
        } else setTimeout(tick, 40);
      };
      tick();
    });
  }
  let ambushing = false;
  const octxBusy = () => ambushing;
  async function ambush(text) {
    if (gentle || !flashes.tryFlash(performance.now())) {
      if (text) card(text, 1500);
      return;
    }
    audio?.screech(0.45, 0.2);
    audio?.slam(0.8);
    audio?.splat(0.4);
    post.glitch(450);
    const { width: w, height: h } = overlay;
    const cx = w * (0.3 + Math.random() * 0.4);
    const start = performance.now();
    ambushing = true;
    await new Promise((resolve) => {
      const frame = (now) => {
        const t = Math.min(1, (now - start) / 480);
        drawGrinner(octx, w, h, { t: now / 1000, scale: 0.4 + t * t * 1.5, cx, grin: 1.3, open: 0.3 + t * 0.7, blood: 0.7, stare: 1 });
        tear(octx, w, h, 5, w * 0.06);
        grain(octx, w, h, 0.25);
        if (t < 1) requestAnimationFrame(frame);
        else resolve();
      };
      requestAnimationFrame(frame);
    });
    ambushing = false;
    octx.clearRect(0, 0, w, h);
    if (text) card(text, 1600);
  }
  /** The opposite of alarmWait: you survive by NOT doing something until the bar runs out. */
  function alarmHold(text, ms, failIf) {
    alarmText.textContent = text;
    alarmEl.hidden = false;
    const start = performance.now();
    return new Promise((resolve) => {
      const tick = () => {
        const left = 1 - (performance.now() - start) / ms;
        alarmBar.style.setProperty('--left', `${Math.max(0, left) * 100}%`);
        if (failIf()) {
          alarmEl.hidden = true;
          resolve(false);
        } else if (left <= 0) {
          alarmEl.hidden = true;
          resolve(true);
        } else setTimeout(tick, 40);
      };
      tick();
    });
  }
  // Hands slapping the inside of your screen (the user's own generated hand photo)
  const handImg = new Image();
  handImg.src = '../assets/underside/generated/hand-on-glass.png';
  async function handsOnGlass() {
    if (gentle) return;
    ambushing = true;
    audio?.whisper(3, 0.14, -0.6);
    setTimeout(() => audio?.whisper(2.6, 0.14, 0.6), 400);
    let landed = 0;
    const start = performance.now();
    await new Promise((resolve) => {
      const step = (now) => {
        const p = Math.min(1, (now - start) / 4200);
        const n = drawHandsOnGlass(octx, overlay.width, overlay.height, { p, count: 18, img: handImg });
        while (landed < n) {
          landed += 1;
          audio?.glassThump(0.25 + Math.random() * 0.25);
        }
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    octx.clearRect(0, 0, overlay.width, overlay.height);
    ambushing = false;
  }

  // ======================================================================================
  // STATE
  // ======================================================================================
  const L = pathLength();
  let lapState = initialLap;
  let s = 0;
  let intent = 0;
  let lookCur = { yaw: 0, pitch: 0 };
  let lookTarget = { yaw: 0, pitch: 0 };
  let lookBack = 0; // 0 = forward, 1 = turned all the way round
  let busy = false; // a scripted moment: no walking
  let eventActive = false; // a threat is happening: no walking
  let ended = false;
  let lives = MAX_LIVES;
  let flicker = 1;
  let storm = false; // lights stuttering hard
  let peeking = false; // hiding: seeing the hall through a door's crack
  let hidden = false;
  let faceClicked = false;
  let activeIds = new Set();
  let runSerial = 0; // bumps on death/restart so old async scripts stop
  const startTime = performance.now();
  let lockedMs = 0;
  let stillMoved = 0; // how much you moved during a DON'T MOVE
  let nextLie = performance.now() + 30000;

  function setLives(n) {
    lives = n;
    livesEl.textContent = '♥'.repeat(Math.max(0, lives)) + '♡'.repeat(Math.max(0, MAX_LIVES - lives));
  }
  setLives(MAX_LIVES);

  function damage(reason) {
    setLives(lives - 1);
    post.glitch(500);
    if (lives <= 0) die(reason);
  }

  // ---------- death and retry ----------
  async function die(reason = 'The party goes on without you.') {
    if (ended) return;
    runSerial += 1;
    busy = true;
    eventActive = false;
    storm = false;
    peeking = false;
    alarmEl.hidden = true;
    await ambush();
    thing.group.visible = false;
    audio?.braam(2.5, 0.35);
    $('#death-text').textContent = reason;
    $('#death').hidden = false;
    $('#retry').focus();
  }
  $('#retry').addEventListener('click', async () => {
    $('#death').hidden = true;
    await fade(true);
    setLives(MAX_LIVES);
    lapState = { lap: lapState.lap, solved: false, done: false };
    s = 0;
    enterLap();
    await fade(false);
    busy = false;
  });

  // ======================================================================================
  // THREAT 1: THE LAMP EATER. Lights stutter, it growls: hide in a door, now.
  // ======================================================================================
  async function lampEater(text = 'HIDE IN A DOOR — NOW') {
    if (eventActive || ended || nursery.open || devil.open) return 'skip';
    const serial = runSerial;
    eventActive = true;
    hidden = false;
    const before = activeIds;
    activeIds = new Set(['hide', 'nursery']);
    objective('Something is coming. Hide in one of the side doors.');
    storm = true;
    audio?.braam(5, 0.32);
    const growl = setInterval(() => audio?.staticBurst(0.25, 0.12), 380);
    const made = gentle ? true : await alarmWait(text, 5200, () => hidden);
    if (serial !== runSerial) {
      clearInterval(growl);
      return 'dead';
    }
    if (!made) {
      // It finds you in the hall
      clearInterval(growl);
      placeThing(s + 4, { speed: 3 });
      for (let i = 0; i < 20; i += 1) {
        placeThing(s + 4 - i * 0.18, { speed: 3 });
        await wait(30);
      }
      storm = false;
      eventActive = false;
      activeIds = before;
      die('It found you in the hall. Hide when the lights stutter.');
      return 'dead';
    }
    // Hidden: watch it go past through the crack in the door
    peeking = true;
    audio?.whisper(1, 0.12, 0);
    await wait(900);
    audio?.skitter(1.4);
    audio?.screech(0.7, 0.18);
    let runS = L;
    await new Promise((resolve) => {
      const step = () => {
        runS -= 0.14;
        placeThing(runS, { face: 'forward', speed: 3.2 });
        flicker = Math.abs(runS - s) < 2.5 ? 0.05 : flicker;
        if (Math.abs(runS - s) < 0.5) {
          audio?.slam(0.9);
          post.glitch(300);
        }
        if (runS > -1 && serial === runSerial) setTimeout(step, 16);
        else resolve();
      };
      step();
    });
    clearInterval(growl);
    thing.group.visible = false;
    storm = false;
    peeking = false;
    eventActive = false;
    activeIds = before;
    card('IT’S GONE.', 1400);
    return 'survived';
  }

  // ======================================================================================
  // THREAT 2: THE FACE. A whisper; a grin somewhere in the dark: look at it (click) in time.
  // ======================================================================================
  const faceCanvas = document.createElement('canvas');
  faceCanvas.width = 256;
  faceCanvas.height = 320;
  const faceTex = new THREE.CanvasTexture(faceCanvas);
  faceTex.colorSpace = THREE.SRGBColorSpace;
  const faceMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.69), new THREE.MeshBasicMaterial({ map: faceTex, transparent: true }));
  faceMesh.userData = { id: 'face', label: 'LOOK AT IT' };
  faceMesh.visible = false;
  scene.add(faceMesh);
  async function faceEvent() {
    if (eventActive || ended || busy || nursery.open || devil.open) return;
    const serial = runSerial;
    eventActive = true;
    faceClicked = false;
    const ctx = faceCanvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 320);
    drawGrinner(ctx, 256, 320, { t: Math.random() * 9, scale: 1.25, cy: 165, dark: false, grin: 1.3, open: 0.55, blood: 0.8, stare: 1 });
    faceTex.needsUpdate = true;
    // Somewhere you can see, but not where you're looking
    const side = Math.random() < 0.5 ? -1 : 1;
    const yaw = camera.rotation.y + side * (0.45 + Math.random() * 0.35);
    faceMesh.position.set(camera.position.x - Math.sin(yaw) * 1.9, 1.1 + Math.random() * 0.9, camera.position.z - Math.cos(yaw) * 1.9);
    faceMesh.lookAt(camera.position);
    faceMesh.rotation.z = (Math.random() - 0.5) * 0.8;
    faceMesh.visible = true;
    house.interactives.push(faceMesh);
    activeIds.add('face');
    audio?.whisper(0.9, 0.2, side * 0.8);
    const before = objectiveEl.textContent;
    objective('A face. Look at it and click it before it reaches you.');
    const ok = gentle ? true : await alarmWait('LOOK AT IT — CLICK IT', 3600, () => faceClicked);
    faceMesh.visible = false;
    house.interactives.splice(house.interactives.indexOf(faceMesh), 1);
    activeIds.delete('face');
    eventActive = false;
    if (serial !== runSerial) return;
    if (ok) {
      audio?.screech(0.35, 0.12);
      post.glitch(220);
      card('IT’S GONE. FOR NOW.', 1200);
    } else {
      await ambush();
      damage('You let it get too close. Look at it when it whispers.');
    }
    if (!ended && lives > 0) objective(before);
  }

  // ======================================================================================
  // THREAT 3: THE STILL ONE. It hunts by movement. It is right in front of you. Don't move.
  // ======================================================================================
  async function freezeEvent() {
    if (eventActive || ended) return 'skip';
    const serial = runSerial;
    eventActive = true;
    const before = activeIds;
    activeIds = new Set();
    objective('It hunts by movement. Don’t move the mouse. Don’t scroll. Don’t breathe.');
    flicker = 0.02;
    audio?.setDread(0);
    await wait(1300);
    if (serial !== runSerial) return 'dead';
    // When the light comes back it is right there, stooped to your height, head cocked
    const ahead = samplePath(Math.min(L, s + 0.9));
    thing.group.position.set(ahead.x, -0.55, ahead.z);
    thing.group.visible = true;
    thing.group.lookAt(camera.position.x, -0.55, camera.position.z);
    thing.group.rotation.z = 0.22;
    if (thing.action) thing.action.timeScale = 0.04;
    // and it has a face now
    const fwd = new THREE.Vector3();
    camera.getWorldDirection(fwd);
    faceMesh.position.copy(camera.position).addScaledVector(fwd, 0.78);
    faceMesh.position.y = EYE + 0.04;
    faceMesh.lookAt(camera.position);
    faceMesh.rotation.z += 0.2;
    faceMesh.visible = true;
    const fctx = faceCanvas.getContext('2d');
    let grin = 0.4;
    const redraw = setInterval(() => {
      grin = Math.min(1.5, grin + 0.05);
      fctx.clearRect(0, 0, 256, 320);
      drawGrinner(fctx, 256, 320, { t: performance.now() / 1000, scale: 1.25, cy: 165, dark: false, grin, open: grin * 0.4, blood: 0.6, stare: 1 });
      faceTex.needsUpdate = true;
    }, 180);
    flicker = 0.4;
    audio?.breath(6);
    audio?.braam(6, 0.18);
    stillMoved = 0;
    const startHold = performance.now();
    const ok = gentle ? true : await alarmHold('DON’T MOVE', 6000, () => performance.now() - startHold > 350 && stillMoved > 70);
    clearInterval(redraw);
    if (serial !== runSerial) return 'dead';
    if (!ok) {
      await ambush();
      faceMesh.visible = false;
      thing.group.visible = false;
      flicker = 1;
      eventActive = false;
      activeIds = before;
      damage('It saw you move. When it’s close, freeze.');
      return lives > 0 ? 'hurt' : 'dead';
    }
    // It loses interest. The lights come back. Relief...
    flicker = 0.02;
    await wait(700);
    faceMesh.visible = false;
    thing.group.visible = false;
    flicker = 1;
    card('IT’S GONE.', 1200);
    await wait(1700);
    eventActive = false;
    activeIds = before;
    // ...and that's when it comes back
    if (serial === runSerial) await ambush('IT WAS NEVER GONE.');
    return 'survived';
  }

  // ======================================================================================
  // THREAT 4: THE ONE BEHIND YOU. Footsteps right behind you. Whatever you do, don't look back.
  // ======================================================================================
  async function behindEvent() {
    if (eventActive || ended) return 'skip';
    const serial = runSerial;
    eventActive = true;
    objective('Something is right behind you. Do NOT look back. Don’t press S.');
    placeThing(Math.max(0, s - 0.7), { speed: 0.1 });
    audio?.breath(4);
    const steps = setInterval(() => audio?.creak(0.25, 0.1), 700);
    setTimeout(() => audio?.whisper(2.4, 0.18, 0), 1500);
    const ok = gentle ? true : await alarmHold('DON’T TURN AROUND', 6500, () => lookBack > 0.35);
    clearInterval(steps);
    if (serial !== runSerial) return 'dead';
    if (!ok) {
      await wait(250); // let them see it
      await ambush();
      damage('You looked. Never look at the one behind you.');
    } else {
      timerLie(timerEl, 'GOOD', 900);
    }
    thing.group.visible = false;
    eventActive = false;
    return ok ? 'survived' : 'hurt';
  }

  // ======================================================================================
  // THE CHASE: eyes on the walls; it comes from behind. Run.
  // ======================================================================================
  const eyes = [];
  const eyeCanvas = document.createElement('canvas');
  eyeCanvas.width = 128;
  eyeCanvas.height = 48;
  {
    const c = eyeCanvas.getContext('2d');
    [[34, 24, 15], [94, 22, 12]].forEach(([x, y, r]) => {
      c.fillStyle = '#e8e2d4';
      c.beginPath();
      c.ellipse(x, y, r * 1.5, r, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#1a0a04';
      c.beginPath();
      c.arc(x + 2, y, r * 0.6, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#000';
      c.beginPath();
      c.arc(x + 2, y, r * 0.28, 0, Math.PI * 2);
      c.fill();
    });
  }
  const eyeTex = new THREE.CanvasTexture(eyeCanvas);
  eyeTex.colorSpace = THREE.SRGBColorSpace;
  const eyeMat = new THREE.MeshBasicMaterial({ map: eyeTex, transparent: true });
  for (let i = 0; i < 26; i += 1) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.13), eyeMat);
    const left = i % 2 === 0;
    m.position.set(left ? -0.885 : 0.885, 0.6 + Math.random() * 1.7, -0.5 - Math.random() * 8);
    m.rotation.y = left ? Math.PI / 2 : -Math.PI / 2;
    m.rotation.z = (Math.random() - 0.5) * 0.9;
    m.scale.set(0.7 + Math.random() * 0.8, 0.001, 1);
    m.userData.size = m.scale.x;
    m.visible = false;
    scene.add(m);
    eyes.push(m);
  }
  const chase = { on: false, s: 0 };

  // ======================================================================================
  // PANELS: the nursery (the doll) and the host (the Devil)
  // ======================================================================================
  const nursery = { open: false, stage: 0, wind: 0, holding: false, playing: false, look: 0, near: 0, lastTick: 0, resolve: null };
  const nurseryPanel = $('#nursery-panel');
  const nurseryCanvas = $('#nursery-canvas');
  const windButton = $('#wind');
  const windMeter = $('#wind-meter');
  const windLabel = $('#wind-label');
  function openNursery() {
    return new Promise((resolve) => {
      nursery.open = true;
      nursery.stage = 0;
      nursery.wind = 0;
      nursery.near = 0;
      nursery.resolve = resolve;
      nurseryCanvas.width = Math.round(innerWidth * 0.6);
      nurseryCanvas.height = Math.round(innerHeight * 0.6);
      nurseryPanel.hidden = false;
      windButton.disabled = false;
      windLabel.textContent = 'Hold to wind';
      $('#nursery-prompt').textContent = 'The music box has stopped. Hold the button to wind it.';
      objective('Wind the music box. Don’t look away from her.');
    });
  }
  windButton.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    windButton.setPointerCapture?.(e.pointerId);
    if (!nursery.playing) nursery.holding = true;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach((t) => windButton.addEventListener(t, () => (nursery.holding = false)));
  windButton.addEventListener('keydown', (e) => {
    if ((e.code === 'Space' || e.code === 'Enter') && !e.repeat) {
      e.preventDefault();
      if (!nursery.playing) nursery.holding = true;
    }
  });
  windButton.addEventListener('keyup', () => (nursery.holding = false));
  async function playNursery() {
    nursery.playing = true;
    nursery.holding = false;
    windButton.disabled = true;
    windLabel.textContent = 'Listen…';
    $('#nursery-prompt').textContent = 'Keep watching her.';
    const song = audio?.lullaby(12) ?? wait(5000);
    // While it plays, she changes. Halfway, her head snaps round.
    const start = performance.now();
    const grow = setInterval(() => {
      nursery.stage = Math.min(0.95, (performance.now() - start) / 6500);
      nursery.near = nursery.stage * 0.8;
    }, 50);
    setTimeout(() => {
      nursery.look = -1.7;
      audio?.screech(0.35, 0.14);
    }, 3000);
    await song;
    clearInterval(grow);
    nursery.stage = 1;
    await say('doll-play-with-me', 'radio');
    await ambush('SHE WANTS TO PLAY.');
    nurseryPanel.hidden = true;
    nursery.open = false;
    nursery.playing = false;
    nursery.resolve?.();
  }

  const devil = { open: false, presence: 0, speak: 0, rage: 0, claw: -1, resolve: null };
  const devilPanel = $('#devil-panel');
  const devilCanvas = $('#devil-canvas');
  const rsvpInput = $('#rsvp');
  function openDevil() {
    return new Promise((resolve) => {
      devil.open = true;
      devil.presence = 0;
      devil.claw = -1;
      devil.resolve = resolve;
      devilCanvas.width = Math.round(innerWidth * 0.6);
      devilCanvas.height = Math.round(innerHeight * 0.6);
      devilPanel.hidden = false;
      audio?.braam(3.5, 0.35);
      setTimeout(async () => {
        devil.speak = 1;
        await say('devil-rsvpd');
        devil.speak = 0;
        rsvpInput.focus();
        if (!gentle) typeByItself(rsvpInput, 'nobody leaves', { audio });
      }, 1800);
      objective('Cancel your RSVP. Type the name you signed up with.');
    });
  }
  const normalise = (t) => t.trim().toLowerCase().replace(/\s+/g, ' ');
  rsvpInput.addEventListener('input', () => {
    devil.rage = Math.min(0.8, devil.rage + 0.08);
    audio?.whisper(0.4, 0.08, (Math.random() - 0.5) * 1.6);
  });
  $('#rsvp-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const want = normalise(details?.name ?? '');
    const got = normalise(rsvpInput.value);
    const ok = want ? got === want || (got.length > 1 && got === want.split(' ')[0]) : got.length > 0;
    if (!ok) {
      devil.rage = 1;
      devil.speak = 1;
      say('devil-wrong').then(() => (devil.speak = 0));
      await wait(900);
      await ambush('THAT ISN’T YOUR NAME. −30 SECONDS.');
      lockedMs -= 30000;
      rsvpInput.value = '';
      return;
    }
    devil.rage = 1;
    devil.speak = 1;
    audio?.screech(1, 0.2);
    await say('devil-nobody-leaves');
    devil.speak = 0;
    devil.claw = performance.now();
    audio?.scrape(1, 0.35);
    await wait(2000);
    devilPanel.hidden = true;
    devil.open = false;
    devil.resolve?.();
  });

  // ======================================================================================
  // THE KEYHOLE: the nursery door is locked. Look through. Something looks back.
  // ======================================================================================
  function keyholePath(c, w, h) {
    const r = Math.min(w, h) * 0.13;
    c.beginPath();
    c.arc(w / 2, h * 0.42, r, 0, Math.PI * 2);
    c.moveTo(w / 2 - r * 0.5, h * 0.42 + r * 0.6);
    c.lineTo(w / 2 - r * 0.95, h * 0.42 + r * 3.1);
    c.lineTo(w / 2 + r * 0.95, h * 0.42 + r * 3.1);
    c.lineTo(w / 2 + r * 0.5, h * 0.42 + r * 0.6);
    c.closePath();
  }
  const roomCanvas = document.createElement('canvas');
  function drawEye(c, w, h, t, k) {
    const cx = w / 2 + Math.sin(t * 7) * 4;
    const cy = h * 0.42 + Math.min(w, h) * 0.04;
    const R = Math.min(w, h) * (0.12 + k * 0.05);
    c.fillStyle = '#3a0a06';
    c.fillRect(0, 0, w, h);
    const sclera = c.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.4);
    sclera.addColorStop(0, '#efe6d6');
    sclera.addColorStop(0.7, '#d8a890');
    sclera.addColorStop(1, '#5a1a12');
    c.fillStyle = sclera;
    c.fillRect(0, 0, w, h);
    c.strokeStyle = 'rgba(170, 20, 20, 0.7)';
    for (let i = 0; i < 26; i += 1) {
      const a = i * 2.39;
      c.lineWidth = 1 + (i % 3);
      c.beginPath();
      c.moveTo(cx + Math.cos(a) * R * 1.6, cy + Math.sin(a) * R * 1.6);
      c.quadraticCurveTo(cx + Math.cos(a + 0.3) * R, cy + Math.sin(a + 0.3) * R, cx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5);
      c.stroke();
    }
    const lx = cx + Math.sin(t * 2.3) * R * 0.08 - R * 0.06;
    const iris = c.createRadialGradient(lx, cy, R * 0.1, lx, cy, R * 0.45);
    iris.addColorStop(0, '#2a1808');
    iris.addColorStop(0.6, '#6a4a1a');
    iris.addColorStop(1, '#1a0e04');
    c.fillStyle = iris;
    c.beginPath();
    c.arc(lx, cy, R * 0.45, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.beginPath();
    c.ellipse(lx, cy, R * (0.14 + k * 0.1), R * 0.2, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = 'rgba(255,255,255,0.7)';
    c.beginPath();
    c.arc(lx - R * 0.12, cy - R * 0.14, R * 0.05, 0, Math.PI * 2);
    c.fill();
  }
  async function keyhole() {
    const serial = runSerial;
    keyholeCanvas.width = Math.round(innerWidth * 0.6);
    keyholeCanvas.height = Math.round(innerHeight * 0.6);
    keyholeEl.hidden = false;
    objective('It’s locked. Look through the keyhole. Find her.');
    const c = keyholeCanvas.getContext('2d');
    const { width: w, height: h } = keyholeCanvas;
    const start = performance.now();
    const EYE_AT = 4200;
    let slammed = false;
    await new Promise((resolve) => {
      const step = (now) => {
        const e = now - start;
        c.fillStyle = '#000';
        c.fillRect(0, 0, w, h);
        c.save();
        keyholePath(c, w, h);
        c.clip();
        if (e < EYE_AT || gentle) {
          // the nursery beyond, small and far: she's sitting with her back to you
          roomCanvas.width = Math.round(w * 0.5);
          roomCanvas.height = Math.round(h * 0.5);
          drawNursery(roomCanvas.getContext('2d'), roomCanvas.width, roomCanvas.height, { t: now / 1000, stage: 0.15, look: (pointerPx.x / innerWidth - 0.5) * 0.8, light: Math.random() < 0.03 ? 0.4 : 1, crank: 0, near: 0 });
          const r = Math.min(w, h) * 0.13;
          const bw = r * 2.6;
          const bh = bw * (roomCanvas.height / roomCanvas.width);
          const px = (pointerPx.x / innerWidth - 0.5) * r * 0.8;
          c.drawImage(roomCanvas, w / 2 - bw / 2 - px, h * 0.42 - r * 0.9, bw, bh);
          if (e > EYE_AT - 900) {
            c.fillStyle = `rgba(0,0,0,${(e - (EYE_AT - 900)) / 900})`;
            c.fillRect(0, 0, w, h);
          }
        } else {
          if (!slammed) {
            slammed = true;
            audio?.slam(1);
            audio?.screech(0.5, 0.22);
            post.glitch(300);
          }
          drawEye(c, w, h, now / 1000, Math.min(1, (e - EYE_AT) / 400));
        }
        c.restore();
        grain(c, w, h, 0.12);
        if (e < (gentle ? 2600 : EYE_AT + 2200) && serial === runSerial) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
    keyholeEl.hidden = true;
    if (!gentle) card('SHE SEES YOU TOO.', 1400);
    await wait(1400);
  }

  // ======================================================================================
  // THE LAPS
  // ======================================================================================
  const radioState = { on: false, offs: 0, run: 0 };
  async function radioLoop() {
    const run = ++radioState.run;
    const lines = ['radio-1', 'radio-2', 'radio-3', 'radio-4', 'radio-5', 'radio-6', 'radio-7'];
    for (let i = 0; radioState.on && run === radioState.run; i = (i + 1) % lines.length) {
      audio?.tuning(0.5, 0.08);
      await wait(500);
      if (!radioState.on || run !== radioState.run) return;
      await say(lines[i], 'radio');
      await wait(700);
    }
  }
  function setRadio(on) {
    radioState.on = on;
    house.radio.dialMat.emissiveIntensity = on ? 1.4 : 0;
    if (on) radioLoop();
    else radioState.run += 1;
  }
  function changedPhotos() {
    house.frames.forEach((f, i) => {
      if (i === HOST_PHOTO || !f.tex.image) return;
      const img = f.tex.image;
      const c = document.createElement('canvas');
      c.width = img.naturalWidth || 512;
      c.height = img.naturalHeight || 640;
      const x = c.getContext('2d');
      x.drawImage(img, 0, 0, c.width, c.height);
      x.globalCompositeOperation = 'screen';
      drawGrinner(x, c.width, c.height, { t: i, scale: 0.4, alpha: 0.55, cx: c.width * (i % 2 ? 0.72 : 0.3), cy: c.height * 0.3, dark: false, grin: 1.2, open: 0.3, blood: 0.5 });
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      f.photoMat.map = tex;
      f.photoMat.emissiveMap = tex;
      f.photoMat.needsUpdate = true;
    });
  }
  const once = new Set(); // one-off events per lap attempt
  const finalLeaf = house.doors.final.leaf;
  const toDoor = () => objective('Go through the door at the end of the hall.', finalLeaf, 'Keep scrolling up. The hall turns right at the end.');

  const LAP_SCRIPTS = {
    1: {
      dread: 0.08,
      stop: 3.3,
      enter() {
        house.phone.handset.position.y = 0.085;
        house.phone.handset.rotation.z = 0;
        activeIds = new Set(['phone']);
        objective('A phone is ringing. Find it and answer it.', house.phone.group.children[0], 'The phone is on the small table on your right. Click it.');
        hint.textContent = 'Scroll up to walk. Move to look. Click to use.';
        hint.style.opacity = '1';
        this.nextRing = performance.now() + 2500;
      },
      update(now) {
        if (!lapState.solved && now > this.nextRing) {
          audio?.ring(0.24);
          this.nextRing = now + 3600;
        }
      },
      async interact(id) {
        if (id !== 'phone' || lapState.solved) return;
        busy = true;
        house.phone.handset.position.y = 0.2;
        house.phone.handset.rotation.z = 0.6;
        audio?.clunk();
        await wait(900);
        await say('it-we-see-you');
        card(name ? `WE SEE YOU, ${name}.` : 'WE SEE YOU.', 2200);
        await wait(2300);
        house.phone.handset.position.y = 0.085;
        house.phone.handset.rotation.z = 0;
        // The page itself asks if you want to leave. Close the window. Try to.
        objective('Close the window.');
        await leaveDialog(document.body, { audio, gentle });
        await handsOnGlass();
        busy = false;
        solve();
        toDoor();
      }
    },
    2: {
      dread: 0.3,
      stop: 3.3,
      enter() {
        house.doors.left1.open(0.5);
        radioState.offs = 0;
        setRadio(true);
        activeIds = new Set(['radio']);
        objective('The radio turned itself on. Turn it off.', house.radio.group.children[0], 'The radio is on the table on your right. Click it.');
      },
      update(now) {
        if (now > (this.nextFlicker || 0)) {
          this.nextFlicker = now + 2500 + Math.random() * 4000;
          flicker = 0.15;
          setTimeout(() => (flicker = 1), 90 + Math.random() * 160);
        }
        // The first time you meet it: after the radio, on the way to the door
        if (lapState.solved && s > 5.2 && !once.has('eater2')) {
          once.add('eater2');
          lampEater().then((r) => r === 'survived' && toDoor());
        }
      },
      async interact(id) {
        if (id !== 'radio' || !radioState.on || busy) return;
        setRadio(false);
        audio?.clunk();
        radioState.offs += 1;
        if (radioState.offs < 3) {
          busy = true;
          await wait(2200);
          audio?.staticBurst(0.6, 0.35);
          setRadio(true);
          card(radioState.offs === 1 ? 'IT TURNED ITSELF BACK ON.' : 'STOP TOUCHING IT.', 1500);
          busy = false;
          return;
        }
        await ambush();
        solve();
        activeIds = new Set();
        toDoor();
      }
    },
    3: {
      dread: 0.5,
      stop: 6.1,
      enter() {
        changedPhotos();
        house.doors.left1.open(0.1);
        house.doors.left2.open(0.7);
        house.sconce.intensity = 0; // the power is out
        lightsOut = true;
        house.ambient.intensity = ambientBase * 0.25;
        card('THE POWER WENT OUT.', 1600);
        placeThing(L - 0.6, { speed: 0.3 });
        this.dist = 0;
        activeIds = new Set(['photo']);
        objective('Use your flashlight (move the mouse). Find the host’s portrait: the Devil. Click it.', house.frames[HOST_PHOTO].photo, 'The host’s portrait is on the right, near the end of the hall.');
      },
      update(now) {
        if (now > (this.nextFlicker || 0)) {
          this.nextFlicker = now + 3500 + Math.random() * 3500;
          flicker = 0.02; // the flashlight dies...
          audio?.clunk();
          setTimeout(() => {
            audio?.clunk();
            flicker = 1;
            if (thing.group.visible && !eventActive) {
              this.dist = Math.min(4.2, this.dist + 1.2); // it moves only in the dark
              placeThing(Math.max(s + 2.2, L - 0.6 - this.dist), { speed: 0.3 });
              audio?.skitter(0.25);
            }
          }, 750);
        }
        if (s > 2 && !once.has('face3a')) {
          once.add('face3a');
          faceEvent();
        }
        if (s > 4.6 && !once.has('face3b')) {
          once.add('face3b');
          setTimeout(faceEvent, 600);
        }
      },
      async interact(id, obj) {
        if (id === 'face') return;
        if (id !== 'photo' || busy || lapState.solved) return;
        const index = obj.userData.index;
        if (index === HOST_PHOTO) {
          busy = true;
          house.frames[index].photoMat.emissive.set(0xff2010);
          house.frames[index].photoMat.emissiveIntensity = 0.9;
          audio?.braam(2.4, 0.3);
          await ambush('THE HOST IS EXPECTING YOU.');
          thing.group.visible = false;
          busy = false;
          solve();
          activeIds = new Set();
          toDoor();
        } else {
          house.frames[index].photoMat.emissiveIntensity = 0.5;
          audio?.whisper(1.2, 0.14, 0);
          setTimeout(() => (house.frames[index].photoMat.emissiveIntensity = 0.06), 400);
          card('NOT THAT ONE.', 1000);
        }
      }
    },
    4: {
      dread: 0.65,
      stop: 4.0,
      enter() {
        house.doors.right1.open(0.35);
        house.lamp.light.color.setHex(0xff8a60);
        activeIds = new Set(['nursery']);
        objective('Keep walking. Something is crying in the nursery. Open its door.', house.doors.right1.leaf, 'The nursery door is on your right, the one left open.');
      },
      update() {
        if (s > 1.4 && !once.has('face4')) {
          once.add('face4');
          faceEvent();
        }
        if (lapState.solved && s > 5.5 && !once.has('still4')) {
          once.add('still4');
          freezeEvent().then((r) => r !== 'dead' && lives > 0 && toDoor());
        }
      },
      async interact(id) {
        if (id !== 'nursery' || busy || lapState.solved) return;
        busy = true;
        await keyhole();
        house.doors.right1.open(1.2);
        audio?.creak(1.4, 0.2);
        await openNursery();
        house.doors.right1.open(0);
        audio?.slam(0.9);
        busy = false;
        solve();
        activeIds = new Set();
        toDoor();
      }
    },
    5: {
      dread: 0.85,
      stop: Infinity,
      enter() {
        house.lamp.light.color.setHex(0xff2a18);
        house.ambient.color.setHex(0x3a0808);
        eyes.forEach((e) => {
          e.visible = true;
          e.scale.y = 0.001;
        });
        chase.on = false;
        activeIds = new Set();
        solve(); // no lock: just survive
        objective('The eyes are opening. When it comes, RUN to the door. Don’t stop.', finalLeaf, 'Keep scrolling up, or hold W. Press S to look back.');
      },
      update(now, dt) {
        // eyes open one by one as you walk in
        eyes.forEach((e, i) => {
          if (s > 0.3 + i * 0.08) e.scale.y = Math.min(e.userData.size, e.scale.y + dt * 2);
        });
        if (!chase.on && s > 1.0 && !gentle) {
          chase.on = true;
          chase.s = s - 5;
          audio?.screech(0.8, 0.2);
          audio?.braam(4, 0.4);
          card('RUN.', 900);
        }
        if (chase.on && !busy) {
          const speed = 1.75 + Math.min(0.6, (now % 100000) / 100000);
          chase.s += speed * dt;
          placeThing(chase.s, { face: 'forward', speed: 2.6 });
          const gap = s - chase.s;
          audio?.setHeartRate(clamp(180 - gap * 18, 90, 190));
          if (gap < 0.7) {
            chase.on = false;
            die('It caught you. Don’t stop running.');
          }
          if (s >= L - 0.05) chase.on = false;
        }
      },
      interact() {}
    },
    6: {
      dread: 0.95,
      stop: L - 0.5,
      enter() {
        eyes.forEach((e) => (e.visible = false));
        thing.group.visible = false;
        house.leak.material.color.setHex(0xffffff);
        activeIds = new Set(['final']);
        objective('The host is behind the last door. Open it.', finalLeaf, 'Walk to the end of the hall, then click the door.');
      },
      update() {
        if (s > 2.4 && !once.has('behind6')) {
          once.add('behind6');
          behindEvent().then((r) => r !== 'dead' && lives > 0 && !lapState.solved && objective('The host is behind the last door. Open it.', finalLeaf));
        }
      },
      async interact(id) {
        if (id !== 'final' || busy || lapState.solved) return;
        busy = true;
        await openDevil();
        busy = false;
        // One last time, it comes for you
        const r = await lampEater('IT’S NOT OVER. HIDE.');
        if (r !== 'survived') return;
        solve();
        activeIds = new Set();
        objective('Leave. Go through the door.', finalLeaf);
      }
    }
  };
  function solve() {
    lapState = lapReducer(lapState, { type: 'SOLVE' });
  }
  function enterLap() {
    once.clear();
    runSerial += 1;
    busy = false;
    eventActive = false;
    chase.on = false;
    thing.group.visible = false;
    house.sconce.intensity = 3;
    nurseryPanel.hidden = true;
    nursery.open = false;
    nursery.playing = false;
    devilPanel.hidden = true;
    devil.open = false;
    keyholeEl.hidden = true;
    alarmEl.hidden = true;
    lightsOut = false;
    house.ambient.intensity = ambientBase;
    faceMesh.visible = false;
    audio?.setHeartRate(0);
    lapEl.textContent = `LAP ${lapState.lap} / ${LAPS}`;
    LAP_SCRIPTS[lapState.lap].enter();
  }
  enterLap();

  async function endOfLap() {
    busy = true;
    audio?.creak(1.2, 0.18);
    await fade(true);
    lapState = lapReducer(lapState, { type: 'END_REACHED' });
    if (lapState.done) return escape();
    s = 0;
    lookCur = { yaw: 0, pitch: 0 };
    enterLap();
    await fade(false);
    busy = false;
  }

  async function escape() {
    ended = true;
    card('YOU GOT OUT.', 3200);
    try {
      sessionStorage.setItem('nocturne-night:escaped', '1');
    } catch {
      // ignore
    }
    await wait(3400);
    location.href = '../index.html';
  }

  // ---------- out of time: the long ending ----------
  async function partyEnded() {
    ended = true;
    busy = true;
    runSerial += 1;
    alarmEl.hidden = true;
    for (let i = 0; i < 3; i += 1) {
      audio?.bell(0.4);
      await wait(1400);
    }
    await fade(true);
    card('THE PARTY HAS ENDED.', 3000);
    await say('it-party-ended');
    if (!gentle) {
      try {
        const { createMassacre } = await import('../../js/underside/massacre.js');
        const gore = $('#gore');
        gore.hidden = false;
        const m = createMassacre(gore, { quality });
        m.resize(Math.round(innerWidth * 0.6), Math.round(innerHeight * 0.6));
        const sounds = { slice: () => audio?.slice(), squirt: () => audio?.splat(0.2), sever: () => audio?.snap(), chop: () => audio?.slam(0.8), stab: () => audio?.splat(0.4), bugs: () => audio?.skitter(1.2), tear: () => audio?.splat(0.5), turn: () => audio?.screech(0.6, 0.18) };
        await m.play('throat', { onHit: (k) => sounds[k]?.() });
        await m.play('stabline', { onHit: (k) => sounds[k]?.() });
        await m.play('facewall', { onHit: (k) => sounds[k]?.() });
        gore.hidden = true;
      } catch {
        // gore unavailable: skip
      }
    }
    await say('it-we-see-you');
    await ambush('WE SEE YOU.');
    await wait(1200);
    location.href = '../index.html';
  }

  // ======================================================================================
  // INPUT
  // ======================================================================================
  addEventListener('wheel', (e) => {
    e.preventDefault();
    intent += -e.deltaY * 0.0025; // scroll UP to go deeper
    stillMoved += Math.abs(e.deltaY) * 0.5;
  }, { passive: false });
  const keys = new Set();
  addEventListener('keydown', (e) => {
    if (e.target === rsvpInput) return;
    keys.add(e.key.toLowerCase());
    if (e.key.toLowerCase() === 'w' || e.key === 'ArrowUp') stillMoved += 100;
    if (e.key === 'Escape') audio?.setMuted(true);
  });
  addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
  let touchY = null;
  addEventListener('touchstart', (e) => (touchY = e.touches[0].clientY), { passive: true });
  addEventListener('touchmove', (e) => {
    if (touchY === null) return;
    intent += (e.touches[0].clientY - touchY) * 0.01;
    touchY = e.touches[0].clientY;
  }, { passive: true });
  const pointer = new THREE.Vector2();
  let pointerPx = { x: innerWidth / 2, y: innerHeight / 2 };
  let rollNow = 0;
  addEventListener('pointermove', (e) => {
    stillMoved += Math.hypot(e.clientX - pointerPx.x, e.clientY - pointerPx.y);
    pointerPx = { x: e.clientX, y: e.clientY };
    pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    const inverted = rollNow > Math.PI / 2 ? -1 : 1;
    lookTarget = { yaw: -pointer.x * 1.05 * inverted, pitch: pointer.y * 0.5 * inverted };
  });
  const raycaster = new THREE.Raycaster();
  raycaster.far = 3.4;
  let hovered = null;
  view.addEventListener('click', () => {
    if (!hovered) return;
    const id = hovered.userData.id;
    if (id === 'face') {
      faceClicked = true;
      return;
    }
    if (eventActive && (id === 'hide' || id === 'nursery')) {
      hidden = true;
      const d = id === 'nursery' ? house.doors.right1 : hovered === house.doors.left1.leaf ? house.doors.left1 : house.doors.left2;
      d.open(0.25);
      audio?.creak(0.6, 0.15);
      return;
    }
    if (!busy) LAP_SCRIPTS[lapState.lap].interact(id, hovered);
  });

  // ======================================================================================
  // FRAME LOOP
  // ======================================================================================
  let last = performance.now();
  let hoverObj = null;
  let hoverSince = 0;
  let slow = 0;
  let ema = 16;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    ema += ((now - last) - ema) * 0.05;
    last = now;
    if (ema > 30 && ++slow > 90 && quality > 0.45) {
      quality -= 0.1;
      slow = 0;
      resize();
    }
    const script = LAP_SCRIPTS[lapState.lap];

    // Walk
    if (keys.has('w') || keys.has('arrowup')) intent += 1.8 * dt;
    if (!busy && !eventActive && !ended && !nursery.open && !devil.open) {
      const stop = lapState.solved ? L : script.stop;
      const maxSpeed = lapState.lap === 5 ? 2.5 : 1.5;
      s = walk(s, intent, dt, { maxSpeed, stop, length: L });
      if (lapState.solved && s >= L - 0.02 && !(lapState.lap === 5 && chase.on)) endOfLap();
      if (lapState.lap === 5 && s >= L - 0.02 && chase.on === false && lapState.solved) endOfLap();
    }
    intent *= 0.6;

    // Look (S turns you round)
    const p = samplePath(s);
    const bob = gentle ? 0 : Math.sin(s * 5.2) * 0.02;
    camera.position.set(p.x, EYE + bob, p.z);
    lookCur = look(lookCur, lookTarget, dt);
    lookBack += ((keys.has('s') || keys.has('arrowdown') ? 1 : 0) - lookBack) * Math.min(1, dt * 7);
    rollNow = lapState.lap === 4 ? rollAt(s, { from: 0.8, to: 3.6 }) : lapState.lap > 4 ? Math.PI : 0;
    camera.rotation.set(lookCur.pitch, p.heading + lookCur.yaw + lookBack * Math.PI, rollNow);

    // Lights: the lamp stutters hard when something is coming
    const f = storm ? (Math.random() < 0.35 ? 0.03 : 0.7 + Math.random() * 0.3) : flicker;
    house.lamp.light.intensity = lightsOut ? 0 : house.lamp.base * f * (0.94 + Math.random() * 0.06);
    house.lamp.bulbMat.color.setScalar(!lightsOut && f > 0.5 ? 1 : 0.06);
    torch.intensity = lightsOut ? 70 * (f > 0.5 ? 0.9 + Math.random() * 0.1 : 0) : 0;
    house.lamp.group.rotation.z = Math.sin(now / 1300) * 0.04 * lapState.lap + (storm ? (Math.random() - 0.5) * 0.1 : 0);
    audio?.setDread(storm ? 0.9 : script.dread);
    audio?.tick(dt);
    if (!ended) script.update(now, dt);
    if (thing.mixer && thing.group.visible) thing.mixer.update(dt);

    // Glow on the current target
    if (target && !eventActive) {
      target.getWorldPosition(targetLight.position);
      targetLight.position.x += targetLight.position.x > 0 ? -0.25 : 0.25;
      targetLight.intensity = 1.2 + Math.sin(now / 220) * 0.8;
    } else targetLight.intensity = 0;

    // Time
    if (busy || nursery.open || devil.open) lockedMs += dt * 1000;
    if (!ended) {
      const c = countdown(TIME_LIMIT, now - startTime - lockedMs);
      if (!timerEl.dataset.lie) timerEl.textContent = c.label;
      if (lapState.lap >= 3 && now > nextLie && !gentle) {
        nextLie = now + 25000 + Math.random() * 20000;
        timerLie(timerEl, ['BEHIND YOU', '3:00', 'STAY', name ? name.toUpperCase() : 'I SEE YOU'][Math.floor(Math.random() * 4)]);
        audio?.whisper(0.8, 0.12, (Math.random() - 0.5) * 1.6);
      }
      timerEl.parentElement.classList.toggle('is-urgent', c.urgent);
      if (c.done) partyEnded();
    }

    // Hover: only what you can use right now
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(house.interactives, false).find((h) => activeIds.has(h.object.userData.id) && h.object.visible !== false);
    hovered = hit?.object ?? null;
    document.body.classList.toggle('is-hovering', Boolean(hovered));
    if (hovered && !busy) {
      labelEl.hidden = false;
      if (hovered !== hoverObj) {
        hoverObj = hovered;
        hoverSince = now;
      }
      const lie = !gentle && hovered.userData.label2 && now - hoverSince > 1600;
      labelEl.textContent = eventActive && hovered.userData.id !== 'face' ? 'HIDE' : lie ? hovered.userData.label2 : hovered.userData.label;
      labelEl.classList.toggle('is-lie', Boolean(lie));
      labelEl.style.left = `${pointerPx.x}px`;
      labelEl.style.top = `${pointerPx.y}px`;
    } else labelEl.hidden = true;

    // Overlay: the crack of a door while hiding; the red edge while being chased
    const { width: ow, height: oh } = overlay;
    if (peeking) {
      octx.fillStyle = '#000';
      octx.fillRect(0, 0, ow, oh);
      const gw = ow * 0.12;
      const g = octx.createLinearGradient(ow / 2 - gw, 0, ow / 2 + gw, 0);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(0.35, 'rgba(0,0,0,0)');
      g.addColorStop(0.65, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,1)');
      octx.clearRect(ow / 2 - gw, 0, gw * 2, oh);
      octx.fillStyle = g;
      octx.fillRect(ow / 2 - gw, 0, gw * 2, oh);
    } else if (chase.on) {
      const gap = s - chase.s;
      const a = clamp(1 - gap / 5, 0, 0.8);
      octx.clearRect(0, 0, ow, oh);
      const g = octx.createRadialGradient(ow / 2, oh / 2, oh * 0.25, ow / 2, oh / 2, ow * 0.7);
      g.addColorStop(0, 'rgba(120,0,0,0)');
      g.addColorStop(1, `rgba(120,0,0,${a})`);
      octx.fillStyle = g;
      octx.fillRect(0, 0, ow, oh);
    } else if (!octxBusy()) octx.clearRect(0, 0, ow, oh);

    // Panels
    if (nursery.open) {
      const realDt = Math.min(0.25, (now - (nursery.lastTick || now)) / 1000);
      nursery.lastTick = now;
      if (nursery.holding && !nursery.playing) {
        nursery.wind = Math.min(1, nursery.wind + realDt / 2.4);
        windMeter.parentElement.style.setProperty('--wind', nursery.wind.toFixed(3));
        if (Math.random() < realDt * 6) audio?.clunk();
        if (nursery.wind >= 1) playNursery();
      }
      const targetLook = nursery.stage < 0.9 ? (pointerPx.x / innerWidth - 0.5) * 0.6 : 0;
      nursery.look += (targetLook - nursery.look) * 0.06;
      const c = nurseryCanvas.getContext('2d');
      drawNursery(c, nurseryCanvas.width, nurseryCanvas.height, { t: now / 1000, stage: nursery.stage, look: nursery.look, light: Math.random() < 0.01 * (1 + nursery.stage * 4) ? 0.3 : 1, crank: nursery.wind * 20, near: nursery.near });
      grain(c, nurseryCanvas.width, nurseryCanvas.height, 0.1);
    }
    if (devil.open) {
      devil.presence = Math.min(1, devil.presence + dt * 0.4);
      devil.rage = Math.max(0, devil.rage - dt * 0.2);
      const c = devilCanvas.getContext('2d');
      drawDevil(c, devilCanvas.width, devilCanvas.height, { t: now / 1000, presence: devil.presence, speak: devil.speak * (0.5 + Math.random() * 0.5), rage: devil.rage });
      if (devil.claw > 0) drawDevilClaw(c, devilCanvas.width, devilCanvas.height, { p: Math.min(1, (now - devil.claw) / 1600), t: now / 1000, clear: false });
      grain(c, devilCanvas.width, devilCanvas.height, 0.12);
    }

    post.render(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // The Leave link doesn't want you to leave (twice), then lets you
  const leaveLink = document.querySelector('.hud__leave');
  let leaveDodges = gentle ? 2 : 0;
  leaveLink.addEventListener('pointerenter', () => {
    if (leaveDodges >= 2) return;
    leaveDodges += 1;
    leaveLink.style.transform = `translate(${-30 - Math.random() * 40}vw, ${70 + Math.random() * 10}vh)`;
    leaveLink.textContent = leaveDodges === 1 ? 'Leave?' : 'Fine. Leave.';
    audio?.errorChime();
    setTimeout(() => {
      leaveLink.style.transform = '';
    }, 2600);
  });

  // Labels that change their mind if you hover too long
  const LIES = { photo: 'IT SEES YOU', phone: 'IT’S FOR YOU', radio: 'IT HEARS YOU', nursery: 'SHE’S AWAKE', final: 'DON’T', hide: 'HURRY' };
  house.interactives.forEach((o) => {
    if (LIES[o.userData.id]) o.userData.label2 = LIES[o.userData.id];
  });
  // Look away from the tab, and something is waiting when you come back
  let tabScares = 0;
  watchTab({
    onReturn: () => {
      if (gentle || ended || busy || eventActive || nursery.open || devil.open || tabScares >= 2) return;
      tabScares += 1;
      ambush('YOU LOOKED AWAY.');
    }
  });

  if (params.has('debug')) {
    window.__v2 = {
      lap: (n) => {
        lapState = { lap: n, solved: false, done: false };
        s = 0;
        enterLap();
      },
      solve,
      eater: () => lampEater(),
      face: () => faceEvent(),
      still: () => freezeEvent(),
      behind: () => behindEvent(),
      keyhole: () => keyhole(),
      use: (id, index) => LAP_SCRIPTS[lapState.lap].interact(id, { userData: { id, index } }),
      hide: () => (hidden = true),
      walkTo: (d) => (s = d),
      state: () => ({ lap: lapState.lap, solved: lapState.solved, s, busy, eventActive, lives, lookBack: +lookBack.toFixed(2), keys: [...keys], objective: objectiveEl.textContent })
    };
  }
}
