# Tasks: Nocturne Night v2

- [x] 1. Foundation
  - [x] 1.1 `v2/index.html` + `v2/v2.css`: gate (Enter / Gentle), canvas, HUD (countdown, objective, lives, controls, leave), import map — R1, R8
  - [x] 1.2 `v2/js/path.js` (pure): path length, scroll→distance with speed cap, lap state reducer + tests — R2, R3
  - [x] 1.3 `v2/js/house.js`: L-hallway geometry, textures, frames with public-domain photos, lamp, doors, side table, radio, phone — R3
  - [x] 1.4 `v2/js/main.js`: renderer + postprocessing, walk + look, hover/click picking, lap loop with fade — R2, R3
- [x] 2. Laps 1–3 with their locks (phone, radio, host photo) and the glimpsed walker — R3, R5, R6
- [x] 3. Lap 4: inversion roll, keyhole, nursery panel with the wind-up doll — R4, R5
- [x] 4. Threats with rules (R6), each warned by an alarm bar and costing a life when broken:
  - [x] THE LAMP EATER: lights stutter → hide in a side door, watch it pass through the crack (laps 2, 6)
  - [x] THE FACE: a whisper → look at it and click it in time (laps 3, 4)
  - [x] THE STILL ONE: it's inches from your face → don't move (lap 4)
  - [x] THE ONE BEHIND YOU: footsteps → don't look back (lap 6)
  - [x] THE CHASE: eyes open on the walls → run (lap 5)
- [x] 5. Interface tricks (`v2/js/tricks.js`): the window whose × runs and multiplies, hands on glass, lying hover labels, the tab that talks while you're away, the RSVP that types by itself, the timer that lies, the Leave link that dodges
- [x] 6. Lap 3 power cut with a flashlight that follows the mouse; the walker moves only while the torch is dead
- [x] 7. Lives, death screen and retry (restarts the lap); Devil RSVP (only the signed-up name; wrong name costs 30 s)
- [x] 8. Ending (timeout) with the gore set-pieces and escape back to the invitation; invitation's crossing goes to v2 (`?v1` keeps the original)
- [ ] 9. Final audit: gentle mode, performance on a low-end laptop, full walkthrough by a human tester
