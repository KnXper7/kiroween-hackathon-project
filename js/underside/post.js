// Film-grade post-processing for every 3D scene, from pmndrs/postprocessing (Zlib licence, vendored):
// ACES tone mapping, bloom on lights and screens, film grain, scanlines, vignette, radial chromatic
// aberration, and a glitch that can be fired on impacts. Convolution effects get their own passes.

import * as THREE from '../../vendor/three/three.module.js';
import {
  BlendFunction,
  BloomEffect,
  ChromaticAberrationEffect,
  EffectComposer,
  EffectPass,
  GlitchEffect,
  GlitchMode,
  NoiseEffect,
  RenderPass,
  ScanlineEffect,
  ToneMappingEffect,
  ToneMappingMode,
  VignetteEffect
} from '../../vendor/postprocessing/index.js';

export function createPost(renderer, scene, camera, { bloom = 0.7, grain = 0.32, scanlines = 0.1, aberration = 0.0022, darkness = 0.78 } = {}) {
  // Tone mapping happens in the effect chain, so the renderer itself stays linear.
  renderer.toneMapping = THREE.NoToneMapping;
  const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType });
  composer.addPass(new RenderPass(scene, camera));

  const bloomFx = new BloomEffect({ intensity: bloom, luminanceThreshold: 0.55, luminanceSmoothing: 0.2, mipmapBlur: true });
  const tone = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
  const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SCREEN });
  noise.blendMode.opacity.value = grain;
  const scan = new ScanlineEffect({ density: 1.25, blendFunction: BlendFunction.OVERLAY });
  scan.blendMode.opacity.value = scanlines;
  const vignette = new VignetteEffect({ offset: 0.28, darkness });
  composer.addPass(new EffectPass(camera, bloomFx, tone, noise, scan, vignette));

  const aberrationFx = new ChromaticAberrationEffect({
    offset: new THREE.Vector2(aberration, aberration * 0.6),
    radialModulation: true,
    modulationOffset: 0.25
  });
  composer.addPass(new EffectPass(camera, aberrationFx));

  const glitch = new GlitchEffect({ delay: new THREE.Vector2(0.4, 1.2), duration: new THREE.Vector2(0.1, 0.3), strength: new THREE.Vector2(0.2, 0.6), ratio: 0.85 });
  glitch.mode = GlitchMode.DISABLED;
  composer.addPass(new EffectPass(camera, glitch));

  let glitchUntil = 0;
  return {
    render(dt = 1 / 60) {
      if (glitchUntil && performance.now() > glitchUntil) {
        glitch.mode = GlitchMode.DISABLED;
        aberrationFx.offset.set(aberration, aberration * 0.6);
        glitchUntil = 0;
      }
      composer.render(dt);
    },
    setSize(width, height) {
      composer.setSize(width, height, false);
    },
    /** A burst of tearing and colour-split, for hits. */
    glitch(ms = 350) {
      glitch.mode = GlitchMode.CONSTANT_WILD;
      aberrationFx.offset.set(aberration * 6, aberration * 3);
      glitchUntil = performance.now() + ms;
    },
    dispose() {
      composer.dispose();
    }
  };
}
