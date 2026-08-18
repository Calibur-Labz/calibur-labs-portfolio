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
 *   floater — idle bob + micro-tilt            (translateY + rotate)
 *   arms    — wave, point                      (rotate about a shoulder)
 */

import { gsap } from 'gsap'
import {
  ORBI_ART,
  ORBI_EASE,
  ORBI_SCROLL,
  ORBI_TIMING,
  type OrbiAnimation,
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

/* ── Idle float ────────────────────────────────────────────────────────── */

/**
 * The resting animation: a few pixels of vertical drift plus a barely-there
 * tilt. The two run on different periods so the loop never reads as a metronome.
 */
export function createFloat(
  floater: HTMLElement,
  options: OrbiMotionOptions,
  variant: 'idle' | 'float' = 'idle',
): OrbiMotionHandle {
  if (options.reducedMotion) {
    gsap.set(floater, { y: 0, rotation: 0 })
    return noop
  }

  const t = ORBI_TIMING
  const ratio =
    variant === 'float' ? t.floatTravelRatioActive : t.floatTravelRatio
  const travel = options.size * ratio

  const drift = gsap.to(floater, {
    y: -travel,
    duration: t.floatDuration,
    ease: ORBI_EASE.float,
    repeat: -1,
    yoyo: true,
  })

  const tilt = gsap.fromTo(
    floater,
    { rotation: -t.floatRotation },
    {
      rotation: t.floatRotation,
      duration: t.floatDuration * 1.45,
      ease: ORBI_EASE.float,
      repeat: -1,
      yoyo: true,
      transformOrigin: '50% 80%',
    },
  )

  return {
    kill: () => {
      drift.kill()
      tilt.kill()
      gsap.to(floater, {
        y: 0,
        rotation: 0,
        duration: 0.4,
        ease: ORBI_EASE.soft,
      })
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

/**
 * Slide ORBI toward the right edge so it never sits on top of footer links —
 * it reads as watching from the side rather than hovering over the content.
 *
 * This runs even under reduced motion: it is a layout courtesy, not a
 * flourish. It just gets there faster and without the long ease.
 */
export function playDock(
  dock: HTMLElement,
  mode: 'edge' | 'home',
  options: OrbiMotionOptions,
): gsap.core.Tween {
  const edge = mode === 'edge'
  return gsap.to(dock, {
    xPercent: edge ? ORBI_SCROLL.dockX : 0,
    yPercent: edge ? ORBI_SCROLL.dockY : 0,
    duration: options.reducedMotion ? 0.3 : ORBI_TIMING.dockDuration,
    ease: ORBI_EASE.inOut,
    overwrite: 'auto',
  })
}

/* ── Looking ───────────────────────────────────────────────────────────── */

/**
 * Orient the body toward whatever ORBI is looking at.
 *
 * Intentionally almost nothing — a few degrees. The eyes carry the look (see
 * the `gaze` prop on `OrbiFace`); this is just enough shoulder to sell it.
 * Reduced motion and mobile drop the rotation entirely and keep the eyes.
 */
export function applyLookTilt(
  tilt: HTMLElement,
  animation: OrbiAnimation,
  options: OrbiMotionOptions,
  quiet = false,
): gsap.core.Tween {
  let rotation = 0
  if (!options.reducedMotion && !quiet) {
    if (animation === 'look-left') rotation = -ORBI_ART.lookTilt
    else if (animation === 'look-right') rotation = ORBI_ART.lookTilt
  }
  return gsap.to(tilt, {
    rotation,
    duration: options.reducedMotion ? 0.2 : ORBI_TIMING.lookDuration,
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
 * looped. Disabled entirely under reduced motion — with transitions suppressed
 * a blink would snap rather than close, which is worse than not blinking.
 */
export function createBlinkScheduler(
  blink: () => void,
  options: OrbiMotionOptions,
): OrbiMotionHandle {
  if (options.reducedMotion) return noop

  const t = ORBI_TIMING
  let pending: gsap.core.Tween | null = null

  const schedule = () => {
    pending = gsap.delayedCall(
      gsap.utils.random(t.blinkIntervalMin, t.blinkIntervalMax),
      () => {
        blink()
        schedule()
      },
    )
  }
  schedule()

  return { kill: () => pending?.kill() }
}
