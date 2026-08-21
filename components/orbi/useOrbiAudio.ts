'use client'

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { type OrbiSound } from './orbiConfig'
import {
  audioPreferenceServerSnapshot,
  createOrbiAudioEngine,
  readAudioPreference,
  subscribeAudioPreference,
  writeAudioPreference,
  type OrbiAudioEngine,
  type OrbiAudioRejection,
} from './orbiAudio'

/**
 * ORBI — whether he is allowed to make a sound, and when.
 *
 * Two things have to be true before anything is audible, and confusing them is
 * the classic way to end up fighting a browser:
 *
 *  - **preferred** — the visitor asked for sound. Remembered in localStorage,
 *    and the only thing ORBI persists about anyone.
 *  - **unlocked** — a browser has actually let us start an AudioContext, which
 *    it will only do inside a real user gesture.
 *
 * A returning visitor arrives with `preferred: true` and `unlocked: false`, and
 * that is a perfectly normal state: the toggle shows sound as on, nothing plays
 * yet, and the first genuine gesture — anywhere on the page — quietly unlocks
 * it. No context is constructed before that, so a fresh load never touches the
 * autoplay policy at all and there is nothing for a browser to warn about.
 */

export type OrbiAudioReason = OrbiAudioRejection | 'muted' | 'locked' | 'unavailable'

export interface OrbiAudioApi {
  /** What the visitor asked for. Drives the toggle. */
  preferred: boolean
  /** Whether a browser has let us make sound yet. */
  unlocked: boolean
  /** Both of the above: a `play()` right now would be heard. */
  active: boolean
  /** Ask for a cue. Cheap and safe to call when muted — it does nothing. */
  play: (sound: OrbiSound) => void
  /** Fade whatever is sounding: cancellation, muting, leaving the page. */
  fade: () => void
  /**
   * Flip the preference. **Must** be called from a user gesture — that gesture
   * is what unlocks audio in Safari and on iOS.
   */
  toggle: () => void
  /* Debug HUD only. */
  current: OrbiSound | null
  lastSound: OrbiSound | null
  lastReason: OrbiAudioReason | null
  contextState: string
  /** False when the preference could not be written — private mode, mostly. */
  storageOk: boolean
}

/** How long a cue asked for during unlock stays worth playing. */
const UNLOCK_GRACE_MS = 400

export interface OrbiAudioOptions {
  /**
   * The debug HUD is open. Audio events reach React only when it is: with the
   * HUD closed a cue costs a couple of oscillators and not one render.
   */
  hud?: boolean
}

export function useOrbiAudio({ hud = false }: OrbiAudioOptions = {}): OrbiAudioApi {
  // The preference lives in localStorage, so it is read as an external store
  // rather than mirrored into state: the server snapshot is a definite `false`,
  // which is also the safe answer, so a returning visitor with sound on gets a
  // correction after hydration rather than a mismatch.
  const preferred = useSyncExternalStore(
    subscribeAudioPreference,
    () => readAudioPreference(),
    audioPreferenceServerSnapshot,
  )
  const [unlocked, setUnlocked] = useState(false)
  const [storageOk, setStorageOk] = useState(true)
  /**
   * What the engine is doing, mirrored into state for the debug HUD. Written
   * only on an audio event — and, unless the HUD is open, only on a toggle —
   * so a cue costs no render in production.
   */
  const [telemetry, setTelemetry] = useState<{
    current: OrbiSound | null
    lastSound: OrbiSound | null
    lastReason: OrbiAudioReason | null
    contextState: string
  }>({ current: null, lastSound: null, lastReason: null, contextState: 'none' })

  const engineRef = useRef<OrbiAudioEngine | null>(null)
  const preferredRef = useRef(false)
  const unlockedRef = useRef(false)
  const reasonRef = useRef<OrbiAudioReason | null>(null)
  const hudRef = useRef(hud)
  useEffect(() => {
    hudRef.current = hud
  }, [hud])
  /** A cue asked for while the context was still waking up. */
  const pendingRef = useRef<{ sound: OrbiSound; at: number } | null>(null)

  const sync = useCallback(() => {
    const engine = engineRef.current
    const state = engine?.state()
    setTelemetry({
      current: state?.current ?? null,
      lastSound: state?.lastSound ?? null,
      lastReason: reasonRef.current,
      contextState: engine?.contextState() ?? 'none',
    })
  }, [])

  /* ── Creating it, exactly once, and never on load ───────────────────── */

  const ensureEngine = useCallback(() => {
    if (engineRef.current) return engineRef.current
    const engine = createOrbiAudioEngine()
    if (!engine) {
      reasonRef.current = 'unavailable'
      return null
    }
    engineRef.current = engine
    return engine
  }, [])

  /**
   * Called from inside a gesture, and only from inside one. Resuming is async,
   * so a cue asked for in the same beat is held briefly rather than dropped —
   * that is what makes the first click after a reload audible.
   */
  const unlock = useCallback(() => {
    const engine = ensureEngine()
    if (!engine) return
    void engine.resume().then(() => {
      unlockedRef.current = true
      setUnlocked(true)
      const pending = pendingRef.current
      pendingRef.current = null
      if (!pending) return
      if (performance.now() - pending.at > UNLOCK_GRACE_MS) return
      if (!preferredRef.current) return
      engine.play(pending.sound)
      sync()
    })
  }, [ensureEngine, sync])

  /* ── The preference ─────────────────────────────────────────────────── */

  useEffect(() => {
    preferredRef.current = preferred
  }, [preferred])

  /**
   * A returning visitor whose preference is on: wait for any real gesture and
   * unlock quietly. Nothing is played here — an unexpected noise on someone's
   * first click is exactly what §2 is about.
   */
  useEffect(() => {
    if (!preferred || unlocked) return

    const onGesture = () => unlock()
    const options = { capture: true, passive: true } as const
    window.addEventListener('pointerdown', onGesture, options)
    window.addEventListener('touchstart', onGesture, options)
    window.addEventListener('keydown', onGesture, options)

    return () => {
      window.removeEventListener('pointerdown', onGesture, options)
      window.removeEventListener('touchstart', onGesture, options)
      window.removeEventListener('keydown', onGesture, options)
    }
  }, [preferred, unlocked, unlock])

  const toggle = useCallback(() => {
    const next = !preferredRef.current
    preferredRef.current = next
    // Writing notifies the store, which re-renders every subscriber; the
    // return value only says whether it will survive the visit.
    setStorageOk(writeAudioPreference(next))

    if (!next) {
      // Muting is immediate and applies to whatever is sounding right now —
      // mid-flight, mid-celebration, it does not matter (§43, §44).
      engineRef.current?.stopAll()
      engineRef.current?.suspend()
      reasonRef.current = 'muted'
      sync()
      return
    }

    // This call *is* the gesture. Creating and resuming the context here is
    // the only moment a browser will agree to it.
    const engine = ensureEngine()
    if (!engine) {
      sync()
      return
    }
    pendingRef.current = { sound: 'activate', at: performance.now() }
    unlock()
    sync()
  }, [ensureEngine, sync, unlock])

  /* ── Playing ────────────────────────────────────────────────────────── */

  const play = useCallback((sound: OrbiSound) => {
    if (!preferredRef.current) {
      reasonRef.current = 'muted'
      return
    }
    const engine = engineRef.current
    if (!engine) {
      reasonRef.current = 'locked'
      return
    }
    if (!unlockedRef.current) {
      // Unlocking is in flight. Hold the cue for a moment rather than dropping
      // it, so the gesture that unlocked audio still gets its reply.
      pendingRef.current = { sound, at: performance.now() }
      reasonRef.current = 'locked'
      return
    }
    engine.play(sound)
    reasonRef.current = engine.state().lastRejection
    if (hudRef.current) sync()
  }, [sync])

  const fade = useCallback(() => {
    engineRef.current?.fade()
    if (hudRef.current) sync()
  }, [sync])

  /* ── Leaving, and coming back ───────────────────────────────────────── */

  useEffect(() => {
    const onVisibility = () => {
      const engine = engineRef.current
      if (!engine) return
      if (document.visibilityState === 'hidden') {
        // Nothing ORBI has to say matters to someone in another tab, and a
        // cue arriving from a background tab is startling (§31).
        engine.suspend()
        return
      }
      // Whatever was missed is missed. Only future events make sound.
      if (preferredRef.current && unlockedRef.current) void engine.resume()
    }

    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  useEffect(
    () => () => {
      engineRef.current?.dispose()
      engineRef.current = null
    },
    [],
  )

  return {
    preferred,
    unlocked,
    active: preferred && unlocked,
    play,
    fade,
    toggle,
    current: telemetry.current,
    lastSound: telemetry.lastSound,
    lastReason: telemetry.lastReason,
    contextState: telemetry.contextState,
    storageOk,
  }
}
