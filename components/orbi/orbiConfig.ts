/**
 * ORBI — configuration & shared types.
 *
 * Everything tunable about the companion lives here: the state vocabulary,
 * responsive placement, timing and easing for the GSAP timelines, and the
 * palette. Presentation (OrbiRobot / OrbiFace / OrbiSpeech) and motion
 * (orbiAnimations) both read from this file, so a designer can retune ORBI
 * without touching either.
 */

/* ── State vocabulary ──────────────────────────────────────────────────── */

/** What ORBI's face is doing. */
export type OrbiExpression =
  | 'normal'
  | 'happy'
  | 'blink'
  | 'thinking'
  | 'surprised'
  | 'sleepy'
  /** Poked once too often, or led round in a circle. Phase 8. */
  | 'dizzy'
  /** One lid down. The asymmetric blink, and ORBI's only mischievous face. */
  | 'wink'

/** Expressions that already own the eyelids — the blink scheduler stays out. */
const EYES_BUSY = ['blink', 'surprised', 'sleepy', 'dizzy', 'wink'] as const

export const holdsEyes = (e: OrbiExpression): boolean =>
  (EYES_BUSY as readonly string[]).includes(e)

/**
 * What ORBI's body is doing.
 *
 * Three kinds, and the guide treats them differently:
 *  - resting   `idle` `float` `peek` — the float loop owns the body
 *  - sustained `look-*`             — a held orientation, float keeps running
 *  - one-shot  the rest             — plays once, then resolves to a rest state
 */
export type OrbiAnimation =
  | 'idle'
  | 'float'
  | 'wave'
  | 'peek'
  | 'hide'
  | 'look-left'
  | 'look-right'
  | 'look-up'
  | 'look-down'
  | 'point-left'
  | 'point-right'
  | 'excited'
  | 'surprised'
  | 'settle'
  | 'curious'
  | 'nod'
  | 'inspect'
  /** The stabilisation after a shake — tilt, correct, correct smaller, centre. */
  | 'wobble'

const RESTING = ['idle', 'float', 'peek'] as const
const LOOKING = ['look-left', 'look-right', 'look-up', 'look-down'] as const
const ONE_SHOT = [
  'wave',
  'point-left',
  'point-right',
  'excited',
  'surprised',
  'settle',
  'curious',
  'nod',
  'inspect',
  'wobble',
] as const

export type OrbiLookAnimation = (typeof LOOKING)[number]

/** Resting states let the idle float own the body outright. */
export const isRestingAnimation = (a: OrbiAnimation): boolean =>
  (RESTING as readonly string[]).includes(a)

/** Sustained orientations — held until something else takes over. */
export const isLookAnimation = (a: OrbiAnimation): a is OrbiLookAnimation =>
  (LOOKING as readonly string[]).includes(a)

/** Plays once, then hands the body back to a rest state. */
export const isOneShotAnimation = (a: OrbiAnimation): boolean =>
  (ONE_SHOT as readonly string[]).includes(a)

export interface OrbiState {
  expression: OrbiExpression
  animation: OrbiAnimation
  /** `null` hides the speech bubble. */
  message: string | null
  /** Bumped on every new message so repeats of the same text re-animate. */
  messageId: number
}

export type OrbiStatePatch = Partial<Omit<OrbiState, 'messageId'>>

/* ── Section awareness ─────────────────────────────────────────────────── */

/**
 * What a page section asks ORBI to do when it takes the middle of the
 * viewport. Sections declare this and nothing else — all the machinery lives
 * in `OrbiGuide`. The default set is in `orbiSections.ts`.
 */
export interface OrbiSectionBehavior {
  /** DOM id of the section element. */
  id: string
  expression?: OrbiExpression
  /** Fired once the section becomes meaningfully visible. */
  animation?: OrbiAnimation
  /** Held after a one-shot `animation` resolves. Defaults to `idle`. */
  restAnimation?: OrbiAnimation
  message?: string
  /** How long the bubble stays up. Defaults to `ORBI_TIMING.messageHoldMs`. */
  messageDuration?: number
  /**
   * How long `expression` is held before ORBI relaxes back to `normal`.
   * Defaults to the message duration, then to a short beat.
   */
  expressionDuration?: number
  /**
   * Set when `animation` involves real travel. Mobile visitors — and anyone
   * with `prefers-reduced-motion` — get `quietAnimation` instead.
   */
  wideGesture?: boolean
  /** The calmer stand-in for `animation`. Defaults to `restAnimation`. */
  quietAnimation?: OrbiAnimation
}

export interface OrbiSayOptions {
  /** How long the bubble stays up, ms. Defaults to `ORBI_TIMING.messageHoldMs`. */
  holdMs?: number
  expression?: OrbiExpression
  animation?: OrbiAnimation
}

/**
 * The imperative handle other parts of the site talk to. Phase 2 scroll
 * triggers will grab this with `useOrbi()` and call `setOrbiState(...)`.
 */
export interface OrbiController {
  state: OrbiState
  /** Id of the section currently holding the middle of the viewport. */
  activeSection: string | null
  /** `null` while the page is still. */
  scrollDirection: 'up' | 'down' | null
  /** Where ORBI is currently parked. */
  dock: OrbiDock
  /**
   * Ask the environment to re-measure. Debounced. Call it after a scripted
   * move, or any time the page changes in a way ORBI's observers cannot see.
   */
  refreshEnvironment: (reason: string) => void
  setOrbiState: (patch: OrbiStatePatch) => void
  say: (message: string, options?: OrbiSayOptions) => void
  clearMessage: () => void
  hide: () => void
  peek: () => void
  show: () => void
  /** Register a section at runtime. Returns the unregister function. */
  registerSection: (behavior: OrbiSectionBehavior) => () => void
}

/* ── Interaction priority ──────────────────────────────────────────────── */

/**
 * Who is allowed to move ORBI right now. A request only lands if its level is
 * at least the level of the claim currently in force, so a scroll glance can
 * never cut a section gesture short — and nothing at all interrupts the
 * entrance.
 */
export const ORBI_PRIORITY = {
  idle: 0,
  /** Scroll-direction eye movement. */
  gaze: 10,
  /** ORBI's own idle personality — the curious glance, getting drowsy. */
  ambient: 15,
  /** The startled reaction to a fast flick. */
  fastScroll: 20,
  /** A section becoming meaningfully visible. */
  section: 30,
  /** Getting out of the way of registered page content. */
  environment: 35,
  /** The visitor is using a registered form field. */
  formFocus: 32,
  /**
   * A hidden reaction the visitor found. Above ORBI's own personality and above
   * a section beat — a discovery deserves to finish — but below every kind of
   * safety, the cinematic, and anything the visitor explicitly asked for.
   */
  easterEgg: 40,
  /** A modal or navigation overlay taking over the screen. */
  safety: 45,
  /**
   * Reserved for scripted multi-beat sequences. Nothing claims this yet — it
   * sits between safety and explicit interaction so a future phase can slot in
   * without renumbering anything below it.
   */
  cinematic: 50,
  /** A submission is in flight. Nothing decorative gets to talk over it. */
  formSubmitting: 55,
  /** It landed — or it did not. The strongest beat ORBI has short of the entrance. */
  formResult: 58,
  /** Anything a human explicitly asked for via `useOrbi()`. */
  interaction: 60,
  /** The page-load sequence. Nothing outranks it. */
  entrance: 70,
} as const

export type OrbiPriorityName = keyof typeof ORBI_PRIORITY

/** ORBI boots below the fold, eyes off, saying nothing. */
export const ORBI_INITIAL_STATE: OrbiState = {
  expression: 'normal',
  animation: 'idle',
  message: null,
  messageId: 0,
}

/* ── Responsive placement ──────────────────────────────────────────────── */

export type OrbiBreakpoint = 'mobile' | 'tablet' | 'desktop'

export interface OrbiPlacement {
  /** Rendered width in px. Height follows the viewBox aspect ratio. */
  size: number
  /** Distance from the viewport edges, px. */
  right: number
  bottom: number
  speechMaxWidth: number
  speechFontSize: number
  speechPadding: string
}

/**
 * Deliberately conservative on mobile — a small robot tucked into the corner
 * that never lands on top of a CTA or the nav.
 */
export const ORBI_PLACEMENT: Record<OrbiBreakpoint, OrbiPlacement> = {
  desktop: { size: 148, right: 32, bottom: 30, speechMaxWidth: 230, speechFontSize: 14, speechPadding: '11px 16px' },
  tablet:  { size: 120, right: 24, bottom: 24, speechMaxWidth: 195, speechFontSize: 13, speechPadding: '10px 14px' },
  mobile:  { size: 88,  right: 12, bottom: 16, speechMaxWidth: 150, speechFontSize: 12, speechPadding: '8px 12px'  },
}

/** Matched widest-first; the first hit wins. */
export const ORBI_MEDIA = {
  mobile: '(max-width: 640px)',
  tablet: '(max-width: 1024px)',
  reducedMotion: '(prefers-reduced-motion: reduce)',
  finePointer: '(hover: hover) and (pointer: fine)',
} as const

/**
 * ORBI's tier: above every section (z-index 10) so he can move through the
 * composition, and below the fixed navbar (100) so a full-screen menu, a modal
 * or any system overlay always covers him. Deliberately not a huge number —
 * anything that needs to be above ORBI only has to clear 90.
 */
export const ORBI_Z_INDEX = 90

/* ── Timing ────────────────────────────────────────────────────────────── */

/** Seconds unless the name says ms — GSAP works in seconds. */
export const ORBI_TIMING = {
  /** Beat of stillness after mount before ORBI rises. */
  entranceDelay: 0.35,
  riseDuration: 1.2,
  /** Pause after landing before the eyes come on. */
  eyesOnDelay: 0.2,
  eyesOnDuration: 0.45,
  /** Gap between the eyes lighting up and the first blink. */
  beforeBlink: 0.3,
  blinkCloseMs: 130,
  /** Gap between the blink and the wave. */
  beforeWave: 0.22,
  waveRaise: 0.4,
  waveSwing: 0.26,
  waveSwings: 3,
  waveLower: 0.42,
  /** Speech bubble. */
  messageHoldMs: 2600,
  speechIn: 0.5,
  speechOut: 0.34,
  /** Enter / exit. */
  hideDuration: 0.7,
  peekDuration: 0.8,
  showDuration: 0.9,
  /** How far down ORBI sits while hidden, as % of its own height. */
  hideOffsetPercent: 125,

  /* ── Phase 2 gestures ── */
  /** Pointing: raise, hold on target, lower. */
  pointRaise: 0.42,
  pointHold: 0.6,
  pointLower: 0.4,
  /** Excited: a short hop, never a scale. Travel scales with ORBI's width. */
  excitedHopRatio: 0.055,
  excitedDuration: 0.24,
  excitedHops: 2,
  excitedTilt: 3.5,
  /** Startled recoil: back off, tip away, return. */
  recoilRatio: 0.03,
  recoilTilt: 6,
  recoilOut: 0.16,
  recoilBack: 0.55,
  /** How long the startled face is held before restoring the previous one. */
  surpriseHoldMs: 850,
  /** Returning every layer to neutral. */
  settleDuration: 0.55,
  /** Sliding to and from the footer perch. */
  dockDuration: 0.8,
  /** Look orientations ease in over this. */
  lookDuration: 0.7,
  /** How long the eyes stay lifted after an excited beat. */
  brightHoldMs: 1500,

  /* ── Priority claims ── */
  /** An explicit `useOrbi()` call owns ORBI for this long. */
  interactionClaimMs: 1400,
  /** Long enough to cover rise → blink → wave → greeting. */
  entranceClaimMs: 9000,

  /* ── Phase 3 personality ── */
  /** Randomized blink cadence. */
  blinkIntervalMin: 3.5,
  blinkIntervalMax: 7,
  /** How often a blink is a double blink. Rare on purpose. */
  doubleBlinkChance: 0.12,
  doubleBlinkGapMs: 150,
  /** The startled beat before ORBI realizes it has been poked. */
  clickStartleMs: 260,
  /** How long the wake-up flinch is held. */
  wakeStartleMs: 420,
  /** The acknowledging nod — a dip, not a hop. */
  nodDepth: 5,
  nodDuration: 0.34,
} as const

/** Long, silky settles — the same family as `lib/motion.ts`. */
export const ORBI_EASE = {
  rise: 'power3.out',
  soft: 'power2.out',
  inOut: 'power2.inOut',
  float: 'sine.inOut',
  waveRaise: 'back.out(1.5)',
  waveSwing: 'sine.inOut',
  point: 'power3.out',
  hop: 'power2.out',
  hopLand: 'power2.in',
  recoil: 'power4.out',
  recoilReturn: 'elastic.out(1, 0.55)',
} as const

/* ── Palette ───────────────────────────────────────────────────────────── */

export const ORBI_COLORS = {
  accent: '#00B7FF',
  accentSoft: '#5EE9FF',
  shellTop: '#1B2637',
  shellBottom: '#0A0F16',
  visor: '#04070C',
  rim: 'rgba(255, 255, 255, 0.10)',
  rimStrong: 'rgba(94, 233, 255, 0.35)',
  speechBg: 'rgba(12, 18, 28, 0.92)',
  speechBorder: 'rgba(0, 183, 255, 0.28)',
  speechText: '#E9F1F8',
} as const

/* ── Copy ──────────────────────────────────────────────────────────────── */

export const ORBI_MESSAGES = {
  greeting: 'Hi 👋',
  /** When the cursor rests on ORBI for a beat. */
  hoverGreeting: 'Hey 👀',
} as const

/* ── Geometry ──────────────────────────────────────────────────────────── */

/**
 * The SVG user space every part of ORBI is drawn in. The box is wider than
 * the robot on purpose: the raised waving arm swings into that reserve, so
 * nothing ever clips.
 */
export const ORBI_VIEWBOX = { width: 170, height: 152 } as const

export const ORBI_ART = {
  /** Each arm pivots at its own shoulder. */
  armPivot: '143.5 78',
  armPivotLeft: '26.5 78',
  /** Angles the raised arm swings between, degrees. */
  waveRaised: -125,
  waveSwingA: -140,
  waveSwingB: -110,
  /** Eye centres inside the visor. */
  eyeLeft: { x: 71, y: 68 },
  eyeRight: { x: 99, y: 68 },
  eyeRx: 7,
  eyeRy: 10,
  mouth: { x: 85, y: 89 },
  /** Pointing angles, degrees. Negative swings the right arm outward. */
  pointRightAngle: -88,
  pointLeftAngle: 88,
  /** Body tilt for a look orientation. Deliberately tiny — eyes do the work. */
  lookTilt: 4.5,
  /** The head cock on a curious glance. Smaller still. */
  curiousTilt: 3.2,
  /** How far the pupils travel at full gaze, SVG units. */
  gazeMaxX: 3.6,
  gazeMaxY: 3,
} as const

/* ── Scroll awareness ──────────────────────────────────────────────────── */

export const ORBI_SCROLL = {
  /**
   * A section counts as active only while it overlaps the middle band of the
   * viewport — entering at the very bottom edge is not enough. Expressed as
   * fractions of the viewport height so the ScrollTrigger bounds and the
   * geometry check that resolves ties cannot drift apart.
   */
  bandTop: 0.6,
  bandBottom: 0.4,
  /** The footer perch. */
  footerSelector: 'footer',
  /**
   * Late on purpose. The footer merely touching the bottom edge is not enough:
   * Contact sits directly above it, and docking early would drag ORBI — and
   * its "Let's build something!" bubble — off to the edge mid-greeting.
   */
  footerStart: 'top 68%',
  /** Eyes return to neutral this long after the last scroll tick. */
  glanceSettleMs: 380,
  /** Normalized pupil offset while scrolling. */
  glanceAmount: 0.55,
  /** px/sec. Anything faster than this startles ORBI. */
  fastVelocity: 2800,
  /** How far ORBI slides toward the edge at the footer, % of its own size. */
  dockX: 40,
  dockY: 10,
} as const

/* ── Flight ────────────────────────────────────────────────────────────── */

/**
 * How ORBI stays in the air.
 *
 * Not a loop — a walk through a short list of poses. Each is a slightly
 * different place to be, so the motion never lands on the same coordinates
 * twice in a row, but the sequence is fixed rather than random: ORBI looks
 * organic and still animates identically on every run, which is what makes it
 * testable.
 *
 * Poses are authored at `referenceSize` and scaled from there, so a smaller
 * ORBI flies proportionally smaller.
 */
export const ORBI_FLIGHT = {
  /** Rendered width the pose values below were tuned against. */
  referenceSize: 148,

  /**
   * The resting hover. Rise, ease off near the top, drift a little sideways,
   * tip a fraction, come back down, correct. ~5–9px of lift, 2–5px of drift,
   * under 1.5° of roll, 2.5–4s a segment.
   */
  poses: [
    { x: 0, y: -6.4, rotation: -0.6, duration: 3.2 },
    { x: 2.6, y: -3.1, rotation: 0.5, duration: 2.8 },
    { x: 3.4, y: -8.4, rotation: 1.1, duration: 3.7 },
    { x: 0.9, y: -4.3, rotation: 0.3, duration: 2.6 },
    { x: -2.2, y: -7.6, rotation: -1.0, duration: 3.4 },
    { x: -3.1, y: -3.4, rotation: -0.4, duration: 2.9 },
    { x: -0.7, y: -5.9, rotation: 0.7, duration: 3.1 },
    { x: 1.8, y: -2.7, rotation: -0.2, duration: 2.7 },
  ],

  /**
   * The rare beat where ORBI repositions himself: a firmer climb, a tip into
   * it, a slide sideways, then a settle. Still no bounce and no overshoot —
   * this should read as station-keeping, not as an animation playing.
   */
  adjustment: [
    { x: 0.4, y: -12.6, rotation: 1.4, duration: 1.5, ease: 'power2.out' },
    { x: 4.6, y: -11.2, rotation: 0.2, duration: 1.4, ease: 'sine.inOut' },
    { x: 1.5, y: -7.4, rotation: -0.5, duration: 1.7, ease: 'power2.inOut' },
  ],

  /** Segments between adjustments — roughly 12–20s at the durations above. */
  adjustmentGapMin: 4,
  adjustmentGapMax: 6,

  /** Amplitude and pacing per variant. */
  activeScale: 1.35,
  drowsyScale: 0.6,
  drowsyDurationScale: 1.9,
  /** While a modal owns the screen: quieter, but not asleep. */
  calmScale: 0.55,
  calmDurationScale: 1.35,
  /**
   * Deeply asleep. Barely moving and very slow, plus a small sink so ORBI
   * visibly settles rather than merely slowing down.
   */
  sleepScale: 0.16,
  sleepDurationScale: 2.8,
  /** How far ORBI sinks while deeply asleep, px at `referenceSize`. */
  sleepSink: 5,

  /**
   * Sleeping: not the hover table slowed down, but its own rhythm.
   *
   * A robot does not breathe, so this is what a power system idling looks
   * like — a slow expansion, a settle, and a held pause before it does it
   * again. Roughly 3.5s a cycle, about 1.6px of travel at full size, and a
   * constant few degrees of lean that reads as "gone under" rather than
   * "tipped over". Every value goes through the same lift/drift/roll scaling
   * as the other variants, so a phone gets a third of the lean for free.
   */
  sleepPoses: [
    { x: 0, y: -24, rotation: -6.5, duration: 0.45, ease: 'sine.inOut' },
    { x: 1.5, y: -4, rotation: -5.2, duration: 0.5, ease: 'sine.inOut' },
    { x: 0.5, y: -14, rotation: -6, duration: 0.3, ease: 'sine.inOut' },
  ],

  /**
   * Mobile. Lift already scales with ORBI's size; drift and roll are cut
   * further so he never wanders toward a neighbouring control and his hit area
   * stays where the user expects it.
   */
  quietDriftScale: 0.5,
  quietRotationScale: 0.3,
  /**
   * Lift already shrinks with ORBI's size; this trims it a little further so
   * even the larger reposition stays inside ~6px on a phone.
   */
  quietLiftScale: 0.8,
} as const

export type OrbiFlightPose = {
  x: number
  y: number
  rotation: number
  duration: number
  ease?: string
}

/* ── Cinematic movement ────────────────────────────────────────────────── */

export type OrbiCinematicType = 'hero' | 'precision' | 'projects'

/** Where ORBI can park relative to a cinematic target. */
export type OrbiCinematicSide =
  | 'right'
  | 'left'
  | 'above-right'
  | 'above-left'
  | 'below-right'
  | 'below-left'

export type OrbiCinematicPhase =
  | 'idle'
  | 'out'
  | 'arrive'
  | 'perform'
  | 'back'
  | 'land'

export interface OrbiCinematicSpec {
  /** Attribute value that marks the target: `data-orbi-cinematic="…"`. */
  type: OrbiCinematicType
  /** Preferred parking spots, best first. Scoring can still overrule. */
  prefer: readonly OrbiCinematicSide[]
  /** How long ORBI stays at the destination. */
  dwellMs: number
  /** Only ever once per page load. */
  once: boolean
  /** Skipped entirely on a phone — no room to cross the screen safely. */
  desktopOnly: boolean
}

/**
 * The three moments ORBI leaves his dock for.
 *
 * Rare on purpose: most of the time he stays put, which is what makes going
 * somewhere read as deliberate rather than as an animation on a loop.
 */
export const ORBI_CINEMATICS: Record<OrbiCinematicType, OrbiCinematicSpec> = {
  hero: {
    type: 'hero',
    prefer: ['right', 'below-right', 'left'],
    dwellMs: 0, // the entrance choreography sets its own pace
    once: true,
    desktopOnly: false,
  },
  precision: {
    type: 'precision',
    prefer: ['left', 'above-right', 'right', 'below-right'],
    dwellMs: 1550,
    once: false,
    desktopOnly: true,
  },
  projects: {
    type: 'projects',
    prefer: ['above-right', 'right', 'above-left'],
    dwellMs: 1500,
    once: false,
    desktopOnly: true,
  },
}

export const ORBI_CINEMATIC = {
  selector: '[data-orbi-cinematic]',

  /** Clearance kept from the target itself and from the viewport edges. */
  targetGap: 26,
  edgeMargin: 24,

  /** A destination this covered by something registered is unusable. */
  unsafeOverlap: 0.08,

  /* ── Travel ── */
  /** Anything beyond this counts as a long trip. */
  longDistance: 620,
  shortMs: 880,
  longMs: 1280,
  mobileMs: 640,
  /** Arc height as a fraction of the distance travelled. */
  arcRatio: 0.2,
  maxArc: 130,
  /** Degrees ORBI leans into the direction of travel. */
  leanDeg: 4.5,
  /** The beat between arriving and reacting — small, and load-bearing. */
  arriveSettleMs: 200,
  /** Stabilisation once back on the dock. */
  landSettleMs: 260,

  /**
   * Return paths, chosen deterministically by sequence index so a run is
   * reproducible. Values scale the outbound arc: negative dips below the
   * straight line, positive lifts above it.
   */
  returnStyles: [-0.55, 0.85, 0.06],

  /** Tablet trims the travel; the choreography is otherwise identical. */
  tabletScale: 0.7,

  /** A target this far out of view mid-flight aborts the trip. */
  abortVisibility: 0.25,

  /** Precision inspection: a lean, then one glance either side. */
  inspectLeanDeg: 3.5,
  inspectScan: [-0.75, 0.55, -0.2],
  inspectScanMs: 420,

  /** Projects: eyes travel the row, body stays put. */
  scanMs: 1500,

  /** Beat after a section reaction before ORBI considers going anywhere. */
  requestDelayMs: 500,
  /** ...and once more, after the section's own gesture has resolved. */
  requestRetryMs: 1400,
  /** A bubble younger than this is still being read; ORBI waits. */
  messageGraceMs: 900,
} as const

/* ── Easter eggs ───────────────────────────────────────────────────────── */

/**
 * The hidden half of ORBI's personality.
 *
 * Every one of these is *rare on purpose*. A visitor who spends a few minutes
 * on the site should find one, perhaps two, and leave with the impression that
 * there was more to find — not that a robot was performing at them. Nothing
 * here may interrupt reading, a form, a cinematic, or a safety move, and only
 * one can ever be running at a time.
 */
export type OrbiEasterEgg =
  /** Poked five times in a hurry. */
  | 'dizzyClick'
  /** The cursor whipping about near ORBI. */
  | 'cursorChase'
  /** The cursor drawn all the way around him. */
  | 'cursorCircle'
  /** A tap on the head rather than the body. */
  | 'headTap'
  /** Hovered long enough that ORBI checks himself over. */
  | 'selfAware'
  /** The Calibur Labs logo, hovered. */
  | 'logoNod'
  /** Coming back after ORBI has properly fallen asleep. */
  | 'deepWake'
  /** Staying at the very bottom of the page. */
  | 'footerSecret'
  /** The rare disappearing act. */
  | 'edgePeek'
  /** A small unprompted beat during a genuinely quiet spell. */
  | 'rareIdle'

/**
 * What the visitor has found this page view. Session-lifetime only — nothing
 * is persisted, so a reload is a clean slate. It exists to stop a first-time
 * line being shown twice, not to score anything.
 */
export interface OrbiDiscoveries {
  dizzyClick: boolean
  cursorCircle: boolean
  headTap: boolean
  footerSecret: boolean
  deepWake: boolean
}

export const ORBI_NO_DISCOVERIES: OrbiDiscoveries = {
  dizzyClick: false,
  cursorCircle: false,
  headTap: false,
  footerSecret: false,
  deepWake: false,
}

export interface OrbiEasterSpec {
  type: OrbiEasterEgg
  /**
   * One entry per beat: how long that step is held before the next one. The
   * controller advances the step; `OrbiGuide` decides what each step *looks*
   * like, exactly as it does for a cinematic.
   */
  beats: readonly number[]
  /** Not again inside this window. */
  cooldown: number
  /** At most once per page view. */
  once?: boolean
  /** Needs a real cursor — never on touch. */
  pointerOnly?: boolean
  /** No room for it on a phone. */
  desktopOnly?: boolean
  /**
   * The reaction *is* the movement — there is nothing left of it once travel
   * is removed, so it does not run under `prefers-reduced-motion` at all.
   */
  motionOnly?: boolean
  /**
   * The visitor caused this directly by touching ORBI, so the rule that keeps
   * *unprompted* reactions rare does not apply: the global cooldown between
   * any two reactions is skipped. Its own cooldown still holds, and so does
   * every safety check.
   */
  userTriggered?: boolean
  /**
   * May take over a reaction already running. Only the repeated-click beat
   * has it: someone poking ORBI five times has overtaken whatever he started
   * doing about the first poke, and both cannot be true at once.
   */
  interrupts?: boolean
}

export const ORBI_EASTER_SPECS: Record<OrbiEasterEgg, OrbiEasterSpec> = {
  // startled → dizzy → recover
  dizzyClick: {
    type: 'dizzyClick',
    beats: [420, 1250, 520],
    cooldown: 40000,
    userTriggered: true,
    interrupts: true,
  },
  // one startled beat and a correction; the shortest egg there is
  cursorChase: {
    type: 'cursorChase',
    beats: [640, 320],
    cooldown: 10000,
    pointerOnly: true,
    desktopOnly: true,
  },
  // eyes go round with it, then the same recovery as a poking
  cursorCircle: {
    type: 'cursorCircle',
    beats: [560, 1150, 520],
    cooldown: 30000,
    pointerOnly: true,
    desktopOnly: true,
  },
  // eyes up → blink → pleased
  headTap: {
    type: 'headTap',
    beats: [360, 260, 900],
    cooldown: 6000,
    userTriggered: true,
  },
  // look down at himself → back at the visitor → happy blink
  selfAware: {
    type: 'selfAware',
    beats: [900, 700, 420],
    cooldown: 60000,
    pointerOnly: true,
    desktopOnly: true,
  },
  // look at the mark → small proud nod
  logoNod: {
    type: 'logoNod',
    beats: [820, 900],
    cooldown: 45000,
    pointerOnly: true,
    desktopOnly: true,
  },
  // startle → blink → blink → find the visitor → settle
  deepWake: { type: 'deepWake', beats: [380, 220, 200, 220, 900], cooldown: 8000 },
  // lean in → find the visitor → wave → settle back
  footerSecret: {
    type: 'footerSecret',
    beats: [900, 800, 1500, 520],
    cooldown: 60000,
    once: true,
  },
  // slip behind the edge → hold → eyes first, then the rest of him
  edgePeek: {
    type: 'edgePeek',
    beats: [1100, 900, 1000],
    cooldown: 90000,
    once: true,
    desktopOnly: true,
    motionOnly: true,
  },
  // one small unprompted beat
  rareIdle: { type: 'rareIdle', beats: [720, 520, 400], cooldown: 30000 },
}

/**
 * Every threshold and every "not again yet" window for the hidden reactions,
 * in one place — personality lives or dies on these numbers and they are meant
 * to be tuned here, in the browser, rather than hunted for in a component.
 */
export const ORBI_EASTER_EGGS = {
  /* ── Repeated clicking ── */
  repeatedClickWindow: 3000,
  repeatedClickCount: 5,
  repeatedClickCooldown: 40000,

  /* ── Cursor ── */
  cursorChaseCooldown: 10000,
  cursorCircleCooldown: 30000,
  /** px/s the cursor has to sustain near ORBI before he reacts to it. */
  chaseVelocity: 2400,
  /** ...and how near, px from his centre. */
  chaseRadius: 300,
  /** Consecutive fast samples required, so one flick is not enough. */
  chaseSamples: 4,

  /* ── The circle ──
   * A lightweight angular accumulator, not gesture recognition: the angle of
   * the cursor around ORBI, summed, with the radius and the direction policed
   * so ordinary mouse movement across him can never add up to a lap. */
  circleMinDegrees: 320,
  /** A single jump larger than this is a teleport, not a stroke. */
  circleMaxStepDegrees: 62,
  /** Backtracking further than this abandons the attempt. */
  circleReverseDegrees: 34,
  /** Radius band, as multiples of ORBI's own half-width. */
  circleMinRadius: 0.75,
  circleMaxRadius: 3.4,
  /** Fewest samples that can count as a lap. */
  circleMinSamples: 12,
  /** The whole lap has to happen inside this. */
  circleWindowMs: 3200,

  /* ── Head ── */
  headTapBubbleCooldown: 45000,

  /* ── Sleep ── */
  /** Quiet for this long and ORBI is properly asleep, not merely dozing. */
  deepSleepDelay: 75000,
  deepWakeBubbleCooldown: 120000,

  /* ── Footer ── */
  /** How long at the bottom of the page before ORBI leans in. */
  footerSecretDelay: 6500,
  /** How far he leans into the viewport for it, % of his own width. */
  footerPeekPercent: 26,
  /** ...and how far he shrinks back when the cursor comes at him. */
  edgeRetreatPercent: 12,
  /** Coming back out is slower than backing off — he is being careful. */
  edgeReturnDuration: 1.2,

  /* ── Hover ── */
  selfAwareCooldown: 60000,
  /** Cursor resting on ORBI this long before he checks himself over. */
  selfAwareHoverDelay: 4500,
  /** Cursor resting on the logo this long before he looks at it. */
  logoHoverDelay: 1750,

  /* ── Idle ── */
  rareIdleMin: 45000,
  rareIdleMax: 90000,
  /**
   * Deterministic, not random: the gaps between the rare idle beats walk this
   * table in order, so a long visit is varied and a test run is repeatable.
   * Every value sits inside [rareIdleMin, rareIdleMax].
   */
  rareIdleGaps: [52000, 78000, 61000, 88000, 47000, 69000],
  /** Nothing at all until the visitor has been here this long. */
  edgePeekDelay: 120000,

  /* ── House rules ── */
  /** No two hidden reactions back to back, whichever they are. */
  globalCooldown: 14000,
  /** How many Easter-egg bubbles a single page view may ever show. */
  maxBubbles: 2,
  /** Degrees of body roll in the stabilisation wobble. Restrained on purpose. */
  wobbleDegrees: 4.5,
  /** Mobile keeps the beat and loses most of the movement. */
  wobbleQuietScale: 0.45,
  wobbleMs: 900,
} as const

/**
 * The only four lines a hidden reaction may ever say, and never more than
 * `maxBubbles` of them in one visit — each on first discovery only.
 */
export const ORBI_EASTER_MESSAGES = {
  dizzyClick: 'Whoa 😵',
  headTap: 'Hehe 👀',
  deepWake: "Oh! You're back 👀",
  footerSecret: 'You made it! 👋',
} as const

/* ── Audio ─────────────────────────────────────────────────────────────── */

/**
 * ORBI's voice.
 *
 * Nine cues, no more — one per *kind* of moment rather than one per animation,
 * because a companion that chirps at everything stops being a companion and
 * becomes a notification. Everything ORBI says with sound he also says with a
 * face, so muted is not a degraded experience: it is the default one.
 */
export type OrbiSound =
  /** The eyes coming on, and the tone that confirms sound is now on. */
  | 'activate'
  /** "Noted" — the ordinary click. */
  | 'acknowledge'
  /** Leaving the dock. One airy pass, never a loop. */
  | 'fly'
  /** Arriving back on it. */
  | 'land'
  /** A small delight. */
  | 'happy'
  /** The submission landed. The one moment ORBI is allowed to be warm. */
  | 'success'
  /** Going properly under. */
  | 'sleep'
  /** Coming back out of it. */
  | 'wake'
  /** Poked once too often, or led round in a circle. */
  | 'dizzy'

/** 2 interrupts 1 interrupts 0. Equal priority also interrupts — newest wins. */
export type OrbiSoundPriority = 0 | 1 | 2

export interface OrbiSoundSpec {
  priority: OrbiSoundPriority
  /** Peak gain for this cue, before the master volume. */
  volume: number
  /** How long the cue lasts, ms. Also how long it owns the channel. */
  durationMs: number
  /** Not again inside this window. */
  cooldownMs: number
}

/**
 * Volumes and windows in one place, per the same rule as every other tunable
 * in ORBI: no number that shapes how he feels is allowed to hide in a
 * component. Everything here is deliberately quiet — the loudest cue peaks at
 * a quarter of the master gain, which is itself a quarter of full scale.
 */
export const ORBI_AUDIO = {
  /** The only thing ORBI is allowed to remember about a visitor. */
  storageKey: 'calibur-orbi-audio',

  masterVolume: 0.25,
  interactionVolume: 0.18,
  cinematicVolume: 0.2,
  successVolume: 0.25,
  /** Sleep and wake — the quietest things he does. */
  ambientVolume: 0.16,

  /** Every cue is faded rather than cut, so nothing ever clicks. */
  fadeMs: 45,
  /** Two cues never butt up against each other. */
  minGapMs: 90,
  /** How long the "sound is on" beat holds ORBI's face. */
  enableBeatMs: 700,
} as const

export const ORBI_SOUND_SPECS: Record<OrbiSound, OrbiSoundSpec> = {
  activate:    { priority: 0, volume: ORBI_AUDIO.interactionVolume, durationMs: 140, cooldownMs: 800 },
  acknowledge: { priority: 0, volume: ORBI_AUDIO.interactionVolume, durationMs: 120, cooldownMs: 400 },
  fly:         { priority: 1, volume: ORBI_AUDIO.cinematicVolume,   durationMs: 520, cooldownMs: 1200 },
  land:        { priority: 1, volume: ORBI_AUDIO.cinematicVolume,   durationMs: 220, cooldownMs: 1200 },
  happy:       { priority: 1, volume: ORBI_AUDIO.interactionVolume, durationMs: 260, cooldownMs: 2000 },
  success:     { priority: 2, volume: ORBI_AUDIO.successVolume,     durationMs: 520, cooldownMs: 4000 },
  sleep:       { priority: 2, volume: ORBI_AUDIO.ambientVolume,     durationMs: 620, cooldownMs: 30000 },
  wake:        { priority: 2, volume: ORBI_AUDIO.ambientVolume,     durationMs: 380, cooldownMs: 4000 },
  dizzy:       { priority: 2, volume: ORBI_AUDIO.interactionVolume, durationMs: 420, cooldownMs: 4000 },
}

/** The sound control's own geometry. Small, and never in ORBI's way. */
export const ORBI_AUDIO_TOGGLE = {
  /** Rendered size, px. The touch target is padded out to `touchSize`. */
  size: 34,
  mobileSize: 40,
  touchSize: 44,
  /** Gap between the control and ORBI's box. */
  gap: 8,
  /** Resting opacity — present, but not competing with ORBI. */
  restOpacity: 0.3,
  /** ...and on touch, where there is no hover to reveal it. */
  touchOpacity: 0.68,
} as const

/* ── Sleep ─────────────────────────────────────────────────────────────── */

/**
 * What ORBI looks like once he has properly gone under.
 *
 * Phase 3 gave him the *states* — quiet, drowsy, dozing, asleep — and Phase 8
 * added the last one. This is only the presentation of the last one: a body
 * that settles and breathes, a mouth that appears when the eyes close, and one
 * or two Z's drifting away from the screen edge. No new state, no new sound,
 * and nothing that runs when nobody is looking.
 *
 * The numbers are deliberately small. Everything here is meant to be noticed
 * only if you sit still and watch.
 */
export const ORBI_SLEEP = {
  /** Beat between the eyes closing and the first Z, so the order reads. */
  particleDelayMs: 1500,

  /* ── The Z's ── */
  /** Never more than this on screen at once. */
  maxParticles: 2,
  /**
   * One float, start to fade-out. The keyframes finish the rise by 55% of the
   * cycle and hold invisible for the rest, so this is the *visible* life of a
   * Z and `particleGapMs` is the silence after it.
   */
  particleDurationMs: 2600,
  /**
   * Empty beat after a Z has faded, before that slot is used again. Long on
   * purpose: with two slots this is what decides whether sleep reads as the
   * occasional Z or as a stream. At these numbers there is a Z in the air
   * about six seconds in ten, and never two.
   */
  particleGapMs: 3900,
  /** How far apart in time the two slots run. Half the cycle, so they alternate. */
  particleStaggerMs: 3250,
  /**
   * A phone gets one slot rather than two, so its gap is shorter — otherwise a
   * Z would only be there four seconds in ten, and a glance would miss it.
   */
  particleGapMobileMs: 2200,
  /** How far a Z travels up, px. The second slot goes a little further. */
  riseDesktop: 34,
  riseMobile: 22,
  /** ...and sideways, away from the nearest screen edge. */
  driftDesktop: 10,
  driftMobile: 6,
  /** Font size of the two glyphs, px. */
  glyphSmall: 16,
  glyphLarge: 22,
  /** Peak opacity. Low: this is a hint, not a label. */
  glyphOpacity: 0.85,
  /** Where the Z's start, as a fraction of ORBI's box. */
  originX: 0.72,
  originY: 0.16,

  /**
   * The snore itself is a keyframe animation carried by `OrbiSleepParticles`
   * (keyframes cannot be inline styles, so they travel with ORBI rather than
   * living in the application's stylesheet). This is the same number, kept
   * here so the HUD and any future tuning read it from the place every other
   * ORBI constant lives.
   */
  snoreCycleMs: 3600,

  /* ── Waking ── */
  /** How fast visible Z's clear once the visitor is back. */
  fadeOutMs: 220,
  /** ...and how long the layer stays mounted to let that fade finish. */
  unmountAfterMs: 300,
} as const

/* ── Cooldowns ─────────────────────────────────────────────────────────── */

/**
 * Every "don't do that again yet" window, in one place. Personality lives or
 * dies on these numbers, so they are tuned here rather than scattered through
 * the components.
 */
export const ORBI_COOLDOWNS = {
  /** "Hey 👀" when the cursor lingers on ORBI. */
  hoverGreeting: 30000,
  /** Between click reactions — also stops a double-click double-bubbling. */
  clickMessage: 1500,
  /** The self-initiated curious glance. */
  curious: 25000,
  /** The startled reaction to a fast flick. */
  fastScroll: 2600,
  /** The same section message replaying. */
  sectionMessage: 12000,
  /** A section reaction re-firing at all. */
  sectionReaction: 5000,
  /** Reacting to the same marked CTA again. */
  cta: 8000,
  /** A cinematic will not re-run for the same section inside this window. */
  cinematic: 45000,
  /** Nor will *any* cinematic run again this soon after the last one. */
  cinematicGlobal: 20000,
  /** The optional pointing gesture on a high-value CTA. */
  ctaPoint: 20000,
  /** Reacting to the navigation opening. */
  nav: 5000,
} as const

/* ── Interaction ───────────────────────────────────────────────────────── */

export const ORBI_INTERACTION = {
  /**
   * Cursor tracking. The pupils track the pointer across the viewport but the
   * travel is clamped hard — ORBI glances, it does not stare.
   */
  cursorRange: 0.55,
  /** How far the cursor reaches before ORBI notices it approaching, px. */
  proximityRadius: 150,
  /** Inside this, the pointer counts as being on ORBI. */
  hoverPadding: 6,
  /** Gaze gain once the pointer is inside `proximityRadius`. */
  proximityGain: 1,
  /** Degrees of body lean toward a hovering cursor. */
  hoverTilt: 3,
  /** Cursor must rest on ORBI this long before it says hello. */
  hoverGreetingDelay: 1500,
  hoverGreetingHold: 1800,
  /** Eye-follow smoothing. Long enough to read as a glance, not a servo. */
  gazeEase: 'power3.out',
  gazeDuration: 0.5,
  /** Quiet spell before the curious glance may fire, ms (randomized). */
  curiousMinDelay: 8000,
  curiousMaxDelay: 12000,
  curiousHold: 2200,
  /** Quiet spell before ORBI gets drowsy, then closes its eyes. */
  drowsyDelay: 24000,
  dozeDelay: 45000,
  /** Away this long and ORBI does a small wake-up blink on return. */
  awayWakeMs: 30000,
  /** Opt-in attribute a CTA sets to be noticed. No ORBI import required. */
  ctaSelector: '[data-orbi-interest]',
  /** Opt-in attribute on a nav toggle; ORBI watches its `aria-expanded`. */
  navSelector: '[data-orbi-nav]',
} as const

/** Where ORBI's pupils are currently pointed, highest priority first. */
export const ORBI_GAZE_PRIORITY = [
  /** A section gesture or explicit `look-*`. */
  'gesture',
  /** A CTA, the navigation, or a deliberate cue. */
  'interaction',
  /**
   * The focused form field. Above scroll and cursor on purpose: while someone
   * is filling in a field, nothing should pull ORBI's eyes off it.
   */
  'form',
  /** Scroll direction. */
  'scroll',
  /** The cursor. */
  'cursor',
] as const

export type OrbiGazeSource = (typeof ORBI_GAZE_PRIORITY)[number]

/* ── Environment ───────────────────────────────────────────────────────── */

/** Where ORBI is allowed to live. Bottom-right stays the default. */
export type OrbiDock =
  | 'bottom-right'
  | 'bottom-left'
  | 'mid-right'
  | 'mid-left'

/** Where ORBI lives unless something is in the way. */
export const ORBI_DEFAULT_DOCK: OrbiDock = 'bottom-right'

export const ORBI_DOCKS: readonly OrbiDock[] = [
  'bottom-right',
  'bottom-left',
  'mid-right',
  'mid-left',
]

export type OrbiBubblePlacement = 'above' | 'left' | 'right'

export type OrbiRegionTheme = 'dark' | 'light'

/**
 * Everything the page opts into, by attribute. Sections stay free of ORBI
 * imports; they just describe themselves.
 *
 *   data-orbi-avoid            don't cover me
 *   data-orbi-avoid="high"     really don't cover me
 *   data-orbi-modal            I am an overlay; stand down
 *   data-orbi-project          a project card ORBI can look at
 *   data-orbi-expanded="true"  I just revealed something
 *   data-orbi-theme="light"    ORBI is over a light region here
 *   data-orbi-form             a form region; keep clear of the fields
 */
export const ORBI_SELECTORS = {
  avoid: '[data-orbi-avoid]',
  modal: '[data-orbi-modal],dialog[open]',
  project: '[data-orbi-project]',
  expanded: '[data-orbi-expanded]',
  theme: '[data-orbi-theme]',
  form: '[data-orbi-form]',
  field: '[data-orbi-field]',
  submit: '[data-orbi-submit]',
  /** The brand mark. ORBI notices it if you rest the cursor there. */
  logo: '[data-orbi-logo]',
  /** The head/visor hit region inside the robot itself. */
  head: '[data-orbi-part="head"]',
} as const

/* ── Contact companion ─────────────────────────────────────────────────── */

export type OrbiFormStatus = 'idle' | 'submitting' | 'success' | 'error'

export const ORBI_FORM = {
  /**
   * Focus can leave the form briefly — tabbing through, clicking a label, the
   * browser's autofill dropdown — without ORBI dropping out of companion mode.
   */
  leaveGraceMs: 1600,
  /** Geometry reads are debounced; nothing here runs per keystroke. */
  geometryDebounceMs: 120,
  /** After this long in flight, attentive becomes patient. No speech, no fake progress. */
  patientAfterMs: 4000,
  /** How long the celebration bubble stays up. */
  successHoldMs: 2600,
  errorHoldMs: 2800,
  /** Beat between the celebratory lift and the first line. */
  successLiftMs: 900,
  /** Companion mode lingers this long after the result, then hands back. */
  exitDelayMs: 1400,
  /** The "check this field" bubble, at most once per this window. */
  invalidMessageCooldownMs: 20000,
  /**
   * Below this fraction of the layout viewport, the on-screen keyboard has
   * taken the screen and ORBI gets out of the way entirely.
   */
  keyboardViewportRatio: 0.62,
  /** Let the keyboard finish animating before re-measuring anything. */
  viewportDebounceMs: 260,
} as const

export const ORBI_FORM_MESSAGES = {
  error: 'Something went wrong.',
  invalid: 'Check this field 👀',
} as const

/**
 * What ORBI says after the server confirms a submission — and only then.
 *
 * Three short beats that de-escalate: celebrate, acknowledge, thank. The
 * movement follows the same curve, so it never reads as three celebrations in
 * a row. The whole thing runs ~7s from the lift to the settle.
 */
export const ORBI_SUCCESS = {
  steps: [
    { message: 'Yay, I got your message!', holdMs: 1900, beat: 'celebrate' },
    { message: 'Our team will check it out!', holdMs: 2100, beat: 'acknowledge' },
    { message: 'Thank You', holdMs: 2100, beat: 'thank' },
  ],
  /**
   * The three lines are different lengths. Pinning the floor just under the
   * bubble's own maximum makes the panel effectively a fixed width for the
   * run, so the words swap without the box breathing around them.
   */
  minBubbleRatio: 0.97,
} as const

export type OrbiSuccessBeat = (typeof ORBI_SUCCESS.steps)[number]['beat']

/** The elements that become avoid regions — one query covers all of them. */
export const ORBI_REGISTRY_SELECTOR = [
  ORBI_SELECTORS.avoid,
  ORBI_SELECTORS.modal,
  ORBI_SELECTORS.form,
].join(',')

/**
 * Everything worth re-measuring for. Wider than the registry: a theme region
 * never blocks ORBI, but it does change how he is drawn, so one appearing has
 * to wake the environment up just the same.
 */
export const ORBI_WATCHED_SELECTOR = [
  ORBI_REGISTRY_SELECTOR,
  ORBI_SELECTORS.theme,
].join(',')

export const ORBI_ENVIRONMENT = {
  /**
   * Keep off the physical edges. Safe-area insets are added on top of these,
   * so a notched phone in landscape still gets a usable margin.
   */
  desktopMargin: 20,
  mobileMargin: 12,

  /**
   * Overlap is measured as a fraction of ORBI's own area. Below the threshold
   * a clipped corner is simply ignored — ORBI should not flee a 2px touch.
   */
  collisionThreshold: 0.12,
  /** `data-orbi-avoid="high"` is taken far more seriously. */
  highCollisionThreshold: 0.02,
  highWeight: 3.2,
  /** A modal or full-screen menu outranks everything else on the page. */
  modalWeight: 4,

  /**
   * Sitting right beside something important is worth avoiding, but only as a
   * tie-break between usable docks — never a reason to relocate on its own.
   */
  proximityRadius: 26,
  proximityWeight: 0.2,

  /** Scoring weights. Collision dominates; the rest only breaks ties. */
  travelWeight: 0.08,
  /** A nudge back toward the default dock when ranking usable candidates. */
  homeWeight: 0.6,
  edgeWeight: 2,

  /**
   * Hysteresis. Having just moved, ORBI stays put for a while — otherwise a
   * layout that flickers across a threshold makes him oscillate.
   */
  minHoldMs: 4000,
  /** Bypasses the hold: a high-priority control is genuinely covered. */
  urgentOverlap: 0.3,

  /**
   * Last resort. When even the best dock is still this covered — a form
   * filling a phone screen, an overlay taking everything — there is nowhere
   * good left, so ORBI slides out to the edge rather than shuffling between
   * equally bad corners. Asymmetric thresholds so he does not flicker in and
   * out at the boundary.
   */
  crowdedEnter: 0.25,
  crowdedExit: 0.1,

  /** Re-evaluation is debounced; nothing here runs per frame. */
  evaluateDebounceMs: 180,
  /** After a scroll stops, wait for layout to settle before measuring. */
  scrollSettleMs: 260,
  /** A closing modal gets a beat before ORBI drifts back. */
  modalReturnDelayMs: 400,

  /** Reposition flight. */
  moveDuration: 0.95,
  moveDurationMobile: 0.7,
  moveDurationReduced: 0.22,
  /** How long the "I noticed" glance is held while moving. */
  noticeHoldMs: 900,

  /** Dwell on one project card before the single interested reaction. */
  projectDwellMs: 1200,
  /**
   * While the visitor is using a form, prefer a dock beside it — level with
   * its middle and clear of its horizontal span. A nudge, not an override:
   * collisions still decide what is usable.
   */
  companionWeight: 0.45,
} as const

/** Ordered fallbacks per dock — the smallest visual move comes first. */
export const ORBI_DOCK_FALLBACKS: Record<OrbiDock, readonly OrbiDock[]> = {
  'bottom-right': ['bottom-right', 'mid-right', 'bottom-left', 'mid-left'],
  'bottom-left': ['bottom-left', 'mid-left', 'bottom-right', 'mid-right'],
  'mid-right': ['mid-right', 'bottom-right', 'mid-left', 'bottom-left'],
  'mid-left': ['mid-left', 'bottom-left', 'mid-right', 'bottom-right'],
}

/* ── Personality copy ──────────────────────────────────────────────────── */

/**
 * Kept short on purpose — roughly 30 characters. The bubble is a beat of
 * personality, not a place to put information.
 */
export const ORBI_CLICK_MESSAGES = [
  'Hi again 👋',
  'You found me!',
  'Keep exploring 👀',
  'Nice to meet you!',
  "I'm ORBI ✨",
] as const

/* ── Debug ─────────────────────────────────────────────────────────────── */

/**
 * Flip to `true` for the development HUD (section, expression, animation,
 * scroll direction, motion lock). It is additionally gated on
 * `NODE_ENV !== 'production'`, so it can never ship. In dev you can also just
 * append `?orbi-debug` to the URL instead of editing this.
 */
export const ORBI_DEBUG = false

/**
 * Development-only URL switches, resolved in `useOrbiMedia`:
 *
 *   ?orbi-debug              the HUD
 *   ?orbi-cinematic=precision  run a cinematic on load, for visual tuning
 *   ?orbi-easter=dizzyClick    run a hidden reaction on demand, likewise
 *   ?orbi-audio-debug=1      sound-test buttons in the HUD
 *   ?orbi-sleep=deep         put ORBI straight to sleep, for visual tuning
 *   ?orbi-freeze=1           hold ORBI still so screenshots are deterministic
 *
 * All six are gated on `NODE_ENV !== 'production'`, which Next inlines.
 */
export const ORBI_DEV_PARAMS = {
  debug: 'orbi-debug',
  cinematic: 'orbi-cinematic',
  easter: 'orbi-easter',
  audio: 'orbi-audio-debug',
  sleep: 'orbi-sleep',
  freeze: 'orbi-freeze',
} as const
