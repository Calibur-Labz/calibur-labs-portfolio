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
import {
  ORBI_EMBED_LIMITS,
  ORBI_EMBED_SECTION_KEYS,
  customSectionKey,
  isCustomSectionKey,
} from '@/components/orbi/orbiEmbedSections'

/** A site as the API returns it: the record plus its ready-made snippet. */
export type OrbiSiteRow = OrbiSite & { embed_code: string }

const PLANS = [
  { value: 'core', label: 'Core' },
  { value: 'guide', label: 'Guide' },
  { value: 'intelligence', label: 'Intelligence' },
]

/**
 * Section names that mean one of ORBI's five built-in sections. A row named
 * like this is saved under the built-in key, so ORBI's answers can still link
 * to it; any other name becomes a `custom-<slug>` menu entry.
 */
const BUILT_IN_NAMES: Record<string, string> = {
  services: 'services',
  service: 'services',
  'our-services': 'services',
  work: 'work',
  projects: 'work',
  project: 'work',
  portfolio: 'work',
  'our-work': 'work',
  testimonials: 'testimonials',
  reviews: 'testimonials',
  about: 'about',
  'about-us': 'about',
  contact: 'contact',
  'contact-us': 'contact',
}
/** How a built-in key reads back in the Section column when editing. */
const BUILT_IN_DISPLAY: Record<string, string> = {
  services: 'Services',
  work: 'Projects',
  testimonials: 'Testimonials',
  about: 'About',
  contact: 'Contact',
}

/** One menu entry; `name` decides the key it is saved under. */
type SectionRow = { name: string; label: string; selector: string }

const BLANK_ROW: SectionRow = { name: '', label: '', selector: '' }
const blankRows = (): SectionRow[] => [{ ...BLANK_ROW }, { ...BLANK_ROW }]
const isBlank = (r: SectionRow) => !r.name.trim() && !r.label.trim() && !r.selector.trim()

function keyForName(name: string): string {
  const custom = customSectionKey(name)
  return BUILT_IN_NAMES[custom.slice('custom-'.length)] ?? custom
}

/** Stored JSON → rows, always at least two. */
function rowsFromConfig(config: string | null): SectionRow[] {
  const rows: SectionRow[] = []
  if (config) {
    try {
      const parsed = JSON.parse(config) as Record<string, { label?: string; selector?: string }>
      for (const [k, v] of Object.entries(parsed)) {
        let name = BUILT_IN_DISPLAY[k]
        if (!name && isCustomSectionKey(k)) {
          const words = k.slice('custom-'.length).replace(/-/g, ' ')
          name = words.charAt(0).toUpperCase() + words.slice(1)
        }
        if (name) rows.push({ name, label: v.label ?? '', selector: v.selector ?? '' })
      }
    } catch {
      /* unreadable config — start blank */
    }
  }
  while (rows.length < 2) rows.push({ ...BLANK_ROW })
  return rows
}

/** Filled rows → the JSON the API expects ('' when every row is blank). */
function configFromRows(rows: SectionRow[]): string {
  const picked: Record<string, { label: string; selector: string }> = {}
  for (const r of rows) {
    if (isBlank(r)) continue
    const key = keyForName(r.name)
    if (!key) throw new Error(`Section name "${r.name}" needs at least one letter or number`)
    if (picked[key]) throw new Error(`Two rows are both the "${r.name.trim()}" section — give each a different name`)
    picked[key] = { label: r.label, selector: r.selector }
  }
  return Object.keys(picked).length ? JSON.stringify(picked) : ''
}

const empty = {
  customer_name: '',
  allowed_origins: '',
  plan: 'core',
  status: 'active',
  expires_on: '',
  knowledge: '',
  ask_intro: '',
  ask_starters: '',
}

const KNOWLEDGE_EXAMPLE = `What the business does, in plain sentences:
- Products / services and what they include
- Prices exactly as published (ORBI only quotes figures written here)
- Opening hours, locations, delivery areas
- How to contact them
- Common questions and their answers`

const mini: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--accent)',
  fontSize: '13px',
  cursor: 'pointer',
  padding: 0,
  fontFamily: 'var(--font-poppins), system-ui, sans-serif',
}

const sectionGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'minmax(150px, 1fr) minmax(140px, 1.3fr) minmax(140px, 1.3fr)',
  gap: '12px',
  alignItems: 'center',
  padding: '10px 14px',
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
  const [sectionRows, setSectionRows] = useState<SectionRow[]>(blankRows)
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
      const { site } = await apiSend<{ site: OrbiSiteRow }>(url, editId ? 'PATCH' : 'POST', {
        ...form,
        sections_config: configFromRows(sectionRows),
      })
      setForm({ ...empty })
      setSectionRows(blankRows())
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
      knowledge: site.knowledge ?? '',
      ask_intro: site.ask_intro ?? '',
      ask_starters: site.ask_starters ?? '',
    })
    setSectionRows(rowsFromConfig(site.sections_config))
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
    <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: '20px' }}>
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
          <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted-text)' }}>
              Menu sections (optional) — leave rows blank to skip
            </span>
            <div style={{ border: '1px solid var(--hairline)', borderRadius: '10px', overflow: 'hidden' }}>
              <div style={{ ...sectionGrid, fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--muted-text)', borderBottom: '1px solid var(--hairline)' }}>
                <span>Section</span>
                <span>Menu label</span>
                <span>Page anchor (CSS selector)</span>
              </div>
              {sectionRows.map((row, i) => {
                const set = (patch: Partial<SectionRow>) =>
                  setSectionRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)))
                const needed = !isBlank(row)
                return (
                  <div key={i} style={sectionGrid}>
                    <input
                      aria-label={`Section ${i + 1} name`}
                      value={row.name}
                      required={needed}
                      maxLength={40}
                      onChange={(e) => set({ name: e.target.value })}
                      style={input}
                      placeholder="e.g. Pricing"
                    />
                    <input
                      aria-label={`Section ${i + 1} menu label`}
                      value={row.label}
                      required={needed}
                      maxLength={ORBI_EMBED_LIMITS.labelMax}
                      onChange={(e) => set({ label: e.target.value })}
                      style={input}
                      placeholder="e.g. Our Prices"
                    />
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        aria-label={`Section ${i + 1} page anchor`}
                        value={row.selector}
                        required={needed}
                        onChange={(e) => set({ selector: e.target.value })}
                        style={{ ...input, fontFamily: 'ui-monospace, monospace' }}
                        placeholder="e.g. #pricing"
                      />
                      {sectionRows.length > 2 && (
                        <button
                          type="button"
                          aria-label={`Remove custom section ${i + 1}`}
                          onClick={() => setSectionRows((rs) => rs.filter((_, j) => j !== i))}
                          style={{ ...mini, color: 'var(--muted-text)', fontSize: '18px', lineHeight: 1 }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
              {sectionRows.length < ORBI_EMBED_SECTION_KEYS.length + ORBI_EMBED_LIMITS.customMax && (
                <div style={{ padding: '4px 14px 12px' }}>
                  <button
                    type="button"
                    onClick={() => setSectionRows((rs) => [...rs, { ...BLANK_ROW }])}
                    style={{ ...mini, fontSize: '14px' }}
                  >
                    + Add section
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* Ask ORBI is what the Intelligence plan sells, so its inputs only
              appear there. Switching plans keeps whatever was typed. */}
          {form.plan === 'intelligence' && (
            <>
              <Field label="Ask ORBI — business knowledge. ORBI answers only from this text." full>
                <textarea
                  rows={8}
                  value={form.knowledge}
                  onChange={(e) => setForm({ ...form, knowledge: e.target.value })}
                  style={{ ...input, resize: 'vertical' }}
                  placeholder={KNOWLEDGE_EXAMPLE}
                />
              </Field>
              <Field label="Ask ORBI — intro line (optional)" full>
                <input
                  value={form.ask_intro}
                  onChange={(e) => setForm({ ...form, ask_intro: e.target.value })}
                  style={input}
                  placeholder={`Ask me anything about ${form.customer_name || 'this business'}.`}
                />
              </Field>
              <Field label="Ask ORBI — starter questions (optional, up to 4, one per line)" full>
                <textarea
                  rows={3}
                  value={form.ask_starters}
                  onChange={(e) => setForm({ ...form, ask_starters: e.target.value })}
                  style={{ ...input, resize: 'vertical' }}
                  placeholder={'What does your app do?\nHow much does it cost?'}
                />
              </Field>
            </>
          )}
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
                setSectionRows(blankRows())
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
