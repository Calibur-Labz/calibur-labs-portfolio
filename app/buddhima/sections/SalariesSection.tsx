'use client'

import { useMemo, useState } from 'react'
import type { Project, Salary, TeamMember } from '@/lib/db'
import {
  CurrencySelect,
  Field,
  GhostButton,
  RowActions,
  SubtleButton,
  TableWrap,
  errorBox,
  input,
  money,
  muted,
  panel,
  sectionTitle,
  table,
  td,
  th,
  wideFormGrid,
} from '../ui'
import { apiSend } from '../api'

const empty = {
  member_id: '',
  project_id: '',
  amount: '',
  currency: 'USD',
  paid_on: '',
  note: '',
}

export default function SalariesSection({
  salaries,
  team,
  projects,
  reload,
}: {
  salaries: Salary[]
  team: TeamMember[]
  projects: Project[]
  reload: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const memberName = useMemo(() => new Map(team.map((m) => [m.id, m.name])), [team])
  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/buddhima/salaries/${editId}` : '/api/buddhima/salaries'
      await apiSend(url, editId ? 'PATCH' : 'POST', {
        ...form,
        member_id: form.member_id === '' ? null : Number(form.member_id),
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

  function edit(s: Salary) {
    setEditId(s.id)
    setForm({
      member_id: s.member_id != null ? String(s.member_id) : '',
      project_id: s.project_id != null ? String(s.project_id) : '',
      amount: String(s.amount),
      currency: s.currency,
      paid_on: s.paid_on?.slice(0, 10) ?? '',
      note: s.note ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(id: number) {
    if (!confirm('Delete this salary record?')) return
    try {
      await apiSend(`/api/buddhima/salaries/${id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit salary payment' : 'Record salary payment'}</h2>
        {team.length === 0 && (
          <p style={{ ...muted, marginBottom: '14px' }}>
            Tip: add people in the Team section first so you can attribute payments to them.
          </p>
        )}
        <div style={wideFormGrid}>
          <Field label="Team member">
            <select
              value={form.member_id}
              onChange={(e) => setForm({ ...form, member_id: e.target.value })}
              style={input}
            >
              <option value="">— Unassigned —</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
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
          <Field label="Paid on">
            <input
              type="date"
              value={form.paid_on}
              onChange={(e) => setForm({ ...form, paid_on: e.target.value })}
              style={input}
            />
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
        <h2 style={sectionTitle}>Salary payments ({salaries.length})</h2>
        {salaries.length === 0 ? (
          <p style={muted}>None recorded yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Date', 'Member', 'Project', 'Amount', 'Note', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salaries.map((s) => (
                  <tr key={s.id}>
                    <td style={td}>{s.paid_on?.slice(0, 10)}</td>
                    <td style={{ ...td, color: 'var(--heading)' }}>
                      {s.member_id != null ? memberName.get(s.member_id) ?? '—' : '—'}
                    </td>
                    <td style={td}>{s.project_id != null ? projName.get(s.project_id) ?? '—' : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{money(s.amount, s.currency)}</td>
                    <td style={td}>{s.note ?? '—'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <RowActions onEdit={() => edit(s)} onDelete={() => del(s.id)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </section>
  )
}
