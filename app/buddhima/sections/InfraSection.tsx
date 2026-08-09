'use client'

import { useMemo, useState } from 'react'
import type { Infra, Project } from '@/lib/db'
import {
  CurrencySelect,
  Field,
  GhostButton,
  RowActions,
  StatusPill,
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
  kind: 'domain' as 'domain' | 'hosting',
  name: '',
  provider: '',
  project_id: '',
  cost: '',
  currency: 'USD',
  renews_on: '',
  status: 'active',
  notes: '',
}

export default function InfraSection({
  infra,
  projects,
  reload,
}: {
  infra: Infra[]
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
      const url = editId ? `/api/buddhima/infra/${editId}` : '/api/buddhima/infra'
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

  function edit(it: Infra) {
    setEditId(it.id)
    setForm({
      kind: it.kind,
      name: it.name,
      provider: it.provider ?? '',
      project_id: it.project_id != null ? String(it.project_id) : '',
      cost: it.cost != null ? String(it.cost) : '',
      currency: it.currency,
      renews_on: it.renews_on?.slice(0, 10) ?? '',
      status: it.status,
      notes: it.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(id: number) {
    if (!confirm('Delete this record?')) return
    try {
      await apiSend(`/api/buddhima/infra/${id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit domain / hosting' : 'Add domain / hosting'}</h2>
        <div style={formGrid}>
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as 'domain' | 'hosting' })}
              style={input}
            >
              <option value="domain">Domain</option>
              <option value="hosting">Hosting</option>
            </select>
          </Field>
          <Field label={form.kind === 'domain' ? 'Domain name' : 'Hosting label'}>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              style={input}
              placeholder={form.kind === 'domain' ? 'example.com' : 'Vercel Pro'}
            />
          </Field>
          <Field label="Provider">
            <input
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              style={input}
              placeholder="Namecheap, Vercel…"
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
          <Field label="Cost / renewal">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.cost}
              onChange={(e) => setForm({ ...form, cost: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Currency">
            <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          </Field>
          <Field label="Renews / expires on">
            <input
              type="date"
              value={form.renews_on}
              onChange={(e) => setForm({ ...form, renews_on: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Notes" full>
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} style={input} />
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
        <h2 style={sectionTitle}>Domains &amp; hosting ({infra.length})</h2>
        {infra.length === 0 ? (
          <p style={muted}>None yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Type', 'Name', 'Provider', 'Project', 'Cost', 'Renews', 'Status', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {infra.map((it) => (
                  <tr key={it.id}>
                    <td style={{ ...td, textTransform: 'capitalize' }}>{it.kind}</td>
                    <td style={{ ...td, color: 'var(--heading)' }}>{it.name}</td>
                    <td style={td}>{it.provider ?? '—'}</td>
                    <td style={td}>{it.project_id != null ? projName.get(it.project_id) ?? '—' : '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {it.cost != null ? money(it.cost, it.currency) : '—'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{it.renews_on?.slice(0, 10) ?? '—'}</td>
                    <td style={td}>
                      <StatusPill status={it.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <RowActions onEdit={() => edit(it)} onDelete={() => del(it.id)} />
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
