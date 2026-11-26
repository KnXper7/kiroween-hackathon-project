---
inclusion: always
---

# Code conventions

- Use static HTML, CSS, browser JavaScript ES modules, and the checked-in GSAP source. The only 3D runtime allowed is the Spline runtime, loaded lazily by `js/underside/spline-layer.js` when a scene URL is set. Do not add a framework, CSS utility library, or build requirement.
- Keep page entry at `index.html`, global styling in `style.css`, the browser entry in `script.js`, and pure functions under `js/logic/`.
- Put configuration and themed copy in `js/config.js` and `js/content.js`.
- Put all GSAP timeline creation in `js/anim/timelines.js`; keep DOM wiring in the entry/UI layer. Keep the signup sequence reducer independent from DOM and animation code.
- Use lower-case kebab-case for CSS classes and descriptive semantic HTML nesting. Prefer one clear parent per visual group.
- Use named exports, `const` by default, and pure functions for validation, progress calculation, and sequence transitions.
- All non-decorative images need alternative text. Controls need labels, keyboard support, and visible focus. Honor reduced motion.
- Keep the escape title intro's WebM/MP4 sources local under `videos/`; handle `ended`, media errors, rejected autoplay, skip, and reduced motion so the arrival page remains reachable. Keep intro video muted and separate from the arrival music audio and toggle.
- Signup details must remain local to the browser session; do not transmit them.
