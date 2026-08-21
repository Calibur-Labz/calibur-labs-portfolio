/**
 * ORBI — detector tests.
 *
 * The three Easter-egg detectors are pure state machines fed one sample at a
 * time, which is exactly what makes them worth testing directly: no browser,
 * no timers, no randomness — synthetic samples in, a yes or no out.
 *
 * These are the cases that matter in practice: the thresholds themselves, and
 * the false positives that would make ORBI feel twitchy if they ever got
 * through (a half circle, the cursor crossing him a few times, a hand resting
 * on the mouse, a lap drawn too slowly to be one gesture).
 *
 * No test runner is installed in this project, so run them through the
 * project's own TypeScript and Node's built-in one:
 *
 *   npx tsc components/orbi/orbiEasterDetect.ts \
 *           components/orbi/orbiEasterDetect.test.mts \
 *       --outDir /tmp/orbi-tests --module nodenext --target es2022
 *   node --test /tmp/orbi-tests
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  angleDelta,
  createCircleTracker,
  createClickWindow,
  createVelocityTracker,
} from './orbiEasterDetect.js'

/* ── Repeated clicking ─────────────────────────────────────────────────── */

test('five clicks inside the window fire, four do not', () => {
  const window = createClickWindow(5, 3000)
  assert.equal(window.note(0), false)
  assert.equal(window.note(200), false)
  assert.equal(window.note(400), false)
  assert.equal(window.note(600), false)
  assert.equal(window.note(800), true)
})

test('firing clears the count, so the next reaction needs five more', () => {
  const window = createClickWindow(5, 3000)
  for (let i = 0; i < 4; i++) window.note(i * 100)
  assert.equal(window.note(500), true)
  // One more click is not a second reaction.
  assert.equal(window.note(600), false)
  assert.equal(window.count(600), 1)
  for (const t of [700, 800, 900]) window.note(t)
  assert.equal(window.note(1000), true)
})

test('five unhurried clicks are just clicks', () => {
  const window = createClickWindow(5, 3000)
  for (let i = 0; i < 4; i++) assert.equal(window.note(i * 1000), false)
  // The fifth lands 4s after the first — outside the window.
  assert.equal(window.note(4000), false)
})

test('the live count only sees clicks inside the window', () => {
  const window = createClickWindow(5, 3000)
  window.note(0)
  window.note(100)
  assert.equal(window.count(200), 2)
  assert.equal(window.count(4000), 0)
})

/* ── Cursor velocity ───────────────────────────────────────────────────── */

const CHASE = { velocity: 2400, radius: 300, samples: 4 }

test('sustained fast movement near ORBI is a chase', () => {
  const chase = createVelocityTracker(CHASE)
  // 60px every 16ms ≈ 3750px/s, close in.
  let fired = false
  for (let i = 0; i < 5; i++) {
    fired = chase.feed(i * 60, 0, i * 16, 80) || fired
  }
  assert.equal(fired, true)
})

test('the same speed far away is someone going somewhere else', () => {
  const chase = createVelocityTracker(CHASE)
  for (let i = 0; i < 12; i++) {
    assert.equal(chase.feed(i * 60, 0, i * 16, 900), false)
  }
})

test('one flick is not a chase', () => {
  const chase = createVelocityTracker(CHASE)
  assert.equal(chase.feed(0, 0, 0, 60), false)
  assert.equal(chase.feed(200, 0, 16, 60), false)
  // Then the hand settles: slow samples break the streak.
  assert.equal(chase.feed(202, 0, 32, 60), false)
  assert.equal(chase.feed(204, 0, 48, 60), false)
  assert.equal(chase.feed(206, 0, 64, 60), false)
})

test('a pause breaks the streak', () => {
  const chase = createVelocityTracker(CHASE)
  chase.feed(0, 0, 0, 60)
  chase.feed(60, 0, 16, 60)
  chase.feed(120, 0, 32, 60)
  // ...long gap, so this sample starts again rather than completing.
  assert.equal(chase.feed(180, 0, 2000, 60), false)
  assert.equal(chase.feed(240, 0, 2016, 60), false)
})

/* ── The circle ────────────────────────────────────────────────────────── */

const CIRCLE = {
  minDegrees: 320,
  maxStepDegrees: 62,
  reverseDegrees: 34,
  minRadius: 0.75,
  maxRadius: 3.4,
  minSamples: 12,
  windowMs: 3200,
}

/** Walk the pointer round ORBI, `stepDegrees` at a time. */
function sweep(
  tracker: ReturnType<typeof createCircleTracker>,
  {
    from = 0,
    degrees,
    stepDegrees = 10,
    radius = 2,
    startAt = 0,
    stepMs = 24,
  }: {
    from?: number
    degrees: number
    stepDegrees?: number
    radius?: number
    startAt?: number
    stepMs?: number
  },
): { fired: number; t: number; angle: number } {
  const steps = Math.round(Math.abs(degrees) / stepDegrees)
  const way = degrees < 0 ? -1 : 1
  let fired = 0
  let t = startAt
  let angle = from

  for (let i = 0; i <= steps; i++) {
    const radians = (angle * Math.PI) / 180
    if (tracker.feed(Math.cos(radians) * radius, Math.sin(radians) * radius, radius, t)) {
      fired += 1
    }
    angle += way * stepDegrees
    t += stepMs
  }
  return { fired, t, angle }
}

test('a full lap around ORBI counts', () => {
  const circle = createCircleTracker(CIRCLE)
  assert.equal(sweep(circle, { degrees: 360 }).fired, 1)
})

test('half a lap is not a lap', () => {
  const circle = createCircleTracker(CIRCLE)
  assert.equal(sweep(circle, { degrees: 180 }).fired, 0)
})

test('crossing back and forth over ORBI never adds up', () => {
  const circle = createCircleTracker(CIRCLE)
  let fired = 0
  let angle = 0
  let t = 0
  // Six passes over him, alternating direction — 300° of movement in total
  // and not one degree of progress.
  for (let pass = 0; pass < 6; pass++) {
    const run = sweep(circle, {
      from: angle,
      degrees: pass % 2 === 0 ? 50 : -50,
      startAt: t,
    })
    fired += run.fired
    angle = run.angle
    t = run.t
  }
  assert.equal(fired, 0)
})

test('a small wobble on the way round is forgiven', () => {
  const circle = createCircleTracker(CIRCLE)
  let fired = 0
  let angle = 0
  let t = 0
  for (const leg of [200, -20, 200]) {
    const run = sweep(circle, { from: angle, degrees: leg, startAt: t })
    fired += run.fired
    angle = run.angle
    t = run.t
  }
  assert.equal(fired, 1)
})

test('too far out, or right on top of him, does not count', () => {
  const far = createCircleTracker(CIRCLE)
  assert.equal(sweep(far, { degrees: 360, radius: 6 }).fired, 0)
  const near = createCircleTracker(CIRCLE)
  assert.equal(sweep(near, { degrees: 360, radius: 0.2 }).fired, 0)
})

test('a lap drawn too slowly is not one gesture', () => {
  const circle = createCircleTracker(CIRCLE)
  // 36 samples at 200ms is 7.2s — well past the window.
  assert.equal(sweep(circle, { degrees: 360, stepMs: 200 }).fired, 0)
})

test('a jump across the screen restarts rather than counting', () => {
  const circle = createCircleTracker(CIRCLE)
  // 90° per sample is a teleport, not a stroke.
  assert.equal(sweep(circle, { degrees: 1080, stepDegrees: 90 }).fired, 0)
})

test('few enough samples cannot complete a lap however far they travel', () => {
  const circle = createCircleTracker({ ...CIRCLE, minSamples: 40 })
  assert.equal(sweep(circle, { degrees: 360 }).fired, 0)
})

test('the tracker resets after firing, so one lap is one reaction', () => {
  const circle = createCircleTracker(CIRCLE)
  const first = sweep(circle, { degrees: 360 })
  assert.equal(first.fired, 1)
  // Immediately carrying on does not fire again until another full lap.
  assert.equal(sweep(circle, { from: first.angle, degrees: 180, startAt: first.t }).fired, 0)
})

test('angleDelta takes the short way round', () => {
  assert.equal(Math.round(angleDelta(0, Math.PI / 2) * 1000), Math.round((Math.PI / 2) * 1000))
  // Across the ±π seam: a small step, not a lap backwards.
  assert.ok(Math.abs(angleDelta(Math.PI - 0.1, -Math.PI + 0.1) - 0.2) < 1e-9)
})
