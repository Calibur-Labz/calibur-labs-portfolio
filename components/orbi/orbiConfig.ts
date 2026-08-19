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

/** Expressions that already own the eyelids — the blink scheduler stays out. */
const EYES_BUSY = ['blink', 'surprised', 'sleepy'] as const

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
  /** Anything a human explicitly asked for via `useOrbi()`. */
  interaction: 40,
  /** The page-load sequence. Nothing outranks it. */
  entrance: 50,
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

/** Under the fixed navbar (z-index 100), above every section (z-index 10). */
export const ORBI_Z_INDEX = 90

/* ── Timing ────────────────────────────────────────────────────────────── */

/** Seconds unless the name says ms — GSAP works in seconds. */
export const ORBI_TIMING = {
  /** Beat of stillness after mount before ORBI rises. */
  entranceDelay: 0.5,
  riseDuration: 1.2,
  /** Pause after landing before the eyes come on. */
  eyesOnDelay: 0.28,
  eyesOnDuration: 0.45,
  /** Gap between the eyes lighting up and the first blink. */
  beforeBlink: 0.45,
  blinkCloseMs: 130,
  /** Gap between the blink and the wave. */
  beforeWave: 0.3,
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
  /** Scroll direction. */
  'scroll',
  /** The cursor. */
  'cursor',
] as const

export type OrbiGazeSource = (typeof ORBI_GAZE_PRIORITY)[number]

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
