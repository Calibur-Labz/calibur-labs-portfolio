/**
 * ORBI — motion layer.
 *
 * Pure GSAP factories: they take DOM/SVG elements plus options and hand back
 * a timeline or a killable handle. Nothing in here touches React, so the
 * choreography can be retimed or unit-tested without rendering a component.
 *
 * Transforms are split across one layer per concern, so two behaviours can
 * never write the same property and no timeline has to know about any other:
 *   root    — entrance rise, hide              (translateY)
 *   dock    — footer perch at the screen edge  (translateX/Y)
 *   tilt    — look orientation                 (rotate)
 *   gesture — excited hop, startled recoil     (translateY + rotate)
 *   floater — staying airborne                 (translateX/Y + rotate)
 *   arms    — wave, point                      (rotate about a shoulder)
 */

import { gsap } from 'gsap'
import {
  ORBI_ART,
  ORBI_EASE,
  ORBI_ENVIRONMENT,
  ORBI_FLIGHT,
  ORBI_INTERACTION,
  ORBI_SCROLL,
  ORBI_TIMING,
  type OrbiAnimation,
  type OrbiFlightPose,
} from './orbiConfig'

export interface OrbiMotionOptions {
  /** Honour `prefers-reduced-motion`: no travel, no loops, no oscillation. */
  reducedMotion: boolean
  /** ORBI's rendered width in px — float travel scales with it. */
  size: number
}

/** Anything long-lived we need to tear down on unmount. */
export interface OrbiMotionHandle {
  kill: () => void
}

const noop: OrbiMotionHandle = { kill: () => {} }

/* ── Entrance ──────────────────────────────────────────────────────────── */

/**
 * Park ORBI below the fold and invisible. Called synchronously before paint so
 * there is never a flash of a robot sitting in the corner.
 */
export function setInitialPose(root: HTMLElement, options: OrbiMotionOptions) {
  gsap.set(root, {
    yPercent: options.reducedMotion ? 0 : ORBI_TIMING.hideOffsetPercent,
    autoAlpha: 0,
  })
}

export interface OrbiIntroHooks {
  /** Eyes light up inside the visor. */
  onEyesOn: () => void
  /** A single, deliberate blink. */
  onBlink: () => void
  /** Raise the hand and go `happy`. */
  onWave: () => void
  /** Show "Hi 👋". */
  onGreet: () => void
}

/**
 * The page-load choreography:
 * rise → eyes on → blink → wave → greet. Floating is *not* part of this
 * timeline; it takes over when the wave resolves back to `idle`.
 */
export function createIntroTimeline(
  root: HTMLElement,
  hooks: OrbiIntroHooks,
  options: OrbiMotionOptions,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const tl = gsap.timeline()

  if (options.reducedMotion) {
    // No travel — ORBI simply resolves into place, then runs the same
    // expression beats so the personality survives.
    tl.to(root, { autoAlpha: 1, duration: 0.4, ease: ORBI_EASE.soft }, 0.2)
      .call(hooks.onEyesOn, undefined, '+=0.15')
      .call(hooks.onBlink, undefined, '+=0.4')
      .call(hooks.onWave, undefined, `+=${t.blinkCloseMs / 1000 + 0.25}`)
      .call(hooks.onGreet, undefined, '+=0.1')
    return tl
  }

  tl.to(
    root,
    {
      yPercent: 0,
      autoAlpha: 1,
      duration: t.riseDuration,
      ease: ORBI_EASE.rise,
    },
    t.entranceDelay,
  )
    .call(hooks.onEyesOn, undefined, `+=${t.eyesOnDelay}`)
    .call(hooks.onBlink, undefined, `+=${t.eyesOnDuration + t.beforeBlink}`)
    .call(
      hooks.onWave,
      undefined,
      `+=${t.blinkCloseMs / 1000 + t.beforeWave}`,
    )
    // The bubble pops as the hand comes up, not after it.
    .call(hooks.onGreet, undefined, `+=${t.waveRaise * 0.6}`)

  return tl
}

/* ── Flight ────────────────────────────────────────────────────────────── */

export interface OrbiFlightHandle extends OrbiMotionHandle {
  /** Stop mid-pose without losing it — used while the tab is hidden. */
  pause: () => void
  resume: () => void
}

export interface OrbiFlightOptions {
  /**
   * `hover` at rest, `active` a touch livelier, `calm` while an overlay owns
   * the screen, `drowsy` slow and shallow.
   */
  variant?: 'hover' | 'active' | 'calm' | 'drowsy'
  /** Mobile: less drift, almost no roll. */
  quiet?: boolean
  /**
   * Asked immediately before each larger reposition. Flight is the lowest
   * priority thing ORBI does, so it only takes the extra room when nothing
   * else is happening at all.
   */
  canAdjust?: () => boolean
}

const FLIGHT_EASE = 'sine.inOut'

const inert: OrbiFlightHandle = {
  kill: () => {},
  pause: () => {},
  resume: () => {},
}

/**
 * Keeps ORBI in the air.
 *
 * Rather than a symmetrical up-and-down loop, this walks a short table of
 * poses — each one a slightly different height, offset and roll — so the
 * motion reads as a small stabilisation system holding position rather than as
 * an animation cycling. Every segment tweens to an *absolute* pose, which is
 * what lets it be interrupted and resumed without a snap.
 *
 * The whole thing lives on the `floater` layer and writes x, y and rotation
 * there and nowhere else. No gesture, section orientation, or footer dock
 * touches that layer, so flight can never fight anything — and the occasional
 * larger reposition additionally asks `canAdjust()` first, so it stays out of
 * the way perceptually too.
 *
 * Nothing scales: ORBI is exactly as sharp in the air as on the ground.
 */
export function createFlight(
  floater: HTMLElement,
  options: OrbiMotionOptions,
  { variant = 'hover', quiet = false, canAdjust }: OrbiFlightOptions = {},
): OrbiFlightHandle {
  if (options.reducedMotion) {
    // Stationary, by request. Expressions, gaze and speech carry on.
    gsap.set(floater, { x: 0, y: 0, rotation: 0 })
    return inert
  }

  const cfg = ORBI_FLIGHT
  const scale = options.size / cfg.referenceSize
  const amplitude =
    scale *
    (variant === 'active'
      ? cfg.activeScale
      : variant === 'drowsy'
        ? cfg.drowsyScale
        : variant === 'calm'
          ? cfg.calmScale
          : 1)

  const lift = amplitude * (quiet ? cfg.quietLiftScale : 1)
  const drift = amplitude * (quiet ? cfg.quietDriftScale : 1)
  const roll = quiet ? cfg.quietRotationScale : 1
  const pace =
    variant === 'drowsy'
      ? cfg.drowsyDurationScale
      : variant === 'calm'
        ? cfg.calmDurationScale
        : 1

  let tween: gsap.core.Tween | null = null
  let killed = false
  let paused = false
  let index = 0
  let queued: OrbiFlightPose[] = []
  let untilAdjustment = gsap.utils.random(
    cfg.adjustmentGapMin,
    cfg.adjustmentGapMax,
    1,
  )

  const play = (pose: OrbiFlightPose) => {
    tween = gsap.to(floater, {
      x: pose.x * drift,
      y: pose.y * lift,
      rotation: pose.rotation * roll,
      duration: pose.duration * pace,
      ease: pose.ease ?? FLIGHT_EASE,
      transformOrigin: '50% 80%',
      onComplete: step,
    })
    if (paused) tween.pause()
  }

  const step = () => {
    if (killed) return

    // Finish a reposition before considering anything else.
    const pending = queued.shift()
    if (pending) {
      play(pending)
      return
    }

    if (untilAdjustment <= 0 && (canAdjust ? canAdjust() : true)) {
      untilAdjustment = gsap.utils.random(
        cfg.adjustmentGapMin,
        cfg.adjustmentGapMax,
        1,
      )
      queued = [...cfg.adjustment]
      play(queued.shift()!)
      return
    }

    // Not the moment for it — try again after the next segment.
    untilAdjustment -= 1
    play(cfg.poses[index++ % cfg.poses.length])
  }

  step()

  return {
    kill: () => {
      killed = true
      tween?.kill()
      // Ease home rather than snapping, so a breakpoint change or unmount is
      // never a jump.
      gsap.to(floater, {
        x: 0,
        y: 0,
        rotation: 0,
        duration: 0.4,
        ease: ORBI_EASE.soft,
      })
    },
    pause: () => {
      paused = true
      tween?.pause()
    },
    resume: () => {
      if (!paused) return
      paused = false
      // Picks up exactly where it stopped — no jump to a new pose on return.
      tween?.resume()
    },
  }
}

/* ── Wave ──────────────────────────────────────────────────────────────── */

/**
 * Raise the right arm, swing it a few times, lower it. Rotation only — ORBI
 * never scales, so the silhouette stays exactly as sharp as it was drawn.
 */
export function createWaveTimeline(
  arm: SVGGElement,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    // A held greeting pose instead of an oscillation.
    tl.set(arm, { rotation: ORBI_ART.waveRaised, svgOrigin: ORBI_ART.armPivot })
      .to({}, { duration: 0.9 })
      .set(arm, { rotation: 0, svgOrigin: ORBI_ART.armPivot })
    return tl
  }

  tl.to(arm, {
    rotation: ORBI_ART.waveRaised,
    svgOrigin: ORBI_ART.armPivot,
    duration: t.waveRaise,
    ease: ORBI_EASE.waveRaise,
  })

  for (let i = 0; i < t.waveSwings; i++) {
    tl.to(arm, {
      rotation: i % 2 === 0 ? ORBI_ART.waveSwingA : ORBI_ART.waveSwingB,
      svgOrigin: ORBI_ART.armPivot,
      duration: t.waveSwing,
      ease: ORBI_EASE.waveSwing,
    })
  }

  tl.to(arm, {
    rotation: 0,
    svgOrigin: ORBI_ART.armPivot,
    duration: t.waveLower,
    ease: ORBI_EASE.inOut,
  })

  return tl
}

/* ── Enter / exit ──────────────────────────────────────────────────────── */

function slideRoot(
  root: HTMLElement,
  yPercent: number,
  autoAlpha: number,
  duration: number,
  options: OrbiMotionOptions,
): gsap.core.Tween {
  return gsap.to(root, {
    yPercent: options.reducedMotion ? 0 : yPercent,
    autoAlpha,
    duration: options.reducedMotion ? 0.25 : duration,
    ease: ORBI_EASE.inOut,
    overwrite: 'auto',
  })
}

/** Send ORBI away entirely. */
export function playHide(root: HTMLElement, options: OrbiMotionOptions) {
  return slideRoot(root, ORBI_TIMING.hideOffsetPercent, 0, ORBI_TIMING.hideDuration, options)
}

/** Bring ORBI back to its resting spot. */
export function playShow(root: HTMLElement, options: OrbiMotionOptions) {
  return slideRoot(root, 0, 1, ORBI_TIMING.showDuration, options)
}

/* ── Footer perch ──────────────────────────────────────────────────────── */

export interface OrbiDockTransform {
  /** Offset from ORBI's CSS anchor to the chosen dock, px. */
  x: number
  y: number
  /** The footer perch, as a percentage of ORBI's own size. */
  perched: boolean
}

/**
 * The single writer for ORBI's position.
 *
 * Two things want to move his box — the environment choosing a dock, and the
 * footer perch — so both contributions are summed into one tween. Position is
 * a safety concern rather than a personality one, so this runs regardless of
 * who holds the priority claim, and it runs under reduced motion too. It just
 * gets there quickly and without the long ease.
 */
export function applyDock(
  dock: HTMLElement,
  transform: OrbiDockTransform,
  options: OrbiMotionOptions,
  duration: number = ORBI_TIMING.dockDuration,
): gsap.core.Tween {
  return gsap.to(dock, {
    x: transform.x,
    y: transform.y,
    xPercent: transform.perched ? ORBI_SCROLL.dockX : 0,
    yPercent: transform.perched ? ORBI_SCROLL.dockY : 0,
    duration: options.reducedMotion
      ? ORBI_ENVIRONMENT.moveDurationReduced
      : duration,
    ease: ORBI_EASE.inOut,
    overwrite: 'auto',
  })
}

/* ── Looking ───────────────────────────────────────────────────────────── */

/**
 * How far the body leans for a sustained look orientation.
 *
 * Intentionally almost nothing — a few degrees. The eyes carry the look (see
 * `orbiGaze`); this is just enough shoulder to sell it. Reduced motion and
 * mobile get none of it and keep the eyes.
 */
export function lookTiltAngle(
  animation: OrbiAnimation,
  options: OrbiMotionOptions,
  quiet = false,
): number {
  if (options.reducedMotion || quiet) return 0
  if (animation === 'look-left') return -ORBI_ART.lookTilt
  if (animation === 'look-right') return ORBI_ART.lookTilt
  return 0
}

/**
 * The single writer for the tilt layer.
 *
 * Both the section orientation and the lean toward a hovering cursor want this
 * rotation, so callers sum their contributions and hand over one number.
 * `overwrite: 'auto'` guarantees exactly one tween owns the property.
 */
export function applyTilt(
  tilt: HTMLElement,
  rotation: number,
  options: OrbiMotionOptions,
  duration = ORBI_TIMING.lookDuration,
): gsap.core.Tween {
  return gsap.to(tilt, {
    rotation: options.reducedMotion ? 0 : rotation,
    duration: options.reducedMotion ? 0.2 : duration,
    ease: ORBI_EASE.soft,
    transformOrigin: '50% 85%',
    overwrite: 'auto',
  })
}

/* ── Pointing ──────────────────────────────────────────────────────────── */

/**
 * Swing one arm out toward the content, hold, and drop it.
 *
 * Callers are expected to have already swapped this for a quiet stand-in on
 * mobile / reduced motion (`resolveSectionAnimation`); the guard here is a
 * backstop so a direct `setOrbiState({ animation: 'point-left' })` still
 * behaves.
 */
export function createPointTimeline(
  arm: SVGGElement,
  side: 'left' | 'right',
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const svgOrigin = side === 'left' ? ORBI_ART.armPivotLeft : ORBI_ART.armPivot
  const angle =
    side === 'left' ? ORBI_ART.pointLeftAngle : ORBI_ART.pointRightAngle
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    // Hold the pose instead of travelling into it.
    tl.set(arm, { rotation: angle, svgOrigin })
      .to({}, { duration: t.pointHold })
      .set(arm, { rotation: 0, svgOrigin })
    return tl
  }

  tl.to(arm, {
    rotation: angle,
    svgOrigin,
    duration: t.pointRaise,
    ease: ORBI_EASE.point,
  })
    .to({}, { duration: t.pointHold })
    .to(arm, {
      rotation: 0,
      svgOrigin,
      duration: t.pointLower,
      ease: ORBI_EASE.inOut,
    })

  return tl
}

/* ── Excited ───────────────────────────────────────────────────────────── */

/**
 * A couple of small hops with a hint of tilt. Translation only — ORBI's
 * silhouette stays exactly the size it was drawn.
 */
export function createExcitedTimeline(
  gesture: HTMLElement,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    // Expression only — the caller keeps the happy face, the body stays put.
    tl.to({}, { duration: 0.5 })
    return tl
  }

  const hop = options.size * t.excitedHopRatio

  for (let i = 0; i < t.excitedHops; i++) {
    const lean = i % 2 === 0 ? t.excitedTilt : -t.excitedTilt
    tl.to(gesture, {
      y: -hop,
      rotation: lean,
      duration: t.excitedDuration,
      ease: ORBI_EASE.hop,
      transformOrigin: '50% 85%',
    }).to(gesture, {
      y: 0,
      rotation: 0,
      duration: t.excitedDuration,
      ease: ORBI_EASE.hopLand,
      transformOrigin: '50% 85%',
    })
  }

  return tl
}

/* ── Startled ──────────────────────────────────────────────────────────── */

/**
 * The reaction to a fast flick of the scroll wheel: a small recoil away from
 * the movement, then an elastic return. Playful, and over in under a second.
 */
export function createRecoilTimeline(
  gesture: HTMLElement,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    // The startled *face* is still allowed; the body is not.
    tl.to({}, { duration: t.surpriseHoldMs / 1000 })
    return tl
  }

  const back = options.size * t.recoilRatio

  tl.to(gesture, {
    y: back,
    rotation: t.recoilTilt,
    duration: t.recoilOut,
    ease: ORBI_EASE.recoil,
    transformOrigin: '50% 85%',
  }).to(gesture, {
    y: 0,
    rotation: 0,
    duration: t.recoilBack,
    ease: ORBI_EASE.recoilReturn,
    transformOrigin: '50% 85%',
  })

  return tl
}

/* ── Curious ───────────────────────────────────────────────────────────── */

/**
 * The self-initiated "hm?" — a tiny head cock, held, then released. The eyes
 * do the looking (`orbiGaze` gets an `interaction` target for the duration);
 * this is only the body's share of it, which is a degree or two.
 *
 * Under reduced motion it is a pure pause: the thinking face still happens,
 * the body does not move at all.
 */
export function createCuriousTimeline(
  tilt: HTMLElement,
  side: -1 | 1,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const hold = ORBI_INTERACTION.curiousHold / 1000
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    tl.to({}, { duration: hold })
    return tl
  }

  const angle = side * ORBI_ART.curiousTilt

  tl.to(tilt, {
    rotation: angle,
    duration: 0.6,
    ease: ORBI_EASE.soft,
    transformOrigin: '50% 85%',
    overwrite: 'auto',
  })
    .to({}, { duration: hold })
    .to(tilt, {
      rotation: 0,
      duration: 0.7,
      ease: ORBI_EASE.inOut,
      transformOrigin: '50% 85%',
      overwrite: 'auto',
    })

  return tl
}

/* ── Nod ───────────────────────────────────────────────────────────────── */

/**
 * A short dip of acknowledgement — "noted". Smaller than the excited hop and
 * in the opposite direction, so following one with the other reads as calming
 * down rather than as a second celebration.
 *
 * Under reduced motion it is a pause: the expression carries the beat instead.
 */
export function createNodTimeline(
  gesture: HTMLElement,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const t = ORBI_TIMING
  const tl = gsap.timeline({ onComplete })

  if (options.reducedMotion) {
    tl.to({}, { duration: t.nodDuration * 2 })
    return tl
  }

  const depth = (options.size / ORBI_FLIGHT.referenceSize) * t.nodDepth

  tl.to(gesture, {
    y: depth,
    rotation: 0,
    duration: t.nodDuration,
    ease: ORBI_EASE.soft,
    transformOrigin: '50% 85%',
  }).to(gesture, {
    y: 0,
    duration: t.nodDuration * 1.3,
    ease: ORBI_EASE.inOut,
    transformOrigin: '50% 85%',
  })

  return tl
}

/* ── Settling ──────────────────────────────────────────────────────────── */

export interface OrbiSettleTargets {
  tilt: HTMLElement
  gesture: HTMLElement
  arms: Array<{ el: SVGGElement | null; svgOrigin: string }>
}

/**
 * Return every layer to neutral at once. This is the escape hatch that stops
 * state accumulating: whatever a gesture left behind, `settle` clears it.
 */
export function createSettleTimeline(
  targets: OrbiSettleTargets,
  options: OrbiMotionOptions,
  onComplete?: () => void,
): gsap.core.Timeline {
  const duration = options.reducedMotion ? 0.2 : ORBI_TIMING.settleDuration
  const tl = gsap.timeline({ onComplete })

  tl.to(
    targets.tilt,
    { rotation: 0, duration, ease: ORBI_EASE.soft, transformOrigin: '50% 85%' },
    0,
  ).to(
    targets.gesture,
    {
      y: 0,
      rotation: 0,
      duration,
      ease: ORBI_EASE.soft,
      transformOrigin: '50% 85%',
    },
    0,
  )

  for (const arm of targets.arms) {
    if (!arm.el) continue
    tl.to(
      arm.el,
      { rotation: 0, svgOrigin: arm.svgOrigin, duration, ease: ORBI_EASE.soft },
      0,
    )
  }

  return tl
}

/** Snap a layer back to neutral with no animation — used by effect cleanups. */
export function resetLayer(el: HTMLElement | SVGGElement | null, svgOrigin?: string) {
  if (!el) return
  gsap.killTweensOf(el)
  gsap.set(el, svgOrigin ? { rotation: 0, svgOrigin } : { y: 0, rotation: 0 })
}

/* ── Blinking ──────────────────────────────────────────────────────────── */

/**
 * Fires `blink` at irregular intervals so ORBI reads as alive rather than
 * looped, and occasionally — rarely — twice in quick succession, which is the
 * detail that stops it feeling metronomic.
 *
 * Disabled entirely under reduced motion: with transitions suppressed a blink
 * snaps rather than closes, which is worse than not blinking.
 */
export function createBlinkScheduler(
  blink: () => void,
  options: OrbiMotionOptions,
): OrbiMotionHandle {
  if (options.reducedMotion) return noop

  const t = ORBI_TIMING
  const pending = new Set<gsap.core.Tween>()

  const at = (delay: number, fn: () => void) => {
    const call = gsap.delayedCall(delay, () => {
      pending.delete(call)
      fn()
    })
    pending.add(call)
  }

  const schedule = () => {
    at(gsap.utils.random(t.blinkIntervalMin, t.blinkIntervalMax), () => {
      blink()
      if (Math.random() < t.doubleBlinkChance) {
        at(t.doubleBlinkGapMs / 1000 + t.blinkCloseMs / 1000, blink)
      }
      schedule()
    })
  }
  schedule()

  return {
    kill: () => {
      pending.forEach((call) => call.kill())
      pending.clear()
    },
  }
}
