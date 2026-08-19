'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type {
  ContactMessage,
  Document,
  Infra,
  Project,
  Salary,
  TeamMember,
  Transaction,
} from '@/lib/db'
import { BellIcon } from '@/components/ui/icons'
import { GhostButton, errorBox, labelKicker } from './ui'
import Overview from './sections/Overview'
import TransactionsSection from './sections/TransactionsSection'
import ProjectsSection from './sections/ProjectsSection'
import InfraSection from './sections/InfraSection'
import TeamSection from './sections/TeamSection'
import SalariesSection from './sections/SalariesSection'
import MessagesSection from './sections/MessagesSection'
import DocumentsSection from './sections/DocumentsSection'
import SettingsSection from './sections/SettingsSection'

type Data = {
  projects: Project[]
  transactions: Transaction[]
  infra: Infra[]
  team: TeamMember[]
  salaries: Salary[]
  messages: ContactMessage[]
  documents: Document[]
}

type SectionKey =
  | 'overview'
  | 'messages'
  | 'transactions'
  | 'projects'
  | 'infra'
  | 'team'
  | 'salaries'
  | 'documents'
  | 'settings'

const NAV: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Dashboard' },
  { key: 'messages', label: 'Messages' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'projects', label: 'Projects' },
  { key: 'infra', label: 'Domains & Hosting' },
  { key: 'team', label: 'Team' },
  { key: 'salaries', label: 'Salaries' },
  { key: 'documents', label: 'Documents' },
  { key: 'settings', label: 'Settings' },
]

const EMPTY: Data = {
  projects: [],
  transactions: [],
  infra: [],
  team: [],
  salaries: [],
  messages: [],
  documents: [],
}

/** How often the console re-checks the inbox for new contact-form messages. */
const POLL_MS = 30_000

export default function Dashboard({ adminEmail }: { adminEmail: string }) {
  const router = useRouter()
  const [section, setSection] = useState<SectionKey>('overview')
  const [data, setData] = useState<Data>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setError(null)
    try {
      const responses = await Promise.all([
        fetch('/api/buddhima/projects'),
        fetch('/api/buddhima/transactions'),
        fetch('/api/buddhima/infra'),
        fetch('/api/buddhima/team'),
        fetch('/api/buddhima/salaries'),
        fetch('/api/buddhima/messages'),
        fetch('/api/buddhima/documents'),
      ])
      if (responses.some((r) => r.status === 401)) {
        router.replace('/buddhima/login')
        return
      }
      const bad = responses.find((r) => !r.ok)
      if (bad) {
        const d = await bad.json().catch(() => ({}))
        throw new Error(d.error ?? 'Could not load data. Is the database configured?')
      }
      const [p, t, i, tm, s, m, docs] = await Promise.all(responses.map((r) => r.json()))
      setData({
        projects: p.projects ?? [],
        transactions: t.transactions ?? [],
        infra: i.infra ?? [],
        team: tm.team ?? [],
        salaries: s.salaries ?? [],
        messages: m.messages ?? [],
        documents: docs.documents ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }, [router])

  /**
   * Inbox-only refresh. The poll uses this rather than `refresh` so a new
   * message can light up the bell without re-fetching the whole console — and
   * so a transient failure never clears the panels or shows a banner.
   */
  const refreshMessages = useCallback(async () => {
    try {
      const res = await fetch('/api/buddhima/messages')
      if (!res.ok) return
      const { messages } = await res.json()
      setData((prev) => ({ ...prev, messages: messages ?? [] }))
    } catch {
      /* offline or mid-deploy — the next tick tries again */
    }
  }, [])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

  // Poll the inbox while the tab is visible, and once more the moment it is
  // brought back to the front — that's when the badge is actually looked at.
  useEffect(() => {
    const tick = () => {
      if (!document.hidden) refreshMessages()
    }
    const id = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refreshMessages])

  const unread = data.messages.filter((m) => m.status === 'new').length

  // Ping the title bar too, so a new message is visible from another tab.
  const baseTitle = useRef<string>('')
  useEffect(() => {
    if (!baseTitle.current) baseTitle.current = document.title
    document.title = unread > 0 ? `(${unread}) ${baseTitle.current}` : baseTitle.current
  }, [unread])

  async function logout() {
    await fetch('/api/buddhima/logout', { method: 'POST' })
    router.replace('/buddhima/login')
    router.refresh()
  }

  const active = NAV.find((n) => n.key === section)!

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div style={{ padding: '0 8px 18px' }}>
          <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--heading)' }}>Buddhima</div>
          <div style={{ fontSize: '12px', color: 'var(--muted-text)', marginTop: '4px', wordBreak: 'break-all' }}>
            {adminEmail}
          </div>
        </div>

        <nav className="admin-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`admin-navitem${section === n.key ? ' active' : ''}`}
              onClick={() => setSection(n.key)}
            >
              <span className="dot" />
              {n.label}
              {n.key === 'messages' && unread > 0 && (
                <span className="admin-badge" aria-label={`${unread} unread messages`}>
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div style={{ marginTop: 'auto', paddingTop: '18px' }}>
          <GhostButton onClick={logout} style={{ width: '100%' }}>
            Sign out
          </GhostButton>
        </div>
      </aside>

      <main className="admin-main">
        <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
          <header
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '16px',
              marginBottom: '24px',
            }}
          >
            <div>
              <div style={labelKicker}>Admin Console</div>
              <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '4px 0 0' }}>{active.label}</h1>
            </div>

            {/* Notification bell — always present, ringing only when unread. */}
            <button
              type="button"
              onClick={() => setSection('messages')}
              className={`admin-bell${unread > 0 ? ' has-unread' : ''}`}
              title={unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'No new messages'}
              aria-label={
                unread > 0 ? `${unread} unread message${unread === 1 ? '' : 's'}` : 'No new messages'
              }
            >
              <BellIcon size={19} />
              {unread > 0 && <span className="admin-badge dot-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
          </header>

          {error && <div style={errorBox}>{error}</div>}

          {loading ? (
            <p style={{ color: 'var(--muted-text)' }}>Loading…</p>
          ) : (
            <>
              {section === 'overview' && (
                <Overview transactions={data.transactions} salaries={data.salaries} />
              )}
              {section === 'messages' && (
                <MessagesSection messages={data.messages} reload={refreshMessages} />
              )}
              {section === 'transactions' && (
                <TransactionsSection transactions={data.transactions} projects={data.projects} reload={refresh} />
              )}
              {section === 'projects' && <ProjectsSection projects={data.projects} reload={refresh} />}
              {section === 'infra' && (
                <InfraSection infra={data.infra} projects={data.projects} reload={refresh} />
              )}
              {section === 'team' && <TeamSection team={data.team} reload={refresh} />}
              {section === 'salaries' && (
                <SalariesSection
                  salaries={data.salaries}
                  team={data.team}
                  projects={data.projects}
                  reload={refresh}
                />
              )}
              {section === 'documents' && (
                <DocumentsSection documents={data.documents} projects={data.projects} reload={refresh} />
              )}
              {section === 'settings' && <SettingsSection />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
