/**
 * ORBI — audio tests.
 *
 * The engine is a state machine over a Web Audio graph, so it can be tested
 * exactly like one: a fake AudioContext records what was created and when, a
 * fake clock advances by hand, and every assertion is about *policy* — who may
 * interrupt whom, what a cooldown blocks, what a fade tears down — rather than
 * about anything anyone can hear. No speakers, no timers, no flake.
 *
 * Run them with the project's own TypeScript and Node's built-in runner:
 *
 *   npx tsc components/orbi/orbiAudio.ts components/orbi/orbiConfig.ts \
 *           components/orbi/orbiAudio.test.mts \
 *       --outDir /tmp/orbi-audio --module nodenext --target es2022 --skipLibCheck
 *   node --test /tmp/orbi-audio
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createOrbiAudioEngine,
  readAudioPreference,
  writeAudioPreference,
  subscribeAudioPreference,
} from './orbiAudio.js'
import { ORBI_AUDIO, ORBI_SOUND_SPECS } from './orbiConfig.js'

/* ── A Web Audio graph that only remembers what it was told ────────────── */

type Call = { param: string; value: number; time: number }

class FakeParam {
  calls: Call[] = []
  value = 0
  constructor(private param: string) {}
  setValueAtTime(value: number, time: number) {
    this.value = value
    this.calls.push({ param: this.param, value, time })
    return this
  }
  exponentialRampToValueAtTime(value: number, time: number) {
    this.value = value
    this.calls.push({ param: this.param, value, time })
    return this
  }
  linearRampToValueAtTime(value: number, time: number) {
    this.value = value
    this.calls.push({ param: this.param, value, time })
    return this
  }
  cancelScheduledValues() {
    return this
  }
}

class FakeNode {
  connected: FakeNode[] = []
  disconnected = 0
  connect(target: FakeNode) {
    this.connected.push(target)
    return target
  }
  disconnect() {
    this.disconnected += 1
  }
}

class FakeSource extends FakeNode {
  started: number | null = null
  stopped: number | null = null
  buffer: unknown = null
  loop = false
  type = 'sine'
  frequency = new FakeParam('frequency')
  playbackRate = new FakeParam('playbackRate')
  start(time: number) {
    this.started = time
  }
  stop(time: number) {
    // The real API keeps the earliest stop; so does this, which is what makes
    // "a fade shortens the cue" observable.
    this.stopped = this.stopped === null ? time : Math.min(this.stopped, time)
  }
}

class FakeContext {
  currentTime = 0
  sampleRate = 48000
  state: 'running' | 'suspended' | 'closed' = 'running'
  destination = new FakeNode()
  oscillators: FakeSource[] = []
  buffers: FakeSource[] = []
  gains: Array<FakeNode & { gain: FakeParam }> = []
  closed = 0

  createOscillator() {
    const osc = new FakeSource()
    this.oscillators.push(osc)
    return osc as unknown as OscillatorNode
  }
  createBufferSource() {
    const source = new FakeSource()
    this.buffers.push(source)
    return source as unknown as AudioBufferSourceNode
  }
  createGain() {
    const node = Object.assign(new FakeNode(), { gain: new FakeParam('gain') })
    this.gains.push(node)
    return node as unknown as GainNode
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), {
      type: 'bandpass',
      frequency: new FakeParam('frequency'),
      Q: new FakeParam('Q'),
    }) as unknown as BiquadFilterNode
  }
  createBuffer(_channels: number, length: number) {
    const data = new Float32Array(length)
    return { getChannelData: () => data } as unknown as AudioBuffer
  }
  async suspend() {
    this.state = 'suspended'
  }
  async resume() {
    this.state = 'running'
  }
  async close() {
    this.closed += 1
    this.state = 'closed'
  }
  /** Advance the audio clock, in ms. */
  advance(ms: number) {
    this.currentTime += ms / 1000
  }
}

function engineWith() {
  const ctx = new FakeContext()
  const engine = createOrbiAudioEngine(() => ctx as unknown as AudioContext)
  assert.ok(engine, 'engine should have been created')
  return { ctx, engine: engine! }
}

/* ── Making a sound at all ─────────────────────────────────────────────── */

test('a cue schedules oscillators and holds the channel', () => {
  const { ctx, engine } = engineWith()
  assert.equal(engine.play('acknowledge'), true)
  assert.ok(ctx.oscillators.length >= 1)
  assert.equal(engine.state().current, 'acknowledge')
  assert.equal(engine.state().lastSound, 'acknowledge')
  assert.equal(engine.state().lastRejection, null)
})

test('every cue in the vocabulary plays and is under two thirds of a second', () => {
  for (const sound of Object.keys(ORBI_SOUND_SPECS) as Array<
    keyof typeof ORBI_SOUND_SPECS
  >) {
    const { ctx, engine } = engineWith()
    assert.equal(engine.play(sound), true, `${sound} should play`)
    assert.ok(
      ctx.oscillators.length + ctx.buffers.length > 0,
      `${sound} should make at least one source`,
    )
    assert.ok(
      ORBI_SOUND_SPECS[sound].durationMs <= 620,
      `${sound} is too long to be a UI cue`,
    )
    assert.ok(
      ORBI_SOUND_SPECS[sound].volume <= ORBI_AUDIO.successVolume,
      `${sound} is louder than the loudest cue is allowed to be`,
    )
  }
})

test('the master gain is the quiet one, and every cue sits under it', () => {
  const { ctx, engine } = engineWith()
  engine.play('success')
  assert.equal(ctx.gains[0].gain.value, ORBI_AUDIO.masterVolume)
})

/* ── Cooldowns ─────────────────────────────────────────────────────────── */

test('a cue will not repeat inside its own cooldown', () => {
  const { ctx, engine } = engineWith()
  assert.equal(engine.play('acknowledge'), true)
  ctx.advance(ORBI_SOUND_SPECS.acknowledge.cooldownMs - 50)
  assert.equal(engine.play('acknowledge'), false)
  assert.equal(engine.state().lastRejection, 'cooldown')
  ctx.advance(100)
  assert.equal(engine.play('acknowledge'), true)
})

test('twenty rapid clicks make far fewer than twenty sounds', () => {
  const { ctx, engine } = engineWith()
  let heard = 0
  for (let i = 0; i < 20; i++) {
    if (engine.play('acknowledge')) heard += 1
    ctx.advance(60)
  }
  // 20 clicks over 1.2s against a 400ms cooldown.
  assert.ok(heard <= 4, `expected at most 4 cues, heard ${heard}`)
  assert.ok(heard >= 2, `expected the throttle to let some through, heard ${heard}`)
})

test('two different cues still cannot butt up against each other', () => {
  const { ctx, engine } = engineWith()
  engine.play('acknowledge')
  ctx.advance(ORBI_SOUND_SPECS.acknowledge.durationMs + 10)
  // Past the cue, but inside the minimum gap.
  assert.equal(engine.play('happy'), false)
  assert.equal(engine.state().lastRejection, 'gap')
  ctx.advance(ORBI_AUDIO.minGapMs)
  assert.equal(engine.play('happy'), true)
})

/* ── One voice at a time ───────────────────────────────────────────────── */

test('a lower-priority cue never talks over a higher one', () => {
  const { engine } = engineWith()
  assert.equal(engine.play('success'), true)
  assert.equal(engine.play('acknowledge'), false)
  assert.equal(engine.state().lastRejection, 'busy')
  assert.equal(engine.state().current, 'success')
})

test('a higher-priority cue takes the channel and fades the old one', () => {
  const { ctx, engine } = engineWith()
  engine.play('fly')
  const flying = ctx.oscillators.length + ctx.buffers.length
  assert.equal(engine.play('success'), true)
  assert.equal(engine.state().current, 'success')
  // The flight sources were told to stop early rather than left running.
  const stoppedEarly = [...ctx.oscillators, ...ctx.buffers].slice(0, flying)
  assert.ok(
    stoppedEarly.every((node) => node.stopped !== null),
    'the interrupted cue should have been stopped',
  )
})

test('equal priority hands over — the newest thing ORBI feels wins', () => {
  const { engine } = engineWith()
  engine.play('fly')
  assert.equal(engine.play('land'), true)
  assert.equal(engine.state().current, 'land')
})

test('only ever one cue is current', () => {
  const { ctx, engine } = engineWith()
  engine.play('happy')
  engine.play('success')
  engine.play('dizzy')
  ctx.advance(0)
  assert.equal(engine.state().current, 'dizzy')
})

test('a cue that has run its length is no longer current', () => {
  const { ctx, engine } = engineWith()
  engine.play('land')
  ctx.advance(ORBI_SOUND_SPECS.land.durationMs + 1)
  assert.equal(engine.state().current, null)
})

/* ── Stopping ──────────────────────────────────────────────────────────── */

test('fading stops the sources and clears the channel', () => {
  const { ctx, engine } = engineWith()
  engine.play('fly')
  engine.fade()
  assert.equal(engine.state().current, null)
  assert.ok(
    [...ctx.oscillators, ...ctx.buffers].every((node) => node.stopped !== null),
  )
})

test('hiding the tab suspends the context and silences the cue', () => {
  const { ctx, engine } = engineWith()
  engine.play('success')
  engine.suspend()
  assert.equal(ctx.state, 'suspended')
  assert.equal(engine.state().current, null)
})

test('nothing is scheduled against a suspended clock', () => {
  const { ctx, engine } = engineWith()
  ctx.state = 'suspended'
  assert.equal(engine.play('happy'), false)
  assert.equal(engine.state().lastRejection, 'suspended')
  assert.equal(ctx.oscillators.length, 0)
})

test('unmounting closes the context and refuses to make any more sound', () => {
  const { ctx, engine } = engineWith()
  engine.play('happy')
  engine.dispose()
  assert.equal(ctx.closed, 1)
  assert.equal(engine.play('success'), false)
  assert.equal(engine.state().lastRejection, 'disposed')
})

test('disposing twice is not an error', () => {
  const { ctx, engine } = engineWith()
  engine.dispose()
  engine.dispose()
  assert.equal(ctx.closed, 1)
})

/* ── When there is no Web Audio at all ─────────────────────────────────── */

test('a browser without Web Audio simply gets a silent ORBI', () => {
  const engine = createOrbiAudioEngine(() => {
    throw new Error('no AudioContext here')
  })
  assert.equal(engine, null)
})

test('a context that cannot build a gain node is treated the same way', () => {
  const broken = {
    createGain() {
      throw new Error('nope')
    },
  }
  const engine = createOrbiAudioEngine(() => broken as unknown as AudioContext)
  assert.equal(engine, null)
})

/* ── The preference ────────────────────────────────────────────────────── */

function fakeStorage(initial?: string) {
  const map = new Map<string, string>()
  if (initial !== undefined) map.set(ORBI_AUDIO.storageKey, initial)
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => {
      map.set(key, value)
    },
    read: () => map.get(ORBI_AUDIO.storageKey) ?? null,
  }
}

test('with no stored preference, ORBI is muted', () => {
  assert.equal(readAudioPreference(fakeStorage()), false)
})

test('"off" is muted, and anything unexpected is muted too', () => {
  assert.equal(readAudioPreference(fakeStorage('off')), false)
  assert.equal(readAudioPreference(fakeStorage('yes please')), false)
})

test('"on" is the only value that enables sound', () => {
  assert.equal(readAudioPreference(fakeStorage('on')), true)
})

test('the preference round-trips', () => {
  const store = fakeStorage()
  assert.equal(writeAudioPreference(true, store), true)
  assert.equal(store.read(), 'on')
  assert.equal(readAudioPreference(store), true)
  writeAudioPreference(false, store)
  assert.equal(store.read(), 'off')
  assert.equal(readAudioPreference(store), false)
})

test('storage that throws on read means muted, not broken', () => {
  const hostile = {
    getItem() {
      throw new Error('denied')
    },
    setItem() {
      throw new Error('denied')
    },
  }
  assert.equal(readAudioPreference(hostile), false)
})

test('storage that throws on write reports failure but does not throw', () => {
  const hostile = {
    getItem: () => null,
    setItem() {
      throw new Error('denied')
    },
  }
  assert.equal(writeAudioPreference(true, hostile), false)
})

test('subscribers are told when the preference changes', () => {
  let calls = 0
  const stop = subscribeAudioPreference(() => {
    calls += 1
  })
  writeAudioPreference(true, fakeStorage())
  writeAudioPreference(false, fakeStorage())
  stop()
  writeAudioPreference(true, fakeStorage())
  assert.equal(calls, 2)
})
