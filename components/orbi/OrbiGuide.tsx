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
import { ORBI_GAZE_CENTER, type OrbiGaze } from './OrbiFace'
import { createOrbiArbiter } from './orbiArbiter'
import {
  useOrbiBreakpoint,
  useOrbiDebugEnabled,
  useReducedMotion,
} from './useOrbiMedia'
import { useOrbiScroll, type OrbiScrollDirection } from './useOrbiScroll'
import {
  ORBI_SECTION_BEHAVIORS,
  resolveSectionAnimation,
  sectionClaimMs,
} from './orbiSections'
import {
  applyLookTilt,
  createBlinkScheduler,
  createExcitedTimeline,
  createFloat,
  createIntroTimeline,
  createPointTimeline,
  createRecoilTimeline,
  createSettleTimeline,
  createWaveTimeline,
  playDock,
  playHide,
  playShow,
  resetLayer,
  setInitialPose,
  type OrbiMotionOptions,
} from './orbiAnimations'
import {
  isLookAnimation,
  isRestingAnimation,
  ORBI_ART,
  ORBI_INITIAL_STATE,
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

  const reducedMotion = useReducedMotion()
  const breakpoint = useOrbiBreakpoint()
  const debugEnabled = useOrbiDebugEnabled()
  const placement = ORBI_PLACEMENT[breakpoint]

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

  const motion: OrbiMotionOptions = useMemo(
    () => ({ reducedMotion, size: placement.size }),
    [reducedMotion, placement.size],
  )

  /** Mirrors for callbacks that must read current values without re-binding. */
  const stateRef = useRef(state)
  const motionRef = useRef(motion)
  const settledRef = useRef(settled)
  const breakpointRef = useRef(breakpoint)

  // Synced from an effect, not during render, and declared ahead of every
  // effect that reads them so the mirrors are current by the time they run.
  useEffect(() => {
    stateRef.current = state
    motionRef.current = motion
    settledRef.current = settled
    breakpointRef.current = breakpoint
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
    const current = stateRef.current.expression
    if (current === 'blink') return
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
        now - firedAt < ORBI_SCROLL.sectionCooldownMs
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
      restAnimationRef.current = behavior.restAnimation ?? null

      // One bubble at a time, and never the same line twice in quick
      // succession — a hovering scroll position must not chatter.
      const message = behavior.message
      const spokenAt = message ? spokenRef.current.get(message) : undefined
      const speak =
        !!message &&
        !stateRef.current.message &&
        (spokenAt === undefined ||
          now - spokenAt >= ORBI_SCROLL.messageCooldownMs)

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
    if (now - lastStartleRef.current < ORBI_SCROLL.fastCooldownMs) return

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

  /* ── The one scroll system ───────────────────────────────────────────── */

  const scrollHandlers = useMemo(
    () => ({
      onSection: handleSection,
      onFooter: handleFooter,
      onDirection: setScrollDirection,
      onFastScroll: handleFastScroll,
    }),
    [handleSection, handleFooter, handleFastScroll],
  )

  useOrbiScroll({
    sectionIds,
    // Held off until the entrance is done, so nothing competes with it.
    enabled: settled,
    // Mobile stays quiet; reduced motion keeps the face but drops the recoil.
    fastScrollEnabled: breakpoint !== 'mobile',
    handlers: scrollHandlers,
  })

  /* ── Gaze ────────────────────────────────────────────────────────────── */
  // Looking is done with the pupils. An explicit `look-*` wins; otherwise the
  // scroll glance applies, but only while ORBI is at rest — it is the
  // lowest-priority behaviour and must never fight a gesture.

  const gaze = useMemo<OrbiGaze>(() => {
    switch (state.animation) {
      case 'look-left':
        return { x: -1, y: 0 }
      case 'look-right':
        return { x: 1, y: 0 }
      case 'look-up':
        return { x: 0, y: -1 }
      case 'look-down':
        return { x: 0, y: 1 }
      default:
        break
    }
    if (!isRestingAnimation(state.animation)) return ORBI_GAZE_CENTER
    if (scrollDirection === 'down') {
      return { x: 0, y: ORBI_SCROLL.glanceAmount }
    }
    if (scrollDirection === 'up') {
      return { x: 0, y: -ORBI_SCROLL.glanceAmount }
    }
    return ORBI_GAZE_CENTER
  }, [state.animation, scrollDirection])

  /* ── Body animation ──────────────────────────────────────────────────── */

  const prevAnimationRef = useRef<OrbiAnimation | null>(null)
  /** Mobile drops the body rotation and keeps the eye movement. */
  const quietBody = breakpoint === 'mobile'

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
    applyLookTilt(tilt, animation, motion, quietBody)
  }, [state.animation, motion, quietBody, oneShotDone])

  /* ── Idle float ──────────────────────────────────────────────────────── */
  // Its own layer and its own effect, so it keeps breathing underneath every
  // gesture instead of freezing whenever one plays.

  const floatVariant = state.animation === 'float' ? 'float' : 'idle'

  useEffect(() => {
    if (!settled) return
    const floater = floaterRef.current
    if (!floater) return
    const float = createFloat(floater, motion, floatVariant)
    return () => float.kill()
  }, [settled, motion, floatVariant])

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
                  gaze={gaze}
                  bright={bright}
                  armRef={armRef}
                  leftArmRef={leftArmRef}
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
          arbiter={arbiter}
        />
      )}
    </OrbiContext.Provider>
  )
}
