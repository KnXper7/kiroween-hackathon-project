---
inclusion: always
---

# The Underside (escape.html, after the title sequence)

An upside-down, scroll-driven analog-horror descent. The world is rotated 180°; the "camera" overlays (OSD, static, cards, tapes, error dialogs) stay upright.

## Beats, in order (`js/logic/underside.js` → `BEATS`)
1. **gallery**: public-domain spirit photographs and paintings. A frame changes after you've seen it and it has left the screen.
2. **tapes**: the Smile Tapes. Three VHS tapes play upright: SMILE (a family photo whose faces grin too wide), RULES (instructional smile rules), YOUR TURN (labelled with the guest's name).
3. **eyes**: pairs of eyes open and follow the pointer. Spline slot `watcher`.
4. **rooms**: the same doorway nine times (ROOM 1/7 … 9/7); someone peeks; framed photos by the door. Spline slot `door`.
5. **errors**: generic late-90s system error dialogs pile up, smear, and crash to a fatal screen.
6. **broadcast**: color bars, then a figure that gets closer between static cuts; then it's gone, the scroll locks in silence, and the jumpscare hits. Spline slot `figure`.
7. **exit**: hold to escape; the world turns right side up; a final scare on the "safe" page; a ghost cursor follows them back to the invitation.

## Rules
- Everything that watches the visitor (name, local time, scrolling up, idling, tab switching) stays local. Nothing is sent anywhere.
- The camcorder clock drifts from real time to 3:00 AM and stays there.
- All copy lives in `js/content.js` (`underside`). Cards are 8 words or fewer (tested).
- Every flash and scare goes through `createFlashLimiter` (≤ 3 per second) and `createScareGate` (≤ 2 per run). Gentle mode and `prefers-reduced-motion` disable both.
- Images must be public domain or CC0 and listed in `ASSETS.md`. Never ship anything from `CreepyImages/` (third-party characters).
- Error dialogs must stay generic: no real operating-system names, logos, or sounds.
- Creatures are original and procedural (`js/underside/creatures.js`, `tapes.js`).
