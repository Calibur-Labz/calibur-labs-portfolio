/**
 * ORBI — his voice.
 *
 * Every cue is **synthesised in the browser**. There are no audio files, and
 * that is a design decision rather than a shortcut:
 *
 *  - Nothing to download. Sound costs zero bytes on a page where it is off by
 *    default, and there is no asset that can 404, arrive late, or need a
 *    loading state (Phase 9 §40, §41).
 *  - Nothing to license. ORBI's identity is a handful of sine partials written
 *    here, not a sample lifted from something that already exists (§9).
 *  - Tunable in the one place. A cue is four numbers and an envelope, so
 *    "quieter, shorter, less bright" is an edit rather than a re-export (§53).
 *
 * The vocabulary is deliberately narrow and deliberately soft: sine and
 * triangle partials in the 300–2600Hz range, exponential decays, and one
 * band-passed noise sweep for the flight pass. No square waves, no bass, no
 * anything that could read as an alarm.
 *
 * Nothing here touches React or the DOM. The engine is created only once the
 * visitor has asked for sound inside a real gesture (see `useOrbiAudio`), owns
 * exactly one primary channel, and can always be told to fade and disappear.
 */

import {
  ORBI_AUDIO,
  ORBI_SOUND_SPECS,
  type OrbiSound,
  type OrbiSoundPriority,
} from './orbiConfig'

/* ── Public shape ──────────────────────────────────────────────────────── */

export type OrbiAudioRejection =
  | 'cooldown'
  | 'busy'
  | 'gap'
  | 'suspended'
  | 'disposed'

export interface OrbiAudioState {
  /** What is sounding right now, if anything. */
  current: OrbiSound | null
  currentPriority: OrbiSoundPriority | null
  lastSound: OrbiSound | null
  /** Why the last request did not make a sound. Debug HUD only. */
  lastRejection: OrbiAudioRejection | null
}

export interface OrbiAudioEngine {
  /** True when the cue actually started. */
  play: (sound: OrbiSound) => boolean
  /** Fade whatever is sounding. Used by cancellation, muting, and hiding. */
  fade: (ms?: number) => void
  /** Everything off, immediately but without a click. */
  stopAll: () => void
  suspend: () => void
  resume: () => Promise<void>
  dispose: () => void
  state: () => OrbiAudioState
  /** For tests and the HUD; never used to make decisions. */
  contextState: () => string
}

/** Injected in tests. In the browser this is the real constructor. */
export interface OrbiAudioContextFactory {
  (): AudioContext
}

/* ── Building blocks ───────────────────────────────────────────────────── */

interface Scheduler {
  ctx: AudioContext
  /** Everything a cue creates hangs off this, so one fade kills all of it. */
  out: GainNode
  /** Where the cue starts, in context time. */
  t0: number
  /** Peak gain for the cue. */
  peak: number
  track: (node: AudioScheduledSourceNode) => void
}

/**
 * One partial: a pitch that starts, optionally glides, and decays away.
 *
 * The envelope is always the same shape — a few milliseconds of attack so
 * nothing clicks, then an exponential decay — because consistency across the
 * nine cues is most of what makes them sound like one character.
 */
function tone(
  s: Scheduler,
  {
    at = 0,
    freq,
    to,
    durationMs,
    gain = 1,
    type = 'sine',
    attackMs = 8,
  }: {
    at?: number
    freq: number
    /** Glide target, if the pitch moves. */
    to?: number
    durationMs: number
    gain?: number
    type?: OscillatorType
    attackMs?: number
  },
) {
  const start = s.t0 + at / 1000
  const end = start + durationMs / 1000
  const peak = s.peak * gain

  const osc = s.ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (to !== undefined && to !== freq) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), end)
  }

  const env = s.ctx.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(peak, start + attackMs / 1000)
  env.gain.exponentialRampToValueAtTime(0.0001, end)

  osc.connect(env)
  env.connect(s.out)
  osc.start(start)
  osc.stop(end + 0.02)
  s.track(osc)
}

/**
 * The flight pass: band-passed noise sweeping up and back down.
 *
 * Air rather than engine — ORBI has no motor, and a motor loop on a page with
 * a companion on every screen would be intolerable within a minute (§15, §17).
 */
function whoosh(
  s: Scheduler,
  {
    durationMs,
    from = 700,
    peakHz = 2100,
    to = 900,
    gain = 1,
  }: { durationMs: number; from?: number; peakHz?: number; to?: number; gain?: number },
) {
  const start = s.t0
  const end = start + durationMs / 1000
  const mid = start + (end - start) * 0.45

  const source = s.ctx.createBufferSource()
  source.buffer = noiseBuffer(s.ctx)
  source.loop = true

  const band = s.ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.Q.setValueAtTime(1.4, start)
  band.frequency.setValueAtTime(from, start)
  band.frequency.exponentialRampToValueAtTime(peakHz, mid)
  band.frequency.exponentialRampToValueAtTime(to, end)

  const env = s.ctx.createGain()
  env.gain.setValueAtTime(0.0001, start)
  env.gain.exponentialRampToValueAtTime(s.peak * gain, mid)
  env.gain.exponentialRampToValueAtTime(0.0001, end)

  source.connect(band)
  band.connect(env)
  env.connect(s.out)
  source.start(start)
  source.stop(end + 0.02)
  s.track(source)
}

/** One second of white noise, made once per context and reused. */
const noiseBuffers = new WeakMap<AudioContext, AudioBuffer>()

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  const cached = noiseBuffers.get(ctx)
  if (cached) return cached

  const length = Math.floor(ctx.sampleRate * 0.6) || 26460
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate || 44100)
  const data = buffer.getChannelData(0)
  // Deterministic noise: a tiny LCG rather than Math.random, so a rendered
  // cue is byte-identical run to run and can be reasoned about in a test.
  let seed = 0x2f6e2b1
  for (let i = 0; i < length; i++) {
    seed = (seed * 1664525 + 1013904223) >>> 0
    data[i] = (seed / 0xffffffff) * 2 - 1
  }
  noiseBuffers.set(ctx, buffer)
  return buffer
}

/* ── The vocabulary ────────────────────────────────────────────────────── */

/**
 * Nine cues, one family.
 *
 * High and short means curiosity or acknowledgement; ascending means good
 * news; descending means settling or sleep; airy means movement. Every one of
 * them is under two thirds of a second, and most are under a quarter.
 */
const VOICES: Record<OrbiSound, (s: Scheduler) => void> = {
  // Eyes on. Two bright partials, barely there.
  activate: (s) => {
    tone(s, { freq: 1760, durationMs: 90, gain: 0.55, attackMs: 4 })
    tone(s, { at: 45, freq: 2640, durationMs: 95, gain: 0.32, attackMs: 4 })
  },

  // "Noted." Mid, one small step up, gone.
  acknowledge: (s) => {
    tone(s, { freq: 880, to: 1046, durationMs: 110, gain: 0.7, type: 'triangle' })
    tone(s, { at: 20, freq: 1760, durationMs: 70, gain: 0.16 })
  },

  // A pass of air, not an engine.
  fly: (s) => {
    whoosh(s, { durationMs: 500, from: 620, peakHz: 2300, to: 840, gain: 0.5 })
    tone(s, { at: 30, freq: 520, to: 780, durationMs: 300, gain: 0.12 })
  },

  // Arriving: a small dip and a tap of air.
  land: (s) => {
    tone(s, { freq: 880, to: 587, durationMs: 190, gain: 0.5, type: 'triangle' })
    whoosh(s, { durationMs: 200, from: 1400, peakHz: 900, to: 600, gain: 0.22 })
  },

  // Three steps up. The smallest delight ORBI has.
  happy: (s) => {
    tone(s, { freq: 988, durationMs: 90, gain: 0.5 })
    tone(s, { at: 70, freq: 1318, durationMs: 90, gain: 0.45 })
    tone(s, { at: 140, freq: 1568, durationMs: 120, gain: 0.4 })
  },

  // The one warm moment: a two-note rise with a fifth under it.
  success: (s) => {
    tone(s, { freq: 659.25, durationMs: 240, gain: 0.6, type: 'triangle' })
    tone(s, { freq: 987.77, durationMs: 250, gain: 0.18 })
    tone(s, { at: 190, freq: 987.77, durationMs: 330, gain: 0.55, type: 'triangle' })
    tone(s, { at: 190, freq: 1318.51, durationMs: 320, gain: 0.16 })
  },

  // Going under: a long, soft slide down.
  sleep: (s) => {
    tone(s, { freq: 660, to: 314, durationMs: 600, gain: 0.5, type: 'sine', attackMs: 40 })
    tone(s, { at: 120, freq: 330, to: 190, durationMs: 460, gain: 0.16, attackMs: 60 })
  },

  // Coming back: up, with a small overshoot so it reads as a stretch.
  wake: (s) => {
    tone(s, { freq: 392, to: 784, durationMs: 240, gain: 0.55, type: 'triangle', attackMs: 12 })
    tone(s, { at: 210, freq: 880, to: 830, durationMs: 160, gain: 0.4 })
  },

  // Off balance: a wobble that settles. Electronic, not cartoon.
  dizzy: (s) => {
    const wobble = [0, 90, 180, 270, 350]
    const pitch = [1046, 880, 988, 784, 740]
    wobble.forEach((at, i) => {
      tone(s, {
        at,
        freq: pitch[i],
        to: pitch[i] * (i % 2 ? 0.94 : 1.06),
        durationMs: 110,
        gain: 0.34 - i * 0.04,
        type: 'triangle',
        attackMs: 6,
      })
    })
  },
}

/* ── The engine ────────────────────────────────────────────────────────── */

/**
 * One primary channel, and rules about who may take it.
 *
 * A louder rule than any of them: **this is never created on page load.**
 * `useOrbiAudio` calls it from inside a user gesture and not before, so no
 * AudioContext exists — and no autoplay policy is ever tested — until the
 * visitor has asked for one (§2, §34).
 */
export function createOrbiAudioEngine(
  factory?: OrbiAudioContextFactory,
): OrbiAudioEngine | null {
  let ctx: AudioContext
  try {
    const create =
      factory ??
      (() => {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!Ctor) throw new Error('no AudioContext')
        return new Ctor()
      })
    ctx = create()
  } catch {
    // No Web Audio, or the browser refused. ORBI simply stays silent — there
    // is nothing here he needs in order to work.
    return null
  }

  let master: GainNode
  try {
    master = ctx.createGain()
    master.gain.value = ORBI_AUDIO.masterVolume
    master.connect(ctx.destination)
  } catch {
    return null
  }

  let disposed = false
  let channel: GainNode | null = null
  let sources: AudioScheduledSourceNode[] = []
  let current: OrbiSound | null = null
  let currentPriority: OrbiSoundPriority | null = null
  let endsAt = 0
  let lastSound: OrbiSound | null = null
  let lastRejection: OrbiAudioRejection | null = null
  /** When the last cue finished — the gap is silence *between* cues. */
  let lastEndedAt = -Infinity
  const playedAt = new Map<OrbiSound, number>()

  const now = () => ctx.currentTime * 1000

  /** Silence the channel over `ms` and let go of every node on it. */
  const release = (ms: number) => {
    const gain = channel
    const held = sources
    channel = null
    sources = []
    current = null
    currentPriority = null
    if (endsAt) lastEndedAt = Math.min(endsAt, now() + ms)
    endsAt = 0
    if (!gain) return

    const at = ctx.currentTime
    const until = at + Math.max(0.01, ms / 1000)
    try {
      gain.gain.cancelScheduledValues(at)
      gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), at)
      gain.gain.exponentialRampToValueAtTime(0.0001, until)
    } catch {
      /* A context that has gone away cannot be faded; nothing to do. */
    }
    held.forEach((node) => {
      try {
        node.stop(until)
      } catch {
        /* Already stopped, or never started. */
      }
    })
    // Disconnecting after the fade rather than on a timer keeps the teardown
    // synchronous with the audio clock instead of with the event loop.
    try {
      gain.disconnect(master)
      setTimeout(() => {
        try {
          gain.disconnect()
        } catch {
          /* Already gone. */
        }
      }, ms + 60)
    } catch {
      /* Already disconnected. */
    }
  }

  return {
    play(sound) {
      if (disposed) {
        lastRejection = 'disposed'
        return false
      }
      // A suspended context would schedule the cue against a clock that is not
      // running, and it would all arrive at once on resume.
      if (ctx.state === 'suspended' || ctx.state === 'closed') {
        lastRejection = 'suspended'
        return false
      }

      const spec = ORBI_SOUND_SPECS[sound]
      const at = now()

      const last = playedAt.get(sound)
      if (last !== undefined && at - last < spec.cooldownMs) {
        lastRejection = 'cooldown'
        return false
      }

      const busy = current !== null && at < endsAt
      if (busy && currentPriority !== null && spec.priority < currentPriority) {
        // Something more important is talking. ORBI does not talk over himself.
        lastRejection = 'busy'
        return false
      }
      // Two cues never run into each other: there is always a beat of silence
      // between them, however far apart their own cooldowns are.
      if (!busy && at - lastEndedAt < ORBI_AUDIO.minGapMs) {
        lastRejection = 'gap'
        return false
      }

      // Equal or higher priority: the newer cue takes the channel, and the old
      // one is faded rather than cut.
      if (busy) release(ORBI_AUDIO.fadeMs)

      const gain = ctx.createGain()
      gain.gain.value = 1
      gain.connect(master)

      const held: AudioScheduledSourceNode[] = []
      VOICES[sound]({
        ctx,
        out: gain,
        t0: ctx.currentTime,
        peak: spec.volume,
        track: (node) => held.push(node),
      })

      channel = gain
      sources = held
      current = sound
      currentPriority = spec.priority
      endsAt = at + spec.durationMs
      lastSound = sound
      lastRejection = null
      lastEndedAt = endsAt
      playedAt.set(sound, at)
      return true
    },

    fade(ms = ORBI_AUDIO.fadeMs * 3) {
      release(ms)
    },

    stopAll() {
      release(ORBI_AUDIO.fadeMs)
    },

    suspend() {
      release(ORBI_AUDIO.fadeMs)
      try {
        void ctx.suspend()
      } catch {
        /* Some browsers refuse on a closed context. Nothing to recover. */
      }
    },

    async resume() {
      if (disposed) return
      try {
        await ctx.resume()
      } catch {
        /* Still locked, or gone. The next gesture will try again. */
      }
    },

    dispose() {
      if (disposed) return
      disposed = true
      release(0)
      try {
        master.disconnect()
      } catch {
        /* Already disconnected. */
      }
      try {
        void ctx.close()
      } catch {
        /* Already closed. */
      }
    },

    state: () => {
      // A cue that has run its length is no longer "current" — the HUD should
      // say silent when ORBI is silent.
      const live = current !== null && now() < endsAt
      return {
        current: live ? current : null,
        currentPriority: live ? currentPriority : null,
        lastSound,
        lastRejection,
      }
    },
    contextState: () => {
      try {
        return ctx.state
      } catch {
        return 'closed'
      }
    },
  }
}

/* ── The one thing ORBI remembers ──────────────────────────────────────── */

export type OrbiAudioPreference = 'on' | 'off'

/**
 * Storage that might not be there.
 *
 * Private mode, a locked-down browser, an embedded webview: reading
 * `localStorage` can throw before it can return anything. Both helpers below
 * treat that as "no preference", which is the same as a first visit — audio
 * off, and everything else works exactly as it did (§36).
 */
export interface OrbiStorage {
  getItem: (key: string) => string | null
  setItem: (key: string, value: string) => void
}

/**
 * The preference as an external store.
 *
 * `useSyncExternalStore` rather than state-plus-effect: the value lives in
 * localStorage, which is exactly the "external system" that API exists for,
 * and it lets the server snapshot be a definite `false` — so a returning
 * visitor with sound on never produces a hydration mismatch.
 */
const preferenceListeners = new Set<() => void>()

/**
 * What the visitor has chosen *this session*.
 *
 * Authoritative once it is set, because storage is allowed to fail: in a
 * locked-down browser the choice simply does not survive the visit, and that
 * must not mean the toggle stops working (§36). Passing an explicit `storage`
 * bypasses it entirely, which is what the tests do.
 */
let sessionPreference: boolean | null = null

export function subscribeAudioPreference(onChange: () => void): () => void {
  preferenceListeners.add(onChange)
  return () => {
    preferenceListeners.delete(onChange)
  }
}

/** Muted, always, before the client has had a look at storage. */
export const audioPreferenceServerSnapshot = () => false

export function readAudioPreference(storage?: OrbiStorage | null): boolean {
  if (storage === undefined && sessionPreference !== null) return sessionPreference
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
    return store?.getItem(ORBI_AUDIO.storageKey) === 'on'
  } catch {
    return false
  }
}

export function writeAudioPreference(
  enabled: boolean,
  storage?: OrbiStorage | null,
): boolean {
  if (storage === undefined) sessionPreference = enabled
  try {
    const store = storage ?? (typeof window !== 'undefined' ? window.localStorage : null)
    if (!store) return false
    store.setItem(ORBI_AUDIO.storageKey, enabled ? 'on' : 'off')
    preferenceListeners.forEach((listener) => listener())
    return true
  } catch {
    // The preference simply does not survive this visit. Sound still works —
    // it just will not be remembered — so subscribers are still told.
    preferenceListeners.forEach((listener) => listener())
    return false
  }
}
