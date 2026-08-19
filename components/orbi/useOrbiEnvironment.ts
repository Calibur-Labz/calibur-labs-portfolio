'use client'

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import {
  ORBI_ENVIRONMENT,
  ORBI_FORM,
  ORBI_REGISTRY_SELECTOR,
  ORBI_SELECTORS,
  ORBI_WATCHED_SELECTOR,
  type OrbiBubblePlacement,
  type OrbiDock,
  type OrbiRegionTheme,
} from './orbiConfig'
import {
  chooseBubblePlacement,
  chooseDock,
  dockRect,
  rectFrom,
  type OrbiDockScore,
  type OrbiRect,
  type OrbiRegion,
  type OrbiViewport,
} from './orbiDocks'

export interface OrbiEnvironmentDecision {
  /** Where ORBI should be. */
  dock: OrbiDock
  /** Viewport-space box for that dock, so the guide can convert to a transform. */
  rect: OrbiRect | null
  /** Where the bubble can safely open. */
  bubble: { placement: OrbiBubblePlacement; align: 'left' | 'right' }
  /** Which visual region ORBI is currently over. */
  theme: OrbiRegionTheme
  /** A modal or full-screen overlay is up. */
  modal: boolean
  /**
   * Nowhere left to stand: even the best dock is still covered, or the visual
   * viewport has collapsed under an on-screen keyboard. ORBI should peek from
   * the edge rather than sit on top of something.
   */
  crowded: boolean
  /** Normalized direction from ORBI toward the open modal. */
  modalGaze: { x: number; y: number } | null
  /** Normalized direction from ORBI toward whatever is in the way. */
  noticeGaze: { x: number; y: number } | null
  /** Debug: label of the thing that forced the last move. */
  blocker: string | null
  /** Debug: worst overlap at the *current* dock, as a fraction of ORBI's area. */
  overlap: number
  /** Debug: every candidate's score. */
  scores: OrbiDockScore[]
  /** Debug: how many registered elements are being tracked. */
  regions: number
  /** Debug: why the last evaluation did what it did. */
  reason: string
}

const INITIAL: OrbiEnvironmentDecision = {
  dock: 'bottom-right',
  rect: null,
  bubble: { placement: 'above', align: 'right' },
  theme: 'dark',
  modal: false,
  crowded: false,
  modalGaze: null,
  noticeGaze: null,
  blocker: null,
  overlap: 0,
  scores: [],
  regions: 0,
  reason: 'initial',
}

export interface OrbiEnvironmentOptions {
  /** Held off until the entrance sequence has finished. */
  enabled: boolean
  /** ORBI's fixed container — the size to fit, and the anchor to measure from. */
  rootRef: RefObject<HTMLElement | null>
  /** Resolves the safe-area insets. */
  probeRef: RefObject<HTMLElement | null>
  /** Bubble box to test placements against. */
  bubbleSize: { width: number; height: number }
  /** ORBI's CSS anchor margins, so the default dock is a no-op. */
  margin: { x: number; y: number }
  /**
   * A region the visitor is working in — the contact form. Desktop only:
   * on a phone there is no room to sit beside anything.
   */
  companionRect?: OrbiRect | null
  mobile: boolean
}

export interface OrbiEnvironmentApi extends OrbiEnvironmentDecision {
  /**
   * Ask for a re-evaluation. Debounced, so calling it from several triggers at
   * once costs one measurement. Phase 4 choreography should call this when a
   * scripted move finishes.
   */
  refresh: (reason: string) => void
}

/**
 * ORBI's sense of the room.
 *
 * Kept apart from `useOrbiInteraction` on purpose: that hook answers "what is
 * the user doing", this one answers "what does the page look like right now".
 * They run on different clocks and mixing them would make both harder to
 * follow.
 *
 * This hook only ever *decides*. It never touches ORBI — `OrbiGuide` remains
 * the single authority that applies state and animation.
 *
 * Three rules keep it cheap:
 *
 *  - Nothing is measured per frame. Evaluation is debounced and driven by
 *    events: resize, orientation, scroll-stop, an observed attribute change, a
 *    registered element entering or leaving the viewport.
 *  - The registry is one `querySelectorAll` over opted-in attributes, not a
 *    walk of the document.
 *  - All reads happen together inside one `requestAnimationFrame`, so layout
 *    is flushed once rather than per element.
 */
export function useOrbiEnvironment({
  enabled,
  rootRef,
  probeRef,
  bubbleSize,
  margin,
  companionRect = null,
  mobile,
}: OrbiEnvironmentOptions): OrbiEnvironmentApi {
  const [decision, setDecision] = useState<OrbiEnvironmentDecision>(INITIAL)

  const dockRef = useRef<OrbiDock>('bottom-right')
  const dockSinceRef = useRef(0)
  const registryRef = useRef<Element[]>([])
  const frameRef = useRef(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const crowdedRef = useRef(false)
  const evaluateRef = useRef<(reason: string) => void>(() => {})
  const bubbleSizeRef = useRef(bubbleSize)
  const marginRef = useRef(margin)
  const companionRef = useRef(companionRect)
  const mobileRef = useRef(mobile)
  const enabledRef = useRef(enabled)

  useEffect(() => {
    bubbleSizeRef.current = bubbleSize
    marginRef.current = margin
    companionRef.current = companionRect
    mobileRef.current = mobile
    enabledRef.current = enabled
  })

  /* ── Measurement ─────────────────────────────────────────────────────── */

  const readViewport = useCallback((): OrbiViewport => {
    const probe = probeRef.current
    const style = probe ? getComputedStyle(probe) : null
    const px = (v: string | undefined) => (v ? parseFloat(v) || 0 : 0)

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      // Read off a hidden probe whose padding is `env(safe-area-inset-*)`, so
      // a notched phone in landscape reports real numbers rather than assumed
      // ones.
      insetTop: px(style?.paddingTop),
      insetRight: px(style?.paddingRight),
      insetBottom: px(style?.paddingBottom),
      insetLeft: px(style?.paddingLeft),
      marginX: marginRef.current.x,
      marginY: marginRef.current.y,
    }
  }, [probeRef])

  const collectRegions = useCallback((viewport: OrbiViewport) => {
    const regions: OrbiRegion[] = []
    /**
     * Extra regions the *bubble* dodges but ORBI's body does not. Individual
     * form controls belong here: a small panel floating over an input for two
     * seconds is worth avoiding, but registering every field as an obstacle
     * would have ORBI fleeing the form altogether.
     */
    const soft: OrbiRegion[] = []
    let modal = false
    let modalRect: OrbiRect | null = null

    for (const element of registryRef.current) {
      if (!element.isConnected) continue

      const rect = element.getBoundingClientRect()
      // Off-screen and zero-size elements cannot be in the way.
      if (rect.width <= 0 || rect.height <= 0) continue
      if (rect.bottom <= 0 || rect.top >= viewport.height) continue
      if (rect.right <= 0 || rect.left >= viewport.width) continue

      const isModal =
        element.matches(ORBI_SELECTORS.modal) ||
        element.getAttribute('data-orbi-avoid') === 'modal'
      const high = element.getAttribute('data-orbi-avoid') === 'high'

      if (isModal) {
        modal = true
        // The largest overlay wins if several are open.
        const current = modalRect
          ? (modalRect.right - modalRect.left) * (modalRect.bottom - modalRect.top)
          : 0
        if (rect.width * rect.height > current) modalRect = rectFrom(rect)
      }

      regions.push({
        rect: rectFrom(rect),
        weight: isModal
          ? ORBI_ENVIRONMENT.modalWeight
          : high
            ? ORBI_ENVIRONMENT.highWeight
            : 1,
        label:
          element.getAttribute('data-orbi-label') ||
          element.id ||
          (isModal ? 'modal' : element.tagName.toLowerCase()),
        urgent: isModal || high,
      })
    }

    // Controls inside a visible registered form.
    for (const form of document.querySelectorAll(ORBI_SELECTORS.form)) {
      const box = form.getBoundingClientRect()
      if (box.height <= 0 || box.bottom <= 0 || box.top >= viewport.height) continue

      for (const control of form.querySelectorAll(
        `${ORBI_SELECTORS.field},${ORBI_SELECTORS.submit}`,
      )) {
        const rect = control.getBoundingClientRect()
        if (rect.width <= 0 || rect.height <= 0) continue
        if (rect.bottom <= 0 || rect.top >= viewport.height) continue
        soft.push({
          rect: rectFrom(rect),
          weight: 1,
          label: control.getAttribute('data-orbi-field') ?? 'submit',
          urgent: false,
        })
      }
    }

    return { regions, soft, modal, modalRect }
  }, [])

  const readTheme = useCallback((rect: OrbiRect): OrbiRegionTheme => {
    const x = (rect.left + rect.right) / 2
    const y = (rect.top + rect.bottom) / 2
    // Topmost wins: `elementsFromPoint` is ordered front to back, so a light
    // card sitting on a dark section reports light, which is what ORBI sees.
    for (const element of document.elementsFromPoint(x, y)) {
      const theme = element.closest?.(ORBI_SELECTORS.theme)
      const value = theme?.getAttribute('data-orbi-theme')
      if (value === 'light' || value === 'dark') return value
    }
    return 'dark'
  }, [])

  /* ── Evaluation ──────────────────────────────────────────────────────── */

  const evaluate = useCallback(
    (reason: string) => {
      const root = rootRef.current
      if (!root || !enabledRef.current) return

      if (retryRef.current) {
        clearTimeout(retryRef.current)
        retryRef.current = null
      }

      // Every read happens here, in one frame, after layout has settled.
      const viewport = readViewport()
      const box = root.getBoundingClientRect()
      const size = { width: box.width, height: box.height }
      if (!size.width || !size.height) return

      const { regions, soft, modal, modalRect } = collectRegions(viewport)
      const current = dockRef.current
      const outcome = chooseDock(
        current,
        size,
        regions,
        viewport,
        mobileRef.current ? null : companionRef.current,
      )

      const now = performance.now()
      const held = now - dockSinceRef.current

      // `chooseDock` already decided *where*; all that is left is *whether now*
      // — and something high-priority being covered bypasses the hold.
      const wants = outcome.dock !== current
      const allowed = outcome.urgent || held >= ORBI_ENVIRONMENT.minHoldMs

      const next = wants && allowed ? outcome.dock : current
      if (next !== current) {
        dockRef.current = next
        dockSinceRef.current = now
      } else if (wants && !allowed) {
        // The move is warranted but ORBI has not been here long enough. Nothing
        // else will fire once the hold lapses — the page has already settled —
        // so book the re-check now, or he would stay put forever.
        retryRef.current = setTimeout(
          () => evaluateRef.current('hold-expired'),
          ORBI_ENVIRONMENT.minHoldMs - held + 60,
        )
      }

      const rect = dockRect(next, size, viewport)
      const blocker = outcome.currentScore.blocker

      // Is there anywhere good left? Measured against the dock ORBI is about
      // to occupy, not the one he is leaving.
      const chosen = outcome.scores.find((s) => s.dock === next)!
      const visual = window.visualViewport
      const squeezed =
        !!visual && visual.height < viewport.height * ORBI_FORM.keyboardViewportRatio
      const crowded =
        squeezed ||
        (crowdedRef.current
          ? chosen.overlap > ORBI_ENVIRONMENT.crowdedExit
          : chosen.overlap >= ORBI_ENVIRONMENT.crowdedEnter)
      crowdedRef.current = crowded

      // Only glance at the obstruction when actually moving because of it.
      const noticeGaze =
        next !== current && blocker
          ? normalize(
              (blocker.rect.left + blocker.rect.right) / 2 -
                (box.left + box.right) / 2,
              (blocker.rect.top + blocker.rect.bottom) / 2 -
                (box.top + box.bottom) / 2,
            )
          : null

      setDecision({
        dock: next,
        rect,
        bubble: chooseBubblePlacement(
          rect,
          bubbleSizeRef.current,
          // The bubble avoids everything ORBI avoids, plus the form's own
          // controls — it is small and temporary, so it can afford to be fussier.
          regions.concat(soft),
          viewport,
        ),
        theme: readTheme(rect),
        modal,
        crowded,
        modalGaze: modalRect
          ? normalize(
              (modalRect.left + modalRect.right) / 2 - (rect.left + rect.right) / 2,
              (modalRect.top + modalRect.bottom) / 2 - (rect.top + rect.bottom) / 2,
            )
          : null,
        noticeGaze,
        blocker: blocker?.label ?? null,
        overlap: outcome.currentScore.overlap,
        scores: outcome.scores,
        regions: regions.length,
        reason:
          (next !== current
            ? `${reason} → ${next}${outcome.urgent ? ' (urgent)' : ''}`
            : `${reason} → hold`) + (crowded ? ' · crowded' : ''),
      })
    },
    [collectRegions, readTheme, readViewport, rootRef],
  )

  /** Debounced, and always measured inside a frame. */
  const refresh = useCallback(
    (reason: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null
        cancelAnimationFrame(frameRef.current)
        frameRef.current = requestAnimationFrame(() => evaluate(reason))
      }, ORBI_ENVIRONMENT.evaluateDebounceMs)
    },
    [evaluate],
  )

  const refreshRef = useRef(refresh)
  useEffect(() => {
    refreshRef.current = refresh
    evaluateRef.current = evaluate
  })

  /* ── Watching ────────────────────────────────────────────────────────── */

  useEffect(() => {
    if (!enabled) return

    const ping = (reason: string) => refreshRef.current(reason)

    // A single observer over registered elements, so "the CTA scrolled into
    // view" is an event rather than something we poll for.
    const intersection = new IntersectionObserver(() => ping('visibility'), {
      threshold: [0, 0.01],
    })

    const rescan = () => {
      intersection.disconnect()
      registryRef.current = Array.from(
        document.querySelectorAll(ORBI_REGISTRY_SELECTOR),
      )
      for (const element of registryRef.current) intersection.observe(element)
      ping('registry')
    }
    rescan()

    // Attribute-filtered, so this fires when a modal opens or a CTA is marked
    // — not on every style write React makes.
    const attributes = new MutationObserver(() => rescan())
    attributes.observe(document.body, {
      subtree: true,
      attributes: true,
      attributeFilter: [
        'data-orbi-avoid',
        'data-orbi-modal',
        'data-orbi-theme',
        'data-orbi-form',
        'open',
      ],
    })

    // Nodes can also arrive already marked — a modal mounting, a card list
    // re-rendering. Only subtrees that actually contain a registered element
    // trigger work.
    const structure = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue
          if (
            node.matches(ORBI_WATCHED_SELECTOR) ||
            node.querySelector(ORBI_WATCHED_SELECTOR)
          ) {
            rescan()
            return
          }
        }
        for (const node of record.removedNodes) {
          if (!(node instanceof Element)) continue
          if (
            registryRef.current.includes(node) ||
            node.matches(ORBI_WATCHED_SELECTOR) ||
            node.querySelector(ORBI_WATCHED_SELECTOR)
          ) {
            rescan()
            return
          }
        }
      }
    })
    structure.observe(document.body, { subtree: true, childList: true })

    const onResize = () => ping('resize')
    const onOrientation = () => ping('orientation')

    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('orientationchange', onOrientation, { passive: true })

    // The on-screen keyboard changes the *visual* viewport without touching
    // `innerHeight`, so a phone keyboard would otherwise be invisible here.
    // Heavily debounced: the keyboard animates, and ORBI must not chase it.
    let keyboardTimer: ReturnType<typeof setTimeout> | null = null
    const viewport = window.visualViewport
    const onVisualViewport = () => {
      if (keyboardTimer) clearTimeout(keyboardTimer)
      keyboardTimer = setTimeout(
        () => ping('visual-viewport'),
        ORBI_FORM.viewportDebounceMs,
      )
    }
    viewport?.addEventListener('resize', onVisualViewport, { passive: true })

    // Layout below the fold changes what is nearby; measure once it stops.
    let scrollTimer: ReturnType<typeof setTimeout> | null = null
    const onScroll = () => {
      if (scrollTimer) clearTimeout(scrollTimer)
      scrollTimer = setTimeout(
        () => ping('scroll-stop'),
        ORBI_ENVIRONMENT.scrollSettleMs,
      )
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      intersection.disconnect()
      attributes.disconnect()
      structure.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('orientationchange', onOrientation)
      viewport?.removeEventListener('resize', onVisualViewport)
      if (keyboardTimer) clearTimeout(keyboardTimer)
      window.removeEventListener('scroll', onScroll)
      if (scrollTimer) clearTimeout(scrollTimer)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (retryRef.current) clearTimeout(retryRef.current)
      cancelAnimationFrame(frameRef.current)
    }
  }, [enabled])

  // Re-measure when ORBI's own footprint changes.
  useEffect(() => {
    if (!enabled) return
    refreshRef.current('size')
  }, [
    enabled,
    mobile,
    bubbleSize.width,
    bubbleSize.height,
    margin.x,
    margin.y,
    companionRect,
  ])

  return { ...decision, refresh }
}

/** Direction only — magnitude is clamped by the gaze controller anyway. */
function normalize(dx: number, dy: number) {
  const length = Math.hypot(dx, dy) || 1
  return { x: dx / length, y: dy / length }
}
