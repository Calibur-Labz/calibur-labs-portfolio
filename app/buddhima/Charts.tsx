'use client'

import { useState } from 'react'

export const CHART = {
  income: 'var(--color-success, #34D399)',
  expense: 'var(--color-error, #F87171)',
  accent: 'var(--accent, #00B7FF)',
}
const GRID = 'rgba(255,255,255,0.07)'
const AXIS = 'var(--muted-text, #6E8399)'

function niceMax(value: number): number {
  if (value <= 0) return 1
  const pow = Math.pow(10, Math.floor(Math.log10(value)))
  const norm = value / pow
  const step = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10
  return step * pow
}

/**
 * Multi-series line chart. Supports negative values (e.g. net cashflow) by
 * placing a zero baseline when the data range crosses zero.
 */
export function LineChart({
  data,
  series,
  formatValue = shortNum,
}: {
  data: { label: string; values: number[] }[]
  series: { label: string; color: string }[]
  /** Format a value for the hover tooltip (e.g. as currency). */
  formatValue?: (n: number) => string
}) {
  const [active, setActive] = useState<number | null>(null)

  if (data.length === 0) {
    return <Empty>No data for this period yet.</Empty>
  }

  const W = 680
  const H = 300
  const padL = 56
  const padR = 18
  const padT = 16
  const padB = 34
  const plotW = W - padL - padR
  const plotH = H - padT - padB

  const all = data.flatMap((d) => d.values)
  const rawMax = Math.max(0, ...all)
  const rawMin = Math.min(0, ...all)
  const max = rawMax > 0 ? niceMax(rawMax) : rawMin < 0 ? 0 : 1
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0
  const span = max - min || 1

  const x = (i: number) => (data.length === 1 ? padL + plotW / 2 : padL + (i / (data.length - 1)) * plotW)
  const y = (v: number) => padT + plotH - ((v - min) / span) * plotH

  const tickCount = 4
  const tickVals = Array.from({ length: tickCount + 1 }, (_, k) => min + (span * k) / tickCount)

  // Width of each hover band (the slice of the plot that maps to one point).
  const band = data.length === 1 ? plotW : plotW / (data.length - 1)

  return (
    <div style={{ position: 'relative' }}>
      <Legend items={series} />
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        onMouseLeave={() => setActive(null)}
      >
        {/* horizontal grid + y labels */}
        {tickVals.map((t, i) => (
          <g key={i}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke={GRID} strokeWidth={1} />
            <text x={padL - 8} y={y(t) + 4} textAnchor="end" fontSize={10} fill={AXIS}>
              {shortNum(t)}
            </text>
          </g>
        ))}
        {/* emphasised zero baseline when range crosses zero */}
        {min < 0 && (
          <line x1={padL} y1={y(0)} x2={W - padR} y2={y(0)} stroke={AXIS} strokeWidth={1} opacity={0.5} />
        )}
        {/* x labels */}
        {data.map((d, i) => (
          <text
            key={d.label + i}
            x={x(i)}
            y={H - 12}
            textAnchor="middle"
            fontSize={10}
            fill={active === i ? 'var(--heading)' : AXIS}
          >
            {d.label}
          </text>
        ))}
        {/* one line per series */}
        {series.map((s, si) => {
          const pts = data.map((d, i) => `${x(i)},${y(d.values[si] ?? 0)}`).join(' ')
          return (
            <g key={s.label}>
              <polyline points={pts} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
              {data.map((d, i) => (
                <circle key={i} cx={x(i)} cy={y(d.values[si] ?? 0)} r={active === i ? 5 : 3} fill={s.color} />
              ))}
            </g>
          )
        })}
        {/* transparent hover hit areas — one band per data point */}
        {data.map((d, i) => (
          <rect
            key={'hit' + i}
            x={Math.max(padL, x(i) - band / 2)}
            y={padT}
            width={Math.min(band, W - padR - Math.max(padL, x(i) - band / 2))}
            height={plotH}
            fill="transparent"
            onMouseEnter={() => setActive(i)}
            onMouseMove={() => setActive(i)}
          />
        ))}
      </svg>

      {active !== null && (
        <Tooltip
          leftPct={(x(active) / W) * 100}
          label={data[active].label}
          rows={series.map((s, si) => ({
            color: s.color,
            label: s.label,
            value: formatValue(data[active].values[si] ?? 0),
          }))}
        />
      )}
    </div>
  )
}

function Tooltip({
  leftPct,
  label,
  rows,
}: {
  leftPct: number
  label: string
  rows: { color: string; label: string; value: string }[]
}) {
  // Keep the box from spilling off the edges: anchor from the right past centre.
  const nearRight = leftPct > 66
  return (
    <div
      style={{
        position: 'absolute',
        top: '34px',
        left: `${leftPct}%`,
        transform: `translateX(${nearRight ? '-100%' : leftPct < 34 ? '0' : '-50%'})`,
        pointerEvents: 'none',
        background: 'var(--panel-raised, #121A26)',
        border: '1px solid var(--hairline, #17222F)',
        borderRadius: '10px',
        padding: '9px 11px',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        whiteSpace: 'nowrap',
        zIndex: 5,
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--muted-text)', marginBottom: '6px' }}>{label}</div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
          <span style={{ width: '9px', height: '9px', borderRadius: '2px', background: r.color, flexShrink: 0 }} />
          <span style={{ color: 'var(--muted-text)' }}>{r.label}</span>
          <span style={{ color: 'var(--heading)', marginLeft: 'auto', fontWeight: 600 }}>{r.value}</span>
        </div>
      ))}
    </div>
  )
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div style={{ display: 'flex', gap: '18px', marginBottom: '10px', flexWrap: 'wrap' }}>
      {items.map((it) => (
        <span
          key={it.label}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', fontSize: '12px', color: 'var(--muted-text)' }}
        >
          <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--muted-text)', fontSize: '14px', margin: '8px 0' }}>{children}</p>
}

function shortNum(n: number): string {
  const sign = n < 0 ? '-' : ''
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${sign}${(abs / 1_000_000).toFixed(abs % 1_000_000 === 0 ? 0 : 1)}M`
  if (abs >= 1_000) return `${sign}${(abs / 1_000).toFixed(abs % 1_000 === 0 ? 0 : 1)}k`
  return `${sign}${Math.round(abs)}`
}
