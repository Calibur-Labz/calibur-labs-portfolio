'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import dynamic from 'next/dynamic'
import OrbiRobot from './OrbiRobot'
import OrbiSpeech from './OrbiSpeech'
import { OrbiContext } from './OrbiContext'
import { createOrbiArbiter } from './orbiArbiter'
import { createGazeController, type OrbiGazeController } from './orbiGaze'
import {
  useFinePointer,
  useOrbiBreakpoint,
  useOrbiAudioDebug,
  useOrbiCinematicRequest,
  useOrbiSleepRequest,
  useOrbiDebugEnabled,
  useOrbiEasterRequest,
  useOrbiFrozen,
  useOrbiGuideRequest,
  useReducedMotion,
} from './useOrbiMedia'
import { useOrbiScroll, type OrbiScrollDirection } from './useOrbiScroll'
import {
  gazeToward,
  useOrbiInteraction,
  type OrbiCtaSignal,
  type OrbiDrowsiness,
  type OrbiInteractionApi,
  type OrbiProximity,
  type OrbiTargetSignal,
} from './useOrbiInteraction'
import { useOrbiEnvironment } from './useOrbiEnvironment'
import { useOrbiForm } from './useOrbiForm'
import { useOrbiCinematic, type OrbiCinematicApi } from './useOrbiCinematic'
import { useOrbiEasterEggs, type OrbiEasterApi } from './useOrbiEasterEggs'
import { useOrbiAudio, type OrbiAudioApi } from './useOrbiAudio'
import OrbiSoundToggle from './OrbiSoundToggle'
import OrbiSleepParticles from './OrbiSleepParticles'
import OrbiGuideControl from './OrbiGuideControl'
import OrbiGuideMenu from './OrbiGuideMenu'
import OrbiAskPanel from './OrbiAskPanel'
import { useOrbiAsk } from './useOrbiAsk'
import { ORBI_ACTION_TARGETS, type OrbiAskAction } from './orbiAsk'
import { useOrbiGuideMode, type OrbiGuideApi } from './useOrbiGuideMode'
import {
  ORBI_GUIDE,
  ORBI_GUIDE_ITEMS,
  ORBI_GUIDE_MESSAGES,
  type OrbiGuideItem,
} from './orbiGuideConfig'
import {
  ORBI_SECTION_BEHAVIORS,
  resolveSectionAnimation,
  sectionClaimMs,
} from './orbiSections'
import { gsap } from 'gsap'
import {
  applyDock,
  applyTilt,
  createBlinkScheduler,
  createCuriousTimeline,
  createExcitedTimeline,
  createCinematicFlight,
  createInspectTimeline,
  createNodTimeline,
  createFlight,
  createIntroTimeline,
  createPointTimeline,
  createRecoilTimeline,
  createSettleTimeline,
  createStretchTimeline,
  createTinyShakeTimeline,
  createWaveTimeline,
  createWobbleTimeline,
  lookTiltAngle,
  playHide,
  playShow,
  resetCinematic,
  resetLayer,
  setInitialPose,
  type OrbiFlightHandle,
  type OrbiMotionOptions,
} from './orbiAnimations'
import {
  holdsEyes,
  ORBI_ASK_FEELING,
  ORBI_ASK_PRESENCE,
  isLookAnimation,
  isRestingAnimation,
  ORBI_ART,
  ORBI_CINEMATIC,
  ORBI_CLICK_MESSAGES,
  ORBI_AUDIO,
  ORBI_AUDIO_TOGGLE,
  ORBI_COOLDOWNS,
  ORBI_DISCOVERY,
  ORBI_EASTER_EGGS,
  ORBI_EMOTION,
  ORBI_EASTER_SPECS,
  ORBI_INITIAL_STATE,
  ORBI_INTERACTION,
  ORBI_INTRO,
  ORBI_MEDIA,
  ORBI_MESSAGES,
  ORBI_MICRO,
  ORBI_ENVIRONMENT,
  ORBI_FORM,
  ORBI_FORM_MESSAGES,
  ORBI_PLACEMENT,
  ORBI_PRIORITY,
  ORBI_PROGRESS,
  ORBI_PROGRESS_MESSAGES,
  ORBI_SCROLL,
  ORBI_SELECTORS,
  ORBI_SLEEP,
  ORBI_SUCCESS,
  ORBI_TIMING,
  ORBI_VIEWBOX,
  ORBI_Z_INDEX,
  type OrbiAnimation,
  type OrbiBreakpoint,
  type OrbiCinematicType,
  type OrbiEasterEgg,
  type OrbiExpression,
  type OrbiSound,
  type OrbiSayOptions,
  type OrbiSectionBehavior,
  type OrbiState,
  type OrbiStatePatch,
} from './orbiConfig'

/**
 * The development HUD, in its own chunk. `useOrbiDebugEnabled` is false in a
 * production build, so this is never rendered and the chunk is never fetched.
 */
const OrbiDebug = dynamic(() => import('./OrbiDebug'), { ssr: false })

/**
 * Where ORBI enters the page.
 *
 * Measured from the hero's own geometry rather than hardcoded, and only when
 * there is room: on a phone, or with motion reduced, he simply arrives at the
 * dock and greets from there. Never over the headline — the offset puts him in
 * the open space beside it.
 */
function resolveHeroSpot(
  root: HTMLElement | null,
  motion: OrbiMotionOptions,
  breakpoint: OrbiBreakpoint,
): { x: number; y: number } | null {
  if (!root || motion.reducedMotion) return null
  if (breakpoint === 'mobile') return null

  const target = document.querySelector('[data-orbi-cinematic="hero"]')
  if (!target) return null

  const hero = target.getBoundingClientRect()
  const box = root.getBoundingClientRect()
  if (!hero.width || !box.width) return null

  const margin = ORBI_CINEMATIC.edgeMargin
  const gap = ORBI_CINEMATIC.targetGap

  // Beside the content, vertically level with it, clamped inside the viewport.
  let left = hero.right + gap
  if (left + box.width > window.innerWidth - margin) {
    left = hero.left - gap - box.width
  }
  if (left < margin) return null

  const top = Math.min(
    Math.max(hero.top + hero.height / 2 - box.height / 2, margin),
    window.innerHeight - margin - box.height,
  )

  return { x: Math.round(left - box.left), y: Math.round(top - box.top) }
}

/**
 * Which section earns which cinematic. Sections declare the *target* with
 * `data-orbi-cinematic`; this is the only place that says when to go.
 */
/** What pulled ORBI out of a sleep. Debug HUD only. */
type OrbiWakeSource = 'activity' | 'click' | 'head' | 'hover' | 'return'

/**
 * Which hidden reactions have a voice. Phase 8 decides when they fire; this
 * only says what — if anything — is heard when they do.
 */
const EASTER_SOUNDS: Partial<Record<OrbiEasterEgg, OrbiSound>> = {
  dizzyClick: 'dizzy',
  cursorCircle: 'dizzy',
  deepWake: 'wake',
  headTap: 'acknowledge',
  footerSecret: 'happy',
}

const SECTION_CINEMATICS: Record<string, OrbiCinematicType | undefined> = {
  precision: 'precision',
  work: 'projects',
}

/** Where each sustained look orientation points the pupils. */
const LOOK_GAZE: Partial<Record<OrbiAnimation, { x: number; y: number }>> = {
  'look-left': { x: -1, y: 0 },
  'look-right': { x: 1, y: 0 },
  'look-up': { x: 0, y: -1 },
  'look-down': { x: 0, y: 1 },
}

/**
 * ORBI — the website companion.
 *
 * The only component the rest of the site mounts. It owns the state machine,
 * drives the GSAP timelines from `orbiAnimations`, arbitrates who is allowed
 * to move ORBI at any moment, and publishes an imperative controller on
 * context.
 *
 *   <OrbiGuide />                         // drop-in, bottom-right
 *   <OrbiGuide>{pageContent}</OrbiGuide>  // + `useOrbi()` available inside
 *
 * Two rules hold the whole thing together:
 *
 *  1. **One transform per layer.** root (enter/hide) → dock (footer perch) →
 *     tilt (look orientation) → gesture (hop/recoil) → floater (idle bob) →
 *     arms. No two behaviours ever write the same property, so timelines
 *     cannot corrupt each other and nothing accumulates. Nothing scales, so
 *     ORBI keeps a constant size and stays crisp.
 *
 *  2. **One priority claim.** Every request goes through the arbiter, so a
 *     scroll glance can never cut a section gesture short, and the entrance
 *     outranks everything.
 *
 * Phase 3 adds personality on top without disturbing either. The eyes move
 * through `orbiGaze` — imperatively, outside React — so tracking the cursor
 * costs no renders; the body tilt has exactly one writer that sums every
 * contribution; and every new reaction claims priority like any other.
 */
export default function OrbiGuide({ children }: { children?: ReactNode }) {
  const [state, setState] = useState<OrbiState>(ORBI_INITIAL_STATE)
  /** Eyes are dark until the entrance timeline switches them on. */
  const [awake, setAwake] = useState(false)
  /** True once the greeting sequence has handed over to the idle loop. */
  const [settled, setSettled] = useState(false)
  /** Which section owns the middle of the viewport. */
  const [activeSection, setActiveSection] = useState<string | null>(null)
  const [scrollDirection, setScrollDirection] =
    useState<OrbiScrollDirection>(null)
  /** `edge` is the footer perch. */
  const [station, setStation] = useState<'home' | 'edge'>('home')
  /** Lifted eye glow for the excited beat. */
  const [bright, setBright] = useState(false)
  /** How close the pointer is. Only ever set on a threshold crossing. */
  const [proximity, setProximity] = useState<OrbiProximity>('far')
  /** 0 awake, 1 drowsy, 2 eyes closed. */
  const [drowsiness, setDrowsiness] = useState<OrbiDrowsiness>(0)
  /** Which slot leads the eyes during the current gesture. */
  const [gazeLead, setGazeLead] = useState<'gesture' | 'interaction'>('gesture')
  /** False while the tab is in the background. */
  const [tabVisible, setTabVisible] = useState(true)
  /** Which line of the post-success run is showing; −1 when not running. */
  const [successStep, setSuccessStep] = useState(-1)
  const [successRun, setSuccessRun] = useState(0)

  const reducedMotion = useReducedMotion()
  const breakpoint = useOrbiBreakpoint()
  const finePointer = useFinePointer()
  const debugEnabled = useOrbiDebugEnabled()
  /** `?orbi-freeze=1` — hold still for deterministic screenshots. Dev only. */
  const frozen = useOrbiFrozen()
  const devCinematic = useOrbiCinematicRequest()
  const devEaster = useOrbiEasterRequest()
  const devAudio = useOrbiAudioDebug()
  const devSleep = useOrbiSleepRequest()
  const { tools: devGuideTools, target: devGuideTarget } = useOrbiGuideRequest()
  const placement = ORBI_PLACEMENT[breakpoint]
  /** Mobile keeps the eyes and drops the body movement. */
  const quietBody = breakpoint === 'mobile'

  const [arbiter] = useState(createOrbiArbiter)
  const [registry] = useState(
    () =>
      new Map<string, OrbiSectionBehavior>(
        ORBI_SECTION_BEHAVIORS.map((b) => [b.id, b]),
      ),
  )
  const [sectionIds, setSectionIds] = useState<string[]>(() =>
    ORBI_SECTION_BEHAVIORS.map((b) => b.id),
  )

  /* One ref per transform layer — see rule 1 above. */
  const rootRef = useRef<HTMLDivElement>(null)
  const dockRef = useRef<HTMLDivElement>(null)
  const tiltRef = useRef<HTMLDivElement>(null)
  const gestureRef = useRef<HTMLDivElement>(null)
  const floaterRef = useRef<HTMLDivElement>(null)
  const armRef = useRef<SVGGElement>(null)
  const leftArmRef = useRef<SVGGElement>(null)
  /** The pupil group. `orbiGaze` owns its transform; React never sets one. */
  const gazeElementRef = useRef<SVGGElement>(null)
  const gazeRef = useRef<OrbiGazeController | null>(null)

  const motion: OrbiMotionOptions = useMemo(
    () => ({ reducedMotion, size: placement.size }),
    [reducedMotion, placement.size],
  )

  /** Mirrors for callbacks that must read current values without re-binding. */
  const stateRef = useRef(state)
  const motionRef = useRef(motion)
  const settledRef = useRef(settled)
  const breakpointRef = useRef(breakpoint)
  const quietBodyRef = useRef(quietBody)
  const drowsinessRef = useRef<OrbiDrowsiness>(drowsiness)
  const stationRef = useRef(station)
  const hoveringRef = useRef(false)
  /** Last cursor direction, so a hover lean does not need a fresh event. */
  const cursorGazeRef = useRef({ x: 0, y: 0 })
  /** Newest thing ORBI reacted to. Debug HUD only. */
  const lastEventRef = useRef('—')
  const navOpenRef = useRef(false)
  /**
   * The Ask ORBI panel is up. Declared here with the other mirrors because
   * every eligibility check in the file reads it, and they are all written
   * long before the panel's own state exists.
   */
  const askOpenRef = useRef(false)
  /** Which side of ORBI's box the sound control is on. */
  const toggleSideRef = useRef<'left' | 'right'>('left')
  /** What last woke ORBI up. Debug HUD only. */
  const wakeSourceRef = useRef<OrbiWakeSource | '—'>('—')
  const frozenRef = useRef(false)
  /** Where the entrance parks ORBI before he flies to the dock. */
  const heroSpotRef = useRef<{ x: number; y: number } | null>(null)
  /** When the current bubble went up, so a fresh line is never cut short. */
  const messageAtRef = useRef(0)
  /**
   * Invalidates pending "relax the face" timers. Bumped whenever something
   * newer takes over the expression, so an older timer becomes a no-op.
   */
  const expressionTokenRef = useRef(0)
  /** `data-orbi-field` of the focused control, for callbacks that need it. */
  const formFieldRef = useRef<string | null>(null)

  // Synced from an effect, not during render, and declared ahead of every
  // effect that reads them so the mirrors are current by the time they run.
  useEffect(() => {
    stateRef.current = state
    motionRef.current = motion
    settledRef.current = settled
    breakpointRef.current = breakpoint
    quietBodyRef.current = quietBody
    drowsinessRef.current = drowsiness
    stationRef.current = station
    frozenRef.current = frozen
  })

  /* ── Timers ──────────────────────────────────────────────────────────── */
  // Every deferred callback goes through `later` so unmount can cancel the lot.

  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())

  const later = useCallback((fn: () => void, ms: number) => {
    const timers = timersRef.current
    const id = setTimeout(() => {
      timers.delete(id)
      fn()
    }, ms)
    timers.add(id)
  }, [])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
    }
  }, [])

  /* ── State application (no arbitration) ──────────────────────────────── */
  // Used by the entrance and by anything that has already won its claim.

  /** How long the *current* message stays up. */
  const holdRef = useRef<number>(ORBI_TIMING.messageHoldMs)

  const applyPatch = useCallback((patch: OrbiStatePatch) => {
    setState((s) => ({
      ...s,
      ...patch,
      // A fresh, non-empty message always re-pops the bubble.
      messageId: patch.message ? s.messageId + 1 : s.messageId,
    }))
  }, [])

  const applySay = useCallback(
    (message: string, options: OrbiSayOptions = {}) => {
      holdRef.current = options.holdMs ?? ORBI_TIMING.messageHoldMs
      setState((s) => ({
        ...s,
        expression: options.expression ?? s.expression,
        animation: options.animation ?? s.animation,
        message,
        messageId: s.messageId + 1,
      }))
    },
    [],
  )

  /* ── Environment sensing ─────────────────────────────────────────────── */
  const probeRef = useRef<HTMLDivElement>(null)

  const bubbleSize = useMemo(
    () => ({
      width: placement.speechMaxWidth,
      height: placement.speechFontSize * 3.2,
    }),
    [placement.speechMaxWidth, placement.speechFontSize],
  )

  const dockMargin = useMemo(
    () => ({ x: placement.right, y: placement.bottom }),
    [placement.right, placement.bottom],
  )

  const form = useOrbiForm({ enabled: settled, rootRef })

  const environment = useOrbiEnvironment({
    enabled: settled,
    rootRef,
    probeRef,
    bubbleSize,
    margin: dockMargin,
    // Sit beside the form only while it is actually being used, and only
    // where there is room to.
    companionRect: form.companion ? form.rect : null,
    mobile: quietBody,
  })

  /** The dedicated travel layer — cinematic movement and nothing else. */
  const travelRef = useRef<HTMLDivElement>(null)
  /**
   * ORBI's own small UI — currently just the sound control.
   *
   * Deliberately *outside* the travel layer: the control follows him from dock
   * to dock, but it does not fly across the page with a cinematic, bob with the
   * idle flight, or slide off to the footer perch with him. A control that
   * moves while you are reaching for it is not a control (§42).
   */
  const chromeRef = useRef<HTMLDivElement>(null)
  /**
   * Mirror of the cinematic controller. Declared here, ahead of every effect
   * that reaches for it — several of them cancel a flight and run before the
   * controller itself is created.
   */
  const cinematicRef = useRef<OrbiCinematicApi | null>(null)
  /** Same again for the hidden reactions: several handlers cancel one. */
  const easterRef = useRef<OrbiEasterApi | null>(null)
  /**
   * ...and for guide mode, which several handlers above it stand down: a
   * modal, the navigation menu, the contact form, a backgrounded tab.
   */
  const guideRef = useRef<OrbiGuideApi | null>(null)
  /**
   * How far ORBI leans out of, or into, the viewport beyond his ordinary
   * perch — the footer secret, the edge peek, and backing off from a cursor
   * that comes at him. Percent of his own width; summed into the one dock
   * tween so the layer still has a single writer.
   */
  const peekPercentRef = useRef(0)

  /** Mirror, so callbacks can read the environment without re-binding. */
  const environmentRef = useRef(environment)
  useEffect(() => {
    environmentRef.current = environment
  })

  /** True while the visitor is working in the form. Read from callbacks. */
  const companionRef = useRef(false)
  useEffect(() => {
    // Someone filling in a form is doing something more important than
    // watching ORBI fly somewhere.
    if (form.companion) {
      cinematicRef.current?.cancel('form-companion')
      // Someone completing a form is doing something; ORBI stops playing.
      easterRef.current?.cancel('form-companion')
    }
    companionRef.current = form.companion
    formFieldRef.current = form.field
    // A section reaction schedules a revert to `normal`. Once the visitor is
    // in the form, that timer would land on top of the companion's face, so
    // invalidate it — the token guard makes the stale timer a no-op.
    if (form.companion) expressionTokenRef.current += 1
  }, [form.companion, form.field])


  /* ── Cinematic movement ──────────────────────────────────────────────── */

  const cinematicClaim = useCallback(
    (owner: string, durationMs: number) =>
      arbiter.claim(ORBI_PRIORITY.cinematic, owner, durationMs),
    [arbiter],
  )
  const cinematicRelease = useCallback(
    (owner: string) => arbiter.release(owner),
    [arbiter],
  )

  /**
   * Whether ORBI is free to go anywhere at all. Safety and the visitor's own
   * business come first: a modal, an open menu, or someone filling in the
   * contact form all mean he stays exactly where he is.
   */
  const canRunCinematic = useCallback(() => {
    if (companionRef.current) return false
    if (environmentRef.current?.modal) return false
    if (environmentRef.current?.crowded) return false
    if (navOpenRef.current) return false
    if (askOpenRef.current) return false
    if (frozenRef.current) return false
    if (drowsinessRef.current !== 0) return false

    // A sustained look orientation is a resting pose, not a gesture — and it
    // is exactly what a section reaction leaves behind, so refusing it here
    // would mean the cinematic could never follow its own section.
    const animation = stateRef.current.animation
    if (!isRestingAnimation(animation) && !isLookAnimation(animation)) return false

    // A line still being read gets to finish. An older one is stale and gets
    // cleared when he leaves (see the `out` beat) — travel stays wordless.
    if (
      stateRef.current.message &&
      performance.now() - messageAtRef.current < ORBI_CINEMATIC.messageGraceMs
    ) {
      return false
    }

    return arbiter.level() <= ORBI_PRIORITY.section
  }, [arbiter])

  const readEnvironment = useCallback(
    () => environmentRef.current?.read() ?? null,
    [],
  )

  const handleLanded = useCallback((reason: string) => {
    environmentRef.current?.refresh(reason)
  }, [])

  const cinematic = useOrbiCinematic({
    enabled: settled && !frozen,
    travelRef,
    rootRef,
    motion,
    breakpoint,
    readEnvironment,
    canRun: canRunCinematic,
    claim: cinematicClaim,
    release: cinematicRelease,
    onLanded: handleLanded,
  })

  useEffect(() => {
    cinematicRef.current = cinematic
  })

  /* ── Sound ───────────────────────────────────────────────────────────── */
  // Nothing here is created on load: `useOrbiAudio` builds an AudioContext only
  // once the visitor has asked for one inside a real gesture. Every call below
  // is a no-op while ORBI is muted, which is how he ships.

  const audio = useOrbiAudio({ hud: debugEnabled })
  const audioRef = useRef<OrbiAudioApi | null>(null)
  useEffect(() => {
    audioRef.current = audio
  })

  /** Sound is an accompaniment, never a channel of its own. */
  const cue = useCallback((sound: OrbiSound) => {
    audioRef.current?.play(sound)
  }, [])

  /* ── Hidden reactions ────────────────────────────────────────────────── */

  /**
   * The form lifecycle, mirrored for `canRunEaster` — declared here rather
   * than reusing `formStatusRef`, which is written further down the file than
   * this hook is called.
   */
  const formBusyRef = useRef(false)
  useEffect(() => {
    formBusyRef.current = form.status !== 'idle'
  }, [form.status])

  /**
   * Whether ORBI is free to do something for his own amusement.
   *
   * The list is long because that is the point: a hidden reaction is the least
   * important thing on the page, so it stands down for the form, for a modal,
   * for the menu, for a cinematic, for an urgent relocation, and for anything
   * the visitor explicitly asked for. `easterEgg` sits above a section beat, so
   * finding something does get to finish over an ambient gesture.
   */
  const canRunEaster = useCallback(
    (type: OrbiEasterEgg) => {
      if (!settledRef.current) return false
      if (frozenRef.current) return false
      // Nobody is watching. A reaction performed to a background tab is work
      // for no one — and worse, it spends its own cooldown, so the visitor is
      // *less* likely to see one when they come back.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return false
      }
      if (companionRef.current) return false
      if (formBusyRef.current) return false
      if (cinematicRef.current?.active) return false
      if (environmentRef.current?.modal) return false
      if (environmentRef.current?.crowded) return false
      if (navOpenRef.current) return false
      // Someone typing a question is the most deliberate thing a visitor ever
      // does with ORBI. Nothing he does for his own amusement outranks it.
      if (askOpenRef.current) return false
      // Guide mode is the one thing ORBI does because he was *asked* to, and
      // the open panel is the visitor deciding where to go. He stands still
      // and waits — the claim only covers the beats, not the wait (§14).
      if (guideRef.current?.open) return false

      // The visitor poking ORBI is the trigger for these two, so they are held
      // to different rules: they may cut across his own click reaction, and
      // they may interrupt the line that reaction just put up.
      const touch = type === 'dizzyClick' || type === 'headTap'

      // Nothing wakes him but waking up.
      if (drowsinessRef.current >= 2 && type !== 'deepWake') return false

      if (!touch) {
        // A line still being read is not interrupted for a joke, and neither
        // is a gesture — a held look orientation is a resting pose, not one.
        if (stateRef.current.message) return false
        const animation = stateRef.current.animation
        if (!isRestingAnimation(animation) && !isLookAnimation(animation)) {
          return false
        }
      }

      const held = arbiter.current()
      const inherited = touch && held?.owner === 'click'
      const level = inherited ? ORBI_PRIORITY.idle : arbiter.level()
      return level <= ORBI_PRIORITY.easterEgg
    },
    [arbiter],
  )

  const easterClaim = useCallback(
    (owner: string, durationMs: number, takeOver?: string) => {
      // The repeated-click beat succeeds the click that triggered it, so it is
      // allowed to inherit that claim rather than be refused by it.
      if (takeOver) arbiter.release(takeOver)
      return arbiter.claim(ORBI_PRIORITY.easterEgg, owner, durationMs)
    },
    [arbiter],
  )

  const easterRelease = useCallback(
    (owner: string) => arbiter.release(owner),
    [arbiter],
  )

  const easter = useOrbiEasterEggs({
    enabled: settled && !frozen,
    rootRef,
    breakpoint,
    reducedMotion,
    finePointer,
    hud: debugEnabled,
    canRun: canRunEaster,
    claim: easterClaim,
    release: easterRelease,
  })

  useEffect(() => {
    easterRef.current = easter
  })

  /* ── Controller (arbitrated) ─────────────────────────────────────────── */

  const setOrbiState = useCallback(
    (patch: OrbiStatePatch) => {
      if (
        !arbiter.claim(
          ORBI_PRIORITY.interaction,
          'interaction',
          ORBI_TIMING.interactionClaimMs,
        )
      ) {
        return
      }
      applyPatch(patch)
    },
    [arbiter, applyPatch],
  )

  const say = useCallback(
    (message: string, options: OrbiSayOptions = {}) => {
      const hold = options.holdMs ?? ORBI_TIMING.messageHoldMs
      if (!arbiter.claim(ORBI_PRIORITY.interaction, 'interaction', hold)) return
      applySay(message, options)
    },
    [arbiter, applySay],
  )

  const clearMessage = useCallback(
    () => setState((s) => ({ ...s, message: null })),
    [],
  )

  const setAnimation = useCallback(
    (animation: OrbiAnimation) => setOrbiState({ animation }),
    [setOrbiState],
  )
  const hide = useCallback(() => setAnimation('hide'), [setAnimation])
  const peek = useCallback(() => setAnimation('peek'), [setAnimation])
  const show = useCallback(() => setAnimation('idle'), [setAnimation])

  const registerSection = useCallback(
    (behavior: OrbiSectionBehavior) => {
      registry.set(behavior.id, behavior)
      setSectionIds((ids) =>
        ids.includes(behavior.id) ? ids : [...ids, behavior.id],
      )
      return () => {
        registry.delete(behavior.id)
        setSectionIds((ids) => ids.filter((id) => id !== behavior.id))
      }
    },
    [registry],
  )

  const controller = useMemo(
    () => ({
      state,
      activeSection,
      scrollDirection,
      dock: environment.dock,
      refreshEnvironment: environment.refresh,
      setOrbiState,
      say,
      clearMessage,
      hide,
      peek,
      show,
      registerSection,
    }),
    [
      state,
      activeSection,
      scrollDirection,
      environment.dock,
      environment.refresh,
      setOrbiState,
      say,
      clearMessage,
      hide,
      peek,
      show,
      registerSection,
    ],
  )

  /* ── Blinking ────────────────────────────────────────────────────────── */

  const preBlinkRef = useRef<OrbiExpression>('normal')
  const blinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const blink = useCallback(() => {
    const { expression: current, animation } = stateRef.current
    // Something else already owns the eyelids: blinking over a startle, a
    // sleepy droop, or a curious hold would fight it and read as a glitch.
    if (holdsEyes(current)) return
    if (drowsinessRef.current > 0) return
    if (animation === 'curious') return
    preBlinkRef.current = current
    setState((s) => ({ ...s, expression: 'blink' }))

    if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
    blinkTimerRef.current = setTimeout(() => {
      setState((s) =>
        s.expression === 'blink'
          ? { ...s, expression: preBlinkRef.current }
          : s,
      )
    }, ORBI_TIMING.blinkCloseMs)
  }, [])

  useEffect(
    () => () => {
      if (blinkTimerRef.current) clearTimeout(blinkTimerRef.current)
    },
    [],
  )

  /* ── One-shot resolution ─────────────────────────────────────────────── */
  // Every one-shot hands the body back to a rest state. `restAnimationRef` is
  // how the caller says where to land — a section can point and then keep
  // facing the cards, and the startled recoil returns to whatever pose it
  // interrupted.

  const restAnimationRef = useRef<OrbiAnimation | null>(null)

  const oneShotDone = useCallback(
    (animation: OrbiAnimation) => () => {
      // The entrance wave is the handover point into normal service.
      setSettled(true)
      arbiter.release('entrance')

      const rest = restAnimationRef.current ?? 'idle'
      restAnimationRef.current = null
      setGazeLead('gesture')
      setState((s) => (s.animation === animation ? { ...s, animation: rest } : s))
    },
    [arbiter],
  )

  /* ── First meeting ───────────────────────────────────────────────────── */
  // Phase 16, and deliberately not a system: two hooks on the entrance that
  // was already running, plus one deferred line. There is no controller, no
  // claim of its own and nothing to cancel — the follow-up simply checks, at
  // the moment it would speak, whether ORBI is still exactly where the
  // entrance left him. Anything at all having happened since means it is no
  // longer the right thing to say, and it is dropped rather than queued.

  /** False once the second line has run, or once it can no longer be said. */
  const introLiveRef = useRef(true)

  /**
   * A glance at the page ORBI has just arrived on, then back to the visitor.
   *
   * Desktop only: on a phone he docks in the corner with the hero directly
   * above him, so the movement says nothing and the preferred mobile sequence
   * is the plain one. Uses the `interaction` gaze slot like every other
   * deliberate look — no new source, and the entrance's own wave takes the
   * eyes back a beat later whether or not this ran.
   */
  const glanceAtPage = useCallback(() => {
    if (quietBodyRef.current) return
    const gaze = gazeRef.current
    const root = rootRef.current
    const hero = document.querySelector('[data-orbi-cinematic="hero"]')
    if (!gaze || !root || !hero) return

    const from = root.getBoundingClientRect()
    const to = hero.getBoundingClientRect()
    const dx = to.left + to.width / 2 - (from.left + from.width / 2)
    const dy = to.top + to.height / 2 - (from.top + from.height / 2)
    const length = Math.hypot(dx, dy) || 1

    gaze.set('interaction', (dx / length) * 0.8, (dy / length) * 0.5)
    later(() => gaze.clear('interaction'), ORBI_INTRO.heroGlanceMs)
  }, [later])

  /**
   * The second half of the hello, swapped into the panel the first half is
   * still sitting in.
   *
   * Every way the visitor can have taken over is caught by the same question:
   * is ORBI still saying what the entrance told him to say, and is he still
   * free? A section reaction, a poke, guide mode, the form, a cinematic, a
   * modal, the menu, a backgrounded tab — each of them has either replaced the
   * line or taken the claim by the time this runs.
   */
  const introFollowUp = useCallback(() => {
    if (!introLiveRef.current) return
    introLiveRef.current = false

    // The entrance's line is still the one on screen — nothing has spoken over
    // it, and it has not yet expired.
    if (stateRef.current.message !== ORBI_MESSAGES.greeting) return
    if (companionRef.current) return
    if (formBusyRef.current) return
    if (guideRef.current?.open) return
    if (guideRef.current && guideRef.current.phase !== 'closed') return
    if (cinematicRef.current?.active) return
    if (easterRef.current?.active) return
    if (environmentRef.current?.modal) return
    if (navOpenRef.current) return
    if (frozenRef.current) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return
    }
    if (arbiter.level() > ORBI_PRIORITY.ambient) return

    holdRef.current = ORBI_INTRO.secondLineHoldMs
    setState((current) => ({
      ...current,
      expression: 'happy',
      message: ORBI_MESSAGES.introFollowUp,
      messageId: current.messageId + 1,
    }))
  }, [arbiter])

  /* ── Page-load sequence ──────────────────────────────────────────────── */
  // rise → eyes on → blink → wave → "Hi 👋". Claims the top priority for its
  // whole run, so no scroll reaction can cut in.

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    arbiter.claim(
      ORBI_PRIORITY.entrance,
      'entrance',
      ORBI_TIMING.entranceClaimMs,
    )

    /**
     * Read the motion preference *now*, not from the mirror.
     *
     * `useReducedMotion` goes through `useSyncExternalStore`, which serves the
     * server snapshot (`false`) for the hydration render — and this effect runs
     * on that commit, before the correction lands. Trusting the mirror here
     * means the entrance plays its full-travel version for someone who asked
     * for reduced motion, exactly once, on the one occasion it matters most.
     */
    const live: OrbiMotionOptions = {
      ...motionRef.current,
      reducedMotion: window.matchMedia(ORBI_MEDIA.reducedMotion).matches,
    }

    setInitialPose(root, live)

    // Park the travel layer beside the hero before ORBI is visible, so the
    // existing rise lands him *in the composition* rather than on the dock.
    // He flies home once the greeting has played (see the effect below).
    heroSpotRef.current = resolveHeroSpot(root, live, breakpointRef.current)
    if (heroSpotRef.current && travelRef.current) {
      gsap.set(travelRef.current, heroSpotRef.current)
    }

    const tl = createIntroTimeline(
      root,
      {
        onEyesOn: () => {
          setAwake(true)
          // Phase 16: the first thing ORBI does with his eyes open is look at
          // the page, not at the visitor.
          glanceAtPage()
        },
        onBlink: blink,
        onWave: () =>
          setState((s) => ({ ...s, expression: 'happy', animation: 'wave' })),
        onGreet: () => {
          // Held a little past the swap, so the panel can never close in the
          // gap between the two lines.
          applySay(ORBI_MESSAGES.greeting, {
            holdMs: ORBI_INTRO.firstLineMs + 400,
          })
          later(introFollowUp, ORBI_INTRO.firstLineMs)
        },
      },
      live,
    )

    return () => {
      tl.kill()
    }
  }, [arbiter, blink, applySay, glanceAtPage, introFollowUp, later])

  /**
   * Fly home from the hero once the greeting has run — the last beat of the
   * entrance, and the only cinematic that is part of it.
   */
  useEffect(() => {
    if (!settled) return
    const spot = heroSpotRef.current
    const travel = travelRef.current
    if (!spot || !travel) return
    heroSpotRef.current = null

    const tl = createCinematicFlight(travel, {
      from: spot,
      to: { x: 0, y: 0 },
      arc: ORBI_CINEMATIC.returnStyles[0],
      durationMs: breakpointRef.current === 'tablet'
        ? Math.round(ORBI_CINEMATIC.shortMs * ORBI_CINEMATIC.tabletScale)
        : ORBI_CINEMATIC.shortMs,
      lean: ORBI_CINEMATIC.leanDeg,
      onComplete: () => {
        lastEventRef.current = 'hero-landed'
        environmentRef.current?.refresh('cinematic-land')
      },
    })
    return () => {
      tl.kill()
      resetCinematic(travel)
    }
  }, [settled])

  /* ── Message lifetime ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!state.message) return
    messageAtRef.current = performance.now()
    const id = state.messageId
    const timer = setTimeout(() => {
      setState((s) => {
        if (s.messageId !== id) return s
        // Normally ORBI drops the smile with the bubble. Not while a form
        // field has focus — the companion owns the face there, and an
        // unrelated bubble expiring must not wipe it.
        const relax =
          s.expression === 'happy' && formFieldRef.current === null
        return { ...s, message: null, expression: relax ? 'normal' : s.expression }
      })
    }, holdRef.current)
    return () => clearTimeout(timer)
  }, [state.message, state.messageId])

  /* ── Section reactions ───────────────────────────────────────────────── */

  const lastSectionRef = useRef<string | null>(null)
  const sectionFiredRef = useRef(new Map<string, number>())
  const spokenRef = useRef(new Map<string, number>())

  /**
   * A section taking the middle of the viewport — or, when `force` is set, a
   * destination the visitor explicitly asked guide mode to take them to.
   *
   * Forcing skips exactly three guards, and only those: the "same section as
   * last time" memo, the re-fire cooldown, and the "don't talk over a live
   * bubble" check. All three exist to stop ORBI reacting to scrolling he was
   * not asked about; none of them should be able to swallow the one reaction
   * someone pressed a button for. Guide mode clears its own acknowledgement in
   * the same tick, so the bubble it is stepping over is always its own.
   */
  const handleSection = useCallback(
    (id: string, force = false) => {
      // Boundary jitter must not re-fire: only a genuine change of section
      // counts, and even then not twice inside the cooldown.
      if (id === lastSectionRef.current && !force) return
      lastSectionRef.current = id
      setActiveSection(id)

      const behavior = registry.get(id)
      if (!behavior) return

      const now = performance.now()
      const firedAt = sectionFiredRef.current.get(id)
      if (
        !force &&
        firedAt !== undefined &&
        now - firedAt < ORBI_COOLDOWNS.sectionReaction
      ) {
        return
      }

      // Contact's greeting must not interrupt someone already typing in it.
      if (companionRef.current) return

      const animation = resolveSectionAnimation(behavior, {
        breakpoint: breakpointRef.current,
        reducedMotion: motionRef.current.reducedMotion,
      })

      if (
        !arbiter.claim(
          ORBI_PRIORITY.section,
          `section:${id}`,
          sectionClaimMs(behavior, ORBI_TIMING.messageHoldMs),
        )
      ) {
        return
      }
      sectionFiredRef.current.set(id, now)
      setGazeLead('gesture')
      restAnimationRef.current = behavior.restAnimation ?? null

      // One bubble at a time, and never the same line twice in quick
      // succession — a hovering scroll position must not chatter.
      const message = behavior.message
      const spokenAt = message ? spokenRef.current.get(message) : undefined
      const speak =
        !!message &&
        (force || !stateRef.current.message) &&
        (spokenAt === undefined ||
          now - spokenAt >= ORBI_COOLDOWNS.sectionMessage)

      if (speak && message) {
        spokenRef.current.set(message, now)
        holdRef.current = behavior.messageDuration ?? ORBI_TIMING.messageHoldMs
      }

      setState((s) => ({
        ...s,
        expression: behavior.expression ?? s.expression,
        animation: animation ?? s.animation,
        message: speak && message ? message : s.message,
        messageId: speak ? s.messageId + 1 : s.messageId,
      }))

      if (animation === 'excited') {
        setBright(true)
        later(() => setBright(false), ORBI_TIMING.brightHoldMs)
      }

      // Relax the face again afterwards; the token guards against an older
      // section's timer landing on a newer expression.
      // A section with a registered cinematic target may earn a trip; the
      // controller refuses on its own if now is a bad time. Asked twice: the
      // section's own gesture is often still playing on the first attempt, and
      // the controller refuses while anything is mid-move.
      const cinematicFor = SECTION_CINEMATICS[id]
      if (cinematicFor) {
        later(() => {
          if (cinematicRef.current?.request(cinematicFor)) return
          later(
            () => cinematicRef.current?.request(cinematicFor),
            ORBI_CINEMATIC.requestRetryMs,
          )
        }, ORBI_CINEMATIC.requestDelayMs)
      }

      if (behavior.expression) {
        const token = ++expressionTokenRef.current
        const hold =
          behavior.expressionDuration ?? behavior.messageDuration ?? 2400
        later(() => {
          if (token !== expressionTokenRef.current) return
          setState((s) =>
            s.expression === behavior.expression
              ? { ...s, expression: 'normal' }
              : s,
          )
        }, hold)
      }
    },
    [arbiter, later, registry],
  )

  /* ── Fast scroll ─────────────────────────────────────────────────────── */

  const lastStartleRef = useRef(-Infinity)

  const handleFastScroll = useCallback(() => {
    if (!settledRef.current) return

    const now = performance.now()
    if (now - lastStartleRef.current < ORBI_COOLDOWNS.fastScroll) return

    if (
      !arbiter.claim(
        ORBI_PRIORITY.fastScroll,
        'fast-scroll',
        ORBI_TIMING.surpriseHoldMs + 400,
      )
    ) {
      return
    }
    lastStartleRef.current = now

    // Come back to whatever pose was interrupted, not a generic idle.
    const previous = stateRef.current
    restAnimationRef.current =
      isRestingAnimation(previous.animation) ||
      isLookAnimation(previous.animation)
        ? previous.animation
        : 'idle'
    const restore =
      previous.expression === 'surprised' ? 'normal' : previous.expression

    applyPatch({ expression: 'surprised', animation: 'surprised' })
    later(() => {
      setState((s) =>
        s.expression === 'surprised' ? { ...s, expression: restore } : s,
      )
    }, ORBI_TIMING.surpriseHoldMs)
  }, [arbiter, applyPatch, later])

  /* ── Footer ──────────────────────────────────────────────────────────── */

  const handleFooter = useCallback((inFooter: boolean) => {
    setStation(inFooter ? 'edge' : 'home')
    // Staying at the very bottom for a few seconds earns the footer secret;
    // passing through on the way back up does not.
    easterRef.current?.setFooter(inFooter)
    if (!inFooter) return
    // Re-arm the section memo so Contact greets again on the way back up.
    lastSectionRef.current = null
    // Face front on the perch: a leftover section orientation would leave ORBI
    // staring off the side of the screen. A live gesture is left alone.
    restAnimationRef.current = null
    setState((s) =>
      isLookAnimation(s.animation) ? { ...s, animation: 'settle' } : s,
    )
  }, [])

  /* ── Gaze ────────────────────────────────────────────────────────────── */
  // The eyes live outside React. `orbiGaze` owns the pupil group's transform,
  // each source writes to its own slot, and the highest-priority occupied slot
  // wins: gesture > interaction > scroll > cursor > neutral. That is what lets
  // the cursor be followed at pointer-event rate without a single render, and
  // what stops it stealing the eyes from a section gesture.

  useEffect(() => {
    const element = gazeElementRef.current
    if (!element) return
    const controller = createGazeController(element, { reducedMotion })
    gazeRef.current = controller
    return () => {
      controller.kill()
      gazeRef.current = null
    }
  }, [reducedMotion])

  // A `look-*` animation aims the eyes; any other gesture holds them centred
  // for its duration, so a scroll glance cannot drag them mid-wave.
  //
  // Except when the gesture exists *because* of something to look at — a
  // curious glance, a point at a hovered CTA. Those are led by the interaction
  // slot instead, and `gazeLead` is set in the same batch as the animation so
  // this effect can never read it a beat late.
  useEffect(() => {
    const gaze = gazeRef.current
    if (!gaze) return

    const animation = state.animation
    const look = LOOK_GAZE[animation as keyof typeof LOOK_GAZE]

    if (look) gaze.set('gesture', look.x, look.y)
    else if (!isRestingAnimation(animation) && gazeLead === 'gesture') {
      gaze.set('gesture', 0, 0)
    } else gaze.clear('gesture')
  }, [state.animation, gazeLead, reducedMotion])

  useEffect(() => {
    const gaze = gazeRef.current
    if (!gaze) return

    if (scrollDirection === 'down') {
      gaze.set('scroll', 0, ORBI_SCROLL.glanceAmount)
    } else if (scrollDirection === 'up') {
      gaze.set('scroll', 0, -ORBI_SCROLL.glanceAmount)
    } else {
      gaze.clear('scroll')
    }
  }, [scrollDirection, reducedMotion])

  /* ── Body tilt ───────────────────────────────────────────────────────── */
  // One writer, always. The section orientation and the small leans toward a
  // cursor or an open menu are summed into a single tween, so two behaviours
  // can never own this rotation at the same time.

  const auxTiltRef = useRef({ hover: 0, nav: 0, discover: 0 })
  /** Set once `useOrbiInteraction` has run; callbacks above reach it through here. */
  const interactionRef = useRef<OrbiInteractionApi | null>(null)

  const applyBodyTilt = useCallback(() => {
    const tilt = tiltRef.current
    if (!tilt) return
    const base = lookTiltAngle(
      stateRef.current.animation,
      motionRef.current,
      quietBodyRef.current,
    )
    const aux = quietBodyRef.current
      ? 0
      : auxTiltRef.current.hover +
        auxTiltRef.current.nav +
        auxTiltRef.current.discover
    applyTilt(tilt, base + aux, motionRef.current)
  }, [])

  /**
   * The two tokens that invalidate a feeling in flight, and the three refs the
   * conversation needs beside them.
   *
   * `noticeTokenRef` guards the gaze-and-face half, `emotionTokenRef` the body
   * lean. Declared this high because everything that bumps them — the dwell
   * lean, `feel`, the Ask lifecycle, the panel closing — sits below.
   */
  const noticeTokenRef = useRef(0)
  const emotionTokenRef = useRef(0)
  /** Invalidates a pending pause beat when the visitor types again. */
  const askPauseTokenRef = useRef(0)
  /** One pause beat per composition. */
  const askPausedRef = useRef(false)
  /** The measured direction of the input, refreshed on an interval, not per key. */
  const askAimRef = useRef<{ x: number; y: number } | null>(null)
  /** When the last listening adjustment happened. */
  const askGlanceRef = useRef(0)
  /**
   * Guards the two conversation steps that are deferred rather than immediate
   * — the send acknowledgement handing over to thinking, and the reading
   * glance after a reaction. Bumped by `endAskPresence`, so closing the panel
   * or sending another question makes both find themselves stale.
   */
  const askPresenceTokenRef = useRef(0)
  /**
   * The face the conversation last applied.
   *
   * Cancelling a reaction by bumping its token also cancels the revert that
   * would have taken the face off — so closing the panel mid-thought used to
   * leave ORBI wearing `thinking`, or a reaction's `happy`, indefinitely.
   * This is the same idea as `softExpressionRef`: a layer only ever takes back
   * an expression it can still see is its own.
   */
  const askFaceRef = useRef<OrbiExpression | null>(null)

  /**
   * Where a part of the Ask panel is, from where ORBI is sitting.
   *
   * The same arithmetic a project card, a CTA and the form companion use, so
   * the eyes stay correct when the panel moves between desktop and mobile —
   * and so there is no second set of hard-coded gaze numbers to go stale.
   * Returns `null` rather than guessing when the element is not on screen.
   */
  const askGazeTo = useCallback((selector: string) => {
    const root = rootRef.current
    if (!root) return null
    return gazeToward(document.querySelector(selector), root.getBoundingClientRect())
  }, [])

  /**
   * Point the eyes somewhere for a moment, and nothing else.
   *
   * `notice` is the same idea with an expression attached; this is the half of
   * it the conversation needs, because the brief is explicit that the reading
   * and listening states use the normal face. It claims like everything else,
   * so guide mode, a cinematic, the companion and a modal all still win, and
   * it is guarded by the same token `notice` uses — one cancellation strategy
   * for the whole file, not two.
   *
   * `holdMs: 0` means hold indefinitely: the caller owns the release. That is
   * what keeps the eyes on the input while someone is typing, so moving the
   * mouse cannot pull them away (the gaze controller ranks `interaction`
   * above `cursor`).
   */
  const glanceAt = useCallback(
    (gaze: { x: number; y: number } | null, holdMs: number, owner: string) => {
      if (!gaze) return false
      if (arbiter.level() > ORBI_PRIORITY.ambient) return false
      if (companionRef.current) return false
      if (drowsinessRef.current !== 0) return false
      if (cinematicRef.current?.active) return false
      if (easterRef.current?.active) return false
      if (guideRef.current?.open) return false
      if (environmentRef.current?.modal) return false
      if (!arbiter.claim(ORBI_PRIORITY.ambient, owner, (holdMs || 30000) + 300)) {
        return false
      }

      const token = ++noticeTokenRef.current
      gazeRef.current?.set('interaction', gaze.x, gaze.y)
      setGazeLead('interaction')
      if (!holdMs) return true

      later(() => {
        if (token !== noticeTokenRef.current) return
        gazeRef.current?.clear('interaction')
        setGazeLead('gesture')
        arbiter.release(owner)
      }, holdMs)
      return true
    },
    [arbiter, later],
  )

  /**
   * Everything the conversation left running, called off.
   *
   * One place, so closing the panel, sending a new question and handing over
   * to guide mode all cancel the same set — a stale reading glance arriving
   * after the visitor has moved on is the whole class of bug this prevents.
   * Bumping the tokens is the cancellation; the claims are `ambient` and lapse
   * on their own, which the arbiter lets an equal level take over anyway.
   */
  const endAskPresence = useCallback(
    (clearGaze: boolean) => {
      noticeTokenRef.current++
      emotionTokenRef.current++
      askPauseTokenRef.current++
      askPresenceTokenRef.current++
      askPausedRef.current = false
      askGlanceRef.current = 0
      askAimRef.current = null
      if (auxTiltRef.current.discover !== 0) {
        auxTiltRef.current.discover = 0
        applyBodyTilt()
      }
      // Never yank the eyes away from something more important than a chat.
      if (!clearGaze) return
      if (arbiter.level() > ORBI_PRIORITY.ambient) return
      // The listening claim is held open for as long as someone is typing, so
      // it is the one thing here that does not lapse by itself. Released by
      // name: `release` is a no-op if somebody else has since taken over.
      arbiter.release('ask:listening')
      gazeRef.current?.clear('interaction')
      setGazeLead('gesture')

      // And put the face back, if it is still the one the conversation left
      // there. The revert that would normally have done this was just
      // invalidated by the token bump above, which is the whole reason this
      // has to happen here rather than being left to a timer.
      const ours = askFaceRef.current
      askFaceRef.current = null
      if (!ours || ours === 'normal') return
      setState((current) =>
        current.expression === ours ? { ...current, expression: 'normal' } : current,
      )
    },
    [applyBodyTilt, arbiter],
  )

  /* ── Personality ─────────────────────────────────────────────────────── */
  // Every reaction below goes through the arbiter and a named cooldown. None of
  // them are allowed to talk over a section beat, and none of them can fire
  // twice in a row just because a pointer wobbled across a boundary.

  const lastClickRef = useRef(-Infinity)
  /** Whether ORBI has been clicked at all this visit. */
  const clickedRef = useRef(false)
  /** How many times, for the rare bashful beat. */
  const clickCountRef = useRef(0)
  const lastHoverGreetRef = useRef(-Infinity)
  const lastCuriousRef = useRef(-Infinity)
  const lastNavRef = useRef(-Infinity)
  const lastCtaRef = useRef(new Map<string, number>())
  const ctaPointRef = useRef(new Map<string, number>())
  const clickMessageRef = useRef(-1)
  const curiousSideRef = useRef<-1 | 1>(-1)
  /** Expressions this layer applied, so it only ever takes back its own. */
  const softExpressionRef = useRef<OrbiExpression | null>(null)

  const note = useCallback((event: string) => {
    lastEventRef.current = event
  }, [])

  /**
   * Apply a light-touch expression — hover, CTA, navigation. These are moods,
   * not gestures: they defer to anything that actually holds the body, and
   * they only ever revert an expression they set themselves.
   */
  const softExpression = useCallback(
    (expression: OrbiExpression | null) => {
      if (expression === null) {
        const previous = softExpressionRef.current
        softExpressionRef.current = null
        if (!previous) return
        setState((s) => (s.expression === previous ? { ...s, expression: 'normal' } : s))
        return
      }
      if (arbiter.level() > ORBI_PRIORITY.ambient) return
      softExpressionRef.current = expression
      setState((s) => ({ ...s, expression }))
    },
    [arbiter],
  )

  /* ── Waking ──────────────────────────────────────────────────────────── */

  const wake = useCallback(
    (startle: boolean, source: OrbiWakeSource = 'activity') => {
      if (drowsinessRef.current === 0) return
      wakeSourceRef.current = source
      const asleep = drowsinessRef.current === 3
      const deep = drowsinessRef.current >= 2
      drowsinessRef.current = 0
      setDrowsiness(0)
      arbiter.release('drowsy')
      note('wake')

      // Being properly asleep is worth waking up from properly: the deep-wake
      // sequence takes it from here, startle and all. If it is refused — busy,
      // or on cooldown — the ordinary wake below still runs.
      if (asleep && startle && easterRef.current?.noteWake()) return

      // Coming out of a proper doze deserves a small flinch; merely drowsy
      // just opens its eyes again.
      if (startle && deep) {
        setState((s) => ({ ...s, expression: 'surprised' }))
        later(() => {
          setState((s) =>
            s.expression === 'surprised' ? { ...s, expression: 'normal' } : s,
          )
        }, ORBI_TIMING.wakeStartleMs)
        return
      }
      setState((s) => (s.expression === 'sleepy' ? { ...s, expression: 'normal' } : s))
    },
    [arbiter, later, note],
  )

  /* ── Click / tap ─────────────────────────────────────────────────────── */

  /**
   * Every activation on ORBI, from anywhere on him.
   *
   * The order below is the whole point. Being poked repeatedly is a *signal*,
   * not a reaction, so the repeated-click detector sees every activation
   * before anything else is allowed to consume it — before the click cooldown,
   * before the priority claim, before the head gesture, and regardless of what
   * ORBI currently owns or is saying. Everything after that line is a
   * reaction, and reactions are allowed to be refused.
   */
  const activateOrbi = useCallback(
    (part: 'body' | 'head') => {
    const now = performance.now()

    // Mid-flight, a poke gets a look and a blink — not a speech bubble and
    // certainly not a wave. Interrupting the trip would strand him between
    // destinations, and it is explicitly not a way to trigger the dizzy beat.
    if (cinematicRef.current?.active) {
      if (now - lastClickRef.current < ORBI_COOLDOWNS.clickMessage) return
      lastClickRef.current = now
      note('click-during-cinematic')
      setBright(true)
      blink()
      later(() => setBright(false), 600)
      return
    }

    // Counted before everything, because *being* rapid is the whole signal:
    // the fifth click in three seconds is a different event from the first,
    // and the reaction to it succeeds the ordinary one rather than stacking.
    if (easterRef.current?.noteClick()) {
      lastClickRef.current = now
      return
    }

    // A tap on the head is its own gesture — but only once the tap has been
    // counted, so a run of taps on ORBI's face still adds up to five.
    if (part === 'head' && easterRef.current?.noteHeadTap()) {
      lastClickRef.current = now
      note('easter:headTap')
      return
    }

    // Already in the middle of a hidden reaction. What happens next depends on
    // whose idea that reaction was: ORBI's own answer to being poked stands —
    // interrupting it with a wave is exactly the competing-reaction problem —
    // while anything he started for his own amusement yields to the visitor,
    // and yields *properly*, so its last beat cannot land on this one's face.
    const running = easterRef.current?.active ? easterRef.current.type : null
    if (running) {
      // Waking up *is* the reaction to being touched while asleep, so it is
      // left alone for the same reason his answer to being poked is: a wave
      // and a line stacked on top would talk over the moment (§17).
      if (ORBI_EASTER_SPECS[running].userTriggered || running === 'deepWake') return
      easterRef.current?.cancel('click')
    }

    if (now - lastClickRef.current < ORBI_COOLDOWNS.clickMessage) return

    // Explicit interaction outranks a section gesture, so poking ORBI
    // mid-wave cleanly replaces it rather than layering on top.
    if (
      !arbiter.claim(
        ORBI_PRIORITY.interaction,
        'click',
        ORBI_TIMING.clickStartleMs + ORBI_TIMING.messageHoldMs,
      )
    ) {
      return
    }
    lastClickRef.current = now
    wake(false, part === 'head' ? 'head' : 'click')
    note('click')

    // The first poke of a visit earns the small delight; after that a poke is
    // an acknowledgement, not an event (§19). Both are throttled by the click
    // cooldown above and again by the cue's own.
    cue(clickedRef.current ? 'acknowledge' : 'happy')
    clickedRef.current = true

    // Phase 23. Every so often, being made a fuss of leaves ORBI a little
    // bashful: eyes down and away, a tilt in the other direction, gone in
    // under a second. Deliberately late — the wave and the line come first,
    // and `feel` refuses if either is still going — and deliberately rare, on
    // a counter rather than a coin toss so it stays reproducible.
    clickCountRef.current += 1
    if (clickCountRef.current % ORBI_EMOTION.shyEveryNthClick === 0) {
      later(() => {
        // Written out here rather than through `feel`, which is defined much
        // further down the file: reaching it would need a mirror ref, and a
        // ref written in an effect that an earlier callback reads is exactly
        // the pattern the compiler rejects. Ten lines of primitives already in
        // scope is the cheaper answer.
        const shy = ORBI_EMOTION.shy
        if (arbiter.level() > ORBI_PRIORITY.ambient) return
        if (stateRef.current.message) return
        if (companionRef.current || drowsinessRef.current !== 0) return
        if (!isRestingAnimation(stateRef.current.animation)) return
        if (!arbiter.claim(ORBI_PRIORITY.ambient, 'emotion:shy', shy.holdMs + 300)) {
          return
        }

        note('emotion:shy')
        gazeRef.current?.set('interaction', shy.gaze.x, shy.gaze.y)
        setGazeLead('interaction')
        // Was `happy`, which is what "bashful" had to be mimed with before a
        // bashful face existed: the lid comes half over, the eyes drop away,
        // and the blush does the rest.
        setState((current) => ({ ...current, expression: 'shy' }))

        // The tilt goes the *other* way to the glance — looking away while
        // leaning away is what reads as bashful rather than as another look
        // at something. Desktop only.
        const lean =
          quietBodyRef.current || motionRef.current.reducedMotion ? 0 : shy.tilt
        if (lean) {
          auxTiltRef.current.discover = lean
          applyBodyTilt()
        }

        later(() => {
          gazeRef.current?.clear('interaction')
          setGazeLead('gesture')
          if (auxTiltRef.current.discover !== 0) {
            auxTiltRef.current.discover = 0
            applyBodyTilt()
          }
          setState((current) =>
            current.expression === 'shy' ? { ...current, expression: 'normal' } : current,
          )
          arbiter.release('emotion:shy')
        }, shy.holdMs)
      }, ORBI_TIMING.clickStartleMs + ORBI_TIMING.messageHoldMs + 500)
    }

    const pool = ORBI_CLICK_MESSAGES
    let index = Math.floor(Math.random() * pool.length)
    if (index === clickMessageRef.current) index = (index + 1) % pool.length
    clickMessageRef.current = index

    softExpressionRef.current = null
    restAnimationRef.current = null
    setGazeLead('gesture')
    // Startled first — ORBI did not expect to be poked — then pleased.
    setState((s) => ({ ...s, expression: 'surprised', animation: 'idle' }))

    later(() => {
      holdRef.current = ORBI_TIMING.messageHoldMs
      setState((s) => ({
        ...s,
        expression: 'happy',
        animation: 'wave',
        message: pool[index],
        messageId: s.messageId + 1,
      }))
    }, ORBI_TIMING.clickStartleMs)
    },
    [applyBodyTilt, arbiter, blink, cue, later, note, wake],
  )

  /** The robot itself. */
  const handleActivate = useCallback(() => activateOrbi('body'), [activateOrbi])
  /**
   * The head region. It stops the event before the robot's own handler sees
   * it, so one tap is still one activation — it just arrives here instead.
   */
  const handleHead = useCallback(() => activateOrbi('head'), [activateOrbi])

  /* ── Hover ───────────────────────────────────────────────────────────── */

  const handleHoverStart = useCallback(() => {
    hoveringRef.current = true
    interactionRef.current?.setHovering(true)
    easterRef.current?.setHovering(true)
    wake(false, 'hover')
    note('hover')
    softExpression('happy')
    if (!quietBodyRef.current) {
      // A single lean toward wherever the cursor came from — not a tween per
      // mouse move.
      auxTiltRef.current.hover =
        cursorGazeRef.current.x * ORBI_INTERACTION.hoverTilt
      applyBodyTilt()
    }
  }, [applyBodyTilt, note, softExpression, wake])

  const handleHoverEnd = useCallback(() => {
    hoveringRef.current = false
    interactionRef.current?.setHovering(false)
    easterRef.current?.setHovering(false)
    softExpression(null)
    auxTiltRef.current.hover = 0
    applyBodyTilt()
  }, [applyBodyTilt, softExpression])

  const handleHoverGreet = useCallback(() => {
    const now = performance.now()
    if (now - lastHoverGreetRef.current < ORBI_COOLDOWNS.hoverGreeting) return
    if (stateRef.current.message) return
    // One personality beat at a time: greeting over a hidden reaction would
    // put a bubble on top of it.
    if (easterRef.current?.active) return
    if (
      !arbiter.claim(
        ORBI_PRIORITY.interaction,
        'hover-greet',
        ORBI_INTERACTION.hoverGreetingHold,
      )
    ) {
      return
    }
    lastHoverGreetRef.current = now
    note('hover-greet')
    holdRef.current = ORBI_INTERACTION.hoverGreetingHold
    setState((s) => ({
      ...s,
      expression: 'happy',
      message: ORBI_MESSAGES.hoverGreeting,
      messageId: s.messageId + 1,
    }))
  }, [arbiter, note])

  /* ── Curious glance ──────────────────────────────────────────────────── */

  const handleQuiet = useCallback(() => {
    // The unprompted beats only fire during a genuinely quiet spell, and this
    // is the sensor saying there is one.
    easterRef.current?.setDepth(1)
    // Too fidgety on a phone, where there is no cursor to explain it.
    if (quietBodyRef.current) return
    // ...and idle curiosity is the wrong mood over someone composing a
    // question, for the same reason it is over someone filling in a form.
    if (askOpenRef.current) return
    // Someone is filling in a form. Idle curiosity is exactly the wrong mood.
    if (companionRef.current) return
    const now = performance.now()
    if (now - lastCuriousRef.current < ORBI_COOLDOWNS.curious) return
    if (stateRef.current.message) return
    if (!isRestingAnimation(stateRef.current.animation)) return
    if (
      !arbiter.claim(
        ORBI_PRIORITY.ambient,
        'curious',
        ORBI_INTERACTION.curiousHold + 1600,
      )
    ) {
      return
    }
    lastCuriousRef.current = now
    note('curious')

    const side: -1 | 1 = Math.random() < 0.5 ? -1 : 1
    curiousSideRef.current = side
    gazeRef.current?.set('interaction', side * 0.85, -0.2)
    setGazeLead('interaction')
    restAnimationRef.current = null
    setState((s) => ({ ...s, expression: 'thinking', animation: 'curious' }))

    later(() => {
      setState((s) =>
        s.expression === 'thinking' ? { ...s, expression: 'normal' } : s,
      )
    }, ORBI_INTERACTION.curiousHold + 900)
  }, [arbiter, later, note])

  /* ── Getting sleepy ──────────────────────────────────────────────────── */

  const handleDrowsy = useCallback(
    (level: 1 | 2 | 3) => {
      easterRef.current?.setDepth(level)
      // A held look orientation is a resting pose, not a gesture — ORBI is
      // allowed to nod off facing left. Requiring `idle` here meant a section
      // that leaves him looking sideways kept him awake indefinitely, which
      // also put deep sleep (and waking from it) out of reach.
      const animation = stateRef.current.animation
      if (!isRestingAnimation(animation) && !isLookAnimation(animation)) return
      // Never nod off while the visitor is mid-form, or mid-question.
      if (companionRef.current) return
      if (askOpenRef.current) return
      if (
        !arbiter.claim(
          ORBI_PRIORITY.ambient,
          'drowsy',
          ORBI_INTERACTION.dozeDelay * 4,
        )
      ) {
        return
      }
      note(level === 3 ? 'asleep' : level === 2 ? 'doze' : 'drowsy')
      // Going properly under is the only ambient moment with a sound, and it
      // is the quietest one there is. Once, never looped (§22).
      if (level === 3) cue('sleep')
      drowsinessRef.current = level
      setDrowsiness(level)
      softExpressionRef.current = null
      setState((s) => ({ ...s, expression: 'sleepy' }))
    },
    [arbiter, cue, note],
  )

  const handleActive = useCallback(() => {
    // Wake first: waking from a proper sleep is its own sequence, and it has
    // to be able to see how deep ORBI was before the counters are cleared.
    wake(true, 'activity')
    easterRef.current?.setDepth(0)
    // A curious glance holds the eyes; the moment the user is back, give them
    // to the cursor.
    //
    // Gated on the arbiter rather than on `state.animation`, because the same
    // pointer event that wakes ORBI may already have started something better
    // — `pointerover` on a CTA runs before `pointermove` — and the mirrored
    // state would still be reporting the glance. Whoever holds the claim is
    // the truth.
    if (arbiter.current()?.owner !== 'curious') return
    gazeRef.current?.clear('interaction')
    setGazeLead('gesture')
    arbiter.release('curious')
  }, [arbiter, wake])

  /* ── Marked CTAs ─────────────────────────────────────────────────────── */

  const handleCta = useCallback(
    (signal: OrbiCtaSignal | null) => {
      const gaze = gazeRef.current

      // Mid-flight — or mid-flourish — the eyes are already spoken for. A CTA
      // drifting past must neither take the `interaction` slot nor clear it on
      // the way out.
      if (cinematicRef.current?.active || easterRef.current?.active) return

      if (!signal) {
        gaze?.clear('interaction')
        setGazeLead('gesture')
        softExpression(null)
        return
      }

      // Following it with the eyes is free, so that always happens — unless
      // ORBI is already attending to a form, which outranks a passing CTA.
      if (companionRef.current) return
      gaze?.set('interaction', signal.gaze.x, signal.gaze.y)

      const now = performance.now()
      const seen = lastCtaRef.current.get(signal.key)
      if (seen !== undefined && now - seen < ORBI_COOLDOWNS.cta) return
      lastCtaRef.current.set(signal.key, now)
      note(`cta:${signal.key}`)

      softExpression('happy')

      if (signal.message && !stateRef.current.message) {
        if (
          arbiter.claim(ORBI_PRIORITY.ambient, 'cta-say', ORBI_TIMING.messageHoldMs)
        ) {
          holdRef.current = ORBI_TIMING.messageHoldMs
          setState((s) => ({
            ...s,
            message: signal.message,
            messageId: s.messageId + 1,
          }))
        }
      }

      // The pointing gesture is the loud option: desktop only, opt-in per CTA,
      // and rationed hard.
      if (!signal.point || quietBodyRef.current || motionRef.current.reducedMotion) {
        return
      }
      const pointed = ctaPointRef.current.get(signal.key)
      if (pointed !== undefined && now - pointed < ORBI_COOLDOWNS.ctaPoint) return
      if (!arbiter.claim(ORBI_PRIORITY.section, `cta:${signal.key}`, 1800)) return

      ctaPointRef.current.set(signal.key, now)
      setGazeLead('interaction')
      restAnimationRef.current = null
      setState((s) => ({
        ...s,
        animation: signal.side === 'left' ? 'point-left' : 'point-right',
      }))
    },
    [arbiter, note, softExpression],
  )

  /* ── Navigation ──────────────────────────────────────────────────────── */

  const handleNav = useCallback(
    (open: boolean) => {
      const gaze = gazeRef.current

      if (!open) {
        navOpenRef.current = false
        gaze?.clear('interaction')
        softExpression(null)
        auxTiltRef.current.nav = 0
        applyBodyTilt()
        return
      }

      navOpenRef.current = true
      // Safety outranks the flourish: an overlay opening ends a cinematic —
      // and any hidden reaction — rather than pausing it. The navigation is
      // also a way of going somewhere, so it takes ownership from guide mode
      // outright rather than racing it.
      cinematicRef.current?.cancel('nav-open')
      easterRef.current?.cancel('nav-open')
      guideRef.current?.close('nav-open')

      // The menu is above ORBI, so it glances up. Mobile gets the eyes and the
      // expression, never the body.
      gaze?.set('interaction', 0, -0.9)

      const now = performance.now()
      if (now - lastNavRef.current < ORBI_COOLDOWNS.nav) return
      lastNavRef.current = now
      note('nav')

      softExpression('thinking')
      if (!quietBodyRef.current) {
        auxTiltRef.current.nav = -ORBI_ART.curiousTilt * 0.7
        applyBodyTilt()
      }
    },
    [applyBodyTilt, note, softExpression],
  )

  /* ── Coming back to the tab ──────────────────────────────────────────── */

  const lastHappyReturnRef = useRef(-Infinity)

  /**
   * Phase 13 — the small hello.
   *
   * Gone a good while and back again earns one wordless beat: the eyes lift,
   * the body rises a few pixels, and the face is pleased for a moment. It runs
   * off the away duration `useOrbiInteraction` already reports from the tab's
   * own `visibilitychange`, so nothing new is watched, timed or remembered.
   *
   * Everything that outranks it refuses it through the arbiter rather than a
   * list of its own — most importantly the deep-wake sequence, which is the
   * *other* answer to the visitor coming back and already says hello properly.
   * Returns whether it took the moment, so the caller knows to leave it alone.
   */
  const happyReturn = useCallback(
    (awayMs: number) => {
      if (awayMs < ORBI_MICRO.happyReturnMs) return false
      if (companionRef.current) return false
      if (frozenRef.current) return false
      if (guideRef.current?.open) return false
      if (cinematicRef.current?.active) return false
      if (stateRef.current.message) return false
      if (!isRestingAnimation(stateRef.current.animation)) return false

      const now = performance.now()
      if (now - lastHappyReturnRef.current < ORBI_MICRO.happyReturnCooldown) {
        return false
      }
      // The deep-wake sequence holds `easter`, which outranks this — so a
      // proper waking simply refuses the claim and keeps the moment.
      if (
        !arbiter.claim(
          ORBI_PRIORITY.ambient,
          'happy-return',
          ORBI_TIMING.brightHoldMs + 400,
        )
      ) {
        return false
      }

      lastHappyReturnRef.current = now
      note('happy-return')
      softExpressionRef.current = null
      restAnimationRef.current = null
      setGazeLead('gesture')
      setBright(true)
      setState((s) => ({
        ...s,
        expression: 'happy',
        // Reduced motion keeps the brighter eyes and the pleased face, and
        // drops the lift — the expression was always the louder half.
        animation: motionRef.current.reducedMotion ? s.animation : 'lift',
      }))

      later(() => {
        setBright(false)
        setState((s) =>
          s.expression === 'happy' ? { ...s, expression: 'normal' } : s,
        )
        arbiter.release('happy-return')
      }, ORBI_TIMING.brightHoldMs)

      return true
    },
    [arbiter, later, note],
  )

  const handleReturn = useCallback(
    (awayMs: number) => {
      if (awayMs < ORBI_INTERACTION.awayWakeMs) return
      note('return')
      // Gone long enough to be missed gets the small hello instead; anything
      // shorter is never the entrance again — just a blink, as if ORBI looked
      // back up.
      if (happyReturn(awayMs)) return
      blink()
    },
    [blink, happyReturn, note],
  )

  /* ── Senses ──────────────────────────────────────────────────────────── */

  const handleGaze = useCallback((x: number, y: number) => {
    cursorGazeRef.current.x = x
    cursorGazeRef.current.y = y
    gazeRef.current?.set('cursor', x, y)
  }, [])

  const handleGazeEnd = useCallback(() => {
    cursorGazeRef.current.x = 0
    cursorGazeRef.current.y = 0
    gazeRef.current?.clear('cursor')
  }, [])

  /* ── Guide mode ──────────────────────────────────────────────────────── */
  // Phase 12. The one thing ORBI does because he was *asked* to.
  //
  // `useOrbiGuideMode` owns the lifecycle; everything here is the beat that
  // belongs to each phase, which is the same division the cinematic and the
  // hidden reactions use. Guide mode never moves ORBI itself: it scrolls the
  // page and then stands aside, so the destination's own section reaction —
  // and, where the cooldowns allow, its own Phase 7 cinematic — is the single
  // travel owner.

  const guideClaim = useCallback(
    (owner: string, durationMs: number) =>
      arbiter.claim(ORBI_PRIORITY.guide, owner, durationMs),
    [arbiter],
  )
  const guideRelease = useCallback(
    (owner: string) => arbiter.release(owner),
    [arbiter],
  )

  /** Walked in order, so two trips in a row are never the same words. */
  const ackIndexRef = useRef(0)
  /** The line guide mode put up — the only one it is ever allowed to take back. */
  const ackRef = useRef<string | null>(null)
  /** The control, so focus can go back to it when the panel closes. */
  const guideButtonRef = useRef<HTMLButtonElement>(null)
  /** One quiet run of pulses, once, until the visitor has used the control. */
  const [guideHinted, setGuideHinted] = useState(false)
  const guideUsedRef = useRef(false)

  /**
   * Opening. ORBI stops what he was doing, wakes if he was under, looks toward
   * where the panel is about to be, and offers it. Returns any extra delay the
   * panel should wait for — the menu must never appear over a robot who still
   * looks asleep.
   */
  const handleGuideOpen = useCallback(() => {
    note('guide:open')
    guideUsedRef.current = true
    setGuideHinted(false)

    // One travel owner: a flourish already in progress is not more important
    // than a request for directions.
    cinematicRef.current?.cancel('guide-open')
    easterRef.current?.cancel('guide-open')

    // Asleep? The existing wake, without the deep-wake sequence — that one is
    // his reaction to being *found* and runs for the best part of two seconds.
    // Someone who pressed a button is owed a menu, not a performance.
    const asleep = drowsinessRef.current > 0
    if (asleep) wake(false, 'click')

    softExpressionRef.current = null
    restAnimationRef.current = null
    // Attentive, and one small presentation gesture. `nod` is the smallest
    // thing ORBI has that reads as "here you are", and it survives both a
    // phone and reduced motion — where a point would be swapped out anyway.
    setState((s) => ({ ...s, expression: 'happy', animation: 'nod', message: null }))

    // ...and he looks at what he is offering. The panel opens on his inward
    // side and upward, which is the side the controls are on.
    const toward = toggleSideRef.current === 'left' ? -0.7 : 0.7
    gazeRef.current?.set('interaction', toward, -0.5)
    setGazeLead('interaction')

    return asleep ? ORBI_GUIDE.wakeDelayMs : 0
  }, [note, wake])

  /**
   * Chosen. One short line — never two, and never at the destination, where
   * the section has its own — and a beat of stillness before the page moves.
   */
  const handleGuideChoose = useCallback(
    (item: OrbiGuideItem) => {
      note(`guide:${item.id}`)
      const lines = ORBI_GUIDE_MESSAGES.acknowledgements
      const line = lines[ackIndexRef.current % lines.length]
      ackIndexRef.current += 1
      ackRef.current = line

      restAnimationRef.current = null
      gazeRef.current?.clear('interaction')
      setGazeLead('gesture')
      holdRef.current = ORBI_GUIDE.ackHoldMs
      setState((s) => ({
        ...s,
        expression: 'happy',
        animation: 'idle',
        message: line,
        messageId: s.messageId + 1,
      }))
    },
    [note],
  )

  /**
   * Arrived. The acknowledgement is spent, the page has moved a long way, and
   * the destination reacts exactly as it always does.
   */
  const handleGuideArrive = useCallback(
    (item: OrbiGuideItem) => {
      note(`guide-arrive:${item.target}`)

      const line = ackRef.current
      ackRef.current = null
      if (line) {
        setState((s) => (s.message === line ? { ...s, message: null } : s))
      }

      // Where ORBI can safely sit moved with the page.
      environmentRef.current?.refresh('guide-arrive')

      // Forced, because the visitor pressed a button for this: the section may
      // already be the active one, or still inside its own cooldown, and
      // neither is a reason to arrive somewhere and do nothing.
      handleSection(item.target, true)
    },
    [handleSection, note],
  )

  /** Ended early. Put back what guide mode put up, and only that. */
  const handleGuideCancel = useCallback(
    (reason: string) => {
      note(`guide-cancel:${reason}`)
      const line = ackRef.current
      ackRef.current = null
      gazeRef.current?.clear('interaction')
      setGazeLead('gesture')
      setState((s) => ({
        ...s,
        message: line && s.message === line ? null : s.message,
        expression: s.expression === 'happy' ? 'normal' : s.expression,
      }))
    },
    [note],
  )

  const guide = useOrbiGuideMode({
    enabled: settled && !frozen,
    breakpoint,
    reducedMotion,
    // The decided dock, in viewport coordinates — which is exactly where the
    // chrome layer the panel lives in ends up.
    orbiRect: environment.rect,
    dock: environment.dock,
    readEnvironment,
    claim: guideClaim,
    release: guideRelease,
    onOpen: handleGuideOpen,
    onChoose: handleGuideChoose,
    onArrive: handleGuideArrive,
    onCancel: handleGuideCancel,
  })

  useEffect(() => {
    guideRef.current = guide
  })

  /* ── Ask ORBI ────────────────────────────────────────────────────────── */
  // Phase 18. The panel owns the conversation; this owns everything that is
  // ORBI's — waking him, keeping his personality out of the way while someone
  // is typing, and handing an accepted answer to guide mode, which already
  // knows how to take a visitor somewhere.

  /**
   * The two tokens that invalidate a feeling in flight.
   *
   * `noticeTokenRef` guards the gaze-and-face half, `emotionTokenRef` the body
   * lean. Declared this high because three separate things bump them — the
   * dwell lean, `feel`, and the Ask lifecycle cancelling a reaction when a new
   * question starts — and this is above all of them.
   */

  const [askOpen, setAskOpen] = useState(false)
  const ask = useOrbiAsk()
  const askPendingRef = useRef(false)
  useEffect(() => {
    askOpenRef.current = askOpen
    askPendingRef.current = ask.pending
  })

  const openAsk = useCallback(() => {
    // Two panels of ORBI's open at once would be two robots (§27).
    guideRef.current?.close('ask-open')
    cinematicRef.current?.cancel('ask-open')
    easterRef.current?.cancel('ask-open')
    // Never a panel over a robot who still looks asleep (§29): the ordinary
    // wake runs first, Z's and snoring stop with it.
    wake(false, 'click')
    note('ask:open')
    setAskOpen(true)
    // Phase 26 §1. ORBI turns to look at the panel that just appeared: eyes
    // toward it, a couple of degrees of lean, then back to attentive normal.
    // No bubble, no wave, no sound, and nothing that repeats the first-meeting
    // greeting — the panel is measured a tick later, once it has been laid out.
    later(() => {
      const aim = askGazeTo('[data-orbi-ask-panel]')
      if (!aim) return
      if (!glanceAt(aim, ORBI_ASK_PRESENCE.openAckMs, 'ask:open')) return
      // A small curious expression, not just a look. Recorded on `askFaceRef`
      // so closing the panel inside the acknowledgement takes it off again.
      askFaceRef.current = 'curious'
      setState((current) =>
        isRestingAnimation(current.animation)
          ? { ...current, expression: 'curious' }
          : current,
      )
      later(() => {
        setState((current) =>
          current.expression === 'curious' ? { ...current, expression: 'normal' } : current,
        )
      }, ORBI_ASK_PRESENCE.openAckMs)
      if (quietBodyRef.current || motionRef.current.reducedMotion) return
      const token = ++emotionTokenRef.current
      auxTiltRef.current.discover = ORBI_EMOTION.curiousLean
      applyBodyTilt()
      later(() => {
        if (token !== emotionTokenRef.current) return
        auxTiltRef.current.discover = 0
        applyBodyTilt()
      }, ORBI_ASK_PRESENCE.openAckMs)
    }, 60)
  }, [applyBodyTilt, askGazeTo, glanceAt, later, note, wake])

  const closeAsk = useCallback(() => {
    setAskOpen(false)
    note('ask:close')
    // Phase 26 §15. Listening gaze, pause beat, reading glance and any
    // reaction still holding — all cancelled together. `endAskPresence`
    // refuses to touch the eyes if something better already owns them, so a
    // handoff to guide mode or the contact companion is never interrupted.
    endAskPresence(true)
  }, [endAskPresence, note])

  /**
   * The visitor accepted a suggestion.
   *
   * Validated a third time here — the enum is checked on the model's output,
   * again when the answer lands in the browser, and once more before anything
   * moves. Only then is the id looked up, and only guide mode does the moving:
   * no scrolling, no URLs, no selectors, nothing the model chose.
   */
  /**
   * ORBI's face while a question is in flight.
   *
   * `thinking` on the way out, back to `normal` when the answer lands — the
   * same two expressions everything else uses. No AI-specific animation, no
   * new controller: one effect writing an expression the face already had.
   */
  useEffect(() => {
    if (!askOpen) {
      // Closing the panel mid-thought must not leave the eyes parked upward.
      gazeRef.current?.clear('interaction')
      return
    }
    // A tick behind, so the face never cascades a render off the back of the
    // effect that observed the request — the same shape the form companion
    // uses for exactly the same reason.
    later(() => {
      if (ask.pending) {
        softExpressionRef.current = null
        // Phase 25 §16. A reaction to the *previous* answer may still be
        // holding, with a revert scheduled for up to a second from now. Left
        // alone, that revert would land in the middle of this request and
        // wipe the thinking eyes. Bumping both tokens makes it find itself
        // stale and do nothing; the claim it holds is `ambient`, which the
        // arbiter lets an equal level hand over, so nothing has to be
        // released and no old feeling is ever queued behind a new question.
        //
        // Phase 26 folds the listening state into the same cancellation, so a
        // pause beat armed a moment ago cannot land on top of the request.
        endAskPresence(false)

        // Phase 26 §5. A quarter of a second on the message that was just
        // sent, before the eyes go up to think about it. The request left in
        // the same tick the visitor pressed Send — this is the face catching
        // up with the fetch, never the fetch waiting for the face.
        const token = ++askPresenceTokenRef.current
        const sent = askGazeTo('[data-orbi-ask-panel]')
        if (sent) {
          gazeRef.current?.set('interaction', sent.x, sent.y)
          setGazeLead('interaction')
        }

        const think = () => {
          // Stale if the panel closed, the answer beat us here, or another
          // question came through in the meantime.
          if (token !== askPresenceTokenRef.current) return
          if (!askOpenRef.current || !askPendingRef.current) return
          // Phase 23: the eyes go where people look when they are thinking
          // rather than reading — up, and slightly aside. Held for the length
          // of the request, so there is no timer and no loop; the answer
          // arriving is what ends it.
          const { gaze, tilt } = ORBI_EMOTION.thinking
          gazeRef.current?.set('interaction', gaze.x, gaze.y)
          setGazeLead('interaction')
          if (!quietBodyRef.current && !motionRef.current.reducedMotion) {
            auxTiltRef.current.discover = tilt
            applyBodyTilt()
          }
          setState((current) =>
            isRestingAnimation(current.animation)
              ? { ...current, expression: 'thinking' }
              : current,
          )
          askFaceRef.current = 'thinking'
        }

        if (sent) later(think, ORBI_ASK_PRESENCE.sendAckMs)
        else think()
        return
      }
      // The answer landed: eyes back to the visitor, body straight.
      gazeRef.current?.clear('interaction')
      setGazeLead('gesture')
      if (auxTiltRef.current.discover !== 0) {
        auxTiltRef.current.discover = 0
        applyBodyTilt()
      }
      setState((current) =>
        current.expression === 'thinking'
          ? { ...current, expression: 'normal' }
          : current,
      )
    }, 0)
  }, [askOpen, ask.pending, later, applyBodyTilt, askGazeTo, endAskPresence])

  const runAskAction = useCallback(
    (action: OrbiAskAction) => {
      if (action === 'NO_ACTION') return
      const target = ORBI_ACTION_TARGETS[action]
      const item = ORBI_GUIDE_ITEMS.find((entry) => entry.target === target)
      if (!item) return
      setAskOpen(false)
      note(`ask:${action}`)
      // Phase 26 §16. Cancel every listening and reading timer before guide
      // mode takes over, so nothing armed during the conversation can land on
      // top of the navigation. `false` because the eyes are not ours to clear
      // here — `choose` is about to point them at the destination.
      endAskPresence(false)
      // Phase 12 takes it from here — scroll, arrival, and the destination's
      // own reaction, exactly as if the menu had been used.
      //
      // Opened and chosen in the same tick on purpose. `choose` only accepts a
      // guide that is opening or choosing, and the visitor has just closed the
      // menu to type — so this walks in through the same front door rather
      // than adding a second way to navigate. The panel never appears: it is
      // published on a run-token timer, and `choose` bumps that token first.
      guideRef.current?.openMenu()
      guideRef.current?.choose(item)
    },
    [endAskPresence, note],
  )

  const { open: guideOpen, remeasure: guideRemeasure } = guide

  /**
   * The panel is anchored to ORBI's box, so it travels with him for free — but
   * *which side* it opens on is a decision, and the dock changing (or the
   * viewport resizing) can invalidate it. Re-decided on the environment's own
   * clock; the panel is never a region the environment can see, so this can
   * never turn into ORBI and the panel chasing each other (§27).
   */
  useEffect(() => {
    if (!guideOpen) return
    guideRemeasure()
  }, [guideOpen, guideRemeasure, environment.rect])

  /** Nothing is guided while nobody is watching. */
  useEffect(() => {
    if (tabVisible) return
    guideRef.current?.close('tab-hidden')
  }, [tabVisible])

  /**
   * Guide mode stands down when the visitor actually puts their attention into
   * the contact form: a field taking focus, or a submission running.
   *
   * Deliberately keyed on *those* and not on companion mode, which is a
   * lingering state rather than an event — it survives focus leaving the form
   * by 1.6s so that tabbing between fields does not drop it, and its published
   * value can change on focus moves that have nothing to do with the form.
   * Keying on it meant a keyboard visitor who had merely tabbed *past* the
   * form on their way to this very control watched the menu open and shut
   * itself a frame later. Field focus and submission status are unambiguous.
   */
  useEffect(() => {
    if (!form.field && form.status === 'idle') return
    guideRef.current?.close('form-focus')
  }, [form.field, form.status])

  /**
   * Discoverability: one quiet run of pulses on the control a few seconds in,
   * once, and never again once the visitor has used it. No bubble, no
   * automatic opening, and nothing remembered between visits (§30, §31).
   */
  useEffect(() => {
    if (!settled || reducedMotion) return
    if (guideUsedRef.current) return
    const id = setTimeout(
      () => setGuideHinted(true),
      ORBI_GUIDE.control.pulseAfterMs,
    )
    return () => clearTimeout(id)
  }, [settled, reducedMotion])

  useEffect(() => {
    if (!guideHinted) return
    const id = setTimeout(
      () => setGuideHinted(false),
      ORBI_GUIDE.control.pulseCycleMs * ORBI_GUIDE.control.pulseCount + 200,
    )
    return () => clearTimeout(id)
  }, [guideHinted])

  /* ── The sound control's place ───────────────────────────────────────── */
  // Always on ORBI's inward side, so it can never be pushed off the edge of
  // the viewport by the dock he happens to be using.

  const toggleSide: 'left' | 'right' =
    environment.dock === 'bottom-left' || environment.dock === 'mid-left'
      ? 'right'
      : 'left'

  useEffect(() => {
    toggleSideRef.current = toggleSide
  }, [toggleSide])

  /**
   * The button is a 44px touch target with a smaller disc painted inside it,
   * so the gap the eye sees is measured from the disc, not from the control.
   */
  const toggleLeft = (() => {
    const painted = quietBody ? ORBI_AUDIO_TOGGLE.mobileSize : ORBI_AUDIO_TOGGLE.size
    const inset = (ORBI_AUDIO_TOGGLE.touchSize - painted) / 2
    const offset = ORBI_AUDIO_TOGGLE.gap - inset
    return toggleSide === 'left'
      ? -(ORBI_AUDIO_TOGGLE.touchSize + offset)
      : placement.size + offset
  })()

  /* ── Where ORBI sits ─────────────────────────────────────────────────── */
  // Two things want to move ORBI's box: the environment picking a dock, and
  // the footer perch. Both are *position*, not personality, so neither is
  // arbitrated — ORBI must never sit on top of a control, whatever else he is
  // doing. They are summed into a single tween so the layer has one writer.

  // Three reasons to be at the edge: the footer perch, an explicit `peek`,
  // and having nowhere left to stand.
  const docked =
    station === 'edge' || state.animation === 'peek' || environment.crowded
  /** Delta from ORBI's CSS anchor to the dock the environment chose, in px. */
  const dockOffsetRef = useRef({ x: 0, y: 0 })
  const perchedRef = useRef(docked)

  const applyDockTransform = useCallback((duration: number) => {
    const el = dockRef.current
    if (!el) return
    applyDock(
      el,
      {
        ...dockOffsetRef.current,
        perched: perchedRef.current,
        peekPercent: peekPercentRef.current,
      },
      motionRef.current,
      duration,
    )

    // The sound control follows the *dock* and nothing else: no perch, no
    // peek, no lean. It has one writer, exactly like every other layer.
    const chrome = chromeRef.current
    if (!chrome) return
    applyDock(
      chrome,
      { ...dockOffsetRef.current, perched: false },
      motionRef.current,
      duration,
    )
  }, [])

  useEffect(() => {
    perchedRef.current = docked
    applyDockTransform(ORBI_TIMING.dockDuration)
  }, [docked, applyDockTransform, motion])

  /* ── Acting on the environment ───────────────────────────────────────── */
  // The controller only ever *decides*. Everything below is the guide acting
  // on those decisions, which keeps a single authority over ORBI's state and
  // animation.

  const lastDockRef = useRef<string | null>(null)
  const modalOpenRef = useRef(false)

  /**
   * Take note of something and look at it for a beat — the reaction that
   * makes a relocation read as "ORBI saw that" rather than as a jump.
   *
   * The *move* is not arbitrated (position is a safety concern), but the
   * reaction is, so it cannot talk over an explicit interaction.
   */
  const notice = useCallback(
    (
      gaze: { x: number; y: number } | null,
      expression: OrbiExpression,
      level: number,
      owner: string,
      holdMs: number,
    ) => {
      if (!gaze) return
      if (!arbiter.claim(level, owner, holdMs + 300)) return

      const token = ++noticeTokenRef.current
      gazeRef.current?.set('interaction', gaze.x, gaze.y)
      setGazeLead('interaction')
      setState((current) => ({ ...current, expression }))

      later(() => {
        if (token !== noticeTokenRef.current) return
        gazeRef.current?.clear('interaction')
        setGazeLead('gesture')
        setState((current) =>
          current.expression === expression
            ? { ...current, expression: 'normal' }
            : current,
        )
        arbiter.release(owner)
      }, holdMs)
    },
    [arbiter, later],
  )

  /**
   * The sound control.
   *
   * The click itself is what unlocks audio in Safari and on iOS, so the toggle
   * is called first and synchronously — nothing is deferred, awaited or queued
   * ahead of it. The little reaction afterwards is exactly that: afterwards.
   */
  const handleAudioToggle = useCallback(() => {
    const turningOn = !audioRef.current?.preferred
    audioRef.current?.toggle()
    note(turningOn ? 'audio:on' : 'audio:off')
    if (!turningOn) return

    // A glance at the control and a moment of pleasure — under a second, and
    // no bubble: the control's own state is the feedback (§6).
    const toward = toggleSideRef.current === 'left' ? -0.85 : 0.85
    notice(
      { x: toward, y: -0.1 },
      'happy',
      ORBI_PRIORITY.ambient,
      'audio',
      ORBI_AUDIO.enableBeatMs,
    )
  }, [note, notice])

  /**
   * Apply the chosen dock. ORBI's box is CSS-anchored bottom-right, so a dock
   * is the delta from that anchor to the decided rectangle — which makes
   * `bottom-right` cost exactly zero transform.
   */
  useEffect(() => {
    const rect = environment.rect
    const root = rootRef.current
    if (!rect || !root) return

    const width = root.offsetWidth
    const height = root.offsetHeight
    const probe = probeRef.current
    const style = probe ? getComputedStyle(probe) : null
    const insetRight = style ? parseFloat(style.paddingRight) || 0 : 0
    const insetBottom = style ? parseFloat(style.paddingBottom) || 0 : 0

    const anchorLeft =
      window.innerWidth - insetRight - placement.right - width
    const anchorTop =
      window.innerHeight - insetBottom - placement.bottom - height

    const next = { x: rect.left - anchorLeft, y: rect.top - anchorTop }
    const previous = dockOffsetRef.current
    const moved = Math.hypot(next.x - previous.x, next.y - previous.y)
    if (moved < 0.5) return

    dockOffsetRef.current = next
    const changed = environment.dock !== lastDockRef.current
    const first = lastDockRef.current === null
    lastDockRef.current = environment.dock

    applyDockTransform(
      first
        ? 0
        : quietBody
          ? ORBI_ENVIRONMENT.moveDurationMobile
          : ORBI_ENVIRONMENT.moveDuration,
    )

    // Glance at whatever pushed him out of the way. Mid-relocation only —
    // a resize that happens to shift the anchor is not worth reacting to.
    if (changed && !first) {
      note(`dock:${environment.dock}`)
      // A tick behind the move, so the reaction is not a cascading render off
      // the back of a layout decision.
      later(
        () =>
          notice(
            environment.noticeGaze,
            'thinking',
            ORBI_PRIORITY.environment,
            'environment',
            ORBI_ENVIRONMENT.noticeHoldMs,
          ),
        0,
      )
    }
  }, [
    environment.rect,
    environment.dock,
    environment.noticeGaze,
    placement.right,
    placement.bottom,
    quietBody,
    applyDockTransform,
    notice,
    note,
    later,
  ])

  /* Modals: stand down rather than compete. */
  useEffect(() => {
    if (environment.modal === modalOpenRef.current) return
    modalOpenRef.current = environment.modal

    if (environment.modal) {
      note('modal-open')
      // Safety wins: cancel rather than try to pause and resume.
      cinematicRef.current?.cancel('modal-open')
      easterRef.current?.cancel('modal-open')
      guideRef.current?.close('modal-open')
      later(
        () =>
          notice(
            environment.modalGaze,
            'surprised',
            ORBI_PRIORITY.safety,
            'modal',
            ORBI_ENVIRONMENT.noticeHoldMs,
          ),
        0,
      )
      return
    }

    // A beat after it closes, so ORBI is not already drifting back while the
    // overlay is still fading out.
    note('modal-close')
    later(
      () => environment.refresh('modal-close'),
      ORBI_ENVIRONMENT.modalReturnDelayMs,
    )
  }, [environment, later, notice, note])

  /* ── Contact form companion ──────────────────────────────────────────── */
  // ORBI watches the form's lifecycle and never its contents. Everything below
  // is driven by focus, `aria-invalid`, and `data-orbi-form-state` — see
  // `useOrbiForm` for the privacy contract.

  const formStatusRef = useRef<typeof form.status>('idle')
  const formSubmissionRef = useRef(0)
  /** Identity of the running success sequence; stale timers check it and bail. */
  const successRunRef = useRef(0)
  const lastInvalidSaidRef = useRef(-Infinity)
  const patientTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /**
   * Look at whatever the form is doing. The `form` gaze slot outranks scroll
   * and cursor, so once a field has focus nothing pulls ORBI's eyes off it.
   */
  useEffect(() => {
    const gaze = gazeRef.current
    if (!gaze) return
    if (form.companion && form.gaze) gaze.set('form', form.gaze.x, form.gaze.y)
    else gaze.clear('form')
  }, [form.companion, form.gaze, reducedMotion])

  /**
   * Field focus. Attentive, quiet, and no new body animation per field — only
   * the eyes move, so tabbing through does not become a performance.
   *
   * Message is the field people linger in, so it gets the calmest face.
   */
  useEffect(() => {
    if (!form.companion || !form.field) return
    if (formStatusRef.current !== 'idle') return
    if (!arbiter.claim(ORBI_PRIORITY.formFocus, 'form-focus', 2400)) return

    note(`field:${form.field}`)
    const expression: OrbiExpression =
      form.field === 'message' ? 'normal' : form.field === 'name' ? 'happy' : 'normal'
    // A tick behind, so a focus change never cascades a render off the back of
    // the effect that observed it.
    later(
      () =>
        setState((current) =>
          current.expression === expression ? current : { ...current, expression },
        ),
      0,
    )
  }, [form.companion, form.field, arbiter, later, note])

  /**
   * Validation. React to the *state*, never to what was typed, and say
   * something at most once in a long while.
   */
  useEffect(() => {
    if (!form.invalidField || !form.companion) return
    if (!arbiter.claim(ORBI_PRIORITY.formFocus, 'form-invalid', 2000)) return

    note(`invalid:${form.invalidField}`)
    const now = performance.now()
    const speak =
      !stateRef.current.message &&
      now - lastInvalidSaidRef.current >= ORBI_FORM.invalidMessageCooldownMs
    if (speak) lastInvalidSaidRef.current = now

    later(() => {
      if (speak) holdRef.current = ORBI_TIMING.messageHoldMs
      setState((current) => ({
        ...current,
        // Concerned, not thinking: nothing is being worked out here, ORBI has
        // simply noticed the field is not right yet.
        expression: 'concerned',
        ...(speak
          ? {
              message: ORBI_FORM_MESSAGES.invalid,
              messageId: current.messageId + 1,
            }
          : null),
      }))
    }, 0)
  }, [form.invalidField, form.companion, arbiter, later, note])

  // Cleared up: a small change of face, not a celebration.
  useEffect(() => {
    if (form.invalidField || !form.companion) return
    later(
      () =>
        setState((current) =>
          current.expression === 'concerned'
            ? { ...current, expression: 'normal' }
            : current,
        ),
      0,
    )
  }, [form.invalidField, form.companion, later])

  /* Lifecycle: submitting → success / error. */
  useEffect(() => {
    const status = form.status
    if (status === formStatusRef.current) return

    // Guard on the submission id as well, so a re-render can never replay a
    // celebration for a submission that already landed.
    const fresh = form.submissionId !== formSubmissionRef.current
    formStatusRef.current = status

    if (patientTimerRef.current) {
      clearTimeout(patientTimerRef.current)
      patientTimerRef.current = null
    }

    if (status === 'submitting') {
      // Deliberately *not* stamping `formSubmissionRef` here: it records which
      // submission has already been celebrated, so claiming it at the start
      // would make every result look stale and no celebration would ever run.
      note('submitting')
      arbiter.claim(ORBI_PRIORITY.formSubmitting, 'form-submitting', 30000)
      restAnimationRef.current = null
      later(
        () =>
          setState((current) => ({
            ...current,
            expression: 'normal',
            animation: 'idle',
            message: null,
          })),
        0,
      )
      // Long request: attentive becomes patient. No speech, no fake progress.
      patientTimerRef.current = setTimeout(() => {
        patientTimerRef.current = null
        setState((current) =>
          formStatusRef.current === 'submitting'
            ? { ...current, expression: 'thinking' }
            : current,
        )
      }, ORBI_FORM.patientAfterMs)
      return
    }

    if (status === 'success' && fresh) {
      formSubmissionRef.current = form.submissionId
      note('success')
      arbiter.release('form-submitting')

      // A token per sequence. Every deferred step checks it, so a second
      // submission cannot be haunted by the previous one's timers — they still
      // fire, they just find themselves stale and do nothing.
      const run = ++successRunRef.current

      const total =
        ORBI_FORM.successLiftMs +
        ORBI_SUCCESS.steps.reduce((sum, step) => sum + step.holdMs, 0)

      // Claimed once, for the whole run. Nothing decorative gets to cut in
      // between the lines — but the dock layer is outside the arbiter, so
      // ORBI can still get out of the way of a control if he has to.
      arbiter.claim(ORBI_PRIORITY.formResult, 'form-result', total + 900)

      restAnimationRef.current = null

      // Beat 0: eyes up and a small lift, before anything is said — and the
      // one warm sound ORBI has, once, at the top of the run. The three lines
      // that follow are silent; three chimes would be a slot machine (§20).
      later(() => {
        if (run !== successRunRef.current) return
        cue('success')
        setBright(true)
        setGazeLead('gesture')
        setSuccessRun(run)
        setState((current) => ({
          ...current,
          expression: 'happy',
          animation: 'excited',
          // Whatever was on screen — a validation nudge, a section greeting —
          // is stale the moment a submission lands.
          message: null,
        }))
      }, 0)

      // Then celebrate → acknowledge → thank, each a step calmer than the
      // last. Only the first line pops; the rest exchange the words inside a
      // panel that never leaves, so three lines read as one thought.
      let at = ORBI_FORM.successLiftMs
      ORBI_SUCCESS.steps.forEach((step, index) => {
        const offset = at
        at += step.holdMs

        later(() => {
          if (run !== successRunRef.current) return
          setSuccessStep(index)
          // Long enough that the generic message timer never lands mid-run;
          // the sequence clears its own bubble at the end.
          holdRef.current = step.holdMs + 1200
          setBright(step.beat !== 'acknowledge')

          setState((current) => ({
            ...current,
            expression: 'happy',
            // celebrate waves, acknowledge nods, thank is eyes only — three
            // full celebrations in a row would be exhausting.
            animation:
              step.beat === 'celebrate'
                ? 'wave'
                : step.beat === 'acknowledge'
                  ? 'nod'
                  : current.animation,
            message: step.message,
            messageId: current.messageId + 1,
          }))
        }, offset)
      })

      // Settle: let the bubble go, drop the smile, hand ORBI back.
      later(() => {
        if (run !== successRunRef.current) return
        setBright(false)
        setSuccessStep(-1)
        setState((current) => ({
          ...current,
          expression: 'normal',
          message: null,
        }))
      }, at)

      later(() => {
        if (run !== successRunRef.current) return
        setSuccessRun(0)
        arbiter.release('form-result')
        form.release()
      }, at + ORBI_FORM.exitDelayMs)
      return
    }

    if (status === 'error' && fresh) {
      formSubmissionRef.current = form.submissionId
      note('form-error')
      arbiter.release('form-submitting')
      if (!arbiter.claim(ORBI_PRIORITY.formResult, 'form-result', ORBI_FORM.errorHoldMs + 600)) {
        return
      }

      // Concerned, not alarmed. The form's own message is the real one; ORBI
      // is only acknowledging it — with the face that actually means it, now
      // that one exists.
      restAnimationRef.current = null
      later(() => {
        holdRef.current = ORBI_FORM.errorHoldMs
        setState((current) => ({
          ...current,
          expression: 'concerned',
          animation: 'idle',
          message: ORBI_FORM_MESSAGES.error,
          messageId: current.messageId + 1,
        }))
      }, 0)
      // Puts its own face down when the hold is over. Whether the validation
      // effect happens to be watching is not this branch's business, and a
      // face nobody clears is a face ORBI wears until the next thing happens.
      later(() => {
        setState((current) =>
          current.expression === 'concerned'
            ? { ...current, expression: 'normal' }
            : current,
        )
        arbiter.release('form-result')
      }, ORBI_FORM.errorHoldMs)
      return
    }

    if (status === 'idle') {
      arbiter.release('form-submitting')
      arbiter.release('form-focus')
    }
  }, [form, arbiter, cue, later, note])

  useEffect(
    () => () => {
      if (patientTimerRef.current) clearTimeout(patientTimerRef.current)
    },
    [],
  )

  /* ── Project cards ───────────────────────────────────────────────────── */

  const projectKeyRef = useRef<string | null>(null)

  const handleProject = useCallback(
    (signal: OrbiTargetSignal | null) => {
      const gaze = gazeRef.current
      // A card drifting past is not more interesting than the form in front of
      // the visitor.
      if (companionRef.current && signal) return
      // Nor than the cinematic already looking at that whole row: the scan owns
      // the eyes until it lands, and hover resumes after it does. A hidden
      // reaction owns them the same way.
      if (cinematicRef.current?.active || easterRef.current?.active) return

      if (!signal) {
        projectKeyRef.current = null
        gaze?.clear('interaction')
        softExpression(null)
        return
      }

      // Moving across a row of cards is eyes and expression only — a gesture
      // per card would be exhausting.
      projectKeyRef.current = signal.key
      gaze?.set('interaction', signal.gaze.x, signal.gaze.y)
      softExpression('happy')
    },
    [softExpression],
  )

  const handleProjectDwell = useCallback(
    (signal: OrbiTargetSignal) => {
      if (projectKeyRef.current !== signal.key) return
      if (stateRef.current.message) return
      if (!isRestingAnimation(stateRef.current.animation)) return
      if (!arbiter.claim(ORBI_PRIORITY.ambient, 'project', 1400)) return

      note(`project:${signal.key}`)
      // The dwell is ORBI leaning in at one card, which is exactly what the
      // curious face is for. The *sweep* above stays `happy` — that one is
      // pleasure at the work, not interest in a particular piece of it.
      setState((current) => ({ ...current, expression: 'curious' }))

      // Phase 23. The *sweep* across a row stays eyes-only — a gesture per
      // card would be exhausting, which is why `handleProject` has none. This
      // is the dwell: the visitor has settled on one card for over a second,
      // and leaning a couple of degrees toward it is what turns a glance into
      // interest. Desktop only; the eyes carry it everywhere else.
      const lean =
        quietBodyRef.current || motionRef.current.reducedMotion
          ? 0
          : Math.sign(signal.gaze.x || 1) * ORBI_EMOTION.curiousLean
      if (lean) {
        const token = ++emotionTokenRef.current
        auxTiltRef.current.discover = lean
        applyBodyTilt()
        later(() => {
          if (token !== emotionTokenRef.current) return
          auxTiltRef.current.discover = 0
          applyBodyTilt()
        }, 1200)
      }

      later(() => arbiter.release('project'), 1200)
    },
    [applyBodyTilt, arbiter, later, note],
  )

  /**
   * Where the on-screen matches for a selector are, as normalized directions
   * from ORBI's own box. The one piece of "look at that" arithmetic in the
   * file — the cinematic's card scan and Phase 17's quieter glance both read
   * from here rather than each measuring the page their own way.
   */
  const gazeStops = useCallback((selector: string, max: number) => {
    const root = rootRef.current
    if (!root) return []
    const box = root.getBoundingClientRect()
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 }

    const targets = Array.from(document.querySelectorAll(selector)).filter(
      (el) => {
        const r = el.getBoundingClientRect()
        return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
      },
    )

    return targets.slice(0, max).map((el) => {
      const r = el.getBoundingClientRect()
      const dx = r.left + r.width / 2 - from.x
      const dy = r.top + r.height / 2 - from.y
      const length = Math.hypot(dx, dy) || 1
      return { x: dx / length, y: dy / length }
    })
  }, [rootRef])

  /* ── Emotional reactions ─────────────────────────────────────────────── */
  // Phase 23. No controller and no state machine: every feeling below is the
  // existing `notice()` primitive — which already claims priority, moves the
  // eyes, sets a face and puts both back — plus, on a desktop, a couple of
  // degrees through the tilt writer that was already summing the hover, menu
  // and discovery leans.
  //
  // Claiming at `ambient` is what enforces the priority rule: guide mode, a
  // cinematic, the form companion, a submission and the entrance all outrank
  // it, so a feeling is refused rather than layered on top of them.

  /**
   * Feel something, briefly.
   *
   * The lean is desktop-only and dropped under reduced motion — the eyes and
   * the face carry the whole thing everywhere else, which is the same split
   * every other ORBI reaction uses.
   */
  const feel = useCallback(
    (
      emotion: { gaze: { x: number; y: number }; tilt: number; holdMs: number },
      expression: OrbiExpression,
      owner: string,
    ) => {
      // `notice` refuses on its own if something better holds ORBI, so the
      // lean must not be applied until it has agreed to run.
      if (arbiter.level() > ORBI_PRIORITY.ambient) return
      if (companionRef.current) return
      // A line still being read owns the face; a feeling is not worth
      // changing ORBI's expression out from under his own bubble.
      if (stateRef.current.message) return
      if (drowsinessRef.current !== 0) return
      if (cinematicRef.current?.active) return
      if (easterRef.current?.active) return
      if (guideRef.current?.open) return
      if (environmentRef.current?.modal) return
      if (askOpenRef.current && owner.startsWith('emotion:shy')) return

      notice(emotion.gaze, expression, ORBI_PRIORITY.ambient, owner, emotion.holdMs)

      const lean =
        quietBodyRef.current || motionRef.current.reducedMotion ? 0 : emotion.tilt
      if (!lean) return

      const token = ++emotionTokenRef.current
      auxTiltRef.current.discover = lean
      applyBodyTilt()
      later(() => {
        if (token !== emotionTokenRef.current) return
        auxTiltRef.current.discover = 0
        applyBodyTilt()
      }, emotion.holdMs)
    },
    [applyBodyTilt, arbiter, later, notice],
  )

  /**
   * How the last answer landed.
   *
   * Every ending of the same moment lives in one effect, because they are one
   * moment seen four ways: ORBI answered, ORBI redirected, ORBI could not use
   * what the visitor typed, or ORBI could not answer at all.
   *
   * Nothing here reads the answer's words. The failure cases are told apart by
   * the status the route already returned — a 4xx is "I couldn't follow that",
   * anything else is "something broke" — and the two successes by the
   * `outcome` field the provider fills in beside the action it already
   * chooses. Both are contract, so both mean the same thing on every provider.
   *
   * Keyed on the entry id, so a re-render never re-feels an old answer.
   */
  const feltEntryRef = useRef(0)

  useEffect(() => {
    if (!askOpen) return
    const last = ask.entries[ask.entries.length - 1]
    if (!last || last.role !== 'orbi') return
    if (last.id === feltEntryRef.current) return
    feltEntryRef.current = last.id

    if (last.failed) {
      // 400 means the input itself could not be used — the closest thing ORBI
      // has to "I didn't understand you". Everything else is a failure.
      const confused = /http 4/.test(ask.lastError ?? '')
      askFaceRef.current = confused ? 'unsure' : 'concerned'
      later(
        () =>
          confused
            ? feel(ORBI_EMOTION.confused, 'unsure', 'emotion:confused')
            : feel(ORBI_EMOTION.concerned, 'concerned', 'emotion:concerned'),
        0,
      )
      return
    }

    // An answer ORBI stood behind, or one he had to hand back.
    //
    // Phase 25 adds a third possibility — the provider naming how the answer
    // should land — and slots it *below* the two that were already here. The
    // order is the whole point: a technical failure is a fact, an unsure
    // outcome is the provider's own admission, and only once both have
    // declined does the semantic emotion get a say. A model cannot make ORBI
    // look pleased about an error, because it is never asked.
    // `unsure` from the outcome and `concerned` from the emotion are not in
    // conflict — they are the same admission about different things. A visitor
    // reporting a broken page gets both: ORBI cannot fix it (unsure) and is
    // sorry about it (concerned), and *sorry* is the truer face. So the
    // outcome blocks the confident feelings and lets this one through.
    //
    // It is the only exception, and it is safe because it can only ever make
    // ORBI look less certain, never more.
    // Phase 26 §7. Whichever reaction runs, ORBI does not turn away the
    // instant it releases — he looks at what he just said for a beat first.
    // Gaze only, normal face: the brief is explicit that reading is not a new
    // expression, and this is the whole of it.
    //
    // Only ever reached on a successful answer. A failure returned above,
    // because glancing proudly at an error message would be absurd (§14).
    const readAfter = (holdMs: number) => {
      const token = ++askPresenceTokenRef.current
      later(() => {
        if (token !== askPresenceTokenRef.current) return
        if (!askOpenRef.current || askPendingRef.current) return
        // The newest answer if the panel marked one, the panel itself if not.
        const aim =
          askGazeTo('[data-orbi-ask-answer]') ?? askGazeTo('[data-orbi-ask-panel]')
        if (glanceAt(aim, ORBI_ASK_PRESENCE.readingMs, 'ask:reading')) note('ask:reading')
      }, holdMs + ORBI_ASK_PRESENCE.readingDelayMs)
    }

    if (last.outcome === 'unsure' && last.emotion !== 'concerned') {
      askFaceRef.current = 'unsure'
      later(() => feel(ORBI_EMOTION.unsure, 'unsure', 'emotion:unsure'), 0)
      readAfter(ORBI_EMOTION.unsure.holdMs)
      return
    }

    // Already normalised twice before it got here; `ORBI_ASK_FEELING` is a
    // Map, so an unknown word is a miss rather than a lookup into anything.
    // A miss — including the literal `normal` — means the brief happy beat
    // Phase 24 gives every good answer, and nothing more.
    const felt = last.emotion ? ORBI_ASK_FEELING.get(last.emotion) : undefined
    askFaceRef.current = felt ? felt.expression : 'happy'
    later(
      () =>
        felt
          ? feel(felt.emotion, felt.expression, `emotion:ask:${last.emotion}`)
          : feel(ORBI_EMOTION.answered, 'happy', 'emotion:answered'),
      0,
    )
    readAfter(felt ? felt.emotion.holdMs : ORBI_EMOTION.answered.holdMs)
  }, [askOpen, ask.entries, ask.lastError, feel, later, askGazeTo, glanceAt, note])

  /**
   * ORBI notices the visitor writing.
   *
   * Phase 25 §7. The panel reports every focus and every keystroke; this
   * refuses nearly all of them. One glance per six seconds is the whole
   * behaviour — eyes toward the panel and a couple of degrees of lean, which
   * is `feel` doing what it already does for a project card.
   *
   * Everything that makes it safe is borrowed rather than built: `feel` stands
   * down for guide mode, a cinematic, the form companion, a modal, sleep and
   * any higher claim, and the cooldown is a timestamp compared on the way in,
   * not a timer left running. Nothing here listens to anything.
   */
  /**
   * Listening.
   *
   * The panel reports every focus and every keystroke, and almost all of them
   * do nothing here. What they do is keep the eyes *held* on the input — set
   * once, then re-measured at most once every six seconds — which is what
   * stops an aggressive mouse move pulling ORBI's attention out of the
   * conversation, since `interaction` outranks `cursor` in the gaze
   * controller.
   *
   * The only visible movement is one small adjustment per six seconds, and
   * one curious beat if the visitor stops mid-sentence. Neither is a loop:
   * the adjustment is a timestamp comparison, and the pause is a single
   * deferred call re-armed by the next keystroke.
   */
  const handleComposing = useCallback((hasText: boolean) => {
    if (!askOpenRef.current) return
    // Mid-question ORBI is already thinking, and thinking owns the eyes.
    if (askPendingRef.current) return

    const now = performance.now()
    const due = now - askGlanceRef.current >= ORBI_ASK_PRESENCE.listenIntervalMs

    // One layout read per interval, never one per keystroke.
    if (due || !askAimRef.current) {
      askAimRef.current = askGazeTo('#orbi-ask-input')
    }
    if (due) askGlanceRef.current = now

    const aim = askAimRef.current
    if (aim) {
      // A small adjustment when one is due, so attention reads as alive
      // rather than as a stare. Held for most of a second — long enough to be
      // seen — then the eyes settle back onto the input for the rest of the
      // interval. The whole thing is two timestamp comparisons.
      const adjusting =
        now - askGlanceRef.current < ORBI_ASK_PRESENCE.adjustHoldMs
      const drift = adjusting ? ORBI_ASK_PRESENCE.listenDrift : 0
      glanceAt({ x: aim.x + drift, y: aim.y - drift }, 0, 'ask:listening')
    }

    // The pause beat, re-armed by every keystroke so it only ever fires once
    // the visitor has actually stopped. One per composition.
    //
    // An empty input arms nothing. The panel focuses itself as it opens, and
    // treating that as a pause spent the one beat this composition gets before
    // the visitor had typed a character — so the real pause, the one worth
    // reacting to, never had a beat left to use.
    if (!hasText) return
    const token = ++askPauseTokenRef.current
    later(() => {
      if (token !== askPauseTokenRef.current) return
      if (!askOpenRef.current || askPendingRef.current) return
      if (askPausedRef.current) return
      askPausedRef.current = true
      note('ask:pause')
      // Waiting, not confused: the curious lean, and never `unsure`.
      feel(ORBI_EMOTION.askCurious, 'curious', 'emotion:ask:pause')
    }, ORBI_ASK_PRESENCE.pauseAfterMs)
  }, [askGazeTo, feel, glanceAt, later, note])

  /* ── Content discovery ───────────────────────────────────────────────── */
  // Phase 17. Once a section has finished reacting, ORBI takes one quieter
  // look at what it is actually showing. No gesture, no bubble, no sound and
  // no travel — the eyes do it, and on a desktop the body follows by a couple
  // of degrees through the tilt writer that was already summing the hover and
  // menu leans.

  /** Last time each section earned a second look. */
  const discoveredRef = useRef(new Map<string, number>())
  /** Invalidates a sweep's remaining stops when a newer one starts. */
  const discoverTokenRef = useRef(0)

  /**
   * Whether a second look may happen at all.
   *
   * The least important thing ORBI does, so the list is long: it stands down
   * for the entrance, a cinematic — including the Projects one, which is
   * already walking those exact cards — guide mode, the form companion, a
   * submission, a modal, the menu, a hidden reaction, sleep, anything the
   * visitor asked for, and a tab nobody is looking at.
   */
  const canDiscover = useCallback(() => {
    if (!settledRef.current) return false
    if (frozenRef.current) return false
    if (companionRef.current) return false
    if (formBusyRef.current) return false
    if (guideRef.current?.open) return false
    if (guideRef.current && guideRef.current.phase !== 'closed') return false
    if (askOpenRef.current) return false
    if (cinematicRef.current?.active) return false
    if (easterRef.current?.active) return false
    if (environmentRef.current?.modal) return false
    if (navOpenRef.current) return false
    if (drowsinessRef.current !== 0) return false
    if (stateRef.current.message) return false
    // A held look orientation is a resting pose, not a gesture — but it also
    // owns the eyes through the `gesture` slot, and this writes to
    // `interaction`, which sits below it. Sections that end in one are exactly
    // the ones left out of `targets`.
    if (!isRestingAnimation(stateRef.current.animation)) return false
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false
    }
    return arbiter.level() <= ORBI_PRIORITY.ambient
  }, [arbiter])

  const discover = useCallback(
    (id: string) => {
      const selector = ORBI_DISCOVERY.targets[id]
      if (!selector) return
      if (!canDiscover()) return

      const now = performance.now()
      const seen = discoveredRef.current.get(id)
      if (seen !== undefined && now - seen < ORBI_DISCOVERY.cooldown) return

      const stops = gazeStops(selector, ORBI_DISCOVERY.maxStops)
      if (!stops.length) return

      const total = stops.length * ORBI_DISCOVERY.stopMs + ORBI_DISCOVERY.holdMs
      const owner = `discover:${id}`
      if (!arbiter.claim(ORBI_PRIORITY.ambient, owner, total + 400)) return

      discoveredRef.current.set(id, now)
      note(owner)
      const token = ++discoverTokenRef.current

      stops.forEach((stop, index) => {
        later(() => {
          if (token !== discoverTokenRef.current) return
          gazeRef.current?.set('interaction', stop.x, stop.y)
          // The body leans after the eyes have already gone, never with them.
          auxTiltRef.current.discover = Math.sign(stop.x) * ORBI_DISCOVERY.tilt
          applyBodyTilt()
        }, index * ORBI_DISCOVERY.stopMs)
      })

      later(() => {
        if (token !== discoverTokenRef.current) return
        gazeRef.current?.clear('interaction')
        auxTiltRef.current.discover = 0
        applyBodyTilt()
        arbiter.release(owner)
      }, total)
    },
    [applyBodyTilt, arbiter, canDiscover, gazeStops, later, note],
  )

  /**
   * The second look, scheduled off the section ORBI is already tracking.
   *
   * An effect rather than a line inside `handleSection` for two reasons: the
   * beat belongs *after* that section's own claim has lapsed, and the section
   * handler is declared long before any of the machinery this needs. Nothing
   * new is watched — `activeSection` is state the guide already keeps.
   */
  useEffect(() => {
    if (!activeSection) return
    if (!ORBI_DISCOVERY.targets[activeSection]) return
    const behavior = registry.get(activeSection)
    if (!behavior) return
    later(
      () => discover(activeSection),
      sectionClaimMs(behavior, ORBI_TIMING.messageHoldMs) +
        ORBI_DISCOVERY.afterSectionMs,
    )
  }, [activeSection, registry, later, discover])

  /* ── Revealed detail ─────────────────────────────────────────────────── */

  const handleExpanded = useCallback(
    (signal: OrbiTargetSignal | null) => {
      if (cinematicRef.current?.active || easterRef.current?.active) return
      if (!signal) {
        gazeRef.current?.clear('interaction')
        softExpression(null)
        return
      }
      note(`expanded:${signal.key}`)
      notice(
        signal.gaze,
        'surprised',
        ORBI_PRIORITY.environment,
        'expanded',
        ORBI_ENVIRONMENT.noticeHoldMs,
      )
    },
    [notice, note, softExpression],
  )

  const interactionHandlers = useMemo(
    () => ({
      onGaze: handleGaze,
      onGazeEnd: handleGazeEnd,
      onProximity: setProximity,
      onHoverGreet: handleHoverGreet,
      onActivate: handleActivate,
      onQuiet: handleQuiet,
      onDrowsy: handleDrowsy,
      onActive: handleActive,
      onCta: handleCta,
      onNav: handleNav,
      onReturn: handleReturn,
      onVisibility: setTabVisible,
      onProject: handleProject,
      onProjectDwell: handleProjectDwell,
      onExpanded: handleExpanded,
    }),
    [
      handleGaze,
      handleGazeEnd,
      handleHoverGreet,
      handleActivate,
      handleQuiet,
      handleDrowsy,
      handleActive,
      handleCta,
      handleNav,
      handleReturn,
      handleProject,
      handleProjectDwell,
      handleExpanded,
    ],
  )

  const interaction = useOrbiInteraction({
    enabled: settled,
    // Touch devices get no cursor tracking, no proximity, no hover greeting.
    pointerEnabled: finePointer,
    rootRef,
    handlers: interactionHandlers,
  })
  useEffect(() => {
    interactionRef.current = interaction
  })

  // ORBI's box moves when it perches at the footer or the breakpoint changes;
  // proximity is measured against a cached rect, so re-measure then.
  useEffect(() => {
    interaction.refreshGeometry()
  }, [interaction, station, placement.size])

  /**
   * Where the visible project cards are, relative to ORBI. Read once when the
   * scan starts, never per frame.
   */
  const projectGazeStops = useCallback(() => {
    const stops = gazeStops(ORBI_SELECTORS.project, 4)
    return stops.length ? stops : [{ x: 0, y: 0 }]
  }, [gazeStops])

  /* ── Cinematic beats ─────────────────────────────────────────────────── */
  // The controller owns the travel; this owns the face and the gesture. Each
  // phase is a beat, and the guide stays the single authority over state.

  const cinematicTargetRef = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    const gaze = gazeRef.current
    const type = cinematic.type
    const phase = cinematic.phase

    if (!cinematic.active || !type) {
      gaze?.clear('interaction')
      cinematicTargetRef.current = null
      return
    }

    // Where the destination sits relative to ORBI's dock, normalized — used
    // to point the eyes at where he is going and at what he finds there.
    if (cinematic.destination && !cinematicTargetRef.current) {
      const { x, y } = cinematic.destination
      const length = Math.hypot(x, y) || 1
      cinematicTargetRef.current = { x: x / length, y: y / length }
    }
    const toward = cinematicTargetRef.current

    if (phase === 'out') {
      note(`cinematic:${type}`)
      // One pass of air on the way out — never a loop, and never on the hero
      // entrance, which happens before anyone has unlocked audio (§15, §26).
      cue('fly')
      // Phase 7 has priority over Phase 8, and a claim is not enough on its
      // own: the reaction's remaining beats have to stop as well.
      easterRef.current?.cancel('cinematic')
      // Looking where he is going, all the way there.
      if (toward) {
        gaze?.set('interaction', toward.x, toward.y)
        later(() => setGazeLead('interaction'), 0)
      }
      later(
        () =>
          setState((current) => ({
            ...current,
            expression: type === 'precision' ? 'normal' : 'happy',
            // Travel is wordless: anything left over from a section is stale
            // by the time ORBI is on his way somewhere.
            message: null,
          })),
        0,
      )
      return
    }

    if (phase === 'perform') {
      if (type === 'precision') {
        // Curious, leaning in, with one unhurried glance either side.
        later(
          () =>
            setState((current) => ({
              ...current,
              expression: 'thinking',
              animation: 'inspect',
            })),
          0,
        )
        ORBI_CINEMATIC.inspectScan.forEach((offset, index) => {
          later(() => {
            gazeRef.current?.set('interaction', offset, 0.1)
          }, index * ORBI_CINEMATIC.inspectScanMs)
        })
        return
      }

      if (type === 'projects') {
        // Eyes travel the row; the body stays put. Looking at three cards is
        // not a reason to visit three places.
        later(() => {
          setBright(true)
          setState((current) => ({ ...current, expression: 'happy' }))
        }, 0)
        const stops = projectGazeStops()
        stops.forEach((stop, index) => {
          later(
            () => gazeRef.current?.set('interaction', stop.x, stop.y),
            (index * ORBI_CINEMATIC.scanMs) / Math.max(1, stops.length),
          )
        })
        later(() => {
          setState((current) =>
            isRestingAnimation(current.animation)
              ? { ...current, animation: 'excited' }
              : current,
          )
        }, ORBI_CINEMATIC.scanMs * 0.72)
        return
      }
      return
    }

    if (phase === 'back') {
      // A trip cut short takes its sound with it; the landing cue still plays
      // if — and only if — he actually lands (§16).
      if (cinematic.cancelReason) audioRef.current?.fade()
      // Home is behind him now.
      if (toward) gaze?.set('interaction', -toward.x, -toward.y)
      later(() => {
        setBright(false)
        setState((current) => ({
          ...current,
          expression: 'happy',
          animation: isRestingAnimation(current.animation)
            ? current.animation
            : 'settle',
        }))
      }, 0)
      return
    }

    if (phase === 'land') cue('land')

    if (phase === 'land' || phase === 'idle') {
      gaze?.clear('interaction')
      cinematicTargetRef.current = null
      later(() => {
        setBright(false)
        setGazeLead('gesture')
        setState((current) => ({ ...current, expression: 'normal' }))
      }, 0)
    }
  }, [cinematic.active, cinematic.type, cinematic.phase, cinematic.destination, cinematic.runId, cinematic.cancelReason, cue, later, note, projectGazeStops])

  /* ── Hidden reactions: the beats ─────────────────────────────────────── */
  // The controller decides *whether* and *when*; this decides what a beat
  // looks like. Same division as the cinematic, and the same rule: the guide
  // is the only thing in ORBI that touches an expression or a gesture.

  /** The face, animation and line this reaction applied — only they are taken back. */
  const eggFaceRef = useRef<OrbiExpression | null>(null)
  const eggAnimRef = useRef<OrbiAnimation | null>(null)
  const eggBubbleRef = useRef<string | null>(null)
  /** `runId:step` of the beat already performed — the HUD publishes a lot. */
  const eggBeatRef = useRef('')
  const eggRunningRef = useRef(false)
  /** Scales the stabilisation wobble down for the smaller reactions. */
  const wobbleScaleRef = useRef(1)

  const eggFace = useCallback((expression: OrbiExpression) => {
    eggFaceRef.current = expression
    setState((current) => ({ ...current, expression }))
  }, [])

  const eggAnimation = useCallback((animation: OrbiAnimation) => {
    eggAnimRef.current = animation
    restAnimationRef.current = null
    setState((current) => ({ ...current, animation }))
  }, [])

  /** Toward the visitor: wherever the cursor last was, or straight ahead. */
  const towardVisitor = useCallback(() => {
    const { x, y } = cursorGazeRef.current
    const length = Math.hypot(x, y)
    if (length < 0.02) return { x: 0, y: -0.12 }
    return { x: (x / length) * 0.7, y: (y / length) * 0.5 }
  }, [])

  useEffect(() => {
    const type = easter.type
    const step = easter.step
    const gaze = gazeRef.current

    /* Nothing running: put back exactly what a beat took, and nothing else. */
    if (!easter.active || !type || step < 0) {
      if (!eggRunningRef.current) return
      eggRunningRef.current = false
      eggBeatRef.current = ''

      const face = eggFaceRef.current
      const anim = eggAnimRef.current
      const line = eggBubbleRef.current
      eggFaceRef.current = null
      eggAnimRef.current = null
      eggBubbleRef.current = null
      wobbleScaleRef.current = 1

      later(() => {
        gaze?.clear('interaction')
        setGazeLead('gesture')
        if (peekPercentRef.current !== 0) {
          peekPercentRef.current = 0
          applyDockTransform(ORBI_EASTER_EGGS.edgeReturnDuration)
        }
        setState((current) => ({
          ...current,
          expression:
            face && current.expression === face ? 'normal' : current.expression,
          animation: anim && current.animation === anim ? 'idle' : current.animation,
          // A reaction cut short takes its line with it. One that simply
          // finished has already outlived the bubble.
          message: line && current.message === line ? null : current.message,
        }))
      }, 0)
      return
    }

    /* The HUD republishes telemetry several times a second; a beat is
       performed exactly once. */
    const beat = `${easter.runId}:${step}`
    if (eggBeatRef.current === beat) return
    eggBeatRef.current = beat
    eggRunningRef.current = true

    /* Every beat is applied just after the commit, never during it. */
    const perform = () => {
      const say = (message: string | null) => {
        eggBubbleRef.current = message
        if (message) holdRef.current = ORBI_EASTER_EGGS.wobbleMs + 700
        setState((current) => ({
          ...current,
          message,
          messageId: message ? current.messageId + 1 : current.messageId,
        }))
      }

      const look = (x: number, y: number) => {
        gaze?.set('interaction', x, y)
        setGazeLead('interaction')
      }

      const lean = (percent: number, duration: number = ORBI_TIMING.dockDuration) => {
        // Reduced motion keeps the reaction and drops the travel.
        if (reducedMotion) return
        peekPercentRef.current = percent
        applyDockTransform(duration)
      }

      // A beat never inherits a stale bubble: whatever ORBI was saying when
      // the reaction started is over, and only the reaction's own line — if it
      // has earned one — goes up in its place.
      if (step === 0) {
        note(`easter:${type}`)
        say(null)
        // Phase 8 owns *whether* a reaction fires; audio only listens (§45).
        // Four of the ten have a sound; the rest are silent on purpose.
        const sound = EASTER_SOUNDS[type]
        if (sound) cue(sound)
      }

      /* ── Poked once too often ── */
      if (type === 'dizzyClick') {
        if (step === 0) {
          setGazeLead('gesture')
          wobbleScaleRef.current = 1
          eggFace('surprised')
          eggAnimation('wobble')
          say(easter.bubble)
          return
        }
        if (step === 1) return eggFace('dizzy')
        eggFace('blink')
        return
      }

      /* ── Led round in a circle ── */
      if (type === 'cursorCircle') {
        if (step === 0) {
          wobbleScaleRef.current = 1
          eggFace('surprised')
          eggAnimation('wobble')
          // The pupils finish the lap the cursor started.
          const ring = [
            [0.9, 0.1],
            [0.1, 0.85],
            [-0.9, 0.1],
            [-0.1, -0.8],
            [0.6, 0.2],
          ] as const
          ring.forEach(([x, y], index) => later(() => look(x, y), index * 105))
          return
        }
        if (step === 1) return eggFace('dizzy')
        eggFace('blink')
        return
      }

      /* ── The cursor whipping about ── */
      if (type === 'cursorChase') {
        if (step === 0) {
          // Half amplitude: this is ORBI flinching, not ORBI being shaken.
          wobbleScaleRef.current = 0.5
          eggFace('surprised')
          eggAnimation('wobble')
          return
        }
        eggFace('normal')
        return
      }

      /* ── A tap on the head ── */
      if (type === 'headTap') {
        if (step === 0) {
          look(0, -0.95)
          eggFace('surprised')
          return
        }
        if (step === 1) return eggFace('blink')
        eggFace('happy')
        say(easter.bubble)
        return
      }

      /* ── Hovered long enough to check himself over ── */
      if (type === 'selfAware') {
        if (step === 0) {
          look(0, 0.9)
          eggFace('thinking')
          return
        }
        if (step === 1) {
          const to = towardVisitor()
          look(to.x, to.y)
          eggFace('happy')
          return
        }
        eggFace('blink')
        return
      }

      /* ── The mark on the door ── */
      if (type === 'logoNod') {
        if (step === 0) {
          const to = easter.gaze ?? { x: -0.8, y: -0.6 }
          look(to.x, to.y)
          eggFace('happy')
          return
        }
        eggAnimation('nod')
        return
      }

      /* ── Woken properly ── */
      if (type === 'deepWake') {
        if (step === 0) return eggFace('surprised')
        if (step === 1) return eggFace('blink')
        if (step === 2) return eggFace('normal')
        if (step === 3) return eggFace('blink')
        const to = towardVisitor()
        look(to.x, to.y)
        eggFace('happy')
        say(easter.bubble)
        // Phase 13 — the stretch, on the settling beat and nowhere else: it
        // has to finish inside the run, and this is the only beat long enough
        // to hold it. Not every waking, either — the reaction's own variant
        // counter decides, so the first one a visitor triggers stretches and
        // then every other one after that. Silent, and never under reduced
        // motion, where there is nothing left of it.
        if (
          !reducedMotion &&
          easter.variant % ORBI_MICRO.stretchEveryNthWake === 0
        ) {
          eggAnimation('stretch')
        }
        return
      }

      /* ── The bottom of the page ── */
      if (type === 'footerSecret') {
        if (step === 0) {
          // Lean *into* the viewport — the opposite of backing off.
          lean(-ORBI_EASTER_EGGS.footerPeekPercent)
          const to = easter.gaze ?? { x: -0.5, y: 0.7 }
          look(to.x, to.y)
          eggFace('thinking')
          return
        }
        if (step === 1) {
          const to = towardVisitor()
          look(to.x, to.y)
          eggFace('happy')
          return
        }
        if (step === 2) {
          eggAnimation('wave')
          say(easter.bubble)
          return
        }
        lean(0, ORBI_EASTER_EGGS.edgeReturnDuration)
        return
      }

      /* ── The disappearing act ── */
      if (type === 'edgePeek') {
        if (step === 0) {
          eggAnimation('peek')
          lean(ORBI_EASTER_EGGS.footerPeekPercent * 0.8)
          eggFace('normal')
          return
        }
        if (step === 1) {
          // Eyes first: he comes back a little, and looks before he leaps.
          lean(ORBI_EASTER_EGGS.edgeRetreatPercent * 0.5)
          look(-0.9, -0.1)
          return
        }
        lean(0, ORBI_EASTER_EGGS.edgeReturnDuration)
        eggAnimation('idle')
        eggFace('happy')
        return
      }

      /* ── One small unprompted beat ── */
      if (type === 'rareIdle') {
        const variant = easter.variant % 4
        if (variant === 0) {
          if (step === 0) eggFace('wink')
          else if (step === 1) eggFace('normal')
          return
        }
        if (variant === 1) {
          if (step === 0) {
            look(0.35, -0.5)
            eggFace('thinking')
          } else if (step === 1) {
            eggFace('normal')
          }
          return
        }
        if (variant === 2) {
          // Phase 13's look-around: left, back to centre, right — and the
          // teardown drops the `interaction` slot, which is the last centre.
          // Eyes only, on every breakpoint; the body has no part in it.
          const { lookAroundX: x, lookAroundY: y } = ORBI_MICRO
          if (step === 0) look(-x, y)
          else if (step === 1) look(0, 0)
          else look(x, y)
          return
        }
        // Phase 13's reset. Movement is the whole beat, so it stands down
        // under reduced motion rather than playing an empty one.
        if (step === 0 && !reducedMotion) eggAnimation('shake')
        return
      }
    }

    later(perform, 0)
  }, [
    easter.active,
    easter.type,
    easter.step,
    easter.runId,
    easter.bubble,
    easter.gaze,
    easter.variant,
    applyDockTransform,
    cue,
    eggAnimation,
    eggFace,
    later,
    note,
    reducedMotion,
    towardVisitor,
  ])

  /* ── Footer edge play ────────────────────────────────────────────────── */
  // Perched at the footer, a cursor coming at ORBI makes him shrink back a
  // little; when it leaves, he comes out again, slower. Tiny, desktop-only,
  // and never a chase — it is a character noticing he has been noticed.

  useEffect(() => {
    if (station !== 'edge' || quietBody || !finePointer || reducedMotion) return
    if (easter.active || cinematic.active) return

    const retreat = proximity !== 'far'
    peekPercentRef.current = retreat ? ORBI_EASTER_EGGS.edgeRetreatPercent : 0
    applyDockTransform(
      retreat ? ORBI_TIMING.dockDuration : ORBI_EASTER_EGGS.edgeReturnDuration,
    )

    return () => {
      peekPercentRef.current = 0
    }
  }, [
    station,
    proximity,
    quietBody,
    finePointer,
    reducedMotion,
    easter.active,
    cinematic.active,
    applyDockTransform,
  ])

  /* ── Page progress ───────────────────────────────────────────────────── */
  // Phase 15. How far down the page the visitor has got — read off the scroll
  // system's existing master trigger — and the two small moments that come off
  // it. Nothing here is drawn: progress is a number ORBI reacts to twice, not
  // something the visitor is shown. Both beats are arbitrated, and either is
  // skipped outright if it cannot run cleanly rather than queued for later.

  /** How far down the page the visitor has got, 0 to 1. */
  const progressRef = useRef(0)
  const completedRef = useRef(false)
  const halfwayRef = useRef(false)
  /** The footer counts as the end of the page whatever the scrollbar says. */
  const reachedEndRef = useRef(false)

  /**
   * Whether a progress beat may run *right now*.
   *
   * The same list of refusals the small hello uses, for the same reason: this
   * is the least important thing on the page, so it stands down for the form,
   * a modal, the menu, a cinematic, a hidden reaction, guide mode — open or
   * mid-trip — and for a visitor who is not even looking at the tab.
   */
  const canMarkProgress = useCallback(() => {
    if (!settledRef.current) return false
    if (frozenRef.current) return false
    if (companionRef.current) return false
    if (formBusyRef.current) return false
    if (guideRef.current?.open) return false
    if (guideRef.current && guideRef.current.phase !== 'closed') return false
    if (askOpenRef.current) return false
    if (cinematicRef.current?.active) return false
    if (easterRef.current?.active) return false
    if (environmentRef.current?.modal) return false
    if (navOpenRef.current) return false
    if (drowsinessRef.current !== 0) return false
    if (stateRef.current.message) return false
    if (!isRestingAnimation(stateRef.current.animation)) return false
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false
    }
    return arbiter.level() <= ORBI_PRIORITY.ambient
  }, [arbiter])

  /**
   * One small beat about how far through the page the visitor is.
   *
   * `lift` is Phase 13's — the same three-pixel rise the "you're back" hello
   * uses — so nothing new moves. Under reduced motion the body stays put and
   * the face and the line carry it, which is the rule everywhere else in ORBI.
   */
  const markProgress = useCallback(
    (message: string, lift: boolean) => {
      if (!canMarkProgress()) return false
      if (
        !arbiter.claim(
          ORBI_PRIORITY.ambient,
          'progress',
          ORBI_TIMING.messageHoldMs + 600,
        )
      ) {
        return false
      }

      note('progress')
      softExpressionRef.current = null
      restAnimationRef.current = null
      setGazeLead('gesture')
      const still = motionRef.current.reducedMotion
      if (lift && !still) setBright(true)

      holdRef.current = ORBI_TIMING.messageHoldMs
      setState((current) => ({
        ...current,
        expression: 'happy',
        animation: lift && !still ? 'lift' : current.animation,
        message,
        messageId: current.messageId + 1,
      }))

      later(() => {
        setBright(false)
        setState((current) =>
          current.expression === 'happy' ? { ...current, expression: 'normal' } : current,
        )
        arbiter.release('progress')
      }, ORBI_TIMING.messageHoldMs)

      return true
    },
    [arbiter, canMarkProgress, later, note],
  )

  /**
   * Seen the whole page. Tried again on later progress ticks and once more
   * when the footer trigger fires, so a visitor who reached the bottom during
   * a guided trip still gets it when ORBI is free — but never queued, and
   * never more than once a page view.
   */
  const markComplete = useCallback(() => {
    if (completedRef.current) return
    if (!reachedEndRef.current && progressRef.current < ORBI_PROGRESS.completeAt) {
      return
    }
    if (markProgress(ORBI_PROGRESS_MESSAGES.complete, true)) {
      completedRef.current = true
    }
  }, [markProgress])

  /**
   * The footer is the end of the page however long the document is, so taking
   * the perch is the second — and last — place completion is attempted. An
   * effect on the station ORBI already tracks: no trigger, no listener, and it
   * runs after the beat that moved him there rather than during it.
   */
  useEffect(() => {
    if (station !== 'edge') return
    reachedEndRef.current = true
    // Not on arrival: the section that owns the bottom of the page is still
    // reacting then, and it outranks this. Goes through the shared `later` so
    // unmount cancels it like every other deferred beat; no timer of its own.
    later(markComplete, ORBI_PROGRESS.footerBeatMs)
  }, [station, markComplete, later])

  /**
   * The midpoint aside. Held to a stricter rule than the completion beat: it
   * only ever fires on the visitor's *own* scrolling — Phase 14's wheel stamp
   * is what tells the two apart — and it gets exactly one attempt, because an
   * aside that waits around for a good moment stops being an aside.
   */
  const handleProgress = useCallback(
    (progress: number) => {
      progressRef.current = progress

      if (
        !halfwayRef.current &&
        progress >= ORBI_PROGRESS.halfwayAt &&
        progress < ORBI_PROGRESS.completeAt
      ) {
        halfwayRef.current = true
        // Guide mode and hash links cross the midpoint on the way somewhere
        // else; that is travelling, not exploring.
        if (interactionRef.current?.scrolledByHand()) {
          markProgress(ORBI_PROGRESS_MESSAGES.halfway, false)
        }
      }

      markComplete()
    },
    [markComplete, markProgress],
  )

  /* ── The one scroll system ───────────────────────────────────────────── */

  const handleDirection = useCallback((direction: OrbiScrollDirection) => {
    setScrollDirection(direction)
    // Someone who has started reading is no longer being introduced to
    // anybody. Phase 16's second line is dropped, and never re-armed.
    if (direction) introLiveRef.current = false
    // Scrolling is the user being present. The scroll hook owns the scrolling;
    // this is the one line that tells the interaction hook it happened, so
    // ORBI cannot doze off while someone is reading their way down the page.
    if (direction) interactionRef.current?.noteActivity()
  }, [])

  const scrollHandlers = useMemo(
    () => ({
      onSection: handleSection,
      onFooter: handleFooter,
      onDirection: handleDirection,
      /**
       * The startled recoil is only ever a reaction to the *visitor* moving
       * the page.
       *
       * `scroll-behavior: smooth` is set site-wide, so every nav anchor, every
       * in-page CTA and every guide-mode trip animates the viewport far past
       * the velocity threshold. ORBI was flinching on all of them and then
       * playing the destination's own section reaction on top of the flinch —
       * two body beats inside a second, on the most ordinary interaction the
       * site has. A scroll nobody's hand caused is not startling, however fast
       * it is; the wheel is what makes it the visitor's.
       */
      onFastScroll: () => {
        if (!interactionRef.current?.scrolledByHand()) return
        handleFastScroll()
      },
      onProgress: handleProgress,
    }),
    [handleSection, handleFooter, handleDirection, handleFastScroll, handleProgress],
  )

  useOrbiScroll({
    sectionIds,
    // Held off until the entrance is done, so nothing competes with it.
    enabled: settled,
    // Mobile stays quiet; reduced motion keeps the face but drops the recoil.
    fastScrollEnabled: breakpoint !== 'mobile',
    handlers: scrollHandlers,
  })

  /* ── Body animation ──────────────────────────────────────────────────── */

  const prevAnimationRef = useRef<OrbiAnimation | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const tilt = tiltRef.current
    const gestureEl = gestureRef.current
    if (!root || !tilt || !gestureEl) return

    const animation = state.animation
    const previous = prevAnimationRef.current
    prevAnimationRef.current = animation

    if (animation === 'hide') {
      playHide(root, motion)
      return
    }
    if (previous === 'hide') playShow(root, motion)

    if (
      animation === 'wave' ||
      animation === 'point-left' ||
      animation === 'point-right'
    ) {
      const side = animation === 'point-left' ? 'left' : 'right'
      const arm = side === 'left' ? leftArmRef.current : armRef.current
      const svgOrigin =
        side === 'left' ? ORBI_ART.armPivotLeft : ORBI_ART.armPivot
      if (!arm) return

      const tl =
        animation === 'wave'
          ? createWaveTimeline(arm, motion, oneShotDone('wave'))
          : createPointTimeline(arm, side, motion, oneShotDone(animation))

      return () => {
        tl.kill()
        resetLayer(arm, svgOrigin)
      }
    }

    if (animation === 'nod') {
      const tl = createNodTimeline(gestureEl, motion, oneShotDone('nod'))
      return () => {
        tl.kill()
        resetLayer(gestureEl)
      }
    }

    if (animation === 'wobble') {
      // The stabilisation after being shaken. Its own layer, restrained
      // amplitude, and smaller again on a phone.
      const tl = createWobbleTimeline(
        gestureEl,
        {
          degrees:
            ORBI_EASTER_EGGS.wobbleDegrees *
            wobbleScaleRef.current *
            (quietBody ? ORBI_EASTER_EGGS.wobbleQuietScale : 1),
          durationMs: ORBI_EASTER_EGGS.wobbleMs,
        },
        motion,
        oneShotDone('wobble'),
      )
      return () => {
        tl.kill()
        resetLayer(gestureEl)
      }
    }

    if (animation === 'inspect') {
      // Lean toward whatever ORBI came to look at, then straighten up.
      const toward = (cinematicTargetRef.current?.x ?? 0) < 0 ? -1 : 1
      const tl = createInspectTimeline(tilt, toward, motion, oneShotDone('inspect'))
      return () => {
        tl.kill()
        applyBodyTilt()
      }
    }

    if (animation === 'excited') {
      const tl = createExcitedTimeline(
        gestureEl,
        motion,
        oneShotDone('excited'),
      )
      return () => {
        tl.kill()
        resetLayer(gestureEl)
      }
    }

    if (animation === 'surprised') {
      const tl = createRecoilTimeline(gestureEl, motion, oneShotDone('surprised'))
      return () => {
        tl.kill()
        resetLayer(gestureEl)
      }
    }

    if (animation === 'curious') {
      const tl = createCuriousTimeline(
        tilt,
        curiousSideRef.current,
        motion,
        oneShotDone('curious'),
      )
      return () => {
        tl.kill()
        gazeRef.current?.clear('interaction')
        applyBodyTilt()
      }
    }

    /* ── Phase 13: the micro beats ── */

    if (animation === 'stretch' || animation === 'lift') {
      // Same factory, two presets: the stretch takes the arms out with it,
      // the hello is the rise on its own.
      const preset = animation === 'stretch' ? ORBI_MICRO.stretch : ORBI_MICRO.lift
      const angle = quietBody ? preset.armAngleQuiet : preset.armAngle
      // Outward is negative on the right shoulder and positive on the left,
      // the same convention `point-*` uses. Captured here rather than read in
      // the cleanup, so teardown resets the arms it actually moved.
      const arms = angle
        ? [
            { el: armRef.current, svgOrigin: ORBI_ART.armPivot, angle: -angle },
            { el: leftArmRef.current, svgOrigin: ORBI_ART.armPivotLeft, angle },
          ]
        : []
      const tl = createStretchTimeline(
        gestureEl,
        {
          arms,
          lift: quietBody ? preset.liftQuiet : preset.lift,
          durationMs: preset.durationMs,
        },
        motion,
        oneShotDone(animation),
      )
      return () => {
        tl.kill()
        resetLayer(gestureEl)
        for (const arm of arms) resetLayer(arm.el, arm.svgOrigin)
      }
    }

    if (animation === 'shake') {
      const tl = createTinyShakeTimeline(
        gestureEl,
        {
          degrees: quietBody
            ? ORBI_MICRO.shake.degreesQuiet
            : ORBI_MICRO.shake.degrees,
          durationMs: ORBI_MICRO.shake.durationMs,
        },
        motion,
        oneShotDone('shake'),
      )
      return () => {
        tl.kill()
        resetLayer(gestureEl)
      }
    }

    if (animation === 'settle') {
      const tl = createSettleTimeline(
        {
          tilt,
          gesture: gestureEl,
          arms: [
            { el: armRef.current, svgOrigin: ORBI_ART.armPivot },
            { el: leftArmRef.current, svgOrigin: ORBI_ART.armPivotLeft },
          ],
        },
        motion,
        oneShotDone('settle'),
      )
      return () => {
        tl.kill()
      }
    }

    // Resting states and sustained look orientations.
    applyBodyTilt()
  }, [state.animation, motion, quietBody, oneShotDone, applyBodyTilt])

  /* ── Flight ──────────────────────────────────────────────────────────── */
  // Its own layer and its own effect, so ORBI keeps holding station underneath
  // every gesture instead of freezing whenever one plays.

  const flightRef = useRef<OrbiFlightHandle | null>(null)

  const flightVariant =
    drowsiness === 3
      ? 'asleep'
      : drowsiness > 0
        ? 'drowsy'
        : environment.modal
          ? 'calm'
          : state.animation === 'float'
            ? 'active'
            : 'hover'

  /**
   * Flight is the lowest-priority thing ORBI does, so the larger reposition
   * only happens when genuinely nothing else is: no gesture, no claim, no
   * bubble, not perched, not hovered, not drowsy, tab in front. Asked at the
   * moment of decision rather than tracked in state, so it is always current
   * and never re-runs the effect.
   */
  const canAdjustFlight = useCallback(() => {
    if (!settledRef.current) return false
    if (drowsinessRef.current !== 0) return false
    // The larger reposition is decorative; it has no place mid-form.
    if (companionRef.current) return false
    // ...nor under an open menu. The panel is anchored to his dock rather than
    // to the flight layer, so a reposition would slide ORBI out from under his
    // own guide (§5, §27).
    if (guideRef.current?.open) return false
    if (askOpenRef.current) return false
    if (hoveringRef.current) return false
    // ...and it has no place mid-flourish either.
    if (easterRef.current?.active) return false
    if (stationRef.current !== 'home') return false
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      return false
    }
    const current = stateRef.current
    if (current.message) return false
    if (!isRestingAnimation(current.animation)) return false
    return arbiter.level() <= ORBI_PRIORITY.idle
  }, [arbiter])

  useEffect(() => {
    if (!settled) return
    if (frozen) {
      // `?orbi-freeze=1` — rendered, but perfectly still, so a screenshot has
      // something stable to capture. Dev only.
      resetLayer(floaterRef.current)
      return
    }
    const floater = floaterRef.current
    if (!floater) return

    const flight = createFlight(floater, motion, {
      variant: flightVariant,
      quiet: quietBody,
      canAdjust: canAdjustFlight,
    })
    flightRef.current = flight

    return () => {
      flight.kill()
      flightRef.current = null
    }
  }, [settled, frozen, motion, flightVariant, quietBody, canAdjustFlight])

  // Nothing to hold station for while the tab is in the background. Pausing
  // rather than killing means ORBI resumes from the pose he was in, so coming
  // back never looks like a jump.
  useEffect(() => {
    const flight = flightRef.current
    if (!flight) return
    if (tabVisible) flight.resume()
    else flight.pause()
  }, [tabVisible])

  /* ── Development cinematic trigger ───────────────────────────────────── */
  // `?orbi-cinematic=precision` runs one on load so it can be tuned without
  // scrolling to it and waiting out the cooldown. Stripped in production.

  useEffect(() => {
    if (!devCinematic || !settled) return
    const id = setTimeout(() => {
      document
        .querySelector(`[data-orbi-cinematic="${devCinematic}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setTimeout(() => cinematicRef.current?.request(devCinematic), 1200)
    }, 600)
    return () => clearTimeout(id)
  }, [devCinematic, settled])

  /* ── Development Easter-egg trigger ──────────────────────────────────── */
  // `?orbi-easter=dizzyClick` runs one on load, because waiting out a
  // 40-second cooldown to tune 400ms of animation is no way to work.

  useEffect(() => {
    if (!devEaster || !settled) return
    const id = setTimeout(() => easterRef.current?.request(devEaster), 1400)
    return () => clearTimeout(id)
  }, [devEaster, settled])

  /* ── Development sleep trigger ───────────────────────────────────────── */
  // `?orbi-sleep=deep` goes straight to the bottom of the state machine, by
  // the same door the inactivity sensor uses — waiting out 75 seconds to look
  // at a 3.5-second breathing cycle is no way to tune one. Stripped in
  // production, where `devSleep` is a constant false.

  useEffect(() => {
    if (!devSleep || !settled) return
    const id = setTimeout(() => handleDrowsy(3), 1200)
    return () => clearTimeout(id)
  }, [devSleep, settled, handleDrowsy])

  /* ── Development guide trigger ───────────────────────────────────────── */
  // `?orbi-guide=work` opens the menu and takes that trip on load, because
  // checking one destination's arrival should not cost five clicks each time.
  // Stripped in production, where `devGuideTarget` is a constant null.

  useEffect(() => {
    if (!devGuideTarget || !settled) return
    const item = ORBI_GUIDE_ITEMS.find((entry) => entry.id === devGuideTarget)
    if (!item) return
    const open = setTimeout(() => guideRef.current?.openMenu(), 1200)
    const pick = setTimeout(() => guideRef.current?.choose(item), 2000)
    return () => {
      clearTimeout(open)
      clearTimeout(pick)
    }
  }, [devGuideTarget, settled])

  /* ── Idle blinking ───────────────────────────────────────────────────── */

  useEffect(() => {
    if (!settled) return
    const scheduler = createBlinkScheduler(blink, motion)
    return () => scheduler.kill()
  }, [settled, motion, blink])

  /* ── Render ──────────────────────────────────────────────────────────── */

  const height = Math.round(
    (placement.size * ORBI_VIEWBOX.height) / ORBI_VIEWBOX.width,
  )
  /** The two controls, as one column, centred on ORBI's box. */
  const controlsTop = Math.round(
    (height -
      (ORBI_GUIDE.control.touchSize * 2 + ORBI_GUIDE.control.stackGap)) /
      2,
  )
  /** A bubble is opening over this corner; both controls get out of its way. */
  const dimControls =
    state.message !== null && environment.bubble.placement === toggleSide
  const layer: React.CSSProperties = {
    width: '100%',
    height: '100%',
    pointerEvents: 'none',
  }

  return (
    <OrbiContext.Provider value={controller}>
      {children}
      {/* Resolves `env(safe-area-inset-*)` to real numbers. Hidden, inert, and
          measured only on resize — there is no other way to read the insets. */}
      <div
        ref={probeRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          visibility: 'hidden',
          paddingTop: 'env(safe-area-inset-top, 0px)',
          paddingRight: 'env(safe-area-inset-right, 0px)',
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          paddingLeft: 'env(safe-area-inset-left, 0px)',
        }}
      />
      <div
        ref={rootRef}
        style={{
          position: 'fixed',
          // Anchored past the safe-area insets, so on a notched phone the
          // default dock is already inside the usable area rather than under
          // the home indicator.
          right: `calc(env(safe-area-inset-right, 0px) + ${placement.right}px)`,
          bottom: `calc(env(safe-area-inset-bottom, 0px) + ${placement.bottom}px)`,
          width: `${placement.size}px`,
          height: `${height}px`,
          zIndex: ORBI_Z_INDEX,
          // Only the painted robot is interactive — the surrounding box never
          // swallows a click meant for the page.
          pointerEvents: 'none',
          willChange: 'transform, opacity',
          // Hidden until GSAP takes over on mount; prevents a first-paint flash.
          opacity: 0,
          visibility: 'hidden',
        }}
      >
        {/*
          ORBI's own small UI: the guide control, the sound control, and the
          guide panel. Rendered before the travel layer on purpose — when a
          bubble is placed on this side it paints over the controls rather than
          the other way round, and they dim out of its way.

          Two controls, stacked, on ORBI's inward side: one small system rather
          than a row of buttons growing along his edge. Guide sits above sound
          because it is the one worth finding.
        */}
        <div
          ref={chromeRef}
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          <div
            style={{
              position: 'absolute',
              left: `${toggleLeft}px`,
              top: `${controlsTop}px`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: `${ORBI_GUIDE.control.stackGap}px`,
              pointerEvents: 'none',
            }}
          >
            <OrbiGuideControl
              open={guide.open}
              onToggle={guide.toggle}
              revealed={proximity !== 'far' || !finePointer}
              size={quietBody ? ORBI_GUIDE.control.mobileSize : ORBI_GUIDE.control.size}
              theme={environment.theme}
              dimmed={dimControls}
              pulsing={guideHinted}
              buttonRef={guideButtonRef}
            />
            <OrbiSoundToggle
              enabled={audio.preferred}
              onToggle={handleAudioToggle}
              revealed={proximity !== 'far' || !finePointer}
              size={quietBody ? ORBI_AUDIO_TOGGLE.mobileSize : ORBI_AUDIO_TOGGLE.size}
              theme={environment.theme}
              dimmed={dimControls}
            />
          </div>
          {/*
            Rendered after the control, so Tab reaches the control and then the
            options in the order they are read. Outside the travel and dock
            layers for the same reason the controls are: a menu that flies,
            bobs or perches while you are reaching for it is not a menu.
          */}
          <OrbiGuideMenu
            open={guide.open}
            items={guide.items}
            placement={guide.placement}
            box={guide.box}
            breakpoint={breakpoint}
            placementMetrics={placement}
            theme={environment.theme}
            reducedMotion={reducedMotion}
            onSelect={guide.choose}
            onAsk={openAsk}
            onClose={() => guide.close('dismissed')}
            controlRef={guideButtonRef}
          />
        </div>
        {/* Cinematic travel. Its own layer, written by nothing else — and the
            bubble sits inside it, so the Hero greeting travels with ORBI while
            the footer perch (below) still leaves it behind. */}
        <div ref={travelRef} style={{ ...layer, willChange: 'transform' }}>
        {/* Outside the *dock* layer on purpose — sliding to the footer perch
            must not drag the bubble off the right edge — but inside the
            travel layer, so the Hero greeting goes where ORBI goes. */}
        <OrbiSpeech
          message={state.message}
          messageId={state.messageId}
          placement={placement}
          side={environment.bubble.placement}
          align={environment.bubble.align}
          theme={environment.theme}
          // The opening line pops like any other; the follow-ups exchange
          // their words inside the same panel. The first meeting's second line
          // is the same idea — read off the message itself, so it needs no
          // state of its own.
          transition={
            successStep > 0 || state.message === ORBI_MESSAGES.introFollowUp
              ? 'soft'
              : 'pop'
          }
          minWidth={
            successRun > 0
              ? Math.round(placement.speechMaxWidth * ORBI_SUCCESS.minBubbleRatio)
              : undefined
          }
          reducedMotion={reducedMotion}
        />
        <div ref={dockRef} style={{ ...layer, willChange: 'transform' }}>
          {/*
            The Z's hang in the dock layer: they follow ORBI from dock to dock
            and out to the footer perch, but they are above the tilt, the
            gestures and the flight — so they stay put in the air while he
            breathes underneath them.
          */}
          <OrbiSleepParticles
            active={drowsiness === 3}
            side={toggleSide}
            size={placement.size}
            quiet={quietBody}
            reducedMotion={reducedMotion}
          />
          <div ref={tiltRef} style={layer}>
            <div ref={gestureRef} style={layer}>
              <div ref={floaterRef} style={{ ...layer, willChange: 'transform' }}>
                <OrbiRobot
                  expression={state.expression}
                  awake={awake}
                  bright={bright}
                  dozing={drowsiness >= 2}
                  asleep={drowsiness === 3}
                  theme={environment.theme}
                  gazeRef={gazeElementRef}
                  armRef={armRef}
                  leftArmRef={leftArmRef}
                  onActivate={handleActivate}
                  onHead={handleHead}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
      {/*
        Ask ORBI. A sibling of ORBI's root rather than a child of it: the root
        is a small fixed box sized to the robot, and a panel that has to hold a
        conversation does not belong inside it. It anchors itself against the
        same placement metrics, so it still reads as sitting with him.
      */}
      <OrbiAskPanel
        open={askOpen}
        entries={ask.entries}
        pending={ask.pending}
        breakpoint={breakpoint}
        placement={placement}
        reducedMotion={reducedMotion}
        onSend={ask.send}
        onAction={(entry) => {
          if (!entry.action) return
          ask.clearAction(entry.id)
          runAskAction(entry.action)
        }}
        onExplore={() => {
          // Ask ORBI could not answer; guide mode needs no provider at all.
          // Closes the panel and opens the menu — the same door the control
          // opens, so there is no second way into Phase 12.
          setAskOpen(false)
          note('ask:explore')
          endAskPresence(false)
          guideRef.current?.openMenu()
        }}
        onClose={closeAsk}
        onComposing={handleComposing}
      />
      {debugEnabled && (
        <OrbiDebug
          state={state}
          section={activeSection}
          direction={scrollDirection}
          station={station}
          proximity={proximity}
          drowsiness={drowsiness}
          environment={environment}
          form={form}
          cinematic={cinematic}
          easter={easter}
          guide={guide}
          ask={{
            open: askOpen,
            pending: ask.pending,
            count: ask.entries.length,
            lastAction: ask.lastAction,
            lastError: ask.lastError,
          }}
          guideTools={devGuideTools}
          audio={audio}
          audioTools={devAudio}
          sleep={{
            stage: drowsiness,
            bodyAnimation: flightVariant === 'asleep' && !reducedMotion,
            mouth:
              drowsiness === 3
                ? 'sleep'
                : drowsiness > 0 || state.expression === 'sleepy'
                  ? 'flat'
                  : 'normal',
            snoreCycleMs: drowsiness === 3 && !reducedMotion ? ORBI_SLEEP.snoreCycleMs : 0,
            particles: drowsiness === 3 ? (quietBody ? 1 : ORBI_SLEEP.maxParticles) : 0,
            wakeSourceRef,
          }}
          arbiter={arbiter}
          gazeRef={gazeRef}
          eventRef={lastEventRef}
        />
      )}
    </OrbiContext.Provider>
  )
}
