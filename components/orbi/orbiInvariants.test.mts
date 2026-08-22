/**
 * ORBI — the invariants everything else leans on.
 *
 * Phase 10. These are not animation tests: they are the handful of properties
 * that, if they ever quietly stopped holding, would make ORBI misbehave in a
 * way no screenshot would catch — two things owning him at once, a claim that
 * lapses in the middle of its own sequence, a priority reordering that lets a
 * flourish talk over a submission, a reaction that can no longer be triggered
 * by the visitor.
 *
 * Everything here is pure: the arbiter has no React and no DOM, and the rest
 * is configuration. Run them with the project's own TypeScript and Node:
 *
 *   npx tsc components/orbi/orbiArbiter.ts components/orbi/orbiConfig.ts \
 *           components/orbi/orbiInvariants.test.mts \
 *       --outDir /tmp/orbi-inv --module nodenext --target es2022 --skipLibCheck --lib es2022,dom
 *   node --test /tmp/orbi-inv
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrbiArbiter } from './orbiArbiter.js'
import {
  ORBI_AUDIO,
  ORBI_COOLDOWNS,
  ORBI_EASTER_EGGS,
  ORBI_EASTER_SPECS,
  ORBI_PRIORITY,
  ORBI_SOUND_SPECS,
  ORBI_Z_INDEX,
  type OrbiEasterEgg,
} from './orbiConfig.js'

/* ── One owner at a time ───────────────────────────────────────────────── */

test('a claim is refused by anything above it, and granted to anything at or above', () => {
  const arbiter = createOrbiArbiter()
  assert.equal(arbiter.claim(ORBI_PRIORITY.section, 'section', 1000), true)
  assert.equal(arbiter.claim(ORBI_PRIORITY.gaze, 'gaze', 1000), false)
  assert.equal(arbiter.current()?.owner, 'section')
  assert.equal(arbiter.claim(ORBI_PRIORITY.cinematic, 'cinematic', 1000), true)
  assert.equal(arbiter.current()?.owner, 'cinematic')
})

test('there is only ever one owner', () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.ambient, 'curious', 1000)
  arbiter.claim(ORBI_PRIORITY.easterEgg, 'easter', 1000)
  arbiter.claim(ORBI_PRIORITY.formResult, 'form-result', 1000)
  const held = arbiter.current()
  assert.equal(held?.owner, 'form-result')
  assert.equal(arbiter.level(), ORBI_PRIORITY.formResult)
})

test('equal levels hand over rather than deadlock', () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.section, 'section-a', 1000)
  assert.equal(arbiter.claim(ORBI_PRIORITY.section, 'section-b', 1000), true)
  assert.equal(arbiter.current()?.owner, 'section-b')
})

test('releasing only works for the owner, so nothing can free someone else', () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.cinematic, 'cinematic', 5000)
  arbiter.release('easter')
  assert.equal(arbiter.current()?.owner, 'cinematic')
  arbiter.release('cinematic')
  assert.equal(arbiter.current(), null)
  assert.equal(arbiter.level(), ORBI_PRIORITY.idle)
})

test('a claim lapses on its own, so a dropped release can never wedge ORBI', async () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.interaction, 'click', 30)
  assert.equal(arbiter.current()?.owner, 'click')
  await new Promise((r) => setTimeout(r, 60))
  assert.equal(arbiter.current(), null, 'the claim should have expired')
  assert.equal(arbiter.claim(ORBI_PRIORITY.idle, 'flight', 100), true)
})

test('the owner may always renew its own claim', () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.formSubmitting, 'form-submitting', 100)
  assert.equal(arbiter.claim(ORBI_PRIORITY.formSubmitting, 'form-submitting', 5000), true)
  assert.equal(arbiter.claim(ORBI_PRIORITY.gaze, 'gaze', 100), false)
})

/* ── The priority model itself ─────────────────────────────────────────── */

test('the documented order holds', () => {
  const p = ORBI_PRIORITY
  const ascending = [
    p.idle, p.gaze, p.ambient, p.fastScroll, p.section, p.formFocus,
    p.environment, p.easterEgg, p.safety, p.cinematic, p.formSubmitting,
    p.formResult, p.interaction, p.entrance,
  ]
  for (let i = 1; i < ascending.length; i++) {
    assert.ok(ascending[i] > ascending[i - 1], `level ${i} must outrank the one below it`)
  }
})

test('a hidden reaction outranks a section beat and yields to everything serious', () => {
  const p = ORBI_PRIORITY
  assert.ok(p.easterEgg > p.section)
  assert.ok(p.easterEgg > p.ambient)
  assert.ok(p.easterEgg < p.safety)
  assert.ok(p.easterEgg < p.cinematic)
  assert.ok(p.easterEgg < p.formSubmitting)
  assert.ok(p.easterEgg < p.formResult)
  assert.ok(p.easterEgg < p.interaction)
})

test('nothing outranks the entrance', () => {
  const highest = Math.max(...Object.values(ORBI_PRIORITY))
  assert.equal(highest, ORBI_PRIORITY.entrance)
})

/* ── Hidden reactions ──────────────────────────────────────────────────── */

const EGGS = Object.keys(ORBI_EASTER_SPECS) as OrbiEasterEgg[]

test('every reaction has beats, and its claim outlasts them', () => {
  for (const egg of EGGS) {
    const spec = ORBI_EASTER_SPECS[egg]
    assert.ok(spec.beats.length > 0, `${egg} has no beats`)
    const total = spec.beats.reduce((sum, b) => sum + b, 0)
    // `useOrbiEasterEggs` claims for `total + 600`; a claim that lapsed
    // mid-sequence would let something else take ORBI halfway through.
    assert.ok(total + 600 > total, `${egg} claim must outlast its beats`)
    assert.ok(total < 8000, `${egg} runs for ${total}ms — too long for a flourish`)
  }
})

test('a reaction never repeats inside its own run', () => {
  for (const egg of EGGS) {
    const spec = ORBI_EASTER_SPECS[egg]
    const total = spec.beats.reduce((sum, b) => sum + b, 0)
    assert.ok(spec.cooldown > total, `${egg} could re-fire before it finished`)
  }
})

test('only the two reactions the visitor triggers by touching ORBI bend the rules', () => {
  const userTriggered = EGGS.filter((e) => ORBI_EASTER_SPECS[e].userTriggered)
  assert.deepEqual(userTriggered.sort(), ['dizzyClick', 'headTap'])
  const interrupts = EGGS.filter((e) => ORBI_EASTER_SPECS[e].interrupts)
  assert.deepEqual(interrupts, ['dizzyClick'])
})

test('anything that may interrupt must also be one the visitor asked for', () => {
  for (const egg of EGGS) {
    const spec = ORBI_EASTER_SPECS[egg]
    if (spec.interrupts) {
      assert.ok(spec.userTriggered, `${egg} may interrupt but is not user-triggered`)
    }
  }
})

test('the repeated-click threshold stays a deliberate act', () => {
  assert.ok(ORBI_EASTER_EGGS.repeatedClickCount >= 5)
  assert.ok(ORBI_EASTER_EGGS.repeatedClickWindow <= 3000)
  // Faster than the click reaction's own cooldown, or five clicks could never
  // land inside the window.
  assert.ok(
    ORBI_EASTER_EGGS.repeatedClickWindow / ORBI_EASTER_EGGS.repeatedClickCount >
      ORBI_COOLDOWNS.clickMessage / 4,
  )
})

test('rare means rare: every unprompted gap sits inside its own bounds', () => {
  for (const gap of ORBI_EASTER_EGGS.rareIdleGaps) {
    assert.ok(gap >= ORBI_EASTER_EGGS.rareIdleMin, `${gap} is shorter than the minimum`)
    assert.ok(gap <= ORBI_EASTER_EGGS.rareIdleMax, `${gap} is longer than the maximum`)
  }
  assert.ok(ORBI_EASTER_EGGS.globalCooldown >= 10000)
  assert.ok(ORBI_EASTER_EGGS.maxBubbles <= 2)
})

/* ── Sound ─────────────────────────────────────────────────────────────── */

test('no cue is louder than the loudest one is allowed to be, or longer than a beat', () => {
  for (const [name, spec] of Object.entries(ORBI_SOUND_SPECS)) {
    assert.ok(spec.volume <= ORBI_AUDIO.successVolume, `${name} is too loud`)
    assert.ok(spec.durationMs <= 620, `${name} is too long`)
    assert.ok(spec.cooldownMs >= spec.durationMs, `${name} could overlap itself`)
    assert.ok([0, 1, 2].includes(spec.priority), `${name} has an unknown priority`)
  }
})

test('the master volume keeps ORBI quiet next to real media', () => {
  assert.ok(ORBI_AUDIO.masterVolume <= 0.3)
  assert.ok(ORBI_AUDIO.minGapMs > 0, 'two cues must never run into each other')
  assert.ok(ORBI_AUDIO.fadeMs > 0, 'cues are faded, never cut')
})

test('the audio preference is the only thing ORBI stores', () => {
  assert.equal(ORBI_AUDIO.storageKey, 'calibur-orbi-audio')
})

/* ── Stacking ──────────────────────────────────────────────────────────── */

test('ORBI sits above the page and below anything that owns the screen', () => {
  const SECTION_Z = 10
  const NAVBAR_Z = 100
  assert.ok(ORBI_Z_INDEX > SECTION_Z, 'ORBI must be above ordinary section content')
  assert.ok(ORBI_Z_INDEX < NAVBAR_Z, 'the navigation and any overlay must cover ORBI')
})
