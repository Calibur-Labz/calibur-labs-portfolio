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
  ORBI_CINEMATIC,
  ORBI_DEFAULT_DOCK,
  ORBI_DOCK_FALLBACKS,
  ORBI_DOCKS,
  ORBI_ENVIRONMENT,
  type OrbiBubblePlacement,
  type OrbiCinematicSide,
  type OrbiDock,
} from './orbiConfig'
import type { OrbiGuideSide } from './orbiGuideConfig'

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

/* ── Cinematic destinations ────────────────────────────────────────────── */

export interface OrbiCinematicSpot {
  rect: OrbiRect
  side: OrbiCinematicSide
  /** Worst overlap with a registered region, as a fraction of ORBI's area. */
  overlap: number
}

/**
 * Find somewhere to park beside a cinematic target.
 *
 * The point is to sit *near* the composition, never on it — so every candidate
 * is offset clear of the target by `targetGap`, and anything that lands on a
 * registered region, or off the edge of the screen, is discarded rather than
 * merely penalised. If nothing survives, the caller skips the cinematic;
 * usability always outranks the flourish.
 */
export function chooseCinematicSpot(
  target: OrbiRect,
  size: { width: number; height: number },
  regions: OrbiRegion[],
  viewport: OrbiViewport,
  prefer: readonly OrbiCinematicSide[],
): OrbiCinematicSpot | null {
  const gap = ORBI_CINEMATIC.targetGap
  const margin = ORBI_CINEMATIC.edgeMargin
  const own = size.width * size.height || 1

  const midY = (target.top + target.bottom) / 2 - size.height / 2

  const place = (side: OrbiCinematicSide): OrbiRect => {
    let left: number
    let top: number

    switch (side) {
      case 'right':
        left = target.right + gap
        top = midY
        break
      case 'left':
        left = target.left - gap - size.width
        top = midY
        break
      case 'above-right':
        left = target.right - size.width
        top = target.top - gap - size.height
        break
      case 'above-left':
        left = target.left
        top = target.top - gap - size.height
        break
      case 'below-right':
        left = target.right - size.width
        top = target.bottom + gap
        break
      case 'below-left':
      default:
        left = target.left
        top = target.bottom + gap
        break
    }

    return { left, top, right: left + size.width, bottom: top + size.height }
  }

  let best: OrbiCinematicSpot | null = null
  let bestScore = Number.POSITIVE_INFINITY

  prefer.forEach((side, index) => {
    const rect = place(side)

    // Must sit fully inside the usable viewport — ORBI half off the screen
    // mid-composition looks broken, not cinematic.
    const outside =
      rect.left < viewport.insetLeft + margin ||
      rect.right > viewport.width - viewport.insetRight - margin ||
      rect.top < viewport.insetTop + margin ||
      rect.bottom > viewport.height - viewport.insetBottom - margin
    if (outside) return

    let overlap = 0
    let score = 0
    for (const region of regions) {
      const ratio = intersectionArea(rect, region.rect) / own
      if (ratio > overlap) overlap = ratio
      score += ratio * region.weight
    }
    // Anything meaningfully covering a registered control disqualifies the
    // spot outright rather than costing it points.
    if (overlap > ORBI_CINEMATIC.unsafeOverlap) return

    score += index * 0.1
    if (score < bestScore) {
      bestScore = score
      best = { rect, side, overlap }
    }
  })

  return best
}

/** How visible a rectangle currently is, as a fraction of its own area. */
export function visibleFraction(rect: OrbiRect, viewport: OrbiViewport): number {
  const own = area(rect)
  if (!own) return 0
  return (
    intersectionArea(rect, {
      left: 0,
      top: 0,
      right: viewport.width,
      bottom: viewport.height,
    }) / own
  )
}

/* ── Guide panel ───────────────────────────────────────────────────────── */

export interface OrbiGuideSpot {
  side: OrbiGuideSide
  rect: OrbiRect
  /** Worst overlap with a registered region, as a fraction of the panel. */
  overlap: number
  /** Nothing registered is underneath. False means this was the least bad. */
  clear: boolean
  /** What is underneath, when `clear` is false. */
  blocker: string | null
}

export interface OrbiGuideGeometry {
  gap: number
  margin: number
  /** A panel covering a registered control by more than this is unusable. */
  unsafeOverlap: number
}

/**
 * Where the guide panel opens.
 *
 * Two rounds, and the order matters:
 *
 *  1. A placement that is inside the viewport **and** clear of everything
 *     registered. All four sides are tried before settling, so "prefer a safe
 *     alternate side" is exhausted first.
 *  2. Failing that, the placement inside the viewport with the least weighted
 *     overlap, flagged `clear: false`.
 *
 * Round two exists because the alternative is worse, not because covering a
 * control is fine. On a narrow phone every side but one leaves the screen, and
 * the hero's own call-to-action sits exactly where the menu wants to be — so
 * the real choice is between a 200px panel over one button for as long as the
 * menu is open, or the full-width sheet, which covers strictly more. Returning
 * `null` here means *nothing fits on screen at all*, and only then is the
 * sheet the right answer.
 *
 * `prefer` comes from ORBI's dock, so the panel opens into the open half of
 * the screen rather than into the corner he is sitting in.
 */
export function chooseGuidePlacement(
  orbi: OrbiRect,
  size: { width: number; height: number },
  regions: OrbiRegion[],
  viewport: OrbiViewport,
  prefer: readonly OrbiGuideSide[],
  geometry: OrbiGuideGeometry,
): OrbiGuideSpot | null {
  const { gap, margin, unsafeOverlap } = geometry
  const own = size.width * size.height || 1

  /*
   * A panel beside ORBI is centred on him where there is room, and slid up (or
   * down) where there is not.
   *
   * Without this, a side placement is only ever viable for a *mid* dock: the
   * panel is taller than ORBI, so centring it on a robot 30px off the bottom
   * of the screen puts half of it below the fold and the candidate is thrown
   * away. Which would leave the default dock with exactly one usable side and
   * make "prefer a safe alternate side" an empty promise.
   */
  const usableTop = viewport.insetTop + margin
  const usableBottom = viewport.height - viewport.insetBottom - margin
  const centred = (orbi.top + orbi.bottom) / 2 - size.height / 2
  const beside = Math.min(
    Math.max(centred, usableTop),
    Math.max(usableTop, usableBottom - size.height),
  )

  const place = (side: OrbiGuideSide): OrbiRect => {
    let left: number
    let top: number

    switch (side) {
      case 'above-right':
        left = orbi.right - size.width
        top = orbi.top - gap - size.height
        break
      case 'above-left':
        left = orbi.left
        top = orbi.top - gap - size.height
        break
      case 'left':
        left = orbi.left - gap - size.width
        top = beside
        break
      case 'right':
      default:
        left = orbi.right + gap
        top = beside
        break
    }

    return { left, top, right: left + size.width, bottom: top + size.height }
  }

  let clear: OrbiGuideSpot | null = null
  let clearScore = Number.POSITIVE_INFINITY
  let fallback: OrbiGuideSpot | null = null
  let fallbackScore = Number.POSITIVE_INFINITY

  prefer.forEach((side, index) => {
    const rect = place(side)

    // Must sit entirely inside the usable viewport. A menu with an option
    // half off the screen is not a menu, so this one really is disqualifying.
    if (
      rect.left < viewport.insetLeft + margin ||
      rect.right > viewport.width - viewport.insetRight - margin ||
      rect.top < viewport.insetTop + margin ||
      rect.bottom > viewport.height - viewport.insetBottom - margin
    ) {
      return
    }

    let overlap = 0
    let blocker: string | null = null
    let score = index * 0.1
    for (const region of regions) {
      const ratio = intersectionArea(rect, region.rect) / own
      if (ratio > overlap) {
        overlap = ratio
        blocker = region.label
      }
      score += ratio * region.weight
    }

    if (overlap <= unsafeOverlap) {
      if (score < clearScore) {
        clearScore = score
        clear = { side, rect, overlap, clear: true, blocker: null }
      }
      return
    }

    if (score < fallbackScore) {
      fallbackScore = score
      fallback = { side, rect, overlap, clear: false, blocker }
    }
  })

  return clear ?? fallback
}

/**
 * The fallback: a compact sheet on ORBI's side of the screen, sitting in the
 * space above him. Deliberately not full-screen — ORBI has to stay visible, or
 * the panel stops reading as something he is holding out.
 *
 * It is allowed to be shorter than the panel wants to be; the list scrolls
 * inside it. Only when there is genuinely no room above him does it take the
 * whole usable height.
 */
export function guideSheetRect(
  orbi: OrbiRect,
  size: { width: number; height: number },
  viewport: OrbiViewport,
  geometry: OrbiGuideGeometry & { maxWidth: number; minHeight: number },
): OrbiRect {
  const { gap, margin, maxWidth, minHeight } = geometry

  const usableLeft = viewport.insetLeft + margin
  const usableRight = viewport.width - viewport.insetRight - margin
  const usableTop = viewport.insetTop + margin
  const usableBottom = viewport.height - viewport.insetBottom - margin

  const width = Math.min(maxWidth, Math.max(0, usableRight - usableLeft))
  // Aligned to whichever edge ORBI is nearer, so the sheet reads as his.
  const nearRight =
    viewport.width - (orbi.left + orbi.right) / 2 < (orbi.left + orbi.right) / 2
  const left = nearRight ? usableRight - width : usableLeft

  const above = orbi.top - gap
  const room = above - usableTop

  if (room >= minHeight) {
    const height = Math.min(size.height, room)
    return { left, top: above - height, right: left + width, bottom: above }
  }

  // Nothing worth calling a sheet fits above him — take the usable height and
  // let the list scroll. Rare enough that it only happens on a phone turned
  // sideways.
  const height = Math.min(size.height, usableBottom - usableTop)
  return { left, top: usableTop, right: left + width, bottom: usableTop + height }
}
