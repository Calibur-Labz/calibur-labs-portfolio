'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ORBI_GUIDE,
  ORBI_GUIDE_ITEMS,
  ORBI_GUIDE_SIDES,
  guidePanelSize,
  type OrbiGuideItem,
  type OrbiGuidePhase,
  type OrbiGuidePlacement,
} from './orbiGuideConfig'
import { ORBI_PLACEMENT, type OrbiBreakpoint, type OrbiDock } from './orbiConfig'
import {
  chooseGuidePlacement,
  guideSheetRect,
  type OrbiRect,
  type OrbiRegion,
  type OrbiViewport,
} from './orbiDocks'

/**
 * ORBI — guide mode.
 *
 * Phase 12, and the same division of labour as every other subsystem here:
 * this owns the *lifecycle* — open, choose, travel, arrive, cancel — and
 * `OrbiGuide` owns what ORBI's face and body do at each beat. The panel is a
 * presentation component that knows none of this.
 *
 * The lifecycle is five states and deliberately no more:
 *
 *   closed → opening → choosing → navigating → arriving → closed
 *
 * Two rules hold it together:
 *
 *  - **One travel owner.** Guide mode never animates ORBI across the page. It
 *    scrolls the document to a section and then *releases*, so the section's
 *    existing reaction — and, where the cooldowns allow, its existing Phase 7
 *    cinematic — is the one and only thing that performs on arrival.
 *  - **The visitor is always in control.** A wheel, a swipe, a scroll key,
 *    Escape, a modal, the navigation menu, a hidden tab or a resize all cancel
 *    rather than pause. Cancelling is cheap; fighting someone's scroll is not.
 */

export interface OrbiGuideSnapshot {
  phase: OrbiGuidePhase
  /** The panel is up (or on its way up). */
  open: boolean
  /** What the visitor picked. Kept through `arriving` for the HUD. */
  selected: OrbiGuideItem | null
  placement: OrbiGuidePlacement
  /**
   * Where the panel goes, as offsets from ORBI's own box — which is exactly
   * where the layer it renders in sits, so this is all the component needs and
   * the geometry has one home. `null` until the first measurement.
   */
  box: { left: number; top: number; width: number; height: number } | null
  /**
   * What the panel had to open over, when every side was blocked and the least
   * bad one was taken. `null` means it is sitting on nothing at all.
   */
  blocked: string | null
  /** Why the last run ended early, if it did. */
  cancelReason: string | null
  /** True while guide mode holds the priority claim. */
  owning: boolean
  /** Bumped per run so the guide can perform a beat exactly once. */
  runId: number
}

const IDLE: OrbiGuideSnapshot = {
  phase: 'closed',
  open: false,
  selected: null,
  placement: 'above-right',
  box: null,
  blocked: null,
  cancelReason: null,
  owning: false,
  runId: 0,
}

export interface OrbiGuideOptions {
  /** Held off until the entrance has finished, like everything else. */
  enabled: boolean
  breakpoint: OrbiBreakpoint
  reducedMotion: boolean
  /** ORBI's decided box in viewport coordinates — the panel anchors to it. */
  orbiRect: OrbiRect | null
  dock: OrbiDock
  /** The same regions the docking system uses. One source of "don't cover that". */
  readEnvironment: () => { viewport: OrbiViewport; regions: OrbiRegion[] } | null
  claim: (owner: string, durationMs: number) => boolean
  release: (owner: string) => void
  /** Woken, if he was asleep. Returns the delay the opening beat should take. */
  onOpen: () => number
  /** The visitor picked something: the acknowledgement beat. */
  onChoose: (item: OrbiGuideItem) => void
  /** The page has settled at the destination. Run its existing reaction. */
  onArrive: (item: OrbiGuideItem) => void
  /** Ended early. Put back anything the acknowledgement left behind. */
  onCancel: (reason: string, item: OrbiGuideItem | null) => void
}

export interface OrbiGuideApi extends OrbiGuideSnapshot {
  items: readonly OrbiGuideItem[]
  toggle: () => void
  openMenu: () => void
  close: (reason: string) => void
  choose: (item: OrbiGuideItem) => void
  /** Re-decide where the panel sits — dock change, resize. */
  remeasure: () => void
}

/** Keys that scroll the page, and therefore end a guided trip. */
const SCROLL_KEYS = new Set([
  'ArrowUp',
  'ArrowDown',
  'PageUp',
  'PageDown',
  'Home',
  'End',
  ' ',
  'Spacebar',
])

export function useOrbiGuideMode({
  enabled,
  breakpoint,
  reducedMotion,
  orbiRect,
  dock,
  readEnvironment,
  claim,
  release,
  onOpen,
  onChoose,
  onArrive,
  onCancel,
}: OrbiGuideOptions): OrbiGuideApi {
  const [snapshot, setSnapshot] = useState<OrbiGuideSnapshot>(IDLE)

  const runRef = useRef(0)
  const phaseRef = useRef<OrbiGuidePhase>('closed')
  const selectedRef = useRef<OrbiGuideItem | null>(null)
  const owningRef = useRef(false)
  const timersRef = useRef(new Set<ReturnType<typeof setTimeout>>())
  /** Torn down together when a trip ends, however it ends. */
  const listenersRef = useRef<Array<() => void>>([])
  const settleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startedAtRef = useRef(0)
  const wheelRef = useRef(0)

  const optionsRef = useRef({
    breakpoint,
    reducedMotion,
    orbiRect,
    dock,
    readEnvironment,
    claim,
    release,
    onOpen,
    onChoose,
    onArrive,
    onCancel,
  })
  useEffect(() => {
    optionsRef.current = {
      breakpoint,
      reducedMotion,
      orbiRect,
      dock,
      readEnvironment,
      claim,
      release,
      onOpen,
      onChoose,
      onArrive,
      onCancel,
    }
  })

  /* ── Bookkeeping ─────────────────────────────────────────────────────── */

  const at = useCallback((run: number, ms: number, fn: () => void) => {
    const id = setTimeout(() => {
      timersRef.current.delete(id)
      if (run !== runRef.current) return
      fn()
    }, ms)
    timersRef.current.add(id)
  }, [])

  const clearTimers = useCallback(() => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
    if (settleRef.current) {
      clearTimeout(settleRef.current)
      settleRef.current = null
    }
  }, [])

  const detach = useCallback(() => {
    listenersRef.current.forEach((off) => off())
    listenersRef.current = []
  }, [])

  const releaseClaim = useCallback(() => {
    if (!owningRef.current) return
    owningRef.current = false
    optionsRef.current.release('guide')
  }, [])

  const publish = useCallback((patch: Partial<OrbiGuideSnapshot>) => {
    setSnapshot((current) => ({ ...current, ...patch }))
  }, [])

  /* ── Placement ───────────────────────────────────────────────────────── */

  /**
   * Decided from the same geometry the docking system uses, and expressed
   * relative to ORBI's own box — which is where the panel is rendered, so it
   * travels with him from dock to dock without being repositioned per frame.
   */
  const measure = useCallback(() => {
    const opts = optionsRef.current
    const env = opts.readEnvironment()
    const orbi = opts.orbiRect
    const size = guidePanelSize(opts.breakpoint)
    const { gap, margin, unsafeOverlap, sheetMaxWidth, sheetMinHeight } =
      ORBI_GUIDE.panel

    // The environment has not measured yet — first open of a visit, or a
    // browser that has not given us a layout. Take the default placement
    // rather than rendering no menu at all: something the visitor pressed a
    // button for must never simply fail to appear.
    if (!env || !orbi) {
      const box = ORBI_PLACEMENT[opts.breakpoint]
      publish({
        placement: 'above-right',
        blocked: null,
        box: {
          left: box.size - size.width,
          top: -(gap + size.height),
          width: size.width,
          height: size.height,
        },
      })
      return
    }

    const spot = chooseGuidePlacement(
      orbi,
      size,
      env.regions,
      env.viewport,
      ORBI_GUIDE_SIDES[opts.dock] ?? ORBI_GUIDE_SIDES['bottom-right'],
      { gap, margin, unsafeOverlap },
    )

    /** Viewport coordinates → offsets from ORBI's box, which is the layer. */
    const relative = (rect: { left: number; top: number; right: number; bottom: number }) => ({
      left: Math.round(rect.left - orbi.left),
      top: Math.round(rect.top - orbi.top),
      width: Math.round(rect.right - rect.left),
      height: Math.round(rect.bottom - rect.top),
    })

    if (spot) {
      publish({
        placement: spot.side,
        box: relative(spot.rect),
        blocked: spot.clear ? null : spot.blocker,
      })
      return
    }

    // Nothing fits beside him at all. The sheet always has an answer.
    const rect = guideSheetRect(orbi, size, env.viewport, {
      gap,
      margin,
      unsafeOverlap,
      maxWidth: sheetMaxWidth,
      minHeight: sheetMinHeight,
    })
    publish({ placement: 'sheet', blocked: null, box: relative(rect) })
  }, [publish])

  /* ── Ending ──────────────────────────────────────────────────────────── */

  /**
   * One exit for every ending — chosen, closed, cancelled, unmounted. Kills
   * the timers, drops the listeners, hands the claim back, and resets. Nothing
   * else is allowed to leave guide mode.
   */
  const finish = useCallback(
    (reason: string | null) => {
      // Nothing to end. Also what keeps "stand down" idempotent: a modal, the
      // navigation and a hidden tab all close guide mode, and they can easily
      // all be true at once.
      if (phaseRef.current === 'closed') return

      const item = selectedRef.current
      const wasNavigating =
        phaseRef.current === 'navigating' || phaseRef.current === 'arriving'

      runRef.current += 1
      phaseRef.current = 'closed'
      selectedRef.current = null
      wheelRef.current = 0

      clearTimers()
      detach()
      releaseClaim()

      publish({
        phase: 'closed',
        open: false,
        selected: null,
        owning: false,
        cancelReason: reason,
      })

      /*
       * Every ending that is not "we arrived" hands ORBI back — including
       * simply closing the menu. The opening beat points his eyes at the panel
       * through the `interaction` gaze slot, and a slot nobody clears is a
       * robot left staring at a menu that is no longer there.
       */
      if (reason) optionsRef.current.onCancel(reason, item)

      if (reason && wasNavigating) {
        /*
         * Abandon the scroll guide mode started.
         *
         * Dropping the listeners is not enough: a smooth `scrollIntoView` is
         * the browser's animation now, and it will happily carry on to the
         * destination while ORBI has stopped guiding. Starting a new scroll
         * cancels the one in flight, and scrolling to where the page already
         * is moves nothing the visitor can see — it only stops ours. Their own
         * wheel or swipe carries on from there, which is the whole point: this
         * is standing down, not taking the page back.
         */
        window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: 'auto' })
      }
    },
    [clearTimers, detach, publish, releaseClaim],
  )

  const close = useCallback((reason: string) => finish(reason), [finish])

  /* ── Opening ─────────────────────────────────────────────────────────── */

  const openMenu = useCallback(() => {
    if (!enabled) return
    if (phaseRef.current !== 'closed') return

    const opts = optionsRef.current
    const run = ++runRef.current
    phaseRef.current = 'opening'
    startedAtRef.current = performance.now()

    // The visitor asked for this, so it outranks whatever ORBI was doing —
    // and it is held only for the beat itself.
    owningRef.current = opts.claim('guide', ORBI_GUIDE.openClaimMs)
    measure()
    publish({
      phase: 'opening',
      open: false,
      selected: null,
      cancelReason: null,
      owning: owningRef.current,
      runId: run,
    })

    // `onOpen` wakes him if he was under, and says how long that took: the
    // panel must never appear over a robot who still looks asleep.
    const delay = ORBI_GUIDE.openBeatMs + opts.onOpen()

    at(run, delay, () => {
      phaseRef.current = 'choosing'
      // The menu being up is not a reason to own ORBI. Handing the claim back
      // here is what keeps a poke, a blink and the dizzy beat all working
      // while the visitor reads five words.
      releaseClaim()
      measure()
      publish({ phase: 'choosing', open: true, owning: false })
    })
  }, [at, enabled, measure, publish, releaseClaim])

  const toggle = useCallback(() => {
    if (phaseRef.current === 'closed') openMenu()
    else close('toggle')
  }, [close, openMenu])

  /* ── Travelling ──────────────────────────────────────────────────────── */

  const arrive = useCallback(
    (run: number, item: OrbiGuideItem) => {
      if (run !== runRef.current) return
      if (phaseRef.current !== 'navigating') return

      clearTimers()
      detach()
      phaseRef.current = 'arriving'
      // Released *before* the destination reacts: the section beat claims at
      // `section`, which guide mode would otherwise be sitting on top of.
      releaseClaim()
      publish({ phase: 'arriving', owning: false })

      optionsRef.current.onArrive(item)

      at(run, ORBI_GUIDE.arriveHoldMs, () => finish(null))
    },
    [at, clearTimers, detach, finish, publish, releaseClaim],
  )

  /**
   * Move the page. Deliberately the site's own scrolling and nothing more
   * clever: `scrollIntoView` honours the `scroll-padding-top` that keeps
   * anchors clear of the fixed navbar, so guide mode lands in exactly the same
   * place a click on the navigation would.
   */
  const travel = useCallback(
    (run: number, item: OrbiGuideItem) => {
      if (run !== runRef.current) return

      const target = document.getElementById(item.target)
      if (!target) return finish('missing-target')

      target.scrollIntoView({
        // An explicit behaviour beats the CSS property, so reduced motion has
        // to be asked for here rather than left to the stylesheet.
        behavior: optionsRef.current.reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })

      const settle = () => {
        if (settleRef.current) clearTimeout(settleRef.current)
        settleRef.current = setTimeout(() => {
          settleRef.current = null
          const waited = performance.now() - startedAtRef.current
          const remaining = Math.max(0, ORBI_GUIDE.minTravelMs - waited)
          // Never arrive before the acknowledgement has been readable, even
          // when the destination was already on screen and nothing moved.
          if (remaining > 0) at(run, remaining, () => arrive(run, item))
          else arrive(run, item)
        }, ORBI_GUIDE.settleMs)
      }

      const on = <K extends keyof WindowEventMap>(
        type: K,
        handler: (event: WindowEventMap[K]) => void,
      ) => {
        window.addEventListener(type, handler as EventListener, { passive: true })
        listenersRef.current.push(() =>
          window.removeEventListener(type, handler as EventListener),
        )
      }

      on('scroll', settle)
      // A deliberate push, not a palm resting on a trackpad.
      on('wheel', (event) => {
        wheelRef.current += Math.abs(event.deltaY) + Math.abs(event.deltaX)
        if (wheelRef.current >= ORBI_GUIDE.cancelScrollDelta) finish('user-scroll')
      })
      on('touchmove', () => finish('user-scroll'))
      on('keydown', (event) => {
        if (event.key === 'Escape') return finish('escape')
        if (SCROLL_KEYS.has(event.key)) finish('user-scroll')
      })
      // The target may have moved under a reflow; the scroll we asked for is
      // no longer the one we would ask for now.
      on('resize', () => finish('resize'))
      on('orientationchange', () => finish('resize'))

      // Start the clock even if the page never scrolls — the destination may
      // already be exactly where it needs to be.
      settle()
      // ...and a hard ceiling, so a smooth scroll that never settles (a page
      // animating underneath it) still lands somewhere.
      at(run, ORBI_GUIDE.navTimeoutMs, () => arrive(run, item))
    },
    [arrive, at, finish],
  )

  const choose = useCallback(
    (item: OrbiGuideItem) => {
      if (phaseRef.current !== 'choosing' && phaseRef.current !== 'opening') return

      const run = ++runRef.current
      phaseRef.current = 'navigating'
      selectedRef.current = item
      startedAtRef.current = performance.now()
      wheelRef.current = 0

      owningRef.current = optionsRef.current.claim('guide', ORBI_GUIDE.navClaimMs)
      publish({
        phase: 'navigating',
        open: false,
        selected: item,
        cancelReason: null,
        owning: owningRef.current,
        runId: run,
      })

      optionsRef.current.onChoose(item)

      // A beat of "right, this way" before the page moves. Small, and the
      // difference between a menu and a teleport.
      at(run, ORBI_GUIDE.travelDelayMs, () => travel(run, item))
    },
    [at, publish, travel],
  )

  /* ── Standing down ───────────────────────────────────────────────────── */

  /* Escape closes the menu wherever focus is; the trip has its own listener. */
  useEffect(() => {
    if (!snapshot.open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close('escape')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [snapshot.open, close])

  /**
   * ...and so does touching anything else on the page.
   *
   * `pointerdown`, not `click`: a menu should be gone by the time whatever was
   * pressed responds. The control itself is excluded — its own handler
   * toggles, and closing here first would make the second press re-open it and
   * the button look dead.
   *
   * Only the pointer *landing* elsewhere counts. It merely leaving the panel
   * does not: a cursor drifting off a menu is not a decision (§18).
   */
  useEffect(() => {
    if (!snapshot.open) return
    const onDown = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest('[data-orbi-guide-panel],[data-orbi-guide-control]')) return
      close('outside')
    }
    // Capture, so a handler that stops the event cannot leave the menu open.
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [snapshot.open, close])

  /*
   * Everything stops when ORBI does — a tick behind the commit that disabled
   * him rather than inside it. Standing guide mode down is a state change, and
   * running one synchronously off the back of someone else's is how a cascade
   * starts; the same reason every deferred beat in `OrbiGuide` goes through
   * `later(…, 0)`.
   */
  useEffect(() => {
    if (enabled) return
    const id = setTimeout(() => finish(null), 0)
    return () => clearTimeout(id)
  }, [enabled, finish])

  useEffect(() => {
    const timers = timersRef.current
    // The *ref*, not the array it currently holds: `detach` replaces the array,
    // so a captured one would be an empty stale copy by the time this runs.
    const listeners = listenersRef
    return () => {
      timers.forEach(clearTimeout)
      timers.clear()
      listeners.current.forEach((off) => off())
      listeners.current = []
      optionsRef.current.release('guide')
    }
  }, [])

  return {
    ...snapshot,
    items: ORBI_GUIDE_ITEMS,
    toggle,
    openMenu,
    close,
    choose,
    remeasure: measure,
  }
}
