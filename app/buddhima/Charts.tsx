'use client'

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
}: {
  data: { label: string; values: number[] }[]
  series: { label: string; color: string }[]
}) {
  if (data.length === 0) {
    return <Empty>No data for this period yet.</Empty>
  }

  const W = 680
  const H = 260
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

  return (
    <div>
      <Legend items={series} />
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img">
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
          <text key={d.label + i} x={x(i)} y={H - 12} textAnchor="middle" fontSize={10} fill={AXIS}>
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
                <circle key={i} cx={x(i)} cy={y(d.values[si] ?? 0)} r={3} fill={s.color} />
              ))}
            </g>
          )
        })}
      </svg>
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
