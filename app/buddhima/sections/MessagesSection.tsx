'use client'

import { useState } from 'react'
import type { ContactMessage } from '@/lib/db'
import { GhostButton, StatusPill, SubtleButton, errorBox, muted, panel, sectionTitle } from '../ui'
import { apiSend } from '../api'

/** "2 hours ago" for anything recent, an absolute date once it's older. */
function when(iso: string): string {
  const then = new Date(iso).getTime()
  const mins = Math.round((Date.now() - then) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} h ago`
  if (mins < 60 * 24 * 7) return `${Math.round(mins / (60 * 24))} d ago`
  return new Date(iso).toLocaleDateString()
}

/**
 * What the enquiry is about.
 *
 * A message from the ORBI page's package cards carries the tier the visitor
 * clicked, which is the single most useful thing to know before opening it.
 * The homepage form has no tier, so it gets a plain label.
 */
function subjectOf(m: ContactMessage): string {
  return m.package ? `${m.package} package enquiry` : 'Message from the website'
}

export default function MessagesSection({
  messages,
  reload,
}: {
  messages: ContactMessage[]
  reload: () => Promise<void>
}) {
  const [openId, setOpenId] = useState<number | null>(null)
  const [showArchived, setShowArchived] = useState(false)
  const [busy, setBusy] = useState(false)
  /** Ticked rows, by id. Ids of deleted messages are pruned on every render
   *  by intersecting with what is actually visible, so nothing stale is sent. */
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const visible = messages.filter((m) => (showArchived ? true : m.status !== 'archived'))
  const unread = messages.filter((m) => m.status === 'new').length
  // What "Delete read" would remove — read only, never unread or archived.
  const readCount = messages.filter((m) => m.status === 'read').length
  // Intersect rather than trust the set: a message deleted elsewhere, or one
  // hidden by the archived filter, must not be swept up by "Delete selected".
  const selectedIds = visible.filter((m) => selected.has(m.id)).map((m) => m.id)
  const allSelected = visible.length > 0 && selectedIds.length === visible.length

  function toggleSelected(id: number) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelectAll() {
    setSelected(allSelected ? new Set() : new Set(visible.map((m) => m.id)))
  }


  async function setStatus(id: number, status: ContactMessage['status']) {
    setError(null)
    try {
      await apiSend(`/api/buddhima/messages/${id}`, 'PATCH', { status })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    }
  }

  /** Opening a message is the read receipt — no extra click needed. */
  async function toggle(m: ContactMessage) {
    const next = openId === m.id ? null : m.id
    setOpenId(next)
    if (next !== null && m.status === 'new') await setStatus(m.id, 'read')
  }

  async function markAllRead() {
    setBusy(true)
    setError(null)
    try {
      await apiSend('/api/buddhima/messages', 'PATCH', { action: 'read-all' })
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteRead() {
    if (
      !confirm(
        `Delete all ${readCount} read message${readCount === 1 ? '' : 's'}? This cannot be undone.`,
      )
    ) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiSend('/api/buddhima/messages', 'DELETE', { action: 'delete-read' })
      setOpenId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function deleteSelected() {
    const count = selectedIds.length
    if (!confirm(`Delete ${count} selected message${count === 1 ? '' : 's'}? This cannot be undone.`)) {
      return
    }
    setBusy(true)
    setError(null)
    try {
      await apiSend('/api/buddhima/messages', 'DELETE', {
        action: 'delete-ids',
        ids: selectedIds,
      })
      setSelected(new Set())
      setOpenId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    } finally {
      setBusy(false)
    }
  }

  async function del(id: number) {
    if (!confirm('Delete this message? This cannot be undone.')) return
    setError(null)
    try {
      await apiSend(`/api/buddhima/messages/${id}`, 'DELETE')
      if (openId === id) setOpenId(null)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Delete failed')
    }
  }

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

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
          <h2 style={{ ...sectionTitle, margin: 0 }}>
            Inbox ({visible.length}){unread > 0 && ` · ${unread} unread`}
          </h2>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {visible.length > 0 && (
              <SubtleButton onClick={toggleSelectAll}>
                {allSelected ? 'Clear selection' : 'Select all'}
              </SubtleButton>
            )}
            <SubtleButton onClick={() => setShowArchived((v) => !v)}>
              {showArchived ? 'Hide archived' : 'Show archived'}
            </SubtleButton>
            <GhostButton onClick={markAllRead} disabled={busy || unread === 0}>
              Mark all read
            </GhostButton>
            <GhostButton onClick={deleteSelected} disabled={busy || selectedIds.length === 0}>
              Delete selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ''}
            </GhostButton>
            <GhostButton onClick={deleteRead} disabled={busy || readCount === 0}>
              Delete read{readCount > 0 ? ` (${readCount})` : ''}
            </GhostButton>
          </div>
        </div>

        {visible.length === 0 ? (
          <p style={muted}>No messages yet. Submissions from the site&rsquo;s contact form land here.</p>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {visible.map((m) => {
              const open = openId === m.id
              const isNew = m.status === 'new'
              return (
                <article
                  key={m.id}
                  style={{
                    border: `1px solid ${isNew ? 'rgba(0,183,255,0.35)' : 'var(--hairline)'}`,
                    background: isNew ? 'rgba(0,183,255,0.05)' : 'rgba(255,255,255,0.015)',
                    borderRadius: '12px',
                    opacity: m.status === 'archived' ? 0.6 : 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'stretch' }}>
                    <label
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        paddingLeft: '14px',
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(m.id)}
                        onChange={() => toggleSelected(m.id)}
                        aria-label={`Select message from ${m.name}`}
                        style={{
                          width: '16px',
                          height: '16px',
                          accentColor: '#00B7FF',
                          cursor: 'pointer',
                        }}
                      />
                    </label>
                    <button
                      onClick={() => toggle(m)}
                      aria-expanded={open}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        width: '100%',
                        textAlign: 'left',
                        background: 'transparent',
                        border: 'none',
                        padding: '14px 16px 14px 12px',
                        cursor: 'pointer',
                        color: 'inherit',
                        fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                      }}
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          flexShrink: 0,
                          background: isNew ? 'var(--accent)' : 'transparent',
                          border: isNew ? 'none' : '1px solid var(--hairline)',
                        }}
                      />
                      <span style={{ minWidth: 0, flex: 1 }}>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '14px',
                            fontWeight: isNew ? 600 : 500,
                            color: 'var(--heading)',
                          }}
                        >
                          {m.name}
                          {m.company ? ` · ${m.company}` : ''}
                          {/* The pricing tier, when the enquiry came from the
                              ORBI page's package cards rather than the homepage. */}
                          {m.package && (
                            <span style={{ marginLeft: '8px' }}>
                              <StatusPill status={m.package} />
                            </span>
                          )}
                        </span>
                        <span
                          style={{
                            display: 'block',
                            fontSize: '13px',
                            color: 'var(--muted-text)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {open ? m.email : m.message}
                        </span>
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--muted-text)', whiteSpace: 'nowrap' }}>
                        {when(m.created_at)}
                      </span>
                    </button>
                  </div>

                  {open && (
                    <div style={{ padding: '0 16px 16px', display: 'grid', gap: '14px' }}>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          fontWeight: 600,
                          color: 'var(--heading)',
                        }}
                      >
                        <span style={{ color: 'var(--muted-text)', fontWeight: 500 }}>
                          Subject:{' '}
                        </span>
                        {subjectOf(m)}
                      </p>
                      <p
                        style={{
                          margin: 0,
                          fontSize: '14px',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                          color: 'var(--foreground)',
                        }}
                      >
                        {m.message}
                      </p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        <a
                          href={`mailto:${m.email}?subject=${encodeURIComponent(
                            `Re: ${subjectOf(m)}`,
                          )}`}
                          className="btn-primary"
                          style={{
                            padding: '10px 20px',
                            borderRadius: '12px',
                            fontSize: '14px',
                            fontWeight: 600,
                            textDecoration: 'none',
                            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                          }}
                        >
                          Reply by email
                        </a>
                        {m.phone && (
                          <a
                            href={`tel:${m.phone.replace(/[^\d+]/g, '')}`}
                            className="btn-primary"
                            style={{
                              padding: '10px 20px',
                              borderRadius: '12px',
                              fontSize: '14px',
                              fontWeight: 600,
                              textDecoration: 'none',
                              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                            }}
                          >
                            Call {m.phone}
                          </a>
                        )}
                        <SubtleButton onClick={() => setStatus(m.id, isNew ? 'read' : 'new')}>
                          Mark as {isNew ? 'read' : 'unread'}
                        </SubtleButton>
                        <SubtleButton
                          onClick={() => setStatus(m.id, m.status === 'archived' ? 'read' : 'archived')}
                        >
                          {m.status === 'archived' ? 'Unarchive' : 'Archive'}
                        </SubtleButton>
                        <button
                          onClick={() => del(m.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-error, #F87171)',
                            fontSize: '13px',
                            cursor: 'pointer',
                            fontFamily: 'var(--font-poppins), system-ui, sans-serif',
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
