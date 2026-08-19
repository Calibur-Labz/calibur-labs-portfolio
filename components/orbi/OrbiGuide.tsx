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
  useOrbiDebugEnabled,
  useReducedMotion,
} from './useOrbiMedia'
import { useOrbiScroll, type OrbiScrollDirection } from './useOrbiScroll'
import {
  useOrbiInteraction,
  type OrbiCtaSignal,
  type OrbiDrowsiness,
  type OrbiInteractionApi,
  type OrbiProximity,
} from './useOrbiInteraction'
import {
  ORBI_SECTION_BEHAVIORS,
  resolveSectionAnimation,
  sectionClaimMs,
} from './orbiSections'
import {
  applyTilt,
  createBlinkScheduler,
  createCuriousTimeline,
  createExcitedTimeline,
  createFlight,
  createIntroTimeline,
  createPointTimeline,
  createRecoilTimeline,
  createSettleTimeline,
  createWaveTimeline,
  lookTiltAngle,
  playDock,
  playHide,
  playShow,
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
  ORBI_CLICK_MESSAGES,
  ORBI_COOLDOWNS,
  ORBI_INITIAL_STATE,
  ORBI_INTERACTION,
  ORBI_MESSAGES,
  ORBI_PLACEMENT,
  ORBI_PRIORITY,
  ORBI_SCROLL,
  ORBI_TIMING,
  ORBI_VIEWBOX,
  ORBI_Z_INDEX,
  type OrbiAnimation,
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

  const reducedMotion = useReducedMotion()
  const breakpoint = useOrbiBreakpoint()
  const finePointer = useFinePointer()
  const debugEnabled = useOrbiDebugEnabled()
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
    setInitialPose(root, motionRef.current)

    const tl = createIntroTimeline(
      root,
      {
        onEyesOn: () => setAwake(true),
        onBlink: blink,
        onWave: () =>
          setState((s) => ({ ...s, expression: 'happy', animation: 'wave' })),
        onGreet: () => applySay(ORBI_MESSAGES.greeting),
      },
      motionRef.current,
    )

    return () => {
      tl.kill()
    }
  }, [arbiter, blink, applySay])

  /* ── Message lifetime ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!state.message) return
    const id = state.messageId
    const timer = setTimeout(() => {
      setState((s) =>
        s.messageId === id
          ? {
              ...s,
              message: null,
              expression: s.expression === 'happy' ? 'normal' : s.expression,
            }
          : s,
      )
    }, holdRef.current)
    return () => clearTimeout(timer)
  }, [state.message, state.messageId])

  /* ── Section reactions ───────────────────────────────────────────────── */

  const lastSectionRef = useRef<string | null>(null)
  const sectionFiredRef = useRef(new Map<string, number>())
  const spokenRef = useRef(new Map<string, number>())
  const expressionTokenRef = useRef(0)

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
  }, [arbiter, later, note, wake])

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

      // Following it with the eyes is free, so that always happens.
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
        gaze?.clear('interaction')
        softExpression(null)
        auxTiltRef.current.nav = 0
        applyBodyTilt()
        return
      }

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
    drowsiness > 0 ? 'drowsy' : state.animation === 'float' ? 'active' : 'hover'

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
  }, [settled, motion, flightVariant, quietBody, canAdjustFlight])

  // Nothing to hold station for while the tab is in the background. Pausing
  // rather than killing means ORBI resumes from the pose he was in, so coming
  // back never looks like a jump.
  useEffect(() => {
    const flight = flightRef.current
    if (!flight) return
    if (tabVisible) flight.resume()
    else flight.pause()
  }, [tabVisible])

  /* ── Footer perch ────────────────────────────────────────────────────── */
  // Position, not personality: this runs regardless of who holds the priority
  // claim, because ORBI must never sit on top of the footer links.

  const docked = station === 'edge' || state.animation === 'peek'

  useEffect(() => {
    const dock = dockRef.current
    if (!dock) return
    playDock(dock, docked ? 'edge' : 'home', motion)
  }, [docked, motion])

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
      <div
        ref={rootRef}
        style={{
          position: 'fixed',
          right: `${placement.right}px`,
          bottom: `${placement.bottom}px`,
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
        {/* Outside the dock layer on purpose: the bubble stays anchored where
            ORBI normally lives, so sliding to the footer perch can never drag
            it off the right edge of the screen. */}
        <OrbiSpeech
          message={state.message}
          messageId={state.messageId}
          placement={placement}
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
      {debugEnabled && (
        <OrbiDebug
          state={state}
          section={activeSection}
          direction={scrollDirection}
          station={station}
          proximity={proximity}
          drowsiness={drowsiness}
          arbiter={arbiter}
          gazeRef={gazeRef}
          eventRef={lastEventRef}
        />
      )}
    </OrbiContext.Provider>
  )
}
