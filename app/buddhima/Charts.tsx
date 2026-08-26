'use client'

import { useId, useState } from 'react'

export const CHART = {
  income: 'var(--color-success, #34D399)',
  expense: 'var(--color-error, #F87171)',
  accent: 'var(--accent, #00B7FF)',
}
const GRID = 'rgba(255,255,255,0.07)'
const AXIS = 'var(--muted-text, #6E8399)'

/**
 * A smooth path through the points that never invents a value.
 *
 * Monotone cubic interpolation (Fritsch–Carlson), not the Catmull-Rom spline
 * most "curved chart" snippets reach for. The difference matters here: a plain
 * spline overshoots around a peak, so two months of £4k income either side of
 * an £8k month draw a curve that bulges to £9k, and a net-cashflow line
 * between two positive months can dip below zero. On a finance dashboard a
 * curve that reads as a loss the business never had is not a style choice, it
 * is a wrong number drawn convincingly.
 *
 * This clamps each tangent so every segment stays inside the two values it
 * connects. The result is still soft — it just cannot lie.
 */
function smoothPath(pts: { x: number; y: number }[]): string {
  const n = pts.length
  if (n === 0) return ''
  if (n === 1) return `M ${pts[0].x} ${pts[0].y}`
  if (n === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y}`

  // Secant slope of each segment.
  const dx: number[] = []
  const slope: number[] = []
  for (let i = 0; i < n - 1; i++) {
    const h = pts[i + 1].x - pts[i].x
    dx.push(h)
    slope.push(h === 0 ? 0 : (pts[i + 1].y - pts[i].y) / h)
  }

  // Tangents: average of neighbouring secants, endpoints take their own.
  const m: number[] = new Array(n)
  m[0] = slope[0]
  m[n - 1] = slope[n - 2]
  for (let i = 1; i < n - 1; i++) {
    m[i] = slope[i - 1] * slope[i] <= 0 ? 0 : (slope[i - 1] + slope[i]) / 2
  }

  // Fritsch–Carlson clamp — this is what removes the overshoot.
  for (let i = 0; i < n - 1; i++) {
    if (slope[i] === 0) {
      m[i] = 0
      m[i + 1] = 0
      continue
    }
    const a = m[i] / slope[i]
    const b = m[i + 1] / slope[i]
    const sq = a * a + b * b
    if (sq > 9) {
      const t = 3 / Math.sqrt(sq)
      m[i] = t * a * slope[i]
      m[i + 1] = t * b * slope[i]
    }
  }

  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 0; i < n - 1; i++) {
    const third = dx[i] / 3
    const c1x = pts[i].x + third
    const c1y = pts[i].y + m[i] * third
    const c2x = pts[i + 1].x - third
    const c2y = pts[i + 1].y - m[i + 1] * third
    d += ` C ${c1x.toFixed(2)} ${c1y.toFixed(2)}, ${c2x.toFixed(2)} ${c2y.toFixed(2)}, ${pts[i + 1].x.toFixed(2)} ${pts[i + 1].y.toFixed(2)}`
  }
  return d
}

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
  /*
   * Gradient and filter ids have to be unique per chart. Two `LineChart`s
   * render on the Overview at once, and SVG defs share one document-wide
   * namespace — duplicate ids mean the second chart silently paints with the
   * first one's fill.
   */
  // Stripped to letters and digits: React's generated ids contain characters
  // (`:` in 18, `«»` in 19) that are not valid in an SVG id and would break
  // the `url(#...)` reference that points at the gradient.
  const uid = `c${useId().replace(/[^a-zA-Z0-9]/g, '')}`

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
        {/*
          Fills are drawn from the line down to the zero baseline, not to the
          bottom of the plot. On the net-cashflow chart that is the difference
          between shading "money made" and shading "everything above the axis",
          which for a negative month would be the wrong region entirely.
        */}
        <defs>
          {series.map((s, si) => (
            <linearGradient key={s.label} id={`${uid}-fill-${si}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.28} />
              <stop offset="70%" stopColor={s.color} stopOpacity={0.06} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>

        {/* A guide under the cursor, so the eye can line the point up with its label. */}
        {active !== null && (
          <line
            x1={x(active)}
            y1={padT}
            x2={x(active)}
            y2={padT + plotH}
            stroke={AXIS}
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.45}
          />
        )}

        {/* one curve per series */}
        {series.map((s, si) => {
          const pts = data.map((d, i) => ({ x: x(i), y: y(d.values[si] ?? 0) }))
          const line = smoothPath(pts)
          // The fill closes back along the baseline, so it needs the same
          // curve followed by a return path at zero.
          const baseY = y(Math.min(Math.max(0, min), max))
          const area =
            pts.length > 1
              ? `${line} L ${pts[pts.length - 1].x} ${baseY} L ${pts[0].x} ${baseY} Z`
              : ''
          return (
            <g key={s.label}>
              {area && <path d={area} fill={`url(#${uid}-fill-${si})`} stroke="none" />}
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth={2.5}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {data.map((d, i) => (
                <g key={i}>
                  {/* A halo only under the hovered point, so the row of dots
                      stays quiet until someone is actually looking at one. */}
                  {active === i && (
                    <circle cx={x(i)} cy={y(d.values[si] ?? 0)} r={8} fill={s.color} opacity={0.18} />
                  )}
                  <circle
                    cx={x(i)}
                    cy={y(d.values[si] ?? 0)}
                    r={active === i ? 4.5 : 3}
                    fill={active === i ? 'var(--panel-raised, #121A26)' : s.color}
                    stroke={s.color}
                    strokeWidth={active === i ? 2.5 : 0}
                  />
                </g>
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
