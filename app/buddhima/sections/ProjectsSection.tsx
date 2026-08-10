'use client'

import { useState } from 'react'
import type { Project } from '@/lib/db'
import {
  CurrencySelect,
  Field,
  GhostButton,
  RowActions,
  StatusPill,
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

const empty = { name: '', client: '', status: 'active', budget: '', currency: 'USD', notes: '' }

export default function ProjectsSection({
  projects,
  reload,
}: {
  projects: Project[]
  reload: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/buddhima/projects/${editId}` : '/api/buddhima/projects'
      await apiSend(url, editId ? 'PATCH' : 'POST', form)
      setForm({ ...empty })
      setEditId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function edit(p: Project) {
    setEditId(p.id)
    setForm({
      name: p.name,
      client: p.client ?? '',
      status: p.status,
      budget: p.budget != null ? String(p.budget) : '',
      currency: p.currency ?? 'USD',
      notes: p.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(id: number) {
    if (!confirm('Delete this project? Linked records will be kept but unlinked.')) return
    try {
      await apiSend(`/api/buddhima/projects/${id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit project' : 'Add project'}</h2>
        <div style={wideFormGrid}>
          <Field label="Name" full>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
          </Field>
          <Field label="Client" full>
            <input value={form.client} onChange={(e) => setForm({ ...form, client: e.target.value })} style={input} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="active">Active</option>
              <option value="on-hold">On hold</option>
              <option value="completed">Completed</option>
            </select>
          </Field>
          <Field label="Budget">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.budget}
              onChange={(e) => setForm({ ...form, budget: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Currency">
            <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
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
        <h2 style={sectionTitle}>Projects ({projects.length})</h2>
        {projects.length === 0 ? (
          <p style={muted}>None yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Project', 'Client', 'Status', 'Budget', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id}>
                    <td style={td}>
                      <div style={{ color: 'var(--heading)' }}>{p.name}</div>
                      {p.notes && <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{p.notes}</div>}
                    </td>
                    <td style={td}>{p.client ?? '—'}</td>
                    <td style={td}>
                      <StatusPill status={p.status} />
                    </td>
                    <td style={td}>{p.budget != null ? money(p.budget, p.currency) : '—'}</td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <RowActions onEdit={() => edit(p)} onDelete={() => del(p.id)} />
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
