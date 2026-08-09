'use client'

import { useEffect, useState } from 'react'
import type { SiteSettings } from '@/lib/settings'
import { Field, GhostButton, errorBox, input, muted, panel, sectionTitle } from '../ui'
import { apiSend } from '../api'

/** Build a `tel:` href from a human-formatted number (client-safe copy). */
const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`

export default function SettingsSection() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    setError(null)
    try {
      const res = await fetch('/api/buddhima/settings')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Failed to load settings')
      setSettings(data.settings)
      setPhone(data.settings.emergencyPhone)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load settings')
    }
  }

  useEffect(() => {
    load().finally(() => setLoading(false))
  }, [])

  async function toggleMaintenance() {
    if (!settings) return
    const next = !settings.maintenance
    if (
      next &&
      !confirm('Put the public site into maintenance mode? Visitors will see the "sharpening our blade" screen instead of the homepage.')
    ) {
      return
    }
    setToggling(true)
    setError(null)
    try {
      const { settings: updated } = await apiSend<{ settings: SiteSettings }>(
        '/api/buddhima/settings',
        'PATCH',
        { maintenance: next }
      )
      setSettings(updated)
      setPhone(updated.emergencyPhone)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update maintenance mode')
    } finally {
      setToggling(false)
    }
  }

  async function savePhone(e: React.FormEvent) {
    e.preventDefault()
    setSavingPhone(true)
    setError(null)
    try {
      const { settings: updated } = await apiSend<{ settings: SiteSettings }>(
        '/api/buddhima/settings',
        'PATCH',
        { emergencyPhone: phone }
      )
      setSettings(updated)
      setPhone(updated.emergencyPhone)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save phone number')
    } finally {
      setSavingPhone(false)
    }
  }

  if (loading) return <p style={muted}>Loading…</p>

  const active = settings?.maintenance ?? false
  const phoneDirty = settings ? phone.trim() !== settings.emergencyPhone : false

  return (
    <section style={{ display: 'grid', gap: '20px' }}>
      {error && <div style={errorBox}>{error}</div>}

      {/* Maintenance mode */}
      <div style={panel}>
        <h2 style={sectionTitle}>Maintenance mode</h2>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '999px',
                flexShrink: 0,
                background: active ? 'var(--color-warning, #FBBF24)' : 'var(--color-success, #34D399)',
                boxShadow: `0 0 10px ${active ? 'rgba(251,191,36,0.6)' : 'rgba(52,211,153,0.6)'}`,
              }}
            />
            <div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--heading)' }}>
                {active ? 'Maintenance mode is ON' : 'Site is live'}
              </div>
              <div style={{ ...muted, fontSize: '13px', marginTop: '2px' }}>
                {active
                  ? 'Visitors see the "sharpening our blade" screen.'
                  : 'Visitors see the normal homepage.'}
              </div>
            </div>
          </div>

          <GhostButton
            onClick={toggleMaintenance}
            disabled={toggling}
            style={
              active
                ? undefined
                : {
                    background: 'rgba(251,191,36,0.1)',
                    border: '1px solid rgba(251,191,36,0.4)',
                    color: 'var(--color-warning, #FBBF24)',
                  }
            }
          >
            {toggling ? 'Saving…' : active ? 'Deactivate — go live' : 'Activate maintenance'}
          </GhostButton>
        </div>
      </div>

      {/* Emergency contact number */}
      <form onSubmit={savePhone} style={panel}>
        <h2 style={sectionTitle}>Emergency contact number</h2>
        <p style={{ ...muted, fontSize: '13px', margin: '0 0 16px' }}>
          Shown as the &ldquo;Emergency contact&rdquo; call button on the maintenance screen.
        </p>
        <Field label="Phone number">
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={input}
            placeholder="+94 76 58 31021"
            inputMode="tel"
          />
        </Field>
        {phone.trim() && (
          <p style={{ ...muted, fontSize: '12px', marginTop: '8px' }}>
            Dials <code style={{ color: 'var(--accent)' }}>{telHref(phone)}</code>
          </p>
        )}
        <div style={{ marginTop: '16px' }}>
          <GhostButton type="submit" disabled={savingPhone || !phone.trim() || !phoneDirty}>
            {savingPhone ? 'Saving…' : 'Save number'}
          </GhostButton>
        </div>
      </form>
    </section>
  )
}
