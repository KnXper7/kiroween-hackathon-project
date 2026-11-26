import { createTimelines } from './anim/timelines.js';
import { createTitleSequence } from './title-sequence.js';
import { createUnderside } from './underside/main.js';
import './stinger.js';

const $ = (selector) => document.querySelector(selector);
const gsap = window.gsap;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------- Title sequence -> arrival screen ----------
const titleSequence = $('#title-sequence');
const arrivalScene = $('#arrival-scene');
const arrivalTitle = $('#arrival-title');
const skipIntro = $('#skip-intro');

const timelines = gsap && !reducedMotion
  ? createTimelines(gsap, reducedMotion, { arrivalTitle, arrivalScene, titleSequence })
  : null;

let introDone = false;

const showArrival = () => {
  if (introDone) return;
  introDone = true;
  titleSequence.hidden = true;
  document.body.classList.remove('is-title-playing');
  arrivalScene.hidden = false;

  if (timelines) {
    timelines.arrivalScene().play();
    if (arrivalTitle) timelines.arrivalTitle().play();
  }
};

// A natural ending has already faded to black, so the arrival screen can appear at once.
// Skipping mid-sequence fades the title out first.
const leaveIntro = ({ skipped = false } = {}) => {
  if (introDone) return;
  if (skipped && timelines) {
    timelines.introExit().eventCallback('onComplete', showArrival).play();
  } else {
    showArrival();
  }
};

if (titleSequence && arrivalScene) {
  // Reduced motion: no animated sequence, go straight to the arrival screen.
  if (reducedMotion) {
    showArrival();
  } else {
    document.body.classList.add('is-title-playing');
    const sequence = createTitleSequence(
      {
        canvas: $('#title-canvas'),
        bloom: $('#title-bloom'),
        haze: $('#title-haze'),
        grain: $('#title-grain')
      },
      { onEnd: leaveIntro }
    );

    skipIntro?.addEventListener('click', () => sequence.skip(), { once: true });
    sequence.start().catch(showArrival);
  }
}

// ---------- Sound ----------
const arrivalAudio = $('#arrival-audio');
const soundToggle = $('#sound-toggle');
const soundLabel = $('#sound-label');

if (arrivalAudio && soundToggle && soundLabel) {
  const updateToggle = () => {
    const isPlaying = !arrivalAudio.paused && !arrivalAudio.muted;
    const hasEnded = arrivalAudio.ended;
    const isOff = !hasEnded && !isPlaying;

    soundLabel.textContent = hasEnded ? 'Replay sound' : isPlaying ? 'Sound: on' : 'Sound: off';
    soundToggle.classList.toggle('is-muted', isOff);
    soundToggle.setAttribute('aria-pressed', String(isOff));
  };

  // Browsers often block sound until the visitor interacts (always on reload).
  // In that case play muted, which is allowed, and unmute on the first click, tap, or key press.
  const interactionEvents = ['pointerdown', 'keydown', 'touchstart'];

  const unmuteOnInteraction = (event) => {
    if (soundToggle.contains(event.target)) return;
    stopWaitingForInteraction();
    arrivalAudio.muted = false;
    if (arrivalAudio.paused && !arrivalAudio.ended) arrivalAudio.play().catch(() => {});
    updateToggle();
  };

  const stopWaitingForInteraction = () => {
    interactionEvents.forEach((name) => document.removeEventListener(name, unmuteOnInteraction));
  };

  const startPlayback = () => arrivalAudio.play().then(updateToggle, () => {
    arrivalAudio.muted = true;
    arrivalAudio.play().then(updateToggle, () => {});
    interactionEvents.forEach((name) => document.addEventListener(name, unmuteOnInteraction));
    updateToggle();
  });

  soundToggle.addEventListener('click', () => {
    // The visitor made an explicit choice; stop the automatic unmute.
    stopWaitingForInteraction();

    if (arrivalAudio.ended) {
      arrivalAudio.currentTime = 0;
      arrivalAudio.muted = false;
      arrivalAudio.play().then(updateToggle, () => {});
      return;
    }

    if (arrivalAudio.paused) {
      arrivalAudio.muted = false;
      arrivalAudio.play().then(updateToggle, () => {});
      return;
    }

    arrivalAudio.muted = !arrivalAudio.muted;
    updateToggle();
  });

  ['play', 'pause', 'ended', 'volumechange'].forEach((type) => arrivalAudio.addEventListener(type, updateToggle));
  startPlayback();
}

// ---------- Descent into the Underside ----------
const descend = $('#descend');
const descendGentle = $('#descend-gentle');
let descending = false;

if (reducedMotion) descendGentle?.setAttribute('data-recommended', 'true');

const startDescent = (gentle) => {
  if (descending) return;
  descending = true;
  window.__nocturneLenis?.destroy?.();
  document.documentElement.classList.remove('has-lenis', 'lenis', 'lenis-smooth');

  // The arrival music drowns in static and is replaced by the Underside's own sound.
  if (arrivalAudio) {
    const fade = setInterval(() => {
      arrivalAudio.volume = Math.max(0, arrivalAudio.volume - 0.08);
      if (arrivalAudio.volume <= 0) {
        clearInterval(fade);
        arrivalAudio.pause();
      }
    }, 60);
  }
  soundToggle?.setAttribute('hidden', '');
  document.body.classList.add('is-descending');

  const underside = createUnderside({ gentle: gentle || reducedMotion });
  setTimeout(() => {
    arrivalScene.hidden = true;
    underside.start();
  }, reducedMotion ? 1200 : 1650);
};

descend?.addEventListener('click', () => startDescent(false));
descendGentle?.addEventListener('click', () => startDescent(true));
