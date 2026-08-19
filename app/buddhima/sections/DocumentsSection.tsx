'use client'

import { useMemo, useRef, useState } from 'react'
import { upload } from '@vercel/blob/client'
import type { Document, Project } from '@/lib/db'
import {
  DOCUMENT_KINDS,
  DOCUMENT_KIND_LABELS,
  DOCUMENT_STATUSES,
  documentPathname,
  type DocumentKind,
} from '@/lib/documents'
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

/** Anything larger is uploaded in parallel parts and can resume failed ones. */
const MULTIPART_THRESHOLD = 8 * 1024 * 1024

const empty = {
  title: '',
  kind: 'quotation' as DocumentKind,
  project_id: '',
  client: '',
  amount: '',
  currency: 'USD',
  issued_on: '',
  status: 'active',
  notes: '',
}

function fileSize(input: number | null): string {
  if (input == null) return '—'
  const bytes = Number(input)
  if (!Number.isFinite(bytes)) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function DocumentsSection({
  documents,
  projects,
  reload,
}: {
  documents: Document[]
  projects: Project[]
  reload: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...empty })
  const [file, setFile] = useState<File | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | DocumentKind>('all')
  const [query, setQuery] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const projName = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    return documents.filter((d) => {
      if (filter !== 'all' && d.kind !== filter) return false
      if (!q) return true
      return (
        d.title.toLowerCase().includes(q) ||
        (d.client ?? '').toLowerCase().includes(q) ||
        d.file_name.toLowerCase().includes(q)
      )
    })
  }, [documents, filter, query])

  function reset() {
    setForm({ ...empty })
    setFile(null)
    setEditId(null)
    setProgress(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!editId && !file) {
      setError('Choose a file to upload.')
      return
    }
    setSaving(true)
    setError(null)

    try {
      // The file goes straight from the browser to Blob storage; only the
      // metadata (plus where the file landed) is posted to our API.
      let uploaded: Record<string, unknown> = {}
      if (file) {
        setProgress(0)
        const blob = await upload(documentPathname(form.kind, file.name), file, {
          access: 'private',
          handleUploadUrl: '/api/buddhima/documents/upload',
          multipart: file.size > MULTIPART_THRESHOLD,
          onUploadProgress: ({ percentage }) => setProgress(Math.round(percentage)),
        })
        uploaded = {
          file_name: file.name,
          file_pathname: blob.pathname,
          file_url: blob.url,
          file_size: file.size,
          file_type: file.type || null,
        }
      }

      const url = editId ? `/api/buddhima/documents/${editId}` : '/api/buddhima/documents'
      await apiSend(url, editId ? 'PATCH' : 'POST', {
        ...form,
        project_id: form.project_id === '' ? null : Number(form.project_id),
        ...uploaded,
      })
      reset()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setSaving(false)
      setProgress(null)
    }
  }

  function edit(d: Document) {
    setEditId(d.id)
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
    setForm({
      title: d.title,
      kind: d.kind,
      project_id: d.project_id != null ? String(d.project_id) : '',
      client: d.client ?? '',
      amount: d.amount != null ? String(d.amount) : '',
      currency: d.currency,
      issued_on: d.issued_on?.slice(0, 10) ?? '',
      status: d.status,
      notes: d.notes ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function del(d: Document) {
    if (!confirm(`Delete “${d.title}”? The file is removed from storage too.`)) return
    try {
      await apiSend(`/api/buddhima/documents/${d.id}`, 'DELETE')
      if (editId === d.id) reset()
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit document' : 'Upload document'}</h2>
        <div style={wideFormGrid}>
          <Field label={editId ? 'Replace file (optional)' : 'File'} full>
            <input
              ref={fileInputRef}
              type="file"
              onChange={(e) => {
                const picked = e.target.files?.[0] ?? null
                setFile(picked)
                // First upload with an empty title? Borrow the file's name.
                if (picked && !form.title.trim()) {
                  setForm((f) => ({ ...f, title: picked.name.replace(/\.[^.]+$/, '') }))
                }
              }}
              style={{ ...input, padding: '9px 12px' }}
              accept=".pdf,.doc,.docx,.xls,.xlsx,.odt,.ods,.rtf,.txt,.csv,.png,.jpg,.jpeg,.webp,.zip"
            />
          </Field>
          <Field label="Title">
            <input
              required
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={input}
              placeholder="Quotation template v2"
            />
          </Field>
          <Field label="Type">
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value as DocumentKind })}
              style={input}
            >
              {DOCUMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {DOCUMENT_KIND_LABELS[k]}
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
          <Field label="Client">
            <input
              value={form.client}
              onChange={(e) => setForm({ ...form, client: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Amount">
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              style={input}
              placeholder="Quotes & invoices only"
            />
          </Field>
          <Field label="Currency">
            <CurrencySelect value={form.currency} onChange={(v) => setForm({ ...form, currency: v })} />
          </Field>
          <Field label="Issued on">
            <input
              type="date"
              value={form.issued_on}
              onChange={(e) => setForm({ ...form, issued_on: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Status">
            <select
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              style={input}
            >
              {DOCUMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s[0].toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" full>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              style={input}
            />
          </Field>
        </div>

        {progress !== null && (
          <div style={{ marginTop: '16px' }}>
            <div
              style={{
                height: '6px',
                borderRadius: '999px',
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progress}%`,
                  height: '100%',
                  background: 'var(--accent)',
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
            <p style={{ ...muted, fontSize: '12px', margin: '6px 0 0' }}>Uploading… {progress}%</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '16px', flexWrap: 'wrap' }}>
          <GhostButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Upload'}
          </GhostButton>
          {editId && <SubtleButton onClick={reset}>Cancel</SubtleButton>}
          <span style={{ ...muted, fontSize: '12px', alignSelf: 'center' }}>
            PDF, Word, Excel, images or zip · up to 25 MB
          </span>
        </div>
      </form>

      <div style={panel}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            marginBottom: '16px',
          }}
        >
          <h2 style={{ ...sectionTitle, margin: 0 }}>Documents ({visible.length})</h2>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search title, client, file…"
            style={{ ...input, width: 'auto', minWidth: '220px' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
          {(['all', ...DOCUMENT_KINDS] as const).map((k) => {
            const on = filter === k
            const count = k === 'all' ? documents.length : documents.filter((d) => d.kind === k).length
            return (
              <button
                key={k}
                onClick={() => setFilter(k)}
                style={{
                  padding: '6px 14px',
                  borderRadius: '999px',
                  fontSize: '13px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                  background: on ? 'rgba(0,183,255,0.10)' : 'transparent',
                  border: `1px solid ${on ? 'rgba(0,183,255,0.35)' : 'var(--hairline)'}`,
                  color: on ? 'var(--accent)' : 'var(--muted-text)',
                }}
              >
                {k === 'all' ? 'All' : `${DOCUMENT_KIND_LABELS[k]}s`} ({count})
              </button>
            )
          })}
        </div>

        {visible.length === 0 ? (
          <p style={muted}>
            {documents.length === 0
              ? 'Nothing filed yet. Upload a quotation or invoice template to start.'
              : 'No documents match this filter.'}
          </p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Document', 'Type', 'Project', 'Client', 'Amount', 'Issued', 'Status', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d.id}>
                    <td style={td}>
                      <a
                        href={`/api/buddhima/documents/${d.id}/file`}
                        style={{ color: 'var(--heading)', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {d.title}
                      </a>
                      <div style={{ fontSize: '12px', color: 'var(--muted-text)', marginTop: '3px' }}>
                        {d.file_name} · {fileSize(d.file_size)}
                      </div>
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>{DOCUMENT_KIND_LABELS[d.kind]}</td>
                    <td style={td}>{d.project_id != null ? projName.get(d.project_id) ?? '—' : '—'}</td>
                    <td style={td}>{d.client ?? '—'}</td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {d.amount != null ? money(d.amount, d.currency) : '—'}
                    </td>
                    <td style={{ ...td, whiteSpace: 'nowrap' }}>
                      {d.issued_on?.slice(0, 10) ?? d.created_at.slice(0, 10)}
                    </td>
                    <td style={td}>
                      <StatusPill status={d.status} />
                    </td>
                    <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <span style={{ display: 'inline-flex', gap: '10px', alignItems: 'center' }}>
                        <a
                          href={`/api/buddhima/documents/${d.id}/file`}
                          style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}
                        >
                          Download
                        </a>
                        <a
                          href={`/api/buddhima/documents/${d.id}/file?inline=1`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none' }}
                        >
                          View
                        </a>
                        <RowActions onEdit={() => edit(d)} onDelete={() => del(d)} />
                      </span>
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
