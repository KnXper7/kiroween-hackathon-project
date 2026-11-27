---
inclusion: always
---

# Tech stack

- Static HTML in `index.html`
- CSS custom properties and responsive CSS in `style.css`
- Plain browser JavaScript ES modules under `js/`
- Local GSAP 3 source at `gsap.min.js`
- Browser APIs: sessionStorage, IntersectionObserver, requestAnimationFrame, matchMedia, and native dialog
- The `escape.html` title intro uses local WebM and MP4 `<video>` sources with native playback and no added runtime library
- No framework, CSS framework, or bundler; the page runs as static files
- three.js r187 vendored in `vendor/three/` (ES modules, no build step) for the 3D gallery hall and CRT room
- Optional 3D: `@splinetool/runtime` (ES module from unpkg), loaded only when `SPLINE_SCENES` in `js/config.js` has a URL
- The Underside (`js/underside/`) draws on 2D canvas and synthesizes all sound with the Web Audio API
- Tests: `npm test` (Node's built-in test runner, no dependencies)

## Architecture

- Pure calculations and state transitions live in `js/logic/`.
- Configuration and copy live in `js/config.js` and `js/content.js`.
- Shared GSAP timeline factories live in `js/anim/timelines.js`.
- `script.js` wires browser events, form behavior, accessibility, and visual state.
- CSS uses semantic, descriptive kebab-case class names and a small set of design tokens.
