'use client'

import { Fragment, useState } from 'react'
import type { OrbiSite } from '@/lib/orbi/orbiSites'
import {
  Field,
  GhostButton,
  StatusPill,
  SubtleButton,
  TableWrap,
  errorBox,
  input,
  muted,
  panel,
  sectionTitle,
  table,
  td,
  th,
  wideFormGrid,
} from '../ui'
import { apiSend } from '../api'

/** A site as the API returns it: the record plus its ready-made snippet. */
export type OrbiSiteRow = OrbiSite & { embed_code: string }

const PLANS = [
  { value: 'core', label: 'Core' },
  { value: 'guide', label: 'Guide' },
  { value: 'intelligence', label: 'Intelligence' },
]

const SECTIONS_EXAMPLE = `{
  "about": {"label": "About Us", "selector": "#about"},
  "services": {"label": "Services", "selector": "#services"},
  "work": {"label": "Projects", "selector": "#projects"},
  "contact": {"label": "Contact", "selector": "#contact"}
}`

const empty = {
  customer_name: '',
  allowed_origins: '',
  plan: 'core',
  status: 'active',
  expires_on: '',
  sections_config: '',
}

const mini: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: '13px',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
}

const code: React.CSSProperties = {
  margin: 0,
  padding: '14px',
  borderRadius: '10px',
  background: 'var(--background)',
  border: '1px solid var(--hairline)',
  fontSize: '12px',
  lineHeight: 1.5,
  whiteSpace: 'pre-wrap',
  wordBreak: 'break-all',
  color: 'var(--heading)',
}

/**
 * ORBI Sites — who may embed ORBI, and where.
 *
 * Every rule (origins, plans, sections) is enforced by the API; this form only
 * collects the input and shows what the server said.
 */
export default function OrbiSitesSection({
  sites,
  reload,
}: {
  sites: OrbiSiteRow[]
  reload: () => Promise<void>
}) {
  const [form, setForm] = useState({ ...empty })
  const [editId, setEditId] = useState<number | null>(null)
  const [openId, setOpenId] = useState<number | null>(null)
  const [copiedId, setCopiedId] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const url = editId ? `/api/buddhima/orbi-sites/${editId}` : '/api/buddhima/orbi-sites'
      const { site } = await apiSend<{ site: OrbiSiteRow }>(url, editId ? 'PATCH' : 'POST', form)
      setForm({ ...empty })
      setEditId(null)
      setOpenId(site.id)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  function edit(site: OrbiSiteRow) {
    setEditId(site.id)
    setForm({
      customer_name: site.customer_name,
      allowed_origins: site.allowed_origins.join('\n'),
      plan: site.plan,
      status: site.status,
      expires_on: site.expires_on ?? '',
      sections_config: site.sections_config
        ? JSON.stringify(JSON.parse(site.sections_config), null, 2)
        : '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function setStatus(site: OrbiSiteRow, status: 'active' | 'disabled') {
    setError(null)
    try {
      await apiSend(`/api/buddhima/orbi-sites/${site.id}`, 'PATCH', { status })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  async function del(site: OrbiSiteRow) {
    if (!confirm(`Delete ${site.customer_name}? Their embed stops working on its next page load.`)) return
    try {
      await apiSend(`/api/buddhima/orbi-sites/${site.id}`, 'DELETE')
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function copy(site: OrbiSiteRow) {
    try {
      await navigator.clipboard.writeText(site.embed_code)
      setCopiedId(site.id)
      setTimeout(() => setCopiedId((id) => (id === site.id ? null : id)), 1800)
    } catch {
      setOpenId(site.id)
      setError('Clipboard unavailable — select the code below and copy it.')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      <form onSubmit={submit} style={panel}>
        <h2 style={sectionTitle}>{editId ? 'Edit customer' : 'Add customer'}</h2>
        <div style={wideFormGrid}>
          <Field label="Customer name">
            <input
              required
              value={form.customer_name}
              onChange={(e) => setForm({ ...form, customer_name: e.target.value })}
              style={input}
              placeholder="ABC Company"
            />
          </Field>
          <Field label="Plan">
            <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} style={input}>
              {PLANS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={input}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
          <Field label="Expires on (optional)">
            <input
              type="date"
              value={form.expires_on}
              onChange={(e) => setForm({ ...form, expires_on: e.target.value })}
              style={input}
            />
          </Field>
          <Field label="Allowed domains — one origin per line, exactly as the site is served" full>
            <textarea
              required
              rows={3}
              value={form.allowed_origins}
              onChange={(e) => setForm({ ...form, allowed_origins: e.target.value })}
              style={{ ...input, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
              placeholder={'https://abccompany.com\nhttps://www.abccompany.com'}
            />
          </Field>
          <Field label="Sections (optional JSON — keys: services, work, testimonials, about, contact)" full>
            <textarea
              rows={6}
              value={form.sections_config}
              onChange={(e) => setForm({ ...form, sections_config: e.target.value })}
              style={{ ...input, fontFamily: 'ui-monospace, monospace', resize: 'vertical' }}
              placeholder={SECTIONS_EXAMPLE}
            />
          </Field>
        </div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          <GhostButton type="submit" disabled={saving}>
            {saving ? 'Saving…' : editId ? 'Update' : 'Add customer'}
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
        <h2 style={sectionTitle}>Customers / Sites ({sites.length})</h2>
        {sites.length === 0 ? (
          <p style={muted}>No customers yet.</p>
        ) : (
          <TableWrap>
            <table style={table}>
              <thead>
                <tr>
                  {['Customer', 'Site ID', 'Domains', 'Plan', 'Status', 'Created', 'Expires', ''].map((h) => (
                    <th key={h} style={th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sites.map((site) => (
                  <Fragment key={site.id}>
                    <tr>
                      <td style={{ ...td, color: 'var(--heading)' }}>{site.customer_name}</td>
                      <td style={{ ...td, fontFamily: 'ui-monospace, monospace', fontSize: '12px' }}>
                        {site.site_id}
                      </td>
                      <td style={{ ...td, fontSize: '13px' }}>
                        {site.allowed_origins.map((o) => (
                          <div key={o}>{o}</div>
                        ))}
                      </td>
                      <td style={{ ...td, textTransform: 'capitalize' }}>{site.plan}</td>
                      <td style={td}>
                        <StatusPill status={site.status === 'disabled' ? 'inactive' : 'active'} />
                      </td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{String(site.created_at).slice(0, 10)}</td>
                      <td style={{ ...td, whiteSpace: 'nowrap' }}>{site.expires_on ?? '—'}</td>
                      <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <span style={{ display: 'inline-flex', gap: '10px' }}>
                          <button style={mini} onClick={() => setOpenId(openId === site.id ? null : site.id)}>
                            {openId === site.id ? 'Hide' : 'View'}
                          </button>
                          <button style={mini} onClick={() => copy(site)}>
                            {copiedId === site.id ? 'Copied' : 'Copy embed'}
                          </button>
                          <button style={mini} onClick={() => edit(site)}>
                            Edit
                          </button>
                          {site.status === 'active' ? (
                            <button style={mini} onClick={() => setStatus(site, 'disabled')}>
                              Disable
                            </button>
                          ) : (
                            <button style={mini} onClick={() => setStatus(site, 'active')}>
                              Enable
                            </button>
                          )}
                          <button
                            style={{ ...mini, color: 'var(--color-error, #F87171)' }}
                            onClick={() => del(site)}
                          >
                            Delete
                          </button>
                        </span>
                      </td>
                    </tr>
                    {openId === site.id && (
                      <tr>
                        <td colSpan={8} style={td}>
                          <div style={{ display: 'grid', gap: '10px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
                              Installation code — paste before &lt;/body&gt; on {site.allowed_origins.join(', ')}
                            </span>
                            <pre style={code}>{site.embed_code}</pre>
                            <div>
                              <GhostButton onClick={() => copy(site)}>
                                {copiedId === site.id ? 'Copied' : 'Copy Embed Code'}
                              </GhostButton>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </div>
    </section>
  )
}
