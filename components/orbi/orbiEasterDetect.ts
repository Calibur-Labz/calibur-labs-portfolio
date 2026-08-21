/**
 * ORBI — the arithmetic behind the hidden reactions.
 *
 * Three tiny detectors, deliberately kept out of React and out of the
 * controller: they are pure state machines fed one sample at a time, hold a
 * fixed amount of memory, and answer a single yes/no question. That makes them
 * cheap enough to run from a `pointermove` handler and — more usefully —
 * testable without a browser (see `orbiEasterDetect.test.mts`).
 *
 * None of them allocate per sample. There is no history array to grow, no
 * timestamp list to filter, and no trigonometry beyond one `atan2` per move.
 */

/* ── Repeated clicking ─────────────────────────────────────────────────── */

export interface OrbiClickWindow {
  /** Record a click. True the moment the threshold is met. */
  note: (t: number) => boolean
  /** How many clicks are currently inside the window. */
  count: (t: number) => number
  reset: () => void
}

/**
 * "Five clicks in three seconds" without keeping a list of clicks.
 *
 * A ring buffer exactly `count` long: a hit means the oldest of the last
 * `count` clicks is still inside the window. Firing clears the buffer, so the
 * next reaction needs a fresh five rather than one more click.
 */
export function createClickWindow(count: number, windowMs: number): OrbiClickWindow {
  const times = new Array<number>(count).fill(-Infinity)
  let index = 0

  return {
    note(t) {
      times[index] = t
      index = (index + 1) % count
      // The slot we are about to overwrite next is the oldest of the last
      // `count` clicks.
      const oldest = times[index]
      if (t - oldest > windowMs) return false
      times.fill(-Infinity)
      return true
    },
    count(t) {
      let live = 0
      for (const time of times) if (t - time <= windowMs) live += 1
      return live
    },
    reset() {
      times.fill(-Infinity)
      index = 0
    },
  }
}

/* ── Cursor velocity ───────────────────────────────────────────────────── */

export interface OrbiVelocityConfig {
  /** px/s that counts as "whipping about". */
  velocity: number
  /** Only near ORBI, px from his centre. */
  radius: number
  /** Consecutive fast samples required — one flick is not a chase. */
  samples: number
}

export interface OrbiVelocityTracker {
  /** `distance` is the pointer's distance from ORBI's centre. */
  feed: (x: number, y: number, t: number, distance: number) => boolean
  /** True while the streak is building, for the debug HUD. */
  active: () => boolean
  reset: () => void
}

/** A gap longer than this is a new movement, not a continuation of the last. */
const VELOCITY_GAP_MS = 260

export function createVelocityTracker(
  config: OrbiVelocityConfig,
): OrbiVelocityTracker {
  let lastX = 0
  let lastY = 0
  let lastT = -Infinity
  let streak = 0

  const reset = () => {
    streak = 0
    lastT = -Infinity
  }

  return {
    feed(x, y, t, distance) {
      const dt = t - lastT
      const dx = x - lastX
      const dy = y - lastY
      lastX = x
      lastY = y
      lastT = t

      if (!Number.isFinite(dt) || dt <= 0 || dt > VELOCITY_GAP_MS) {
        streak = 0
        return false
      }

      const speed = (Math.hypot(dx, dy) / dt) * 1000
      if (distance > config.radius || speed < config.velocity) {
        streak = 0
        return false
      }

      streak += 1
      if (streak < config.samples) return false
      streak = 0
      return true
    },
    active: () => streak > 0,
    reset,
  }
}

/* ── The circle ────────────────────────────────────────────────────────── */

export interface OrbiCircleConfig {
  /** How much turning counts as a lap, degrees. */
  minDegrees: number
  /** A single step larger than this is a teleport, not a stroke. */
  maxStepDegrees: number
  /** Turning back further than this abandons the attempt. */
  reverseDegrees: number
  /** Radius band, in whatever unit the caller feeds `radius` in. */
  minRadius: number
  maxRadius: number
  /** Fewest samples that may count as a lap. */
  minSamples: number
  /** The whole lap has to happen inside this. */
  windowMs: number
}

export interface OrbiCircleTracker {
  /**
   * One pointer sample, as an offset from ORBI's centre. True on the sample
   * that completes a lap; the tracker resets itself when that happens.
   */
  feed: (dx: number, dy: number, radius: number, t: number) => boolean
  /** 0…1 toward a lap, for the debug HUD. */
  progress: () => number
  reset: () => void
}

const RAD = Math.PI / 180
const TAU = Math.PI * 2

/** Shortest signed way round from `from` to `to`, −π…π. */
export function angleDelta(from: number, to: number): number {
  let delta = (to - from) % TAU
  if (delta > Math.PI) delta -= TAU
  if (delta < -Math.PI) delta += TAU
  return delta
}

/**
 * "Did they draw a circle around ORBI?" — by summing how far the *angle* to
 * the cursor travels, not by recognising a shape.
 *
 * Four things stop ordinary mouse movement from ever adding up to a lap:
 * the pointer has to stay inside a radius band around ORBI, each step has to
 * be small enough to be a real stroke, the direction has to stay consistent
 * (a wobble is forgiven, a reversal is not), and it all has to happen inside
 * one window. Crossing back and forth over ORBI therefore scores nothing:
 * every crossing reverses the direction and abandons the attempt.
 */
export function createCircleTracker(config: OrbiCircleConfig): OrbiCircleTracker {
  const target = config.minDegrees * RAD
  const maxStep = config.maxStepDegrees * RAD
  const reverseLimit = config.reverseDegrees * RAD

  let last = 0
  let started = false
  let startedAt = 0
  let total = 0
  let against = 0
  let samples = 0
  let direction = 0

  const reset = () => {
    started = false
    total = 0
    against = 0
    samples = 0
    direction = 0
  }

  const restart = (angle: number, t: number) => {
    started = true
    startedAt = t
    last = angle
    total = 0
    against = 0
    samples = 1
    direction = 0
  }

  return {
    feed(dx, dy, radius, t) {
      if (radius < config.minRadius || radius > config.maxRadius) {
        reset()
        return false
      }

      const angle = Math.atan2(dy, dx)
      if (!started || t - startedAt > config.windowMs) {
        restart(angle, t)
        return false
      }

      const delta = angleDelta(last, angle)
      last = angle

      // A jump this big is the pointer being somewhere else, not a stroke.
      if (Math.abs(delta) > maxStep) {
        restart(angle, t)
        return false
      }
      // Sub-degree jitter is not movement; counting it would let a resting
      // hand accumulate samples.
      if (Math.abs(delta) < 0.004) return false

      const way = delta > 0 ? 1 : -1
      if (direction === 0) direction = way

      if (way !== direction) {
        against += Math.abs(delta)
        if (against > reverseLimit) {
          restart(angle, t)
          return false
        }
        samples += 1
        return false
      }

      // Going the right way again pays off a little of the wobble.
      against = Math.max(0, against - Math.abs(delta) * 0.5)
      total += Math.abs(delta)
      samples += 1

      if (total < target || samples < config.minSamples) return false
      reset()
      return true
    },
    progress: () => (started ? Math.min(1, total / target) : 0),
    reset,
  }
}
