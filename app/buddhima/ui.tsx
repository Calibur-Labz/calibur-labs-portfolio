'use client'

import type { ReactNode } from 'react'
import { CURRENCIES } from '@/lib/currency'

export { money } from '@/lib/currency'

/* ── shared style objects ─────────────────────────────── */
export const panel: React.CSSProperties = {
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '16px',
  padding: '20px',
}
export const sectionTitle: React.CSSProperties = { fontSize: '15px', fontWeight: 600, margin: '0 0 16px' }
export const labelKicker: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
  color: 'var(--accent)',
}
export const formGrid: React.CSSProperties = {
  display: 'grid',
  gap: '14px',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
}
export const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid var(--hairline)',
  color: 'var(--heading)',
  fontSize: '14px',
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
  outline: 'none',
}
export const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: '14px' }
export const th: React.CSSProperties = {
  textAlign: 'left',
  fontSize: '11px',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--muted-text)',
  padding: '8px 12px',
  borderBottom: '1px solid var(--hairline)',
  fontWeight: 500,
}
export const td: React.CSSProperties = {
  padding: '12px',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
  color: 'var(--foreground)',
  verticalAlign: 'top',
}
export const errorBox: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--color-error, #F87171)',
  background: 'rgba(248,113,113,0.08)',
  border: '1px solid rgba(248,113,113,0.2)',
  borderRadius: '10px',
  padding: '10px 12px',
  marginBottom: '20px',
}
export const muted: React.CSSProperties = { color: 'var(--muted-text)', fontSize: '14px' }

/* ── buttons — ghost style, no shimmer/shade ──────────── */
const ghostBtnStyle: React.CSSProperties = {
  padding: '10px 20px',
  borderRadius: '12px',
  fontSize: '14px',
  fontWeight: 600,
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
  cursor: 'pointer',
}

export function GhostButton({
  children,
  type = 'button',
  onClick,
  disabled,
  style,
}: {
  children: ReactNode
  type?: 'button' | 'submit'
  onClick?: () => void
  disabled?: boolean
  style?: React.CSSProperties
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="btn-ghost"
      style={{ ...ghostBtnStyle, opacity: disabled ? 0.6 : 1, ...style }}
    >
      {children}
    </button>
  )
}

export function SubtleButton({
  children,
  onClick,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      style={{
        ...ghostBtnStyle,
        background: 'transparent',
        border: '1px solid var(--hairline)',
        color: 'var(--muted-text)',
      }}
    >
      {children}
    </button>
  )
}

/* ── small building blocks ────────────────────────────── */
export function Field({
  label,
  children,
  full,
}: {
  label: string
  children: ReactNode
  full?: boolean
}) {
  return (
    <label
      style={{ display: 'flex', flexDirection: 'column', gap: '6px', gridColumn: full ? '1 / -1' : 'auto' }}
    >
      <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{label}</span>
      {children}
    </label>
  )
}

export function CurrencySelect({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} style={input}>
      {CURRENCIES.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  )
}

export function RowActions({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  const mini: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'var(--accent)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: 0,
    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
  }
  return (
    <span style={{ display: 'inline-flex', gap: '10px' }}>
      <button onClick={onEdit} style={mini} aria-label="Edit">
        Edit
      </button>
      <button onClick={onDelete} style={{ ...mini, color: 'var(--color-error, #F87171)' }} aria-label="Delete">
        Delete
      </button>
    </span>
  )
}

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--accent)',
  'on-hold': 'var(--color-warning, #FBBF24)',
  completed: 'var(--color-success, #34D399)',
  inactive: 'var(--muted-text)',
  expired: 'var(--color-error, #F87171)',
  cancelled: 'var(--muted-text)',
}

export function StatusPill({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'var(--muted-text)'
  return (
    <span
      style={{
        fontSize: '12px',
        color,
        border: `1px solid ${color}`,
        borderRadius: '999px',
        padding: '2px 10px',
        opacity: 0.9,
        whiteSpace: 'nowrap',
      }}
    >
      {status}
    </span>
  )
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div style={{ overflowX: 'auto' }}>{children}</div>
}
