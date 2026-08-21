'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  ORBI_EASTER_EGGS,
  ORBI_EASTER_MESSAGES,
  ORBI_EASTER_SPECS,
  ORBI_NO_DISCOVERIES,
  ORBI_SELECTORS,
  type OrbiBreakpoint,
  type OrbiDiscoveries,
  type OrbiEasterEgg,
} from './orbiConfig'
import {
  createCircleTracker,
  createClickWindow,
  createVelocityTracker,
} from './orbiEasterDetect'

/**
 * ORBI — the hidden reactions.
 *
 * Phase 8's whole job is to make ORBI feel like there is more to him than the
 * visible behaviour, and the only way that works is if the hidden part stays
 * hidden most of the time. So this controller is mostly a set of reasons *not*
 * to do something: a cooldown per reaction, a global one between any two, a
 * hard "only one at a time", a budget of two bubbles for the entire visit, and
 * a `canRun()` the guide answers with everything it knows about forms, modals,
 * cinematics and safety.
 *
 * Shape follows the cinematic controller deliberately. This owns *detection*
 * and *eligibility* and publishes a numbered beat; `OrbiGuide` stays the only
 * thing that ever touches an expression, a gesture or a bubble. Sections and
 * page content opt in with attributes and never import any of it.
 *
 * Everything expensive is avoided rather than optimised: pointer samples go to
 * three fixed-size detectors in `orbiEasterDetect`, no React state is written
 * on a pointer move, and geometry is re-read at most a couple of times a
 * second while a gesture is actually in progress.
 */

export interface OrbiEasterSnapshot {
  active: boolean
  type: OrbiEasterEgg | null
  /** Which beat of the sequence is showing. −1 when nothing is running. */
  step: number
  /** Bumped per run, so the guide can replay a beat without double-firing. */
  runId: number
  /** Where to look, for the reactions that have a subject. */
  gaze: { x: number; y: number } | null
  /** Deterministic flavour index, for reactions with more than one. */
  variant: number
  /** The one line this run may say. Almost always null. */
  bubble: string | null
  discoveries: OrbiDiscoveries
  /** Egg bubbles spent this visit, out of `maxBubbles`. */
  bubbles: number
  /* Debug HUD only. */
  clicks: number
  chasing: boolean
  circle: number
  depth: number
  cooldownMs: number
  lastEvent: string
}

const IDLE: OrbiEasterSnapshot = {
  active: false,
  type: null,
  step: -1,
  runId: 0,
  gaze: null,
  variant: 0,
  bubble: null,
  discoveries: ORBI_NO_DISCOVERIES,
  bubbles: 0,
  clicks: 0,
  chasing: false,
  circle: 0,
  depth: 0,
  cooldownMs: 0,
  lastEvent: '—',
}

export interface OrbiEasterOptions {
  /** Held off until the entrance has handed over to normal service. */
  enabled: boolean
  rootRef: RefObject<HTMLElement | null>
  breakpoint: OrbiBreakpoint
  reducedMotion: boolean
  /** A real cursor is present. Half of these reactions need one. */
  finePointer: boolean
  /**
   * The debug HUD is showing. Detector telemetry is published to React only
   * when it is: in production a pointer move costs three fixed-size detector
   * updates and not one render.
   */
  hud?: boolean
  /**
   * Everything the guide knows that should stop a flourish: a modal, an open
   * menu, a cinematic in flight, a form being filled in, an urgent relocation.
   * Asked per reaction, because the two the visitor triggers by touching ORBI
   * are allowed through things the unprompted ones are not.
   */
  canRun: (type: OrbiEasterEgg) => boolean
  /**
   * Take the priority claim. `takeOver` names a claim this reaction is allowed
   * to inherit — the repeated-click beat succeeds the click that triggered it,
   * so it takes over from `click` rather than being refused by it.
   */
  claim: (owner: string, durationMs: number, takeOver?: string) => boolean
  release: (owner: string) => void
}

export interface OrbiEasterApi extends OrbiEasterSnapshot {
  /** A click landed on ORBI. True when it *became* the repeated-click beat. */
  noteClick: () => boolean
  /** A tap on the head region rather than the body. */
  noteHeadTap: () => boolean
  /** The cursor entered or left the painted robot. */
  setHovering: (hovering: boolean) => void
  /** ORBI took, or left, the footer perch. */
  setFooter: (inFooter: boolean) => void
  /** Inactivity depth from the sensor. 3 is properly asleep. */
  setDepth: (depth: number) => void
  /**
   * The visitor is back, and ORBI was properly asleep. True when the wake
   * sequence took over from the ordinary one.
   */
  noteWake: () => boolean
  request: (type: OrbiEasterEgg) => boolean
  cancel: (reason: string) => void
}

/** The five reactions that count as discoveries; the rest are just moods. */
const DISCOVERY_KEYS: Partial<Record<OrbiEasterEgg, keyof OrbiDiscoveries>> = {
  dizzyClick: 'dizzyClick',
  cursorCircle: 'cursorCircle',
  headTap: 'headTap',
  footerSecret: 'footerSecret',
  deepWake: 'deepWake',
}

export function useOrbiEasterEggs({
  enabled,
  rootRef,
  breakpoint,
  reducedMotion,
  finePointer,
  hud = false,
  canRun,
  claim,
  release,
}: OrbiEasterOptions): OrbiEasterApi {
  const [snapshot, setSnapshot] = useState<OrbiEasterSnapshot>(IDLE)

  const runRef = useRef(0)
  const activeRef = useRef(false)
  const typeRef = useRef<OrbiEasterEgg | null>(null)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  const lastRunRef = useRef(new Map<OrbiEasterEgg, number>())
  const lastAnyRef = useRef(-Infinity)
  const playedRef = useRef(new Set<OrbiEasterEgg>())
  const discoveriesRef = useRef<OrbiDiscoveries>({ ...ORBI_NO_DISCOVERIES })
  const bubblesRef = useRef(0)
  const lastBubbleRef = useRef(new Map<OrbiEasterEgg, number>())
  /** Per reaction, so a flavour cycle is not disturbed by other reactions. */
  const variantsRef = useRef(new Map<OrbiEasterEgg, number>())
  const depthRef = useRef(0)

  /** ORBI's centre and half-size. Re-read at most a few times a second. */
  const boxRef = useRef({ x: 0, y: 0, half: 74, at: -Infinity })

  const optionsRef = useRef({ breakpoint, reducedMotion, finePointer, hud, canRun, claim, release })
  useEffect(() => {
    optionsRef.current = { breakpoint, reducedMotion, finePointer, hud, canRun, claim, release }
  })

  /* ── Detectors ───────────────────────────────────────────────────────── */

  const [clicks] = useState(() =>
    createClickWindow(
      ORBI_EASTER_EGGS.repeatedClickCount,
      ORBI_EASTER_EGGS.repeatedClickWindow,
    ),
  )
  const [velocity] = useState(() =>
    createVelocityTracker({
      velocity: ORBI_EASTER_EGGS.chaseVelocity,
      radius: ORBI_EASTER_EGGS.chaseRadius,
      samples: ORBI_EASTER_EGGS.chaseSamples,
    }),
  )
  const [circle] = useState(() =>
    createCircleTracker({
      minDegrees: ORBI_EASTER_EGGS.circleMinDegrees,
      maxStepDegrees: ORBI_EASTER_EGGS.circleMaxStepDegrees,
      reverseDegrees: ORBI_EASTER_EGGS.circleReverseDegrees,
      minRadius: ORBI_EASTER_EGGS.circleMinRadius,
      maxRadius: ORBI_EASTER_EGGS.circleMaxRadius,
      minSamples: ORBI_EASTER_EGGS.circleMinSamples,
      windowMs: ORBI_EASTER_EGGS.circleWindowMs,
    }),
  )

  /* ── Bookkeeping ─────────────────────────────────────────────────────── */

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])

  const at = useCallback((run: number, ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      if (run !== runRef.current) return
      fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  const publish = useCallback((patch: Partial<OrbiEasterSnapshot>) => {
    setSnapshot((current) => ({ ...current, ...patch }))
  }, [])

  /** End a run — however it ended. One teardown, always. */
  const finish = useCallback(
    (reason: string | null) => {
      if (!activeRef.current) return
      const type = typeRef.current
      runRef.current += 1
      activeRef.current = false
      typeRef.current = null
      clearTimers()
      optionsRef.current.release('easter')
      publish({
        active: false,
        type: null,
        step: -1,
        gaze: null,
        bubble: null,
        lastEvent: reason ? `${type}:${reason}` : `${type}:done`,
      })
    },
    [clearTimers, publish],
  )

  const cancel = useCallback((reason: string) => finish(reason), [finish])

  /* ── Eligibility ─────────────────────────────────────────────────────── */

  /**
   * Whether a given reaction may run *right now*. Deliberately a long list of
   * refusals: rarity is the feature.
   */
  const eligible = useCallback(
    (type: OrbiEasterEgg, now: number) => {
      const spec = ORBI_EASTER_SPECS[type]
      const opts = optionsRef.current
      if (!spec || activeRef.current) return false
      if (spec.once && playedRef.current.has(type)) return false
      if (spec.desktopOnly && opts.breakpoint === 'mobile') return false
      if (spec.pointerOnly && !opts.finePointer) return false
      if (spec.motionOnly && opts.reducedMotion) return false
      if (now - lastAnyRef.current < ORBI_EASTER_EGGS.globalCooldown) return false
      const last = lastRunRef.current.get(type)
      if (last !== undefined && now - last < spec.cooldown) return false
      return opts.canRun(type)
    },
    [],
  )

  /**
   * The one line this run may say, or null — which is the usual answer.
   * A message is spent only on a genuine first discovery, only while the
   * visit still has bubble budget, and never twice inside its own window.
   */
  const bubbleFor = useCallback((type: OrbiEasterEgg, now: number) => {
    const message = ORBI_EASTER_MESSAGES[type as keyof typeof ORBI_EASTER_MESSAGES]
    if (!message) return null
    if (bubblesRef.current >= ORBI_EASTER_EGGS.maxBubbles) return null

    const key = DISCOVERY_KEYS[type]
    if (key && discoveriesRef.current[key]) return null

    const grace =
      type === 'headTap'
        ? ORBI_EASTER_EGGS.headTapBubbleCooldown
        : type === 'deepWake'
          ? ORBI_EASTER_EGGS.deepWakeBubbleCooldown
          : 0
    const spoken = lastBubbleRef.current.get(type)
    if (grace && spoken !== undefined && now - spoken < grace) return null

    lastBubbleRef.current.set(type, now)
    bubblesRef.current += 1
    return message
  }, [])

  const markDiscovered = useCallback((type: OrbiEasterEgg) => {
    const key = DISCOVERY_KEYS[type]
    if (!key) return
    discoveriesRef.current = { ...discoveriesRef.current, [key]: true }
  }, [])

  /* ── Running one ─────────────────────────────────────────────────────── */

  const start = useCallback(
    (type: OrbiEasterEgg, gaze: { x: number; y: number } | null, takeOver?: string) => {
      const spec = ORBI_EASTER_SPECS[type]
      const now = performance.now()
      if (!eligible(type, now)) return false

      const total = spec.beats.reduce((sum, beat) => sum + beat, 0)
      if (!optionsRef.current.claim('easter', total + 600, takeOver)) return false

      const run = ++runRef.current
      activeRef.current = true
      typeRef.current = type
      lastRunRef.current.set(type, now)
      lastAnyRef.current = now
      if (spec.once) playedRef.current.add(type)

      const bubble = bubbleFor(type, now)
      markDiscovered(type)

      // Reactions with more than one flavour walk their variants in order, so
      // a long visit stays varied and a test run stays repeatable.
      const variant = variantsRef.current.get(type) ?? 0
      variantsRef.current.set(type, variant + 1)

      publish({
        active: true,
        type,
        step: 0,
        runId: run,
        gaze,
        variant,
        bubble,
        discoveries: discoveriesRef.current,
        bubbles: bubblesRef.current,
        lastEvent: `${type}:start`,
      })

      // Walk the beats. Each one is just "hold, then advance"; what a beat
      // *looks* like is the guide's business, not this file's.
      let elapsed = 0
      spec.beats.forEach((beat, index) => {
        elapsed += beat
        const next = index + 1
        at(run, elapsed, () => {
          if (next < spec.beats.length) publish({ step: next })
          else finish(null)
        })
      })

      return true
    },
    [at, bubbleFor, eligible, finish, markDiscovered, publish],
  )

  const request = useCallback((type: OrbiEasterEgg) => start(type, null), [start])

  /* ── Clicks ──────────────────────────────────────────────────────────── */

  const noteClick = useCallback(() => {
    const now = performance.now()
    const hit = clicks.note(now)
    if (optionsRef.current.hud) publish({ clicks: clicks.count(now) })
    if (!hit) return false
    // The fifth click is a different event from the first: it succeeds the
    // ordinary click reaction rather than competing with it.
    return start('dizzyClick', null, 'click')
  }, [clicks, publish, start])

  const noteHeadTap = useCallback(
    () => start('headTap', null, 'click'),
    [start],
  )

  /* ── Inactivity ──────────────────────────────────────────────────────── */

  const setDepth = useCallback(
    (depth: number) => {
      depthRef.current = depth
      publish({ depth })
    },
    [publish],
  )

  const noteWake = useCallback(() => {
    // Deliberately not gated on `depth`: the guide asks this from inside its
    // own wake path, by which point the visitor's activity has already reset
    // every depth counter there is. Whether ORBI was asleep is the guide's
    // question, and it has already answered it.
    depthRef.current = 0
    return start('deepWake', null)
  }, [start])

  /* ── Hover: ORBI himself, and the logo ───────────────────────────────── */

  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const logoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const footerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setHovering = useCallback(
    (hovering: boolean) => {
      if (hoverTimerRef.current) {
        clearTimeout(hoverTimerRef.current)
        hoverTimerRef.current = null
      }
      if (!hovering) return
      hoverTimerRef.current = setTimeout(() => {
        hoverTimerRef.current = null
        start('selfAware', null)
      }, ORBI_EASTER_EGGS.selfAwareHoverDelay)
    },
    [start],
  )

  const setFooter = useCallback(
    (inFooter: boolean) => {
      if (footerTimerRef.current) {
        clearTimeout(footerTimerRef.current)
        footerTimerRef.current = null
      }
      if (!inFooter) return
      // Staying put at the bottom is the trigger — passing through it is not.
      footerTimerRef.current = setTimeout(() => {
        footerTimerRef.current = null
        start('footerSecret', { x: -0.55, y: 0.75 })
      }, ORBI_EASTER_EGGS.footerSecretDelay)
    },
    [start],
  )

  /* ── Pointer ─────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return
    if (!finePointer || breakpoint === 'mobile') return

    const measure = (t: number) => {
      const el = rootRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      boxRef.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        half: Math.max(rect.width, rect.height) / 2 || 74,
        at: t,
      }
    }

    let hudAt = 0

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      const t = event.timeStamp || performance.now()

      // ORBI moves — docks, perches, flies. Re-read his box a couple of times
      // a second while the pointer is actually moving, never per sample.
      if (t - boxRef.current.at > 400) measure(t)
      const box = boxRef.current

      const dx = event.clientX - box.x
      const dy = event.clientY - box.y
      const distance = Math.hypot(dx, dy)

      if (velocity.feed(event.clientX, event.clientY, t, distance)) {
        start('cursorChase', null)
      }
      if (circle.feed(dx, dy, distance / box.half, t)) {
        start('cursorCircle', null)
      }

      // The HUD is the only reason any of this would reach React at all, and
      // only when it is actually open — a few times a second, never per move.
      if (optionsRef.current.hud && t - hudAt > 250) {
        hudAt = t
        publish({ chasing: velocity.active(), circle: circle.progress() })
      }
    }

    /* The brand mark, by delegation: one attribute, no imports. */
    let overLogo: Element | null = null
    const clearLogo = () => {
      if (logoTimerRef.current) {
        clearTimeout(logoTimerRef.current)
        logoTimerRef.current = null
      }
    }

    const onOver = (event: Event) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const logo = target.closest(ORBI_SELECTORS.logo)
      if (logo === overLogo) return
      overLogo = logo
      clearLogo()
      if (!logo) return

      logoTimerRef.current = setTimeout(() => {
        logoTimerRef.current = null
        if (overLogo !== logo) return
        const rect = logo.getBoundingClientRect()
        const box = boxRef.current
        const dx = rect.left + rect.width / 2 - box.x
        const dy = rect.top + rect.height / 2 - box.y
        const length = Math.hypot(dx, dy) || 1
        start('logoNod', { x: dx / length, y: dy / length })
      }, ORBI_EASTER_EGGS.logoHoverDelay)
    }

    const passive = { passive: true } as const
    window.addEventListener('pointermove', onMove, passive)
    document.addEventListener('pointerover', onOver, passive)

    return () => {
      window.removeEventListener('pointermove', onMove)
      document.removeEventListener('pointerover', onOver)
      clearLogo()
      velocity.reset()
      circle.reset()
    }
  }, [enabled, finePointer, breakpoint, rootRef, velocity, circle, publish, start])

  /* ── Unprompted beats ────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return

    const gaps = ORBI_EASTER_EGGS.rareIdleGaps
    let index = 0
    let timer: ReturnType<typeof setTimeout> | null = null

    const schedule = () => {
      const gap = gaps[index++ % gaps.length]
      timer = setTimeout(() => {
        // "Genuinely idle" is about ORBI, not the visitor: he is resting, holds
        // no claim, has nothing to say, and is not asleep. The guide answers
        // all of that in `canRun`, so this only has to ask.
        start('rareIdle', null)
        schedule()
      }, gap)
    }
    schedule()

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [enabled, start])

  /** The disappearing act: never early, never twice, and only when idle. */
  useEffect(() => {
    if (!enabled) return
    if (breakpoint === 'mobile' || reducedMotion) return

    let timer: ReturnType<typeof setTimeout> | null = null
    const check = () => {
      if (!playedRef.current.has('edgePeek') && depthRef.current >= 1) {
        start('edgePeek', null)
      }
      if (playedRef.current.has('edgePeek')) return
      timer = setTimeout(check, 15000)
    }
    timer = setTimeout(check, ORBI_EASTER_EGGS.edgePeekDelay)

    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [enabled, breakpoint, reducedMotion, start])

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
      if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
      if (logoTimerRef.current) clearTimeout(logoTimerRef.current)
      if (footerTimerRef.current) clearTimeout(footerTimerRef.current)
    }
  }, [])

  /** Remaining cooldown on the reaction that ran last. Debug HUD only. */
  const cooldownMs = (() => {
    const type = snapshot.type ?? lastTypeOf(lastRunRef.current)
    if (!type) return 0
    const last = lastRunRef.current.get(type)
    if (last === undefined) return 0
    const left = ORBI_EASTER_SPECS[type].cooldown - (performance.now() - last)
    return left > 0 ? Math.round(left) : 0
  })()

  return {
    ...snapshot,
    cooldownMs,
    noteClick,
    noteHeadTap,
    setHovering,
    setFooter,
    setDepth,
    noteWake,
    request,
    cancel,
  }
}

/** Whichever reaction ran most recently. */
function lastTypeOf(runs: Map<OrbiEasterEgg, number>): OrbiEasterEgg | null {
  let best: OrbiEasterEgg | null = null
  let at = -Infinity
  runs.forEach((time, type) => {
    if (time > at) {
      at = time
      best = type
    }
  })
  return best
}
