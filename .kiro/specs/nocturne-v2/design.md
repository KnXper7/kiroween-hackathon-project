# Design: Nocturne Night v2

## Structure
```
v2/index.html              entry: warning gate, canvas, HUD (timer, prompt, leave), overlays
v2/v2.css                  HUD and gate styles (reuses the v1 fonts and palette)
v2/js/main.js              boot, gate, frame loop, lap state machine, input
v2/js/house.js             the L-shaped hallway: geometry, materials, props, lights, doors, photos
v2/js/laps.js              per-lap "what's different" scripts (pure data + hooks)
v2/js/path.js              the fixed walking path (spline) and scroll → distance mapping (pure)
v2/js/thing.js             the rigged walker: placement, glimpses, behind-you
../js/underside/*          reused: audio.js (synth + voices), post.js (postprocessing), overlays.js,
                           creatures.js (hammer face, Grinner), massacre.js (gore set-pieces)
../vendor/*                three.js r187 + GLTFLoader, postprocessing
```

## The hallway
An L: an entrance door (z=0) → a 9 m corridor (doors left and right, 6 frames, side table with radio and phone, a hanging lamp) → a 90° turn → 3 m to the final door. The camera follows a Catmull-Rom path at eye height (1.6 m). Scrolling advances a distance `s` along the path (speed-capped); the pointer adds yaw and pitch within limits. At the end of the path, a fade and a door creak send you back to s = 0, and the lap increments.

## Laps (escalation)
| Lap | Feels like | Changes | Lock |
|---|---|---|---|
| 1 | almost normal, a party heard through a wall | warm lamp, muffled synth, photos normal | phone rings; answer it: "We see you, {name}" |
| 2 | wrong | lamp flickers, a door ajar, the radio on by itself (search party) | turn the radio off (it turns back on twice) |
| 3 | watched | the photos have changed, faces in them; the thing at the end of the hall, closer each time the lamp fails | click the host's photo |
| 4 | the world turns over | slow 180° roll mid-corridor, everything hangs; blood drips upward | nursery door: wind the music box (doll) |
| 5 | hunted | red light, hands on the walls, breathing behind you; it is behind you when you turn | three doors at the turn; hesitation is punished |
| 6 | the host | corridor stretched, the final door is huge; the Devil | type your RSVP name; then hold to escape |

## Rendering
- MeshStandardMaterial with procedural canvas textures (wallpaper, wood floor, skirting) and public-domain photos in frames.
- One shadow-casting light (the lamp), plus emissive practicals. Fog. postprocessing chain (grain, bloom, vignette, chromatic aberration, glitch on hits).
- The inversion rolls the camera's up vector from +Y to −Y over 3 s while the walk continues. Gravity effects (drips, falling objects) flip with it.

## Correctness properties (tested)
- Path: distance stays within [0, length], and the speed cap holds for any input.
- Laps: the lap only advances when that lap's lock is solved; lap is always in [1, 6].
- Inversion: the roll is monotonic and ends exactly at 180°.
