'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Infra, Project, Salary, TeamMember, Transaction } from '@/lib/db'
import { GhostButton, errorBox, labelKicker } from './ui'
import Overview from './sections/Overview'
import TransactionsSection from './sections/TransactionsSection'
import ProjectsSection from './sections/ProjectsSection'
import InfraSection from './sections/InfraSection'
import TeamSection from './sections/TeamSection'
import SalariesSection from './sections/SalariesSection'
import SettingsSection from './sections/SettingsSection'

type Data = {
  projects: Project[]
  transactions: Transaction[]
  infra: Infra[]
  team: TeamMember[]
  salaries: Salary[]
}

type SectionKey =
  | 'overview'
  | 'transactions'
  | 'projects'
  | 'infra'
  | 'team'
  | 'salaries'
  | 'settings'

const NAV: { key: SectionKey; label: string }[] = [
  { key: 'overview', label: 'Dashboard' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'projects', label: 'Projects' },
  { key: 'infra', label: 'Domains & Hosting' },
  { key: 'team', label: 'Team' },
  { key: 'salaries', label: 'Salaries' },
  { key: 'settings', label: 'Settings' },
]

const EMPTY: Data = { projects: [], transactions: [], infra: [], team: [], salaries: [] }

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
      const [p, t, i, tm, s] = await Promise.all(responses.map((r) => r.json()))
      setData({
        projects: p.projects ?? [],
        transactions: t.transactions ?? [],
        infra: i.infra ?? [],
        team: tm.team ?? [],
        salaries: s.salaries ?? [],
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    }
  }, [router])

  useEffect(() => {
    refresh().finally(() => setLoading(false))
  }, [refresh])

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
          <header style={{ marginBottom: '24px' }}>
            <div style={labelKicker}>Admin Console</div>
            <h1 style={{ fontSize: '26px', fontWeight: 700, margin: '4px 0 0' }}>{active.label}</h1>
          </header>

          {error && <div style={errorBox}>{error}</div>}

          {loading ? (
            <p style={{ color: 'var(--muted-text)' }}>Loading…</p>
          ) : (
            <>
              {section === 'overview' && (
                <Overview transactions={data.transactions} salaries={data.salaries} />
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
              {section === 'settings' && <SettingsSection />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
