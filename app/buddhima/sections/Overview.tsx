'use client'

import { useMemo, useState } from 'react'
import type { Salary, Transaction } from '@/lib/db'
import { CURRENCIES, type Currency } from '@/lib/currency'
import { money, muted, panel, sectionTitle } from '../ui'
import { LineChart, CHART } from '../Charts'

function monthLabel(key: string): string {
  // key is 'YYYY-MM'
  const [y, m] = key.split('-')
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${names[Number(m) - 1] ?? m} '${y.slice(2)}`
}

export default function Overview({
  transactions,
  salaries,
}: {
  transactions: Transaction[]
  salaries: Salary[]
}) {
  // Which currencies actually appear in the data?
  const available = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((t) => set.add(t.currency))
    salaries.forEach((s) => set.add(s.currency))
    const ordered = CURRENCIES.filter((c) => set.has(c))
    return ordered.length ? ordered : (['USD'] as Currency[])
  }, [transactions, salaries])

  const [currency, setCurrency] = useState<string>(available[0])
  // Keep selection valid if data changes.
  const cur = available.includes(currency as Currency) ? currency : available[0]

  const txn = useMemo(() => transactions.filter((t) => t.currency === cur), [transactions, cur])
  const sal = useMemo(() => salaries.filter((s) => s.currency === cur), [salaries, cur])

  const totals = useMemo(() => {
    let income = 0
    let expense = 0
    for (const t of txn) {
      if (t.kind === 'income') income += Number(t.amount)
      else expense += Number(t.amount)
    }
    const salaryTotal = sal.reduce((sum, s) => sum + Number(s.amount), 0)
    return { income, expense, net: income - expense, salaryTotal }
  }, [txn, sal])

  const monthly = useMemo(() => {
    const map = new Map<string, { income: number; expense: number }>()
    for (const t of txn) {
      const key = t.occurred_on?.slice(0, 7)
      if (!key) continue
      const row = map.get(key) ?? { income: 0, expense: 0 }
      if (t.kind === 'income') row.income += Number(t.amount)
      else row.expense += Number(t.amount)
      map.set(key, row)
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-8)
      .map(([key, v]) => ({ label: monthLabel(key), income: v.income, expense: v.expense }))
  }, [txn])

  const recent = useMemo(() => transactions.slice(0, 6), [transactions])

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {/* currency toggle */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <p style={muted}>Financial snapshot in {cur}.</p>
        {available.length > 1 && (
          <div style={{ display: 'inline-flex', gap: '4px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px' }}>
            {available.map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  background: c === cur ? 'rgba(0,183,255,0.15)' : 'transparent',
                  color: c === cur ? 'var(--accent)' : 'var(--muted-text)',
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* stat tiles */}
      <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
        <StatTile label="Net" value={money(totals.net, cur)} accent={totals.net >= 0 ? 'var(--color-success, #34D399)' : 'var(--color-error, #F87171)'} />
        <StatTile label="Income" value={money(totals.income, cur)} accent="var(--color-success, #34D399)" />
        <StatTile label="Expenses" value={money(totals.expense, cur)} accent="var(--color-error, #F87171)" />
        <StatTile label="Salaries paid" value={money(totals.salaryTotal, cur)} accent="var(--accent)" />
      </div>

      {/* charts */}
      <div style={{ display: 'grid', gap: '20px', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <div style={panel}>
          <h2 style={sectionTitle}>Income vs expense by month</h2>
          <LineChart
            data={monthly.map((m) => ({ label: m.label, values: [m.income, m.expense] }))}
            series={[
              { label: 'Income', color: CHART.income },
              { label: 'Expense', color: CHART.expense },
            ]}
          />
        </div>
        <div style={panel}>
          <h2 style={sectionTitle}>Net cashflow by month</h2>
          <LineChart
            data={monthly.map((m) => ({ label: m.label, values: [m.income - m.expense] }))}
            series={[{ label: 'Net', color: CHART.accent }]}
          />
        </div>
      </div>

      {/* recent */}
      <div style={panel}>
        <h2 style={sectionTitle}>Recent activity</h2>
        {recent.length === 0 ? (
          <p style={muted}>Nothing recorded yet.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recent.map((t) => {
              const income = t.kind === 'income'
              return (
                <div
                  key={t.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '10px 0',
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    fontSize: '14px',
                  }}
                >
                  <span style={{ color: 'var(--muted-text)' }}>
                    {t.occurred_on?.slice(0, 10)} · {t.category ?? (income ? 'Income' : 'Expense')}
                  </span>
                  <span style={{ color: income ? 'var(--color-success, #34D399)' : 'var(--color-error, #F87171)', whiteSpace: 'nowrap' }}>
                    {income ? '+' : '−'}
                    {money(t.amount, t.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}

function StatTile({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={panel}>
      <div style={{ fontSize: '12px', color: 'var(--muted-text)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        {label}
      </div>
      <div style={{ fontSize: '26px', fontWeight: 700, marginTop: '8px', color: accent }}>{value}</div>
    </div>
  )
}
