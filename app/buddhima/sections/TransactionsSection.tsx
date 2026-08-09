'use client'

import { useMemo, useState } from 'react'
import type { Project, Transaction } from '@/lib/db'
import {
  CurrencySelect,
  Field,
  GhostButton,
  RowActions,
  SubtleButton,
  TableWrap,
  errorBox,
  formGrid,
  input,
  money,
  muted,
  panel,
  sectionTitle,
  table,
  td,
  th,
} from '../ui'
import { apiSend } from '../api'

const empty = {
  kind: 'income' as 'income' | 'expense',
  amount: '',
  currency: 'USD',
  category: '',
  note: '',
  project_id: '',
  occurred_on: '',
}

export default function TransactionsSection({
  transactions,
  projects,
  reload,
}: {
  transactions: Transaction[]
  projects: Project[]
  reload: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/buddhima/transactions/${editId}` : '/api/buddhima/transactions'
      await apiSend(url, editId ? 'PATCH' : 'POST', {
        ...form,
        project_id: form.project_id === '' ? null : Number(form.project_id),
      })
      setForm({ ...empty })
      setEditId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function edit(t: Transaction) {
    setEditId(t.id)
    setForm({
      kind: t.kind,
      amount: String(t.amount),
      currency: t.currency,
      category: t.category ?? '',
      note: t.note ?? '',
      project_id: t.project_id != null ? String(t.project_id) : '',
      occurred_on: t.occurred_on?.slice(0, 10) ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(id: number) {
    if (!confirm('Delete this transaction?')) return
    try {
      await apiSend(`/api/buddhima/transactions/${id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit transaction' : 'Add transaction'}</h2>
        <div style={formGrid}>
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'income' | 'expense' })}
              style={input}
            >
              <option value="income">Income</option>
              <option value="expense">Expense</option>
            </select>
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Currency">
            <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          </Field>
          <Field label="Date">
            <input
              type="date"
              value={form.occurred_on}
              onChange={(e) => setForm({ ...form, occurred_on: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Category">
            <input
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              style={input}
              placeholder="e.g. Design, Hosting"
            />
          </Field>
          <Field label="Project">
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              style={input}
            >
              <option value="">— None —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Note" full>
            <input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={input} />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <GhostButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Add'}
          </GhostButton>
          {editId && (
            <SubtleButton
              onClick={() => {
                setEditId(null)
                setForm({ ...empty })
              }}
            >
              Cancel
            </SubtleButton>
          )}
        </div>
      </form>

      <div style={panel}>
        <h2 style={sectionTitle}>All transactions ({transactions.length})</h2>
        {transactions.length === 0 ? (
          <p style={muted}>None yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Date', 'Type', 'Amount', 'Category', 'Project', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const income = t.kind === 'income'
                  return (
                    <tr key={t.id}>
                      <td style={td}>{t.occurred_on?.slice(0, 10)}</td>
                      <td style={td}>
                        <span
                          style={{
                            fontSize: '12px',
                            color: income ? 'var(--color-success, #34D399)' : 'var(--color-error, #F87171)',
                          }}
                        >
                          {income ? 'Income' : 'Expense'}
                        </span>
                      </td>
                      <td style={{ ...td, color: 'var(--heading)', whiteSpace: 'nowrap' }}>
                        {income ? '+' : '−'}
                        {money(t.amount, t.currency)}
                      </td>
                      <td style={td}>{t.category ?? '—'}</td>
                      <td style={td}>{t.project_id != null ? projName.get(t.project_id) ?? '—' : '—'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <RowActions onEdit={() => edit(t)} onDelete={() => del(t.id)} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </section>
  )
}
