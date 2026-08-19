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
  useOrbiCinematicRequest,
  useOrbiDebugEnabled,
  useOrbiFrozen,
  useReducedMotion,
} from './useOrbiMedia'
import { useOrbiScroll, type OrbiScrollDirection } from './useOrbiScroll'
import {
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
  createWaveTimeline,
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
  isLookAnimation,
  isRestingAnimation,
  ORBI_ART,
  ORBI_CINEMATIC,
  ORBI_CLICK_MESSAGES,
  ORBI_COOLDOWNS,
  ORBI_INITIAL_STATE,
  ORBI_INTERACTION,
  ORBI_MEDIA,
  ORBI_MESSAGES,
  ORBI_ENVIRONMENT,
  ORBI_FORM,
  ORBI_FORM_MESSAGES,
  ORBI_PLACEMENT,
  ORBI_PRIORITY,
  ORBI_SCROLL,
  ORBI_SELECTORS,
  ORBI_SUCCESS,
  ORBI_TIMING,
  ORBI_VIEWBOX,
  ORBI_Z_INDEX,
  type OrbiAnimation,
  type OrbiBreakpoint,
  type OrbiCinematicType,
  type OrbiExpression,
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
   * Mirror of the cinematic controller. Declared here, ahead of every effect
   * that reaches for it — several of them cancel a flight and run before the
   * controller itself is created.
   */
  const cinematicRef = useRef<OrbiCinematicApi | null>(null)

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
    if (form.companion) cinematicRef.current?.cancel('form-companion')
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
        onEyesOn: () => setAwake(true),
        onBlink: blink,
        onWave: () =>
          setState((s) => ({ ...s, expression: 'happy', animation: 'wave' })),
        onGreet: () => applySay(ORBI_MESSAGES.greeting),
      },
      live,
    )

    return () => {
      tl.kill()
    }
  }, [arbiter, blink, applySay])

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

  const handleSection = useCallback(
    (id: string) => {
      // Boundary jitter must not re-fire: only a genuine change of section
      // counts, and even then not twice inside the cooldown.
      if (id === lastSectionRef.current) return
      lastSectionRef.current = id
      setActiveSection(id)

      const behavior = registry.get(id)
      if (!behavior) return

      const now = performance.now()
      const firedAt = sectionFiredRef.current.get(id)
      if (
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
        !stateRef.current.message &&
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
      // A section with a registered cinematic target may earn a trip. The
      // controller refuses on its own if now is a bad time.
      // A section with a registered cinematic target may earn a trip. Asked
      // twice: the section's own gesture is often still playing on the first
      // attempt, and the controller refuses while anything is mid-move.
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

  const auxTiltRef = useRef({ hover: 0, nav: 0 })
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
      : auxTiltRef.current.hover + auxTiltRef.current.nav
    applyTilt(tilt, base + aux, motionRef.current)
  }, [])

  /* ── Personality ─────────────────────────────────────────────────────── */
  // Every reaction below goes through the arbiter and a named cooldown. None of
  // them are allowed to talk over a section beat, and none of them can fire
  // twice in a row just because a pointer wobbled across a boundary.

  const lastClickRef = useRef(-Infinity)
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
    (startle: boolean) => {
      if (drowsinessRef.current === 0) return
      const deep = drowsinessRef.current === 2
      drowsinessRef.current = 0
      setDrowsiness(0)
      arbiter.release('drowsy')
      note('wake')

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

  const handleActivate = useCallback(() => {
    const now = performance.now()
    if (now - lastClickRef.current < ORBI_COOLDOWNS.clickMessage) return

    // Mid-flight, a poke gets a look and a blink — not a speech bubble and
    // certainly not a wave. Interrupting the trip would strand him between
    // destinations.
    if (cinematicRef.current?.active) {
      lastClickRef.current = now
      note('click-during-cinematic')
      setBright(true)
      blink()
      later(() => setBright(false), 600)
      return
    }

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
    wake(false)
    note('click')

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
  }, [arbiter, blink, later, note, wake])

  /* ── Hover ───────────────────────────────────────────────────────────── */

  const handleHoverStart = useCallback(() => {
    hoveringRef.current = true
    interactionRef.current?.setHovering(true)
    wake(false)
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
    softExpression(null)
    auxTiltRef.current.hover = 0
    applyBodyTilt()
  }, [applyBodyTilt, softExpression])

  const handleHoverGreet = useCallback(() => {
    const now = performance.now()
    if (now - lastHoverGreetRef.current < ORBI_COOLDOWNS.hoverGreeting) return
    if (stateRef.current.message) return
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
    // Too fidgety on a phone, where there is no cursor to explain it.
    if (quietBodyRef.current) return
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
    (level: 1 | 2) => {
      if (!isRestingAnimation(stateRef.current.animation)) return
      // Never nod off while the visitor is mid-form.
      if (companionRef.current) return
      if (
        !arbiter.claim(
          ORBI_PRIORITY.ambient,
          'drowsy',
          ORBI_INTERACTION.dozeDelay * 4,
        )
      ) {
        return
      }
      note(level === 2 ? 'doze' : 'drowsy')
      drowsinessRef.current = level
      setDrowsiness(level)
      softExpressionRef.current = null
      setState((s) => ({ ...s, expression: 'sleepy' }))
    },
    [arbiter, note],
  )

  const handleActive = useCallback(() => {
    wake(true)
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
      // Safety outranks the flourish: an overlay opening ends a cinematic
      // rather than pausing it.
      cinematicRef.current?.cancel('nav-open')

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

  const handleReturn = useCallback(
    (awayMs: number) => {
      // Never the entrance again — just a blink, as if ORBI looked back up.
      if (awayMs >= ORBI_INTERACTION.awayWakeMs) {
        note('return')
        blink()
      }
    },
    [blink, note],
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
      { ...dockOffsetRef.current, perched: perchedRef.current },
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
  const noticeTokenRef = useRef(0)

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
        expression: 'thinking',
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
          current.expression === 'thinking'
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

      // Beat 0: eyes up and a small lift, before anything is said.
      later(() => {
        if (run !== successRunRef.current) return
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
      // is only acknowledging it.
      restAnimationRef.current = null
      later(() => {
        holdRef.current = ORBI_FORM.errorHoldMs
        setState((current) => ({
          ...current,
          expression: 'thinking',
          animation: 'idle',
          message: ORBI_FORM_MESSAGES.error,
          messageId: current.messageId + 1,
        }))
      }, 0)
      later(() => arbiter.release('form-result'), ORBI_FORM.errorHoldMs)
      return
    }

    if (status === 'idle') {
      arbiter.release('form-submitting')
      arbiter.release('form-focus')
    }
  }, [form, arbiter, later, note])

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
      setState((current) => ({ ...current, expression: 'happy' }))
      later(() => arbiter.release('project'), 1200)
    },
    [arbiter, later, note],
  )

  /* ── Revealed detail ─────────────────────────────────────────────────── */

  const handleExpanded = useCallback(
    (signal: OrbiTargetSignal | null) => {
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
    const root = rootRef.current
    if (!root) return [{ x: 0, y: 0 }]
    const box = root.getBoundingClientRect()
    const from = { x: box.left + box.width / 2, y: box.top + box.height / 2 }

    const cards = Array.from(
      document.querySelectorAll(ORBI_SELECTORS.project),
    ).filter((card) => {
      const r = card.getBoundingClientRect()
      return r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
    })

    if (!cards.length) return [{ x: 0, y: 0 }]

    return cards.slice(0, 4).map((card) => {
      const r = card.getBoundingClientRect()
      const dx = r.left + r.width / 2 - from.x
      const dy = r.top + r.height / 2 - from.y
      const length = Math.hypot(dx, dy) || 1
      return { x: dx / length, y: dy / length }
    })
  }, [rootRef])

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

    if (phase === 'land' || phase === 'idle') {
      gaze?.clear('interaction')
      cinematicTargetRef.current = null
      later(() => {
        setBright(false)
        setGazeLead('gesture')
        setState((current) => ({ ...current, expression: 'normal' }))
      }, 0)
    }
  }, [cinematic.active, cinematic.type, cinematic.phase, cinematic.destination, cinematic.runId, later, note, projectGazeStops])

  /* ── The one scroll system ───────────────────────────────────────────── */

  const handleDirection = useCallback((direction: OrbiScrollDirection) => {
    setScrollDirection(direction)
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
      onFastScroll: handleFastScroll,
    }),
    [handleSection, handleFooter, handleDirection, handleFastScroll],
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
    drowsiness > 0
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
    if (hoveringRef.current) return false
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
          // their words inside the same panel.
          transition={successStep > 0 ? 'soft' : 'pop'}
          minWidth={
            successRun > 0
              ? Math.round(placement.speechMaxWidth * ORBI_SUCCESS.minBubbleRatio)
              : undefined
          }
          reducedMotion={reducedMotion}
        />
        <div ref={dockRef} style={{ ...layer, willChange: 'transform' }}>
          <div ref={tiltRef} style={layer}>
            <div ref={gestureRef} style={layer}>
              <div ref={floaterRef} style={{ ...layer, willChange: 'transform' }}>
                <OrbiRobot
                  expression={state.expression}
                  awake={awake}
                  bright={bright}
                  dozing={drowsiness === 2}
                  theme={environment.theme}
                  gazeRef={gazeElementRef}
                  armRef={armRef}
                  leftArmRef={leftArmRef}
                  onActivate={handleActivate}
                  onHoverStart={handleHoverStart}
                  onHoverEnd={handleHoverEnd}
                />
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
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
          arbiter={arbiter}
          gazeRef={gazeRef}
          eventRef={lastEventRef}
        />
      )}
    </OrbiContext.Provider>
  )
}
