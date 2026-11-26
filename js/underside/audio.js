// All Underside sound is synthesized with the Web Audio API: no audio files, no licensing questions.
// Everything passes through a compressor and a soft limiter so nothing can spike past the ceiling.

const MELODY = [
  // An original music-box tune (semitones from A4, beat length). Played slowly and detuned more as dread grows.
  [7, 1], [10, 1], [14, 1], [12, 2], [10, 1], [7, 1], [9, 1], [5, 2],
  [7, 1], [10, 1], [15, 1], [14, 2], [12, 1], [10, 1], [9, 3]
];

export function createUndersideAudio({ gentle = false } = {}) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;

  const ctx = new AudioContextClass();
  const now = () => ctx.currentTime;
  const masterLevel = gentle ? 0.4 : 0.9;

  // ---------- master chain ----------
  const master = ctx.createGain();
  master.gain.value = 0;
  const compressor = ctx.createDynamicsCompressor();
  compressor.threshold.value = -18;
  compressor.knee.value = 6;
  compressor.ratio.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  const limiter = ctx.createWaveShaper();
  limiter.curve = softClipCurve(0.7);
  master.connect(compressor).connect(limiter).connect(ctx.destination);

  const noiseBuffer = makeNoise(ctx, 3);

  // ---------- tape hiss ----------
  const hiss = loopNoise(ctx, noiseBuffer);
  const hissFilter = ctx.createBiquadFilter();
  hissFilter.type = 'highpass';
  hissFilter.frequency.value = 2400;
  const hissGain = ctx.createGain();
  hissGain.gain.value = 0.015;
  hiss.connect(hissFilter).connect(hissGain).connect(master);

  // ---------- mains hum (60 Hz + harmonics) ----------
  const humGain = ctx.createGain();
  humGain.gain.value = 0.012;
  [60, 120, 180].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 1 / (i + 1);
    osc.connect(g).connect(humGain);
    osc.start();
  });
  humGain.connect(master);

  // ---------- dread drone: detuned saws through a closing/opening low-pass ----------
  const droneFilter = ctx.createBiquadFilter();
  droneFilter.type = 'lowpass';
  droneFilter.frequency.value = 140;
  droneFilter.Q.value = 6;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0;
  [41.2, 41.7, 82.1].forEach((freq) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.connect(droneFilter);
    osc.start();
  });
  droneFilter.connect(droneGain).connect(master);

  // ---------- sub pressure ----------
  const sub = ctx.createOscillator();
  sub.frequency.value = 33;
  const subGain = ctx.createGain();
  subGain.gain.value = 0;
  sub.connect(subGain).connect(master);
  sub.start();

  // ---------- Shepard riser: a tone that seems to rise forever ----------
  const SHEPARD_VOICES = 6;
  const shepardGain = ctx.createGain();
  shepardGain.gain.value = 0;
  shepardGain.connect(master);
  const shepard = Array.from({ length: SHEPARD_VOICES }, () => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    const g = ctx.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(shepardGain);
    osc.start();
    return { osc, g };
  });
  let shepardPhase = 0;

  // ---------- music box ----------
  const boxGain = ctx.createGain();
  boxGain.gain.value = 0;
  const boxFilter = ctx.createBiquadFilter();
  boxFilter.type = 'lowpass';
  boxFilter.frequency.value = 3200;
  boxGain.connect(boxFilter).connect(master);
  let boxNext = 0;
  let boxIndex = 0;

  // ---------- heartbeat ----------
  let heartRate = 0; // beats per minute; 0 = off
  let heartNext = 0;

  let dread = 0;
  let silenced = false;

  const set = (param, value, time = 0.4) => param.setTargetAtTime(value, now(), time);

  function setDread(value) {
    dread = value;
    if (silenced) return;
    set(droneGain.gain, 0.02 + dread * 0.12);
    set(droneFilter.frequency, 120 + dread * 900);
    set(subGain.gain, dread > 0.35 ? (dread - 0.35) * 0.35 : 0);
    set(hissGain.gain, 0.012 + dread * 0.03);
    set(shepardGain.gain, dread > 0.45 ? (dread - 0.45) * 0.09 : 0);
    set(boxGain.gain, dread < 0.55 ? 0.05 * (1 - dread) : 0, 1.2);
  }

  function playBoxNote(time) {
    const [semi, beats] = MELODY[boxIndex % MELODY.length];
    boxIndex += 1;
    const wobble = 1 + (Math.random() - 0.5) * 0.04 * (1 + dread * 6);
    const freq = 440 * 2 ** (semi / 12) * wobble;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.linearRampToValueAtTime(freq * (1 - dread * 0.03), time + 1.2);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(0.5, time + 0.005);
    env.gain.exponentialRampToValueAtTime(0.001, time + 1.4);
    osc.connect(env).connect(boxGain);
    osc.start(time);
    osc.stop(time + 1.5);
    const tempo = 0.42 + dread * 0.5; // slows down as it decays
    return beats * tempo;
  }

  function playHeartbeat(time) {
    [0, 0.17].forEach((offset, i) => {
      const osc = ctx.createOscillator();
      osc.frequency.setValueAtTime(58, time + offset);
      osc.frequency.exponentialRampToValueAtTime(34, time + offset + 0.14);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, time + offset);
      env.gain.linearRampToValueAtTime(i ? 0.35 : 0.5, time + offset + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, time + offset + 0.18);
      osc.connect(env).connect(master);
      osc.start(time + offset);
      osc.stop(time + offset + 0.2);
    });
  }

  /** Call every animation frame with the frame delta in seconds. */
  function tick(dt) {
    if (ctx.state !== 'running') return;
    const t = now();

    // Shepard tone: each voice climbs an octave band; loudness is a bell curve over the band.
    shepardPhase = (shepardPhase + dt * (0.03 + dread * 0.09)) % 1;
    shepard.forEach(({ osc, g }, i) => {
      const position = (i + shepardPhase) / SHEPARD_VOICES;
      osc.frequency.setTargetAtTime(55 * 2 ** (position * SHEPARD_VOICES), t, 0.05);
      g.gain.setTargetAtTime(Math.exp(-((position - 0.5) ** 2) / 0.045), t, 0.05);
    });

    if (!silenced && dread < 0.55 && t >= boxNext) boxNext = t + playBoxNote(Math.max(t, boxNext));
    if (!silenced && heartRate > 0 && t >= heartNext) {
      playHeartbeat(t + 0.02);
      heartNext = t + 60 / heartRate;
    }
  }

  function staticBurst(duration = 0.18, level = 0.35) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1800 + Math.random() * 2400;
    band.Q.value = 0.6;
    const env = ctx.createGain();
    const t = now();
    env.gain.setValueAtTime(level, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + duration);
    src.connect(band).connect(env).connect(master);
    src.start(t, Math.random() * 2);
    src.stop(t + duration + 0.02);
  }

  /** Cut everything to near silence. The absence of sound is the loudest cue before a scare. */
  function silence(seconds = 0.05) {
    silenced = true;
    [droneGain, subGain, hissGain, shepardGain, boxGain, humGain].forEach((node) => set(node.gain, 0, seconds));
  }

  function restore() {
    silenced = false;
    set(humGain.gain, 0.012);
    setDread(dread);
  }

  /** The jumpscare stab: noise slam + a dissonant, distorted, falling saw cluster. Under one second. */
  function stab() {
    const t = now() + 0.01;
    const shaper = ctx.createWaveShaper();
    shaper.curve = softClipCurve(4);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(gentle ? 0.25 : 0.85, t + 0.01);
    env.gain.setTargetAtTime(0, t + 0.35, 0.18);
    shaper.connect(env).connect(master);

    [98, 104, 139, 207.6, 293].forEach((freq) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.62, t + 0.85);
      osc.connect(shaper);
      osc.start(t);
      osc.stop(t + 0.95);
    });
    const slam = ctx.createBufferSource();
    slam.buffer = noiseBuffer;
    slam.connect(shaper);
    slam.start(t, Math.random());
    slam.stop(t + 0.5);
  }

  /** A low, breathy swell for the "something is behind you" moments. */
  function breath(duration = 2.2) {
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 520;
    band.Q.value = 1.4;
    const env = ctx.createGain();
    const t = now();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.22, t + duration * 0.45);
    env.gain.linearRampToValueAtTime(0, t + duration);
    band.frequency.linearRampToValueAtTime(380, t + duration);
    src.connect(band).connect(env).connect(master);
    src.start(t, Math.random());
    src.stop(t + duration);
  }

  /** An original two-note "error" chime: a falling minor third, slightly detuned. */
  function errorChime() {
    const t = now();
    [[880, 0], [698.5, 0.09]].forEach(([freq, offset]) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq * (1 + (Math.random() - 0.5) * 0.01 * (1 + dread * 4));
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, t + offset);
      env.gain.linearRampToValueAtTime(0.12, t + offset + 0.01);
      env.gain.exponentialRampToValueAtTime(0.001, t + offset + 0.5);
      osc.connect(env).connect(master);
      osc.start(t + offset);
      osc.stop(t + offset + 0.55);
    });
  }

  /** The mechanical clunk of a tape going into a VCR. */
  function clunk() {
    const t = now();
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 600;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.5, t);
    env.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(low).connect(env).connect(master);
    src.start(t, Math.random());
    src.stop(t + 0.15);
  }

  return {
    errorChime,
    clunk,
    async start() {
      if (ctx.state !== 'running') await ctx.resume();
      hiss.start();
      boxNext = now() + 1.2;
      master.gain.setTargetAtTime(masterLevel, now(), 1.5);
      setDread(0);
    },
    tick,
    setDread,
    setHeartRate(bpm) {
      heartRate = gentle ? Math.min(bpm, 70) : bpm;
    },
    staticBurst,
    silence,
    restore,
    stab,
    breath,
    setMuted(muted) {
      master.gain.setTargetAtTime(muted ? 0 : masterLevel, now(), 0.1);
    },
    fadeOut(seconds = 2) {
      master.gain.setTargetAtTime(0, now(), seconds / 3);
    },
    close: () => ctx.close()
  };
}

function makeNoise(ctx, seconds) {
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let brown = 0;
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1;
    brown = (brown + 0.02 * white) / 1.02;
    data[i] = white * 0.6 + brown * 2.4;
  }
  return buffer;
}

function loopNoise(ctx, buffer) {
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

function softClipCurve(amount) {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const x = (i / (n - 1)) * 2 - 1;
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount);
  }
  return curve;
}
