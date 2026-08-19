'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  ORBI_CINEMATIC,
  ORBI_CINEMATICS,
  ORBI_COOLDOWNS,
  type OrbiBreakpoint,
  type OrbiCinematicPhase,
  type OrbiCinematicType,
} from './orbiConfig'
import {
  chooseCinematicSpot,
  rectFrom,
  visibleFraction,
  type OrbiRect,
  type OrbiRegion,
  type OrbiViewport,
} from './orbiDocks'
import {
  createCinematicFlight,
  readCinematicOffset,
  resetCinematic,
  type OrbiMotionOptions,
} from './orbiAnimations'

/**
 * ORBI — cinematic movement.
 *
 * Occasionally ORBI leaves his dock and moves into the page itself: beside the
 * hero, next to the precision diagram, over the project cards. Rare on
 * purpose — most of the time he stays put, and that is what makes going
 * somewhere read as deliberate rather than as an animation on a loop.
 *
 * Shape follows the rest of ORBI: this owns the *travel* — one dedicated
 * transform layer nothing else writes — and reports a phase. `OrbiGuide`
 * decides what face and gesture belong to each beat. Sections never contain
 * choreography; they opt in with `data-orbi-cinematic="…"` and nothing else.
 *
 * Two rules it will not bend:
 *
 *  - **Never over content that matters.** The destination is scored against
 *    the same registered regions the docking system uses. If nowhere beside
 *    the target is clear, the cinematic is skipped rather than forced.
 *  - **Never accumulate.** Every position is an absolute offset from ORBI's
 *    anchor, and the layer is reset to identity when a sequence ends — however
 *    it ends.
 */

export interface OrbiCinematicSnapshot {
  active: boolean
  type: OrbiCinematicType | null
  phase: OrbiCinematicPhase
  /** Destination offset from the anchor, for the debug HUD. */
  destination: { x: number; y: number } | null
  safe: boolean
  cancelReason: string | null
  elapsedMs: number
  /** Bumped per run, so the guide can react to beats without double-firing. */
  runId: number
}

const IDLE: OrbiCinematicSnapshot = {
  active: false,
  type: null,
  phase: 'idle',
  destination: null,
  safe: true,
  cancelReason: null,
  elapsedMs: 0,
  runId: 0,
}

export interface OrbiCinematicOptions {
  /** Held off until the entrance has finished (the hero run is separate). */
  enabled: boolean
  /** The dedicated travel layer. Nothing else may write to it. */
  travelRef: RefObject<HTMLElement | null>
  /** ORBI's anchor, for size and for the offset maths. */
  rootRef: RefObject<HTMLElement | null>
  motion: OrbiMotionOptions
  breakpoint: OrbiBreakpoint
  /** Live viewport + regions from the environment controller. */
  readEnvironment: () => { viewport: OrbiViewport; regions: OrbiRegion[] } | null
  /** Consulted before every run: modal open, form in use, anything else. */
  canRun: () => boolean
  /** Priority claim. Returns false if something outranks the cinematic. */
  claim: (owner: string, durationMs: number) => boolean
  release: (owner: string) => void
  /** Re-measure once ORBI is home; the page may have moved while he was away. */
  onLanded: (reason: string) => void
}

export interface OrbiCinematicApi extends OrbiCinematicSnapshot {
  /** Ask for a run. Returns false when refused — the caller need not care why. */
  request: (type: OrbiCinematicType) => boolean
  cancel: (reason: string) => void
}

export function useOrbiCinematic({
  enabled,
  travelRef,
  rootRef,
  motion,
  breakpoint,
  readEnvironment,
  canRun,
  claim,
  release,
  onLanded,
}: OrbiCinematicOptions): OrbiCinematicApi {
  const [snapshot, setSnapshot] = useState<OrbiCinematicSnapshot>(IDLE)

  const runRef = useRef(0)
  const activeRef = useRef(false)
  const typeRef = useRef<OrbiCinematicType | null>(null)
  const startedAtRef = useRef(0)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const timelineRef = useRef<gsap.core.Timeline | null>(null)
  const lastRunRef = useRef(new Map<OrbiCinematicType, number>())
  const lastAnyRef = useRef(-Infinity)
  const playedRef = useRef(new Set<OrbiCinematicType>())
  const watchRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const targetRectRef = useRef<OrbiRect | null>(null)

  const optionsRef = useRef({ motion, breakpoint, readEnvironment, canRun, claim, release, onLanded })
  useEffect(() => {
    optionsRef.current = { motion, breakpoint, readEnvironment, canRun, claim, release, onLanded }
  })

  /* ── Bookkeeping ─────────────────────────────────────────────────────── */

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    if (watchRef.current) {
      clearInterval(watchRef.current)
      watchRef.current = null
    }
  }, [])

  const at = useCallback((run: number, ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      if (run !== runRef.current) return
      fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  const publish = useCallback(
    (patch: Partial<OrbiCinematicSnapshot>) => {
      setSnapshot((current) => ({
        ...current,
        elapsedMs: startedAtRef.current
          ? Math.round(performance.now() - startedAtRef.current)
          : 0,
        ...patch,
      }))
    },
    [],
  )

  /**
   * End a run — any run, however it ended. Kills the timeline, puts the travel
   * layer back to identity, hands the claim back, and asks the environment to
   * re-measure, because the page may have changed while ORBI was away.
   */
  const finish = useCallback(
    (reason: string | null) => {
      if (!activeRef.current) return
      const type = typeRef.current

      runRef.current += 1
      activeRef.current = false
      typeRef.current = null
      targetRectRef.current = null

      clearTimers()
      timelineRef.current?.kill()
      timelineRef.current = null
      resetCinematic(travelRef.current)

      optionsRef.current.release('cinematic')
      publish({
        active: false,
        type: null,
        phase: 'idle',
        destination: null,
        cancelReason: reason,
      })
      optionsRef.current.onLanded(reason ? `cinematic-cancel:${reason}` : 'cinematic-land')

      // A cancelled run is not a played run — it may legitimately try again.
      if (reason && type) playedRef.current.delete(type)
    },
    [clearTimers, publish, travelRef],
  )

  const cancel = useCallback(
    (reason: string) => {
      if (!activeRef.current) return

      // Fly home rather than snapping: a cancel should look like ORBI thought
      // better of it, not like a dropped frame.
      const travel = travelRef.current
      const run = runRef.current
      if (!travel) return finish(reason)

      clearTimers()
      timelineRef.current?.kill()
      publish({ phase: 'back', cancelReason: reason })

      const current = readCinematicOffset(travel)
      const back = travelDuration(current, { x: 0, y: 0 }, optionsRef.current.breakpoint)

      timelineRef.current = createCinematicFlight(travel, {
        from: current,
        to: { x: 0, y: 0 },
        arc: ORBI_CINEMATIC.returnStyles[2],
        durationMs: back,
        lean: optionsRef.current.motion.reducedMotion ? 0 : ORBI_CINEMATIC.leanDeg,
        onComplete: () => {
          if (run !== runRef.current) return
          finish(reason)
        },
      })
    },
    [clearTimers, finish, publish, travelRef],
  )

  /* ── Running one ─────────────────────────────────────────────────────── */

  const request = useCallback(
    (type: OrbiCinematicType) => {
      const spec = ORBI_CINEMATICS[type]
      const opts = optionsRef.current
      if (!spec || activeRef.current) return false
      if (spec.desktopOnly && opts.breakpoint === 'mobile') return false
      // No cross-screen flights when motion is reduced. The guide still runs
      // the semantic beat — expression and gaze — from the dock.
      if (opts.motion.reducedMotion) return false
      if (!opts.canRun()) return false

      const now = performance.now()
      if (spec.once && playedRef.current.has(type)) return false
      if (now - lastAnyRef.current < ORBI_COOLDOWNS.cinematicGlobal) return false
      const last = lastRunRef.current.get(type)
      if (last !== undefined && now - last < ORBI_COOLDOWNS.cinematic) return false

      const travel = travelRef.current
      const root = rootRef.current
      const env = opts.readEnvironment()
      if (!travel || !root || !env) return false

      const target = document.querySelector(
        `[data-orbi-cinematic="${type}"]`,
      )
      if (!target) return false

      const targetRect = rectFrom(target.getBoundingClientRect())
      if (visibleFraction(targetRect, env.viewport) < 0.4) return false

      const box = root.getBoundingClientRect()
      const size = { width: box.width, height: box.height }

      const spot = chooseCinematicSpot(
        targetRect,
        size,
        env.regions,
        env.viewport,
        spec.prefer,
      )
      // Nowhere clear beside the target — skip it. A flourish is never worth
      // covering a control for.
      if (!spot) {
        publish({ safe: false, cancelReason: 'no-safe-destination' })
        return false
      }

      if (!opts.claim('cinematic', spec.dwellMs + 6000)) return false

      // Destination as an offset from where ORBI already is. Absolute, so
      // repeated runs cannot drift.
      const destination = {
        x: spot.rect.left - box.left,
        y: spot.rect.top - box.top,
      }

      const run = ++runRef.current
      activeRef.current = true
      typeRef.current = type
      startedAtRef.current = performance.now()
      targetRectRef.current = targetRect
      lastRunRef.current.set(type, now)
      lastAnyRef.current = now
      if (spec.once) playedRef.current.add(type)

      publish({
        active: true,
        type,
        phase: 'out',
        destination,
        safe: true,
        cancelReason: null,
        runId: run,
      })

      const out = travelDuration({ x: 0, y: 0 }, destination, opts.breakpoint)

      timelineRef.current = createCinematicFlight(travel, {
        from: { x: 0, y: 0 },
        to: destination,
        arc: ORBI_CINEMATIC.arcRatio,
        durationMs: out,
        lean: ORBI_CINEMATIC.leanDeg,
        onComplete: () => {
          if (run !== runRef.current) return
          publish({ phase: 'arrive' })

          // The pause before reacting. Small, and the whole thing falls flat
          // without it — arriving and reacting have to read as two events.
          at(run, ORBI_CINEMATIC.arriveSettleMs, () => {
            publish({ phase: 'perform' })

            at(run, spec.dwellMs, () => {
              publish({ phase: 'back' })

              // Return paths vary by run so the trip home is not a rewind of
              // the trip out — deterministic, not random.
              const styleIndex = run % ORBI_CINEMATIC.returnStyles.length
              const home = travelDuration(destination, { x: 0, y: 0 }, opts.breakpoint)

              timelineRef.current = createCinematicFlight(travel, {
                from: destination,
                to: { x: 0, y: 0 },
                arc: ORBI_CINEMATIC.returnStyles[styleIndex],
                durationMs: home,
                lean: ORBI_CINEMATIC.leanDeg,
                onComplete: () => {
                  if (run !== runRef.current) return
                  publish({ phase: 'land' })
                  at(run, ORBI_CINEMATIC.landSettleMs, () => finish(null))
                },
              })
            })
          })
        },
      })

      // While travelling, keep half an eye on the target. If the visitor
      // scrolls it away, come home rather than performing to an empty screen.
      watchRef.current = setInterval(() => {
        if (run !== runRef.current) return
        const current = optionsRef.current.readEnvironment()
        const rect = target.getBoundingClientRect()
        if (!current) return
        if (
          visibleFraction(rectFrom(rect), current.viewport) <
          ORBI_CINEMATIC.abortVisibility
        ) {
          cancel('target-left-view')
        }
      }, 240)

      return true
    },
    [at, cancel, finish, publish, rootRef, travelRef],
  )

  /* Everything stops when ORBI does. */
  useEffect(() => {
    if (enabled) return
    finish(null)
  }, [enabled, finish])

  useEffect(() => {
    const timers = timersRef.current
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
      if (watchRef.current) clearInterval(watchRef.current)
      timelineRef.current?.kill()
    }
  }, [])

  return { ...snapshot, request, cancel }
}

/** Longer trips take longer, within bounds — never a three-second crawl. */
function travelDuration(
  from: { x: number; y: number },
  to: { x: number; y: number },
  breakpoint: OrbiBreakpoint,
): number {
  const distance = Math.hypot(to.x - from.x, to.y - from.y)
  if (breakpoint === 'mobile') return ORBI_CINEMATIC.mobileMs

  const base =
    distance > ORBI_CINEMATIC.longDistance
      ? ORBI_CINEMATIC.longMs
      : ORBI_CINEMATIC.shortMs

  return breakpoint === 'tablet'
    ? Math.round(base * ORBI_CINEMATIC.tabletScale)
    : base
}
