'use client'

import { useEffect, useState, type RefObject } from 'react'
import type { OrbiArbiter } from './orbiArbiter'
import type { OrbiGazeController } from './orbiGaze'
import type { OrbiScrollDirection } from './useOrbiScroll'
import type { OrbiDrowsiness, OrbiProximity } from './useOrbiInteraction'
import { ORBI_PRIORITY, type OrbiState } from './orbiConfig'

/**
 * Development HUD. Never rendered in production — `OrbiGuide` gates it on
 * `NODE_ENV`, which Next inlines, so the whole component is dropped from the
 * production bundle.
 *
 * The priority claim lives outside React (it must never trigger a render), so
 * this polls it rather than subscribing.
 */

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
  arbiter: OrbiArbiter
  gazeRef: RefObject<OrbiGazeController | null>
  eventRef: RefObject<string>
}) {
  const [live, setLive] = useState({ lock: 'idle', gaze: 'neutral', event: '—' })

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
      }
      setLive((previous) =>
        previous.lock === next.lock &&
        previous.gaze === next.gaze &&
        previous.event === next.event
          ? previous
          : next,
      )
      frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [arbiter, gazeRef, eventRef])

  const rows: Array<[string, string]> = [
    ['section', section ?? '—'],
    ['expression', state.expression],
    ['animation', state.animation],
    ['scroll', direction ?? 'still'],
    ['gaze', live.gaze],
    ['pointer', proximity],
    ['idle', drowsiness === 0 ? 'awake' : drowsiness === 1 ? 'drowsy' : 'dozing'],
    ['lock', live.lock],
    ['station', station],
    ['speech', state.message ?? '—'],
    ['event', live.event],
  ]

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
        minWidth: '186px',
      }}
    >
      <div style={{ color: '#00B7FF', marginBottom: '3px' }}>ORBI</div>
      {rows.map(([key, value]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
          <span style={{ color: '#4A5A6C' }}>{key}</span>
          <span data-orbi-field={key} style={{ color: '#E9F1F8' }}>
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}
