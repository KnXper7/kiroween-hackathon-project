---
inclusion: always
---

# Product: Nocturne Night

NocturneNight is a one-page Halloween gathering invitation built for the Kiroween 2026 Costume Contest / Haunting UI track. It starts as a polished, calm invitation and gradually reveals an uncanny atmosphere as visitors scroll and complete the guest list. The haunting acts as feedback: valid fields light candles and scroll drives the haunting level to 60 as the footer enters view. The first two valid invitation requests trigger distinct messages and escalating shakes; the third triggers a restrained glitch and black handoff to the Stranger Things-inspired arrival screen.

Keep this implementation focused on the event landing page, information, signup, progressive atmosphere, secret message, and arrival handoff. The handoff plays the silent Nocturne Night title video before the arrival screen; the arrival screen keeps its separate Stranger Things music autoplay attempt and sound toggle. After the arrival screen, the visitor chooses Go deeper or Gentle mode and descends into the Underside (see `underside.md`). Do not copy another project's text, visuals, or exact interactions; use only broad ideas such as a welcoming surface that gradually reveals a darker character.

Signup data stays in sessionStorage for this browser session and is never sent to a server.
