'use client'

import { useCallback, useEffect, useRef, type RefObject } from 'react'
import { ORBI_EASTER_EGGS, ORBI_INTERACTION, ORBI_SELECTORS } from './orbiConfig'

export type OrbiProximity = 'far' | 'near' | 'over'
/** 0 awake, 1 drowsy, 2 eyes closed, 3 properly asleep. */
export type OrbiDrowsiness = 0 | 1 | 2 | 3

export interface OrbiCtaSignal {
  /** Stable-ish identity, for the per-CTA cooldown. */
  key: string
  /** Normalized direction from ORBI toward the CTA. */
  gaze: { x: number; y: number }
  /** Which arm would point at it. */
  side: 'left' | 'right'
  /** `data-orbi-interest="point"` — worth a gesture, not just a glance. */
  point: boolean
  /** `data-orbi-interest="say:Let's talk"` — opt in to a bubble explicitly. */
  message: string | null
}

/** A `data-orbi-project` card the pointer is on. */
export interface OrbiTargetSignal {
  key: string
  /** Normalized direction from ORBI toward it. */
  gaze: { x: number; y: number }
  side: 'left' | 'right'
}

export interface OrbiInteractionHandlers {
  /** Every pointer move. Must not set React state — write to the gaze controller. */
  onGaze: (x: number, y: number) => void
  /** Pointer left the window, or tracking stopped. */
  onGazeEnd: () => void
  /** Only on a threshold crossing, so this is safe to put in state. */
  onProximity: (level: OrbiProximity) => void
  /** Cursor has rested on ORBI long enough to deserve a hello. */
  onHoverGreet: () => void
  /** Click, tap, or keyboard activation on the robot. */
  onActivate: () => void
  /** A quiet spell long enough for ORBI to get curious. */
  onQuiet: () => void
  /** Quiet for a lot longer. 1 = drowsy, 2 = eyes closed, 3 = properly asleep. */
  onDrowsy: (level: 1 | 2 | 3) => void
  /** Any activity after a quiet spell. */
  onActive: () => void
  /** A marked CTA gained or lost the pointer. */
  onCta: (signal: OrbiCtaSignal | null) => void
  /** A marked navigation toggle opened or closed. */
  onNav: (open: boolean) => void
  /** Tab regained focus, with how long it was hidden. */
  onReturn: (awayMs: number) => void
  /** Tab went to the background or came back. Loops should pause on `false`. */
  onVisibility: (visible: boolean) => void
  /** A project card gained or lost the pointer. */
  onProject: (signal: OrbiTargetSignal | null) => void
  /** The pointer has rested on the same card long enough to deserve a look. */
  onProjectDwell: (signal: OrbiTargetSignal) => void
  /** A registered element revealed or hid its detail. */
  onExpanded: (signal: OrbiTargetSignal | null) => void
}

export interface OrbiInteractionOptions {
  /** Held off until the entrance sequence has finished. */
  enabled: boolean
  /** Real cursor present. False on touch — no tracking, proximity, or hover. */
  pointerEnabled: boolean
  /** ORBI's fixed container, for the proximity geometry. */
  rootRef: RefObject<HTMLElement | null>
  handlers: OrbiInteractionHandlers
}

export interface OrbiInteractionApi {
  /** Ping from outside — the scroll hook uses this so scrolling counts as activity. */
  noteActivity: () => void
  /**
   * Did the visitor's own hand move the page just now?
   *
   * True only just after a real `wheel` event. A programmatic scroll — a nav
   * anchor under `scroll-behavior: smooth`, a `scrollIntoView`, guide mode
   * taking a trip — moves the viewport just as fast but produces none, which
   * is the whole distinction: velocity alone cannot tell "the visitor flicked
   * the page" from "the page is animating itself somewhere".
   */
  scrolledByHand: () => boolean
  /** Pointer entered / left the painted robot. Wired to the SVG, so it is exact. */
  setHovering: (hovering: boolean) => void
  /** Re-measure ORBI. Call when it changes size or docks. */
  refreshGeometry: () => void
}

/**
 * ORBI's senses.
 *
 * Everything that is *not* scrolling lives here — cursor, proximity, hover,
 * activation, inactivity, CTAs, navigation, tab visibility — behind a handful
 * of passive listeners rather than one per behaviour. Scrolling stays in
 * `useOrbiScroll`; the two are kept apart because they answer to different
 * clocks and merging them would only make both harder to follow.
 *
 * This is strictly a sensor: it detects and reports. Every decision about what
 * ORBI *does* — priority, cooldowns, expressions — belongs to `OrbiGuide`.
 *
 * Three things keep it off the critical path:
 *
 *  - Pointer moves never touch React. They do a little arithmetic against a
 *    cached rect and hand the result to the gaze controller.
 *  - Geometry is measured on resize and on request, never inside an event.
 *  - Inactivity is one slow interval rather than timers reset on every move,
 *    and it stops entirely while the tab is hidden.
 */
export function useOrbiInteraction({
  enabled,
  pointerEnabled,
  rootRef,
  handlers,
}: OrbiInteractionOptions): OrbiInteractionApi {
  const handlersRef = useRef(handlers)
  useEffect(() => {
    handlersRef.current = handlers
  })

  /** ORBI's centre in viewport coordinates. Cached; never read in an event. */
  const centreRef = useRef<{ x: number; y: number } | null>(null)
  const lastActivityRef = useRef(0)
  /** When the wheel last turned. See `scrolledByHand`. */
  const lastWheelRef = useRef(-Infinity)
  const hoveringRef = useRef(false)
  const proximityRef = useRef<OrbiProximity>('far')
  const stageRef = useRef<0 | 1 | 2 | 3 | 4>(0)
  const quietTargetRef = useRef<number>(ORBI_INTERACTION.curiousMinDelay)
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const measure = useCallback(() => {
    const el = rootRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    centreRef.current = {
      x: rect.left + rect.width / 2,
      y: rect.top + rect.height / 2,
    }
  }, [rootRef])

  /* ── Inactivity ────────────────────────────────────────────────────────
   * One interval rather than three timers rescheduled on every mouse move.
   * `stage` only ever moves forward until activity resets it, so each beat
   * fires exactly once per quiet spell. */

  const markActive = useCallback(() => {
    lastActivityRef.current = Date.now()
    if (stageRef.current === 0) return
    stageRef.current = 0
    quietTargetRef.current = randomQuietDelay()
    handlersRef.current.onActive()
  }, [])

  const noteActivity = useCallback(() => markActive(), [markActive])

  const setHovering = useCallback(
    (hovering: boolean) => {
      hoveringRef.current = hovering
      markActive()

      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }

      if (!hovering) {
        if (proximityRef.current === 'over') {
          proximityRef.current = 'near'
          handlersRef.current.onProximity('near')
        }
        return
      }

      if (proximityRef.current !== 'over') {
        proximityRef.current = 'over'
        handlersRef.current.onProximity('over')
      }

      // Say hello only if the cursor actually settles. Crossing ORBI on the
      // way somewhere else is not a greeting.
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        if (hoveringRef.current) handlersRef.current.onHoverGreet()
      }, ORBI_INTERACTION.hoverGreetingDelay)
    },
    [markActive],
  )

  /* ── Listeners ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return

    measure()
    lastActivityRef.current = Date.now()
    quietTargetRef.current = randomQuietDelay()

    const passive = { passive: true } as const
    const cleanups: Array<() => void> = []
    const on = <K extends keyof DocumentEventMap>(
      target: Document | Window,
      type: K,
      fn: (event: DocumentEventMap[K]) => void,
    ) => {
      target.addEventListener(type, fn as EventListener, passive)
      cleanups.push(() =>
        target.removeEventListener(type, fn as EventListener),
      )
    }

    /* Cursor → gaze. No layout reads, no state, no allocation beyond two numbers. */
    if (pointerEnabled) {
      on(window, 'pointermove', (event) => {
        const move = event as PointerEvent
        if (move.pointerType === 'touch') return
        markActive()

        const centre = centreRef.current
        if (!centre) return

        const dx = move.clientX - centre.x
        const dy = move.clientY - centre.y
        const distance = Math.hypot(dx, dy)

        // Proximity is a ring around ORBI; `over` is owned by the SVG's own
        // pointer events, which are exact, so it is never inferred here.
        if (!hoveringRef.current) {
          const level: OrbiProximity =
            distance <= ORBI_INTERACTION.proximityRadius ? 'near' : 'far'
          if (level !== proximityRef.current) {
            proximityRef.current = level
            handlersRef.current.onProximity(level)
          }
        }

        const gain =
          proximityRef.current === 'far' ? 1 : ORBI_INTERACTION.proximityGain
        const reach = ORBI_INTERACTION.cursorRange * gain

        handlersRef.current.onGaze(
          (dx / GAZE_REFERENCE) * reach,
          (dy / GAZE_REFERENCE) * reach,
        )
      })

      // Cursor left the window entirely — recentre rather than freezing
      // mid-glance.
      on(document, 'pointerout', (event) => {
        if ((event as PointerEvent).relatedTarget) return
        handlersRef.current.onGazeEnd()
        if (proximityRef.current !== 'far') {
          proximityRef.current = 'far'
          handlersRef.current.onProximity('far')
        }
      })
      on(window, 'blur', () => handlersRef.current.onGazeEnd())
    }

    /* Anything at all counts as the user still being there. */
    on(window, 'pointerdown', markActive)
    on(window, 'keydown', markActive)
    on(window, 'touchstart', markActive)
    // The wheel is the one input that *is* scrolling, so it stamps its own
    // time as well as counting as activity. No extra listener: this is the
    // same one that was already here.
    on(window, 'wheel', () => {
      lastWheelRef.current = Date.now()
      markActive()
    })

    /* Geometry: measured here, never in a pointer handler. */
    on(window, 'resize', measure)

    /* Marked CTAs, by delegation — a CTA opts in with one attribute and never
       imports anything from ORBI. */
    let activeCta: Element | null = null
    let activeProject: Element | null = null
    let dwellTimer: ReturnType<typeof setTimeout> | null = null

    const clearDwell = () => {
      if (!dwellTimer) return
      clearTimeout(dwellTimer)
      dwellTimer = null
    }

    on(document, 'pointerover', (event) => {
      if (!pointerEnabled) return
      const target = event.target
      if (!(target instanceof Element)) return

      const cta = target.closest(ORBI_INTERACTION.ctaSelector)
      if (cta && cta !== activeCta) {
        activeCta = cta
        handlersRef.current.onCta(describeCta(cta, centreRef.current))
      }

      const project = target.closest(ORBI_SELECTORS.project)
      if (project && project !== activeProject) {
        activeProject = project
        clearDwell()
        const signal = describeTarget(project, centreRef.current)
        handlersRef.current.onProject(signal)
        // Moving across a row of cards is eyes only; settling on one for a
        // beat is what earns the single reaction.
        dwellTimer = setTimeout(() => {
          dwellTimer = null
          if (activeProject === project) {
            handlersRef.current.onProjectDwell(signal)
          }
        }, ORBI_ENVIRONMENT_PROJECT_DWELL)
      }
    })

    on(document, 'pointerout', (event) => {
      const related = (event as PointerEvent).relatedTarget

      if (activeCta && !(related instanceof Node && activeCta.contains(related))) {
        activeCta = null
        handlersRef.current.onCta(null)
      }

      if (
        activeProject &&
        !(related instanceof Node && activeProject.contains(related))
      ) {
        activeProject = null
        clearDwell()
        handlersRef.current.onProject(null)
      }
    })

    // Form focus is *not* handled here. `useOrbiForm` owns the whole contact
    // lifecycle — focus, validity, submission — because it answers a different
    // question on a different clock, and mixing it in would make this hook the
    // dumping ground the architecture is meant to avoid.

    /* Navigation: watch the opt-in toggle's `aria-expanded`. */
    const navToggle = document.querySelector(ORBI_INTERACTION.navSelector)
    let navOpen = navToggle?.getAttribute('aria-expanded') === 'true'
    let navObserver: MutationObserver | null = null

    if (navToggle) {
      navObserver = new MutationObserver(() => {
        const open = navToggle.getAttribute('aria-expanded') === 'true'
        if (open === navOpen) return
        navOpen = open
        markActive()
        handlersRef.current.onNav(open)
      })
      navObserver.observe(navToggle, { attributeFilter: ['aria-expanded'] })
    }

    /* Cards and panels that reveal detail. Attribute-filtered on purpose —
       ORBI reacts to a user-visible state change, not to DOM churn. */
    const expansion = new MutationObserver((records) => {
      for (const record of records) {
        const element = record.target
        if (!(element instanceof Element)) continue
        const open = element.getAttribute('data-orbi-expanded') === 'true'
        markActive()
        handlersRef.current.onExpanded(
          open ? describeTarget(element, centreRef.current) : null,
        )
        return
      }
    })
    expansion.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: ['data-orbi-expanded'],
    })

    /* Inactivity + visibility share one interval. */
    let hiddenAt = 0
    let ticker: ReturnType<typeof setInterval> | null = null

    const tick = () => {
      const quiet = Date.now() - lastActivityRef.current

      if (stageRef.current < 1 && quiet >= quietTargetRef.current) {
        stageRef.current = 1
        handlersRef.current.onQuiet()
      }
      if (stageRef.current < 2 && quiet >= ORBI_INTERACTION.drowsyDelay) {
        stageRef.current = 2
        handlersRef.current.onDrowsy(1)
      }
      if (stageRef.current < 3 && quiet >= ORBI_INTERACTION.dozeDelay) {
        stageRef.current = 3
        handlersRef.current.onDrowsy(2)
      }
      // Quiet for over a minute: not dozing any more, asleep. One more branch
      // on the interval that was already running — no new timer, no new
      // listener, and it still stops entirely while the tab is hidden.
      if (stageRef.current < 4 && quiet >= ORBI_EASTER_EGGS.deepSleepDelay) {
        stageRef.current = 4
        handlersRef.current.onDrowsy(3)
      }
    }

    const startTicker = () => {
      if (ticker) return
      ticker = setInterval(tick, IDLE_TICK_MS)
    }
    const stopTicker = () => {
      if (!ticker) return
      clearInterval(ticker)
      ticker = null
    }
    startTicker()

    on(document, 'visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Nothing ORBI does matters to someone looking at another tab.
        hiddenAt = Date.now()
        stopTicker()
        handlersRef.current.onGazeEnd()
        handlersRef.current.onVisibility(false)
        return
      }

      const away = hiddenAt ? Date.now() - hiddenAt : 0
      hiddenAt = 0
      measure()
      // Coming back is activity: ORBI must not be found mid-doze.
      markActive()
      startTicker()
      handlersRef.current.onVisibility(true)
      handlersRef.current.onReturn(away)
    })

    return () => {
      cleanups.forEach((off) => off())
      stopTicker()
      clearDwell()
      expansion.disconnect()
      navObserver?.disconnect()
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      hoverTimerRef.current = null
    }
  }, [enabled, pointerEnabled, markActive, measure])

  /* Tracking off (touch, or before the entrance finishes) means eyes centred. */
  useEffect(() => {
    if (enabled && pointerEnabled) return
    handlersRef.current.onGazeEnd()
  }, [enabled, pointerEnabled])

  const scrolledByHand = useCallback(
    () => Date.now() - lastWheelRef.current < ORBI_INTERACTION.handScrollWindowMs,
    [],
  )

  return { noteActivity, scrolledByHand, setHovering, refreshGeometry: measure }
}

/** How far the cursor travels for the pupils to reach their clamp, px. */
const GAZE_REFERENCE = 520
const IDLE_TICK_MS = 1000

const randomQuietDelay = () =>
  ORBI_INTERACTION.curiousMinDelay +
  Math.random() *
    (ORBI_INTERACTION.curiousMaxDelay - ORBI_INTERACTION.curiousMinDelay)

/** Dwell before a project card earns its one reaction. */
const ORBI_ENVIRONMENT_PROJECT_DWELL = 1200

/**
 * A stable-enough identifier that can never be user content.
 *
 * Falls back to visible text for ordinary elements, but never for a form
 * control — a `<textarea>` exposes its initial content through `textContent`,
 * and ORBI is not allowed to hold typed text under any circumstances.
 */
function labelFor(element: Element): string | null {
  if (element.matches('input,textarea,select,[contenteditable]')) return null
  const text = element.textContent?.trim().slice(0, 32)
  return text || null
}

/** Direction and side of any element, relative to where ORBI is sitting. */
function describeTarget(
  element: Element,
  centre: { x: number; y: number } | null,
): OrbiTargetSignal {
  const rect = element.getBoundingClientRect()
  const dx = centre ? rect.left + rect.width / 2 - centre.x : 0
  const dy = centre ? rect.top + rect.height / 2 - centre.y : 0

  return {
    key:
      element.getAttribute('data-orbi-project') ||
      element.id ||
      labelFor(element) ||
      'target',
    gaze: { x: clampUnit(dx / GAZE_REFERENCE), y: clampUnit(dy / GAZE_REFERENCE) },
    side: dx < 0 ? 'left' : 'right',
  }
}

/**
 * Read a CTA's opt-in. The attribute value is a comma-separated token list, so
 * markup stays declarative:
 *
 *   data-orbi-interest                       glance toward it
 *   data-orbi-interest="point"               glance and point, once in a while
 *   data-orbi-interest="point,say:Let's talk" and say something
 */
function describeCta(
  element: Element,
  centre: { x: number; y: number } | null,
): OrbiCtaSignal {
  const tokens = (element.getAttribute('data-orbi-interest') ?? '')
    .split(',')
    .map((token) => token.trim())
    .filter(Boolean)

  const say = tokens.find((token) => token.startsWith('say:'))
  const rect = element.getBoundingClientRect()
  const target = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }

  const dx = centre ? target.x - centre.x : 0
  const dy = centre ? target.y - centre.y : 0

  return {
    key:
      element.id ||
      element.getAttribute('href') ||
      labelFor(element) ||
      'cta',
    gaze: {
      x: clampUnit(dx / GAZE_REFERENCE),
      y: clampUnit(dy / GAZE_REFERENCE),
    },
    side: dx < 0 ? 'left' : 'right',
    point: tokens.includes('point'),
    message: say ? say.slice(4) : null,
  }
}

const clampUnit = (v: number) => (v < -1 ? -1 : v > 1 ? 1 : v)
