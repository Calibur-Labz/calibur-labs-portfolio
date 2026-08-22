'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { OrbiArbiter } from './orbiArbiter'
import type { OrbiGazeController } from './orbiGaze'
import type { OrbiScrollDirection } from './useOrbiScroll'
import type { OrbiDrowsiness, OrbiProximity } from './useOrbiInteraction'
import type { OrbiEnvironmentApi } from './useOrbiEnvironment'
import type { OrbiFormApi } from './useOrbiForm'
import type { OrbiCinematicApi } from './useOrbiCinematic'
import type { OrbiEasterApi } from './useOrbiEasterEggs'
import type { OrbiGuideApi } from './useOrbiGuideMode'
import type { OrbiAudioApi } from './useOrbiAudio'
import {
  ORBI_EASTER_EGGS,
  ORBI_EASTER_SPECS,
  ORBI_PRIORITY,
  ORBI_SOUND_SPECS,
  type OrbiSound,
  type OrbiState,
} from './orbiConfig'

/**
 * Development HUD. Never rendered in production — `OrbiGuide` gates it on
 * `NODE_ENV`, which Next inlines, so the whole component is dropped from the
 * production bundle.
 *
 * The priority claim lives outside React (it must never trigger a render), so
 * this polls it rather than subscribing.
 */

const DOCK_SHORT: Record<string, string> = {
  'bottom-right': 'br',
  'bottom-left': 'bl',
  'mid-right': 'mr',
  'mid-left': 'ml',
}

/** ORBI's own sleep, as opposed to how long the visitor has been quiet. */
const DROWSY_NAMES: Record<number, string> = {
  0: 'awake',
  1: 'drowsy',
  2: 'dozing',
  3: 'asleep',
}

/** How far under the visitor has gone. */
const DEPTH_NAMES: Record<number, string> = {
  0: 'awake',
  1: 'quiet',
  2: 'drowsy',
  3: 'asleep',
}

const LEVEL_NAMES = Object.fromEntries(
  Object.entries(ORBI_PRIORITY).map(([name, level]) => [level, name]),
) as Record<number, string>

export default function OrbiDebug({
  state,
  section,
  direction,
  station,
  proximity,
  drowsiness,
  environment,
  form,
  cinematic,
  easter,
  guide,
  guideTools,
  audio,
  audioTools,
  sleep,
  arbiter,
  gazeRef,
  eventRef,
}: {
  state: OrbiState
  section: string | null
  direction: OrbiScrollDirection
  station: 'home' | 'edge'
  proximity: OrbiProximity
  drowsiness: OrbiDrowsiness
  environment: OrbiEnvironmentApi
  form: OrbiFormApi
  cinematic: OrbiCinematicApi
  easter: OrbiEasterApi
  guide: OrbiGuideApi
  /** `?orbi-guide=1` — the destination buttons below the readout. */
  guideTools: boolean
  audio: OrbiAudioApi
  /** `?orbi-audio-debug=1` — the sound-test buttons below the readout. */
  audioTools: boolean
  sleep: {
    stage: OrbiDrowsiness
    bodyAnimation: boolean
    mouth: 'normal' | 'flat' | 'sleep'
    snoreCycleMs: number
    particles: number
    /** Polled with the other live values, never read during render. */
    wakeSourceRef: RefObject<string>
  }
  arbiter: OrbiArbiter
  gazeRef: RefObject<OrbiGazeController | null>
  eventRef: RefObject<string>
}) {
  const { wakeSourceRef } = sleep
  const [live, setLive] = useState({ lock: 'idle', gaze: 'neutral', event: '—', woke: '—' })

  useEffect(() => {
    let frame = 0
    const tick = () => {
      const claim = arbiter.current()
      const next = {
        lock: claim
          ? `${LEVEL_NAMES[claim.level] ?? claim.level} · ${claim.owner}`
          : 'idle',
        gaze: gazeRef.current?.source() ?? 'neutral',
        event: eventRef.current ?? '—',
        woke: wakeSourceRef.current ?? '—',
      }
      setLive((previous) =>
        previous.lock === next.lock &&
        previous.gaze === next.gaze &&
        previous.event === next.event &&
        previous.woke === next.woke
          ? previous
          : next,
      )
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [arbiter, gazeRef, eventRef, wakeSourceRef])

  const dock = environment.dock
  const beats = easter.type ? ORBI_EASTER_SPECS[easter.type].beats.length : 0
  const found = Object.entries(easter.discoveries)
    .filter(([, seen]) => seen)
    .map(([name]) => name)
    .join(' ')

  const rows: Array<[string, string]> = [
    ['section', section ?? '—'],
    ['expression', state.expression],
    ['animation', state.animation],
    ['scroll', direction ?? 'still'],
    ['gaze', live.gaze],
    ['pointer', proximity],
    ['idle', DROWSY_NAMES[drowsiness] ?? String(drowsiness)],
    ['lock', live.lock],
    ['station', station],
    ['speech', state.message ?? '—'],
    ['event', live.event],
    ['—env—', ''],
    ['dock', environment.dock],
    [
      'scores',
      environment.scores
        .map((s) => `${DOCK_SHORT[s.dock]}:${s.score.toFixed(2)}`)
        .join(' '),
    ],
    ['blocker', environment.blocker ?? '—'],
    ['overlap', `${Math.round(environment.overlap * 100)}%`],
    ['theme', environment.theme],
    ['bubble', `${environment.bubble.placement}/${environment.bubble.align}`],
    ['modal', environment.modal ? 'open' : '—'],
    ['crowded', environment.crowded ? 'yes → peek' : '—'],
    ['regions', String(environment.regions)],
    ['decision', environment.reason],
    ['—form—', ''],
    ['companion', form.companion ? 'active' : '—'],
    ['form', form.present ? 'in view' : '—'],
    // Field *identifiers* only. Values are never read, so they can never leak.
    ['field', form.field ?? '—'],
    ['invalid', form.invalidField ?? '—'],
    ['status', form.status],
    [
      'form gaze',
      form.gaze ? `${form.gaze.x.toFixed(2)},${form.gaze.y.toFixed(2)}` : '—',
    ],
    [
      'form box',
      form.rect
        ? `${Math.round(form.rect.left)},${Math.round(form.rect.top)} ` +
          `${Math.round(form.rect.right - form.rect.left)}x` +
          `${Math.round(form.rect.bottom - form.rect.top)}`
        : '—',
    ],
    ['submission', String(form.submissionId)],
    ['form event', form.lastEvent],
    ['—cinematic—', ''],
    ['running', cinematic.active ? 'yes' : '—'],
    ['type', cinematic.type ?? '—'],
    ['phase', cinematic.phase],
    [
      'destination',
      cinematic.destination
        ? `${Math.round(cinematic.destination.x)},${Math.round(cinematic.destination.y)}`
        : '—',
    ],
    ['dest safe', cinematic.safe ? 'yes' : 'NO'],
    ['from dock', dock],
    ['elapsed', cinematic.active ? `${cinematic.elapsedMs}ms` : '—'],
    ['cancel', cinematic.cancelReason ?? '—'],
    ['—easter—', ''],
    ['egg', easter.active ? (easter.type ?? '—') : '—'],
    ['beat', easter.active ? `${easter.step + 1}/${beats}` : '—'],
    ['clicks', `${easter.clicks}/${ORBI_EASTER_EGGS.repeatedClickCount}`],
    ['cursor', easter.chasing ? 'fast' : 'calm'],
    ['circle', `${Math.round(easter.circle * 100)}%`],
    ['idle depth', DEPTH_NAMES[easter.depth] ?? String(easter.depth)],
    ['cooldown', easter.cooldownMs ? `${Math.round(easter.cooldownMs / 100) / 10}s` : '—'],
    ['bubbles', `${easter.bubbles}/${ORBI_EASTER_EGGS.maxBubbles}`],
    ['found', found || '—'],
    ['egg event', easter.lastEvent],
    ['—guide—', ''],
    ['menu', guide.open ? 'open' : 'closed'],
    // Prefixed on purpose: the rows are keyed by their label, and `phase` and
    // `destination` are already taken by the cinematic block above.
    ['guide phase', guide.phase],
    ['guide dest', guide.selected?.label ?? '—'],
    ['guide anchor', guide.selected ? `#${guide.selected.target}` : '—'],
    ['placement', guide.placement + (guide.blocked ? ' (relaxed)' : '')],
    ['panel over', guide.blocked ?? '—'],
    // Who owns the trip. Guide mode holds the claim in short bursts and hands
    // it back before the destination reacts, so `—` here mid-arrival is right.
    ['nav owner', guide.owning ? 'guide' : guide.phase === 'closed' ? '—' : 'released'],
    ['guide cancel', guide.cancelReason ?? '—'],
    ['—audio—', ''],
    ['preferred', audio.preferred ? 'on' : 'off'],
    ['unlocked', audio.unlocked ? 'yes' : 'no'],
    ['muted', audio.active ? 'no' : 'YES'],
    ['context', audio.contextState],
    ['playing', audio.current ?? '—'],
    ['priority', audio.current ? String(ORBI_SOUND_SPECS[audio.current].priority) : '—'],
    ['last sound', audio.lastSound ?? '—'],
    ['rejected', audio.lastReason ?? '—'],
    ['storage', audio.storageOk ? 'ok' : 'unavailable'],
    ['—sleep—', ''],
    ['stage', DROWSY_NAMES[sleep.stage] ?? String(sleep.stage)],
    ['body loop', sleep.bodyAnimation ? 'breathing' : '—'],
    ['mouth', sleep.mouth],
    ['snore', sleep.snoreCycleMs ? `${sleep.snoreCycleMs / 1000}s` : '—'],
    ['Z', sleep.particles ? `active ×${sleep.particles}` : '—'],
    ['woke by', live.woke],
  ]

  const sounds = Object.keys(ORBI_SOUND_SPECS) as OrbiSound[]

  /** Same gate as the sound tests: dev-only HUD, dev-only switch. */
  const guideButtons = guideTools ? guide.items : []

  return (
    <div
      data-orbi-debug=""
      style={{
        position: 'fixed',
        left: '12px',
        bottom: '12px',
        zIndex: 9999,
        pointerEvents: 'none',
        padding: '8px 10px',
        borderRadius: '8px',
        background: 'rgba(5, 7, 12, 0.86)',
        border: '1px solid rgba(0, 183, 255, 0.3)',
        color: '#93A6BC',
        font: '500 10px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace',
        letterSpacing: '0.02em',
        minWidth: '212px',
        maxWidth: '260px',
      }}
    >
      <div style={{ color: '#00B7FF', marginBottom: '3px' }}>ORBI</div>
      {rows.map(([key, value]) =>
        value === '' ? (
          <div
            key={key}
            style={{ color: '#24344A', margin: '4px 0 2px', letterSpacing: '0.08em' }}
          >
            {key}
          </div>
        ) : (
          <div
            key={key}
            style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}
          >
            <span style={{ color: '#4A5A6C' }}>{key}</span>
            <span
              data-orbi-field={key}
              style={{ color: '#E9F1F8', textAlign: 'right', wordBreak: 'break-word' }}
            >
              {value}
            </span>
          </div>
        ),
      )}

      {/*
        Guide destinations. Gated on `?orbi-guide=1` *and* on the HUD, which
        never renders in production. Each button runs the real lifecycle —
        open, choose, travel, arrive — rather than jumping to the end of it.
      */}
      {guideButtons.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3px',
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid #1B2838',
            pointerEvents: 'auto',
          }}
        >
          {guideButtons.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                guide.openMenu()
                setTimeout(() => guide.choose(item), 260)
              }}
              style={TEST_BUTTON}
            >
              {item.id}
            </button>
          ))}
        </div>
      )}

      {/*
        Sound tests. Gated on `?orbi-audio-debug=1` *and* on the HUD itself,
        which never renders in production — so these cannot ship. Each button
        is a real click, which is also what audio unlocking needs.
      */}
      {audioTools && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '3px',
            marginTop: '6px',
            paddingTop: '6px',
            borderTop: '1px solid #1B2838',
            pointerEvents: 'auto',
          }}
        >
          <button
            type="button"
            onClick={audio.toggle}
            style={{ ...TEST_BUTTON, color: audio.preferred ? '#00B7FF' : '#93A6BC' }}
          >
            {audio.preferred ? 'mute' : 'unmute'}
          </button>
          {sounds.map((sound) => (
            <button
              key={sound}
              type="button"
              onClick={() => audio.play(sound)}
              style={TEST_BUTTON}
            >
              {sound}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

const TEST_BUTTON = {
  font: '500 9px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace',
  color: '#93A6BC',
  background: 'rgba(0, 183, 255, 0.08)',
  border: '1px solid rgba(0, 183, 255, 0.22)',
  borderRadius: '4px',
  padding: '2px 5px',
  cursor: 'pointer',
} as const
