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
 *           components/orbi/orbiDocks.ts components/orbi/orbiGuideConfig.ts \
 *           components/orbi/orbiSections.ts \
 *           components/orbi/orbiInvariants.test.mts \
 *       --outDir /tmp/orbi-inv --module nodenext --target es2022 --skipLibCheck --lib es2022,dom
 *   node --test /tmp/orbi-inv
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createOrbiArbiter } from './orbiArbiter.js'
import {
  holdsEyes,
  ORBI_ASK_FEELING,
  ORBI_ASK_PRESENCE,
  ORBI_AUDIO,
  ORBI_COOLDOWNS,
  ORBI_EASTER_EGGS,
  ORBI_EASTER_SPECS,
  ORBI_EMOTION,
  ORBI_MICRO,
  ORBI_PRIORITY,
  ORBI_SOUND_SPECS,
  ORBI_TIMING,
  ORBI_Z_INDEX,
  type OrbiEasterEgg,
} from './orbiConfig.js'
import {
  ORBI_GUIDE,
  ORBI_GUIDE_ITEMS,
  ORBI_GUIDE_MESSAGES,
  ORBI_GUIDE_SIDES,
  guidePanelSize,
} from './orbiGuideConfig.js'
import { chooseGuidePlacement, guideSheetRect } from './orbiDocks.js'
import { ORBI_SECTION_BEHAVIORS } from './orbiSections.js'
import { normaliseEmotion, ORBI_ASK_EMOTIONS } from './orbiAsk.js'

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
    p.formResult, p.interaction, p.guide, p.entrance,
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

/* ── Micro personality ─────────────────────────────────────────────────── */

test('the stretch finishes inside the beat that runs it', () => {
  // It rides the last beat of the deep-wake sequence. A stretch that outlives
  // its own run gets cut off by the teardown mid-movement.
  const beats = ORBI_EASTER_SPECS.deepWake.beats
  const last = beats[beats.length - 1]
  assert.ok(
    ORBI_MICRO.stretch.durationMs <= last,
    `the stretch is ${ORBI_MICRO.stretch.durationMs}ms and its beat is ${last}ms`,
  )
})

test('the shake and the lift finish inside their own beats too', () => {
  // The shake is the first beat of a rare idle; the lift is claimed for
  // `brightHoldMs`, which is what takes the face back afterwards.
  assert.ok(ORBI_MICRO.shake.durationMs <= ORBI_EASTER_SPECS.rareIdle.beats[0])
  assert.ok(ORBI_MICRO.lift.durationMs <= ORBI_TIMING.brightHoldMs)
})

test('every micro beat is subtle — and smaller again on a phone', () => {
  // Half a second to a little over a second. Anything quicker is a twitch,
  // anything longer stops being incidental and starts being a performance.
  for (const [name, beat] of Object.entries({
    stretch: ORBI_MICRO.stretch.durationMs,
    lift: ORBI_MICRO.lift.durationMs,
    shake: ORBI_MICRO.shake.durationMs,
  })) {
    assert.ok(beat >= 400 && beat <= 1200, `${name} runs for ${beat}ms`)
  }

  // The reset is a fraction of the stabilisation wobble it sits next to.
  assert.ok(ORBI_MICRO.shake.degrees < ORBI_EASTER_EGGS.wobbleDegrees / 2)
  assert.ok(ORBI_MICRO.shake.degreesQuiet <= 1, 'a phone gets one degree at most')
  assert.ok(ORBI_MICRO.shake.degreesQuiet < ORBI_MICRO.shake.degrees)
  assert.ok(ORBI_MICRO.stretch.armAngleQuiet < ORBI_MICRO.stretch.armAngle)
  assert.ok(ORBI_MICRO.stretch.liftQuiet < ORBI_MICRO.stretch.lift)
  assert.ok(ORBI_MICRO.lift.liftQuiet < ORBI_MICRO.lift.lift)

  // The stretch is the larger of the two body beats, and neither is a hop.
  assert.ok(ORBI_MICRO.lift.lift < ORBI_MICRO.stretch.lift)
  assert.ok(ORBI_MICRO.stretch.lift <= 5, 'three to five pixels, no more')
  assert.ok(!ORBI_MICRO.lift.armAngle, 'the hello has no arms in it')
})

test('the look-around stays inside the gaze range and is eyes only', () => {
  assert.ok(ORBI_MICRO.lookAroundX > 0 && ORBI_MICRO.lookAroundX <= 1)
  assert.ok(Math.abs(ORBI_MICRO.lookAroundY) <= 0.1, 'left and right, not up')
})

test('neither hello nor stretch is something a visitor can see repeatedly', () => {
  assert.ok(ORBI_MICRO.stretchEveryNthWake >= 2, 'not every waking')
  // Long enough that switching tabs to copy an address and back is not "away".
  assert.ok(ORBI_MICRO.happyReturnMs >= 30000)
  assert.ok(ORBI_MICRO.happyReturnCooldown > ORBI_MICRO.happyReturnMs)
})

test('the rare idle has one flavour per variant the guide can show', () => {
  // Four now: wink, a glance up, the look-around, the reset. The guide walks
  // `variant % 4`, so a fifth flavour without a fifth branch would be silent.
  const VARIANTS = 4
  assert.ok(
    ORBI_EASTER_EGGS.rareIdleGaps.length >= VARIANTS,
    'a visit should be able to reach every flavour before the table repeats',
  )
  // Three beats is what the look-around needs: left, centre, right, and the
  // teardown for the last centre.
  assert.ok(ORBI_EASTER_SPECS.rareIdle.beats.length >= 3)
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

/* ── Guide mode ────────────────────────────────────────────────────────── */

test('guide mode outranks everything ORBI does on his own, and yields to the entrance', () => {
  const p = ORBI_PRIORITY
  // The visitor asked for this, so a poke must not derail a trip in progress.
  assert.ok(p.guide > p.interaction)
  assert.ok(p.guide > p.section)
  assert.ok(p.guide > p.easterEgg)
  assert.ok(p.guide > p.cinematic)
  assert.ok(p.guide < p.entrance)
})

test('a guide claim is refused by nothing but the entrance, and hands back cleanly', () => {
  const arbiter = createOrbiArbiter()
  arbiter.claim(ORBI_PRIORITY.section, 'section:work', 5000)
  assert.equal(arbiter.claim(ORBI_PRIORITY.guide, 'guide', 4000), true)
  // The destination's own reaction cannot run until guide mode lets go — which
  // is exactly why `useOrbiGuideMode` releases before `onArrive`.
  assert.equal(arbiter.claim(ORBI_PRIORITY.section, 'section:work', 1000), false)
  arbiter.release('guide')
  assert.equal(arbiter.claim(ORBI_PRIORITY.section, 'section:work', 1000), true)
})

test('every destination is a section that actually reacts', () => {
  const known = new Set(ORBI_SECTION_BEHAVIORS.map((b) => b.id))
  for (const item of ORBI_GUIDE_ITEMS) {
    assert.ok(
      known.has(item.target),
      `${item.id} points at "${item.target}", which has no section behaviour — ` +
        'guide mode would arrive somewhere and do nothing',
    )
  }
})

test('every option leads where its label says — and Client Stories is not How We Work', () => {
  const byId = Object.fromEntries(ORBI_GUIDE_ITEMS.map((i) => [i.id, i]))

  assert.equal(byId.services?.target, 'services')
  assert.equal(byId.projects?.target, 'work')
  assert.equal(byId.testimonials?.target, 'testimonials')
  assert.equal(byId.about?.target, 'about')
  assert.equal(byId.contact?.target, 'contact')

  // The one that moved. "Client Stories" reads like a process page and is not
  // one: it goes to the client quotes, never to the precision diagram.
  assert.notEqual(byId.testimonials?.target, 'precision')
  assert.ok(
    !ORBI_GUIDE_ITEMS.some((i) => i.target === 'precision'),
    'How We Work is no longer a guide destination',
  )

  assert.deepEqual(
    ORBI_GUIDE_ITEMS.map((i) => i.label),
    ['Our Services', 'Our Work', 'Client Stories', 'About Calibur', 'Let\u2019s Talk'],
  )
})

test('taking How We Work off the menu leaves its own behaviour alone', () => {
  assert.ok(
    ORBI_SECTION_BEHAVIORS.some((b) => b.id === 'precision'),
    'the section still reacts on ordinary scrolling',
  )
})

test('Client Stories arrives warm rather than excited', () => {
  const behavior = ORBI_SECTION_BEHAVIORS.find((b) => b.id === 'testimonials')
  assert.ok(behavior, 'the destination needs a reaction of its own')
  assert.equal(behavior.expression, 'happy')
  assert.ok(!behavior.message, 'the quotes are what should be read, not ORBI')
  assert.ok(
    !['excited', 'surprised', 'wave'].includes(behavior.animation ?? ''),
    `${behavior.animation} is too big a gesture for this section`,
  )
  assert.ok(!behavior.wideGesture)
  assert.ok(behavior.restAnimation, 'he should keep facing the quotes afterwards')
})

test('the accessible name says what pressing an option does', () => {
  for (const item of ORBI_GUIDE_ITEMS) {
    const name = ORBI_GUIDE_MESSAGES.destinationLabel(item.label)
    assert.ok(name.includes(item.label), `${name} must carry its own label`)
    assert.ok(
      !/how we work/i.test(name),
      'no option may still announce the old wording',
    )
  }
})

test('the menu is a menu: unique ids, short labels, no text input to speak of', () => {
  const ids = ORBI_GUIDE_ITEMS.map((i) => i.id)
  assert.equal(new Set(ids).size, ids.length, 'destination ids must be unique')
  assert.ok(ORBI_GUIDE_ITEMS.length >= 3 && ORBI_GUIDE_ITEMS.length <= 7)
  for (const item of ORBI_GUIDE_ITEMS) {
    assert.ok(item.label.length <= 18, `"${item.label}" is too long for the panel`)
  }
})

test('opening reads as a control responding, not as a performance', () => {
  const total = ORBI_GUIDE.openBeatMs + ORBI_GUIDE.panelEnterMs
  assert.ok(total >= 200 && total <= 350, `opening takes ${total}ms`)
  assert.ok(ORBI_GUIDE.panelExitMs < ORBI_GUIDE.panelEnterMs, 'closing is quicker than opening')
})

test('the trip claim outlasts the trip, and the trip has a ceiling', () => {
  const longest =
    ORBI_GUIDE.travelDelayMs + ORBI_GUIDE.navTimeoutMs + ORBI_GUIDE.arriveHoldMs
  assert.ok(
    ORBI_GUIDE.navClaimMs > longest,
    'the claim could lapse mid-trip, letting something else take ORBI',
  )
  assert.ok(ORBI_GUIDE.minTravelMs < ORBI_GUIDE.navTimeoutMs)
  // One line per trip, and never the same one twice running.
  assert.ok(ORBI_GUIDE_MESSAGES.acknowledgements.length >= 2)
  for (const line of ORBI_GUIDE_MESSAGES.acknowledgements) {
    assert.ok(line.length <= 14, `"${line}" is a sentence, not an acknowledgement`)
  }
})

test('every dock knows where its panel opens, best side first', () => {
  for (const [dock, sides] of Object.entries(ORBI_GUIDE_SIDES)) {
    assert.equal(new Set(sides).size, sides.length, `${dock} lists a side twice`)
    assert.equal(sides.length, 4, `${dock} must rank every side`)
    // A right-hand dock must never prefer opening off the right edge.
    if (dock.endsWith('-right')) assert.notEqual(sides[0], 'right')
    if (dock.endsWith('-left')) assert.notEqual(sides[0], 'left')
  }
})

/* ── Guide panel placement ─────────────────────────────────────────────── */

const VIEWPORT = {
  width: 1440,
  height: 900,
  insetTop: 0,
  insetRight: 0,
  insetBottom: 0,
  insetLeft: 0,
  marginX: 32,
  marginY: 30,
}

/** ORBI docked bottom-right on a desktop viewport. */
const ORBI_BOX = { left: 1260, top: 738, right: 1408, bottom: 870 }

const GEOMETRY = {
  gap: ORBI_GUIDE.panel.gap,
  margin: ORBI_GUIDE.panel.margin,
  unsafeOverlap: ORBI_GUIDE.panel.unsafeOverlap,
}

test('with a clear page the panel opens above ORBI, aligned to his edge', () => {
  const size = guidePanelSize('desktop')
  const spot = chooseGuidePlacement(
    ORBI_BOX,
    size,
    [],
    VIEWPORT,
    ORBI_GUIDE_SIDES['bottom-right'],
    GEOMETRY,
  )
  assert.ok(spot, 'an empty page must always have somewhere to open')
  assert.equal(spot.side, 'above-right')
  assert.equal(spot.rect.right, ORBI_BOX.right)
  assert.ok(spot.rect.top >= GEOMETRY.margin, 'the panel must stay on screen')
})

test('a clear placement always beats a blocked one, whatever the dock prefers', () => {
  const size = guidePanelSize('desktop')
  // A submit button sitting where the panel would like to open.
  const above = {
    rect: { left: 1250, top: 600, right: 1400, bottom: 648 },
    weight: 3.2,
    label: 'contact-submit',
    urgent: true,
  }
  const spot = chooseGuidePlacement(
    ORBI_BOX,
    size,
    [above],
    VIEWPORT,
    ORBI_GUIDE_SIDES['bottom-right'],
    GEOMETRY,
  )
  assert.notEqual(spot?.side, 'above-right', 'the panel opened on top of the submit button')
  assert.equal(spot?.clear, true, 'a clear side was available and should have been taken')
  // ...and the alternative is a real one only because a side placement slides
  // into the viewport instead of being centred on a robot near the bottom.
  assert.ok(spot.rect.bottom <= VIEWPORT.height - GEOMETRY.margin)
  assert.ok(spot.rect.top >= GEOMETRY.margin)
})

test('when every side is blocked the panel still opens, and says what it is over', () => {
  // A narrow phone is the real case: three sides leave the screen, and the
  // hero's own call-to-action is under the fourth. The alternative to opening
  // here is the full-width sheet, which covers strictly more.
  const size = guidePanelSize('desktop')
  const everywhere = {
    rect: { left: 0, top: 0, right: VIEWPORT.width, bottom: VIEWPORT.height },
    weight: 3.2,
    label: 'view-work',
    urgent: true,
  }
  const spot = chooseGuidePlacement(
    ORBI_BOX,
    size,
    [everywhere],
    VIEWPORT,
    ORBI_GUIDE_SIDES['bottom-right'],
    GEOMETRY,
  )
  assert.ok(spot, 'a placement that fits on screen is always better than nothing')
  assert.equal(spot.clear, false)
  assert.equal(spot.blocker, 'view-work')
  assert.ok(spot.side, 'the dock\u2019s ranking still decides which is least bad')
})

test('nothing fits on screen at all means the sheet, and only then', () => {
  // A viewport shorter than the panel: every side leaves it.
  const tiny = { ...VIEWPORT, width: 360, height: 260, marginX: 12, marginY: 16 }
  const orbi = { left: 260, top: 165, right: 348, bottom: 244 }
  const spot = chooseGuidePlacement(
    orbi,
    guidePanelSize('mobile'),
    [],
    tiny,
    ORBI_GUIDE_SIDES['bottom-right'],
    GEOMETRY,
  )
  assert.equal(spot, null)
})

test('the sheet always lands inside the viewport, however little room there is', () => {
  const sheetGeometry = {
    ...GEOMETRY,
    maxWidth: ORBI_GUIDE.panel.sheetMaxWidth,
    minHeight: ORBI_GUIDE.panel.sheetMinHeight,
  }
  const cases = [
    { width: 320, height: 568, orbi: { left: 220, top: 473, right: 308, bottom: 552 } },
    // A phone on its side: nothing like enough room above him.
    { width: 568, height: 320, orbi: { left: 468, top: 225, right: 556, bottom: 304 } },
  ]

  for (const { width, height, orbi } of cases) {
    const viewport = { ...VIEWPORT, width, height, marginX: 12, marginY: 16 }
    const rect = guideSheetRect(orbi, guidePanelSize('mobile'), viewport, sheetGeometry)
    assert.ok(rect.left >= ORBI_GUIDE.panel.margin - 0.5, `left ${rect.left}`)
    assert.ok(rect.right <= width - ORBI_GUIDE.panel.margin + 0.5, `right ${rect.right}`)
    assert.ok(rect.top >= ORBI_GUIDE.panel.margin - 0.5, `top ${rect.top}`)
    assert.ok(rect.bottom <= height - ORBI_GUIDE.panel.margin + 0.5, `bottom ${rect.bottom}`)
    assert.ok(rect.right - rect.left > 120, 'a sheet narrower than this is unreadable')
    assert.ok(rect.bottom - rect.top > 100, 'a sheet shorter than this shows nothing')
  }
})

test('the panel fits above ORBI on the smallest phone we support', () => {
  const viewport = { ...VIEWPORT, width: 320, height: 568, marginX: 12, marginY: 16 }
  const orbi = { left: 220, top: 473, right: 308, bottom: 552 }
  const spot = chooseGuidePlacement(
    orbi,
    guidePanelSize('mobile'),
    [],
    viewport,
    ORBI_GUIDE_SIDES['bottom-right'],
    GEOMETRY,
  )
  assert.ok(spot, '320x568 should still get a floating panel, not the sheet')
  assert.equal(spot.side, 'above-right')
})


/* ── Phase 25: what an emotion word is allowed to move ─────────────────── */

test('every feeling a provider can ask for is one ORBI already had', () => {
  const poses = new Set(Object.values(ORBI_EMOTION as Record<string, unknown>))
  for (const [word, felt] of ORBI_ASK_FEELING) {
    assert.ok(poses.has(felt.emotion), `"${word}" invented a pose of its own`)
  }
})

test('the pose map covers the enum, minus the resting state', () => {
  assert.deepEqual(
    [...ORBI_ASK_FEELING.keys()].sort(),
    ['concerned', 'curious', 'excited', 'happy', 'surprised', 'unsure'],
  )
  // `normal` is absent on purpose: it must mean "do nothing", not "play the
  // normal feeling", and it is what every unknown word becomes.
  assert.equal(ORBI_ASK_FEELING.get('normal'), undefined)
})

test('a hostile emotion key cannot reach a pose', () => {
  // A Map has no prototype to walk, which is why one is used here rather than
  // an object literal — this is the second line of defence behind the enum.
  for (const key of [
    '__proto__', 'constructor', 'prototype', 'toString', 'valueOf',
    'hasOwnProperty', '../../happy', 'javascript:alert(1)', '<script>',
    'dizzy', 'sleepy', 'thinking', 'shy', 'wink', 'sleep', 'HAPPY', ' happy ',
  ]) {
    assert.equal(ORBI_ASK_FEELING.get(key), undefined, `"${key}" resolved to a pose`)
  }
})

test('a response reaction is brief, and inside the range the brief sets', () => {
  for (const [word, felt] of ORBI_ASK_FEELING) {
    assert.ok(
      felt.emotion.holdMs >= 800 && felt.emotion.holdMs <= 1400,
      `"${word}" holds for ${felt.emotion.holdMs}ms`,
    )
  }
})

test('no response reaction leans further than a project card does', () => {
  // The dwell lean is the loudest ambient body movement ORBI has. Nothing an
  // answer triggers may out-shout it, or a conversation becomes a performance.
  const loudest = Math.max(
    ...[...ORBI_ASK_FEELING.values()].map((f) => Math.abs(f.emotion.tilt)),
  )
  assert.ok(loudest <= ORBI_EMOTION.curiousLean + 0.5, `leans up to ${loudest}°`)
})

test('the glance at the ask panel is rare enough to not be a keystroke echo', () => {
  assert.ok(
    ORBI_EMOTION.askGlanceCooldownMs >= 4000,
    `glances every ${ORBI_EMOTION.askGlanceCooldownMs}ms`,
  )
})


/* ── Phase 26: conversation presence is timings, not machinery ─────────── */

test('the ask-open acknowledgement is inside the window the brief sets', () => {
  assert.ok(
    ORBI_ASK_PRESENCE.openAckMs >= 500 && ORBI_ASK_PRESENCE.openAckMs <= 900,
    `open ack is ${ORBI_ASK_PRESENCE.openAckMs}ms`,
  )
})

test('the send acknowledgement is short enough to read as one motion', () => {
  // It sits between pressing Send and the thinking face. Long enough to see,
  // short enough that nobody could mistake it for the request being slow.
  assert.ok(
    ORBI_ASK_PRESENCE.sendAckMs > 0 && ORBI_ASK_PRESENCE.sendAckMs <= 400,
    `send ack is ${ORBI_ASK_PRESENCE.sendAckMs}ms`,
  )
})

test('the reading glance is inside the window the brief sets', () => {
  assert.ok(
    ORBI_ASK_PRESENCE.readingMs >= 700 && ORBI_ASK_PRESENCE.readingMs <= 1200,
    `reading glance is ${ORBI_ASK_PRESENCE.readingMs}ms`,
  )
})

test('listening adjusts sparsely, at the rate the brief asks for', () => {
  assert.ok(
    ORBI_ASK_PRESENCE.listenIntervalMs >= 5000 &&
      ORBI_ASK_PRESENCE.listenIntervalMs <= 8000,
    `listening adjusts every ${ORBI_ASK_PRESENCE.listenIntervalMs}ms`,
  )
})

test('a listening adjustment is small enough to be a shift, not a look', () => {
  assert.ok(ORBI_ASK_PRESENCE.listenDrift <= 0.25, `drift is ${ORBI_ASK_PRESENCE.listenDrift}`)
})

test('an adjustment is held long enough to be seen, and ends well inside its interval', () => {
  assert.ok(ORBI_ASK_PRESENCE.adjustHoldMs >= 400, `held ${ORBI_ASK_PRESENCE.adjustHoldMs}ms`)
  assert.ok(
    ORBI_ASK_PRESENCE.adjustHoldMs < ORBI_ASK_PRESENCE.listenIntervalMs,
    'an adjustment must finish before the next one is due',
  )
})

test('a typing pause is longer than ordinary typing rhythm', () => {
  // Under a second and this fires between words, which is a twitch rather
  // than ORBI noticing somebody stopped to think.
  assert.ok(
    ORBI_ASK_PRESENCE.pauseAfterMs >= 1200,
    `pause fires after ${ORBI_ASK_PRESENCE.pauseAfterMs}ms`,
  )
  assert.ok(ORBI_ASK_PRESENCE.pauseHoldMs <= 1400, `pause holds ${ORBI_ASK_PRESENCE.pauseHoldMs}ms`)
})

test('a whole answer-to-normal sequence stays under a few seconds', () => {
  // reaction → gap → reading → normal. If this ever grew past a few seconds,
  // ORBI would still be performing while the visitor typed the next question.
  const longest = Math.max(...[...ORBI_ASK_FEELING.values()].map((f) => f.emotion.holdMs))
  const total = longest + ORBI_ASK_PRESENCE.readingDelayMs + ORBI_ASK_PRESENCE.readingMs
  assert.ok(total <= 3000, `answer to normal takes ${total}ms`)
})


/* ── Faces: every feeling must reach one of its own ───────────────────── */

test('the seven answer emotions map to seven distinct faces', () => {
  // The rule this phase exists for. `excited` used to render as `happy` and
  // `unsure` as `thinking`, so four feelings shared two faces and no amount of
  // tilt could tell them apart.
  const faces = [...ORBI_ASK_FEELING.values()].map((f) => f.expression)
  assert.equal(
    new Set(faces).size,
    faces.length,
    `two answer emotions share a face: ${faces.join(', ')}`,
  )
})

test('every answer emotion has a face that is not the resting one', () => {
  for (const [word, felt] of ORBI_ASK_FEELING) {
    assert.notEqual(felt.expression, 'normal', `"${word}" renders as the normal face`)
  }
})

test('the faces the brief requires to differ actually do', () => {
  const face = (word: string) => ORBI_ASK_FEELING.get(word)?.expression
  for (const [a, b] of [
    ['happy', 'excited'],
    ['curious', 'concerned'],
    ['unsure', 'concerned'],
    ['surprised', 'happy'],
  ] as Array<[string, string]>) {
    assert.notEqual(face(a), face(b), `${a} and ${b} render the same face`)
  }
  // Thinking is not answer-selectable, so it is checked against the enum.
  assert.notEqual(face('unsure'), 'thinking', 'unsure still borrows the thinking face')
})

test('a face whose point is its eye shape keeps the blink scheduler out', () => {
  for (const owned of ['excited', 'shy', 'unsure', 'dizzy', 'wink', 'surprised', 'sleepy']) {
    assert.ok(holdsEyes(owned as never), `${owned} would be blinked over`)
  }
  // And the two that are held long enough that not blinking would look wrong.
  for (const free of ['concerned', 'normal', 'curious', 'thinking']) {
    assert.ok(!holdsEyes(free as never), `${free} suppresses blinking`)
  }
})

test('adding faces did not widen what a provider may ask for', () => {
  // The security property from Phase 25, restated now that the expression
  // vocabulary is bigger: the two sets are related by a map, not by identity.
  for (const local of ['thinking', 'shy', 'sleepy', 'dizzy', 'wink', 'blink']) {
    assert.ok(
      !(ORBI_ASK_EMOTIONS as readonly string[]).includes(local),
      `"${local}" became answer-selectable`,
    )
    assert.equal(normaliseEmotion(local), 'normal')
    assert.equal(ORBI_ASK_FEELING.get(local), undefined, `"${local}" is reachable through the map`)
  }
})
