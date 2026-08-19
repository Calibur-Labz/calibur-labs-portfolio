/**
 * ORBI — dock geometry and scoring.
 *
 * Pure functions over plain rectangles: no DOM, no React, no GSAP. Everything
 * that decides *where ORBI should be* lives here, so the choice can be
 * reasoned about (and corrected) without a browser.
 *
 * The scoring is deliberately deterministic. The same visible layout always
 * produces the same dock — no randomness, no tie-break by insertion order.
 */

import {
  ORBI_DEFAULT_DOCK,
  ORBI_DOCK_FALLBACKS,
  ORBI_DOCKS,
  ORBI_ENVIRONMENT,
  type OrbiBubblePlacement,
  type OrbiDock,
} from './orbiConfig'

export interface OrbiRect {
  left: number
  top: number
  right: number
  bottom: number
}

export interface OrbiRegion {
  rect: OrbiRect
  /** `data-orbi-avoid="high"`, a modal, or an ordinary avoid region. */
  weight: number
  /** For the debug HUD and for the glance-toward-the-obstruction beat. */
  label: string
  /** Modals and full-screen menus can bypass the dock hold. */
  urgent: boolean
}

export interface OrbiViewport {
  width: number
  height: number
  /** Safe-area insets, already resolved to px. */
  insetTop: number
  insetRight: number
  insetBottom: number
  insetLeft: number
  /**
   * The margins ORBI keeps off the edges, on top of the insets. These are the
   * same numbers as his CSS anchor, so `bottom-right` resolves to exactly
   * where he already is and the default dock costs no transform at all.
   */
  marginX: number
  marginY: number
}

export const rectFrom = (r: DOMRectReadOnly | DOMRect): OrbiRect => ({
  left: r.left,
  top: r.top,
  right: r.right,
  bottom: r.bottom,
})

const area = (r: OrbiRect) =>
  Math.max(0, r.right - r.left) * Math.max(0, r.bottom - r.top)

/** Overlapping area of two rectangles. Zero when they merely touch. */
export function intersectionArea(a: OrbiRect, b: OrbiRect): number {
  const w = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return w > 0 && h > 0 ? w * h : 0
}

/** Shortest gap between two rectangles; 0 when they overlap. */
export function rectGap(a: OrbiRect, b: OrbiRect): number {
  const dx = Math.max(0, Math.max(a.left - b.right, b.left - a.right))
  const dy = Math.max(0, Math.max(a.top - b.bottom, b.top - a.bottom))
  return Math.hypot(dx, dy)
}

/**
 * Where ORBI's box sits for a given dock.
 *
 * Docks are expressed in viewport coordinates rather than as offsets, because
 * safe-area insets make "the bottom right corner" a different place on a
 * notched phone than on a desktop.
 */
export function dockRect(
  dock: OrbiDock,
  size: { width: number; height: number },
  viewport: OrbiViewport,
): OrbiRect {
  const left = viewport.insetLeft + viewport.marginX
  const right =
    viewport.width - viewport.insetRight - viewport.marginX - size.width
  const bottom =
    viewport.height - viewport.insetBottom - viewport.marginY - size.height
  const middle =
    (viewport.height + viewport.insetTop - viewport.insetBottom - size.height) /
    2

  const x = dock === 'bottom-left' || dock === 'mid-left' ? left : right
  const y = dock === 'mid-left' || dock === 'mid-right' ? middle : bottom

  return { left: x, top: y, right: x + size.width, bottom: y + size.height }
}

export interface OrbiDockScore {
  dock: OrbiDock
  /** Lower is better. Used to rank candidates, never to decide *whether* to move. */
  score: number
  /**
   * Weighted overlap. Non-zero means something registered is genuinely
   * covered here — this, and only this, is what makes a dock unusable.
   */
  collision: number
  /**
   * Weighted nearness to something registered without covering it. Breaks ties
   * between usable docks; deliberately cannot make a dock unusable, or ORBI
   * would flee anything he merely sits beside.
   */
  crowd: number
  /** Worst single overlap, as a fraction of ORBI's area. */
  overlap: number
  /** What is in the way, if anything. */
  blocker: OrbiRegion | null
}

/**
 * Score one dock. Collision dominates; everything else only breaks ties.
 *
 * A clipped corner below `collisionThreshold` is ignored outright — ORBI
 * should not relocate because a shadow grazes him — but anything marked
 * high-priority is measured against a much tighter threshold and weighted up.
 */
export function scoreDock(
  dock: OrbiDock,
  rect: OrbiRect,
  regions: OrbiRegion[],
  viewport: OrbiViewport,
  current: OrbiDock,
  /**
   * Something the visitor is working in — a form. Docks level with it and
   * clear of its horizontal span score better, which puts ORBI *beside* it
   * rather than under it. A nudge only: collisions still decide usability.
   */
  companion: OrbiRect | null = null,
): OrbiDockScore {
  const cfg = ORBI_ENVIRONMENT
  const own = area(rect) || 1

  let collision = 0
  let crowd = 0
  let worstOverlap = 0
  let blocker: OrbiRegion | null = null

  for (const region of regions) {
    const ratio = intersectionArea(rect, region.rect) / own
    const threshold =
      region.weight > 1 ? cfg.highCollisionThreshold : cfg.collisionThreshold

    if (ratio > threshold) {
      collision += ratio * region.weight
      if (ratio > worstOverlap) {
        worstOverlap = ratio
        blocker = region
      }
      continue
    }

    // Not covering it, but close enough to look crowded. Noted, not acted on.
    const gap = rectGap(rect, region.rect)
    if (gap < cfg.proximityRadius) {
      crowd +=
        ((cfg.proximityRadius - gap) / cfg.proximityRadius) *
        cfg.proximityWeight *
        region.weight
    }
  }

  // Anything that would hang off the screen is disqualified in practice.
  const overflow =
    Math.max(0, viewport.insetLeft - rect.left) +
    Math.max(0, rect.right - (viewport.width - viewport.insetRight)) +
    Math.max(0, viewport.insetTop - rect.top) +
    Math.max(0, rect.bottom - (viewport.height - viewport.insetBottom))

  // Prefer the smallest visual move...
  const order = ORBI_DOCK_FALLBACKS[current].indexOf(dock)
  const travel = order < 0 ? ORBI_DOCKS.length : order

  let beside = 0
  if (companion) {
    const dockCx = (rect.left + rect.right) / 2
    const dockCy = (rect.top + rect.bottom) / 2
    const overlapsSpan = dockCx > companion.left && dockCx < companion.right
    const offLevel =
      Math.abs(dockCy - (companion.top + companion.bottom) / 2) /
      Math.max(1, viewport.height)
    beside = ((overlapsSpan ? 1 : 0) + Math.min(1, offLevel * 2)) *
      cfg.companionWeight
  }

  const score =
    collision +
    crowd +
    beside +
    (overflow > 0 ? cfg.edgeWeight : 0) +
    travel * cfg.travelWeight +
    // ...and keep a pull toward home, so a relocation reads as temporary.
    (dock === ORBI_DEFAULT_DOCK ? 0 : cfg.homeWeight)

  return { dock, score, collision, crowd, overlap: worstOverlap, blocker }
}

export interface OrbiDockDecision {
  /** Where ORBI should be, ignoring how long he has been where he is. */
  dock: OrbiDock
  scores: OrbiDockScore[]
  /** The score for where ORBI is right now. */
  currentScore: OrbiDockScore
  /** Something registered is genuinely covered at the current dock. */
  blocked: boolean
  /** ...and it is high-priority or a modal, so the dock hold is bypassed. */
  urgent: boolean
}

/**
 * Pick the dock.
 *
 * Deliberately *not* a pure "lowest score wins": scores rank candidates, but
 * the decision to move at all is binary and explicit —
 *
 *   blocked here            → take the best usable dock
 *   free, and not at home   → go home
 *   otherwise               → stay
 *
 * An earlier version compared scores against a margin, which meant a tuning
 * change in any weight could quietly strand ORBI away from home. This cannot.
 *
 * The caller owns the hysteresis, because only it knows how long ORBI has been
 * where he is.
 */
export function chooseDock(
  current: OrbiDock,
  size: { width: number; height: number },
  regions: OrbiRegion[],
  viewport: OrbiViewport,
  companion: OrbiRect | null = null,
): OrbiDockDecision {
  const scores = ORBI_DOCKS.map((dock) =>
    scoreDock(
      dock,
      dockRect(dock, size, viewport),
      regions,
      viewport,
      current,
      companion,
    ),
  )

  // Sorted by score, then by the fallback order, so ties never depend on
  // array order or on when a region happened to be registered.
  const fallback = ORBI_DOCK_FALLBACKS[current]
  const ranked = [...scores].sort(
    (a, b) =>
      a.score - b.score || fallback.indexOf(a.dock) - fallback.indexOf(b.dock),
  )

  const currentScore = scores.find((s) => s.dock === current)!
  const homeScore = scores.find((s) => s.dock === ORBI_DEFAULT_DOCK)!
  const blocked = currentScore.collision > 0

  let dock = current
  if (blocked) dock = ranked[0].dock
  else if (current !== ORBI_DEFAULT_DOCK && homeScore.collision === 0) {
    dock = ORBI_DEFAULT_DOCK
  }

  const urgent =
    blocked &&
    (currentScore.overlap >= ORBI_ENVIRONMENT.urgentOverlap ||
      (currentScore.blocker?.urgent ?? false))

  return { dock, scores, currentScore, blocked, urgent }
}

/* ── Speech bubble ─────────────────────────────────────────────────────── */

export interface OrbiBubbleChoice {
  placement: OrbiBubblePlacement
  /** Which edge the bubble aligns to when it sits above ORBI. */
  align: 'left' | 'right'
}

/**
 * Where the bubble can go without covering anything that matters.
 *
 * Flipping the bubble is always preferable to moving ORBI, so this is decided
 * independently of the dock and never feeds back into it.
 */
export function chooseBubblePlacement(
  orbi: OrbiRect,
  size: { width: number; height: number },
  regions: OrbiRegion[],
  viewport: OrbiViewport,
): OrbiBubbleChoice {
  const gap = 10
  const candidates: Array<OrbiBubbleChoice & { rect: OrbiRect }> = []

  const above = (align: 'left' | 'right'): OrbiRect => {
    const left =
      align === 'right' ? orbi.right - size.width : orbi.left
    return {
      left,
      top: orbi.top - gap - size.height,
      right: left + size.width,
      bottom: orbi.top - gap,
    }
  }

  const centreY = (orbi.top + orbi.bottom) / 2
  const side = (dir: 'left' | 'right'): OrbiRect => {
    const left =
      dir === 'left' ? orbi.left - gap - size.width : orbi.right + gap
    return {
      left,
      top: centreY - size.height / 2,
      right: left + size.width,
      bottom: centreY + size.height / 2,
    }
  }

  // Above is the natural place for a speech bubble; the sides are the escape.
  candidates.push({ placement: 'above', align: 'right', rect: above('right') })
  candidates.push({ placement: 'above', align: 'left', rect: above('left') })
  candidates.push({ placement: 'left', align: 'right', rect: side('left') })
  candidates.push({ placement: 'right', align: 'left', rect: side('right') })

  let best = candidates[0]
  let bestScore = Number.POSITIVE_INFINITY

  candidates.forEach((candidate, index) => {
    const own = area(candidate.rect) || 1
    let score = 0

    for (const region of regions) {
      score += (intersectionArea(candidate.rect, region.rect) / own) * region.weight
    }

    // Leaving the viewport is disqualifying, not merely bad.
    const outside =
      Math.max(0, viewport.insetLeft - candidate.rect.left) +
      Math.max(0, candidate.rect.right - (viewport.width - viewport.insetRight)) +
      Math.max(0, viewport.insetTop - candidate.rect.top) +
      Math.max(0, candidate.rect.bottom - (viewport.height - viewport.insetBottom))
    if (outside > 0) score += 10

    // Earlier candidates win ties, which keeps "above, right-aligned" the
    // default it has always been.
    score += index * 0.01

    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  })

  return { placement: best.placement, align: best.align }
}
