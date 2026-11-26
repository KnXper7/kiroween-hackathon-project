export const copy = Object.freeze({
  nameRequired: 'The house needs a name for its guest book.',
  nameTooLong: 'Keep it to 100 characters. Some secrets are shorter.',
  emailInvalid: 'That address seems to lead somewhere else. Check it and try again.',
  firstAttempt: 'The house stirs. It is not ready to let you go yet.',
  secondAttempt: 'The walls are closing in. One more invitation may open the way.',
  glitch: 'The lights are going out. Something has noticed you.',
  secret:
    'If the candles flicker <b>twice</b>, someone at the house is <b>thinking</b> of you. They may even save you the <b>last</b> slice of cake.',
  handoff: 'Your place is saved. The night is only beginning…'
});

// The Underside speaks in short, upright broadcast cards. Keep each one under eight words.
export const underside = Object.freeze({
  continueScrolling: 'PLEASE CONTINUE SCROLLING.',
  doNotScrollUp: 'DO NOT SCROLL UP.',
  weAsked: 'WE ASKED YOU NOT TO.',
  lastWarning: 'LAST WARNING.',
  lookCloser: 'LOOK CLOSER.',
  weSee: 'WE SEE YOU.',
  weSeeName: (name) => `WE SEE YOU, ${name}.`,
  itIsLate: (clock) => `IT IS ${clock}. HERE, IT IS 3 AM.`,
  awakeAtThree: "YOU'RE AWAKE AT 3 AM TOO.",
  alwaysThree: 'IT IS ALWAYS 3:00 AM HERE.',
  smileBack: 'IF IT SMILES, SMILE BACK.',
  tapes: Object.freeze([
    Object.freeze({ label: 'SMILE', date: '10/31/94', note: 'family' }),
    Object.freeze({ label: 'RULES', date: '10/31/95', note: 'do not rewind' }),
    Object.freeze({ label: 'YOUR TURN', date: '10/31/26', note: '' })
  ]),
  smileRules: Object.freeze([
    'IF IT SMILES, SMILE BACK.',
    'NEVER SMILE FIRST.',
    'IT CAN HEAR YOU NOT SMILING.',
    'DO NOT COUNT ITS TEETH.',
    'SMILE.'
  ]),
  errors: Object.freeze([
    Object.freeze({ title: 'SYSTEM', body: 'SMILE.EXE is not responding.' }),
    Object.freeze({ title: 'SYSTEM', body: 'Error 0x0300: the time is wrong.' }),
    Object.freeze({ title: 'WARNING', body: 'Something is behind this window.' }),
    Object.freeze({ title: 'SYSTEM', body: 'Cannot close FACE.DLL. It is still open.' }),
    Object.freeze({ title: 'ERROR', body: 'Unknown device found in your room.' }),
    Object.freeze({ title: 'SYSTEM', body: 'Are you smiling?' }),
    Object.freeze({ title: 'SYSTEM', body: 'Please smile to continue.' })
  ]),
  fatal: Object.freeze([
    'A FATAL EXCEPTION HAS OCCURRED AT 03:00:00.',
    'THE CURRENT FACE WILL BE TERMINATED.',
    '',
    '*  PRESS ANY KEY TO SMILE.',
    '*  PRESS ANY KEY AGAIN TO SMILE WIDER.'
  ]),
  notForYou: 'THIS BROADCAST IS NOT FOR YOU.',
  dontTurn: "DON'T TURN AROUND.",
  whyStop: 'WHY DID YOU STOP?',
  lookedAway: 'YOU LOOKED AWAY. IT MOVED.',
  dontLeave: "DON'T LEAVE.",
  live: Object.freeze({
    gallery: 'The world has turned upside down. Old photographs hang in the dark. Keep scrolling.',
    eyes: 'Darkness. Pairs of eyes open and follow your pointer.',
    tapes: 'A television plays three old home videos labelled Smile. The faces in them begin to grin too widely.',
    rooms: 'The same doorway repeats. It opens wider each time. Someone is peeking.',
    errors: 'Old computer error windows pile up on the screen, then the system crashes.',
    broadcast: 'A broadcast interrupts. A figure gets closer each time the static clears.',
    exit: 'A door of light. Press and hold the escape button, or hold Space, to get out.'
  })
});
