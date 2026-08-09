'use client'

import { useState } from 'react'
import type { TeamMember } from '@/lib/db'
import {
  Field,
  GhostButton,
  RowActions,
  StatusPill,
  SubtleButton,
  TableWrap,
  errorBox,
  formGrid,
  input,
  muted,
  panel,
  sectionTitle,
  table,
  td,
  th,
} from '../ui'
import { apiSend } from '../api'

const empty = { name: '', role: '', email: '', phone: '', status: 'active', notes: '' }

export default function TeamSection({
  team,
  reload,
}: {
  team: TeamMember[]
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
      const url = editId ? `/api/buddhima/team/${editId}` : '/api/buddhima/team'
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

  function edit(m: TeamMember) {
    setEditId(m.id)
    setForm({
      name: m.name,
      role: m.role ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      status: m.status,
      notes: m.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(id: number) {
    if (!confirm('Remove this team member? Their salary records will be kept but unlinked.')) return
    try {
      await apiSend(`/api/buddhima/team/${id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit team member' : 'Add team member'}</h2>
        <div style={formGrid}>
          <Field label="Name">
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={input} />
          </Field>
          <Field label="Role">
            <input
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              style={input}
              placeholder="Developer, Designer…"
            />
          </Field>
          <Field label="Email">
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={input} />
          </Field>
          <Field label="Phone">
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={input} />
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
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
        <h2 style={sectionTitle}>Team ({team.length})</h2>
        {team.length === 0 ? (
          <p style={muted}>No team members yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Contact', 'Status', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {team.map((m) => (
                  <tr key={m.id}>
                    <td style={{ ...td, color: 'var(--heading)' }}>{m.name}</td>
                    <td style={td}>{m.role ?? '—'}</td>
                    <td style={td}>
                      <div>{m.email ?? '—'}</div>
                      {m.phone && <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>{m.phone}</div>}
                    </td>
                    <td style={td}>
                      <StatusPill status={m.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <RowActions onEdit={() => edit(m)} onDelete={() => del(m.id)} />
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
