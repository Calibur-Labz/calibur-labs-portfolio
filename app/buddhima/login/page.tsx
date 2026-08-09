'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/buddhima/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error ?? 'Login failed')
        return
      }
      // Full navigation so proxy re-evaluates the fresh session cookie.
      router.replace('/buddhima')
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 14px',
    borderRadius: '12px',
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid var(--hairline)',
    color: 'var(--heading)',
    fontSize: '14px',
    fontFamily: 'var(--font-poppins), system-ui, sans-serif',
    outline: 'none',
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background:
          'radial-gradient(1200px 600px at 50% -10%, rgba(0,183,255,0.08), transparent), var(--background)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          padding: '36px 32px',
          borderRadius: '20px',
          background: 'rgba(255,255,255,0.02)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 30px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ marginBottom: '28px', textAlign: 'center' }}>
          <div
            style={{
              fontSize: '12px',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--accent)',
              marginBottom: '8px',
            }}
          >
            Admin
          </div>
          <h1 style={{ fontSize: '26px', fontWeight: 700, margin: 0 }}>Buddhima Console</h1>
          <p style={{ fontSize: '13px', color: 'var(--muted-text)', marginTop: '8px' }}>
            Sign in to track income, expenses &amp; projects.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label htmlFor="email" style={labelStyle}>
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={inputStyle}
            />
          </div>
          <div>
            <label htmlFor="password" style={labelStyle}>
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div
              role="alert"
              style={{
                fontSize: '13px',
                color: 'var(--color-error, #F87171)',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: '10px',
                padding: '10px 12px',
              }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-shimmer btn-primary"
            style={{
              marginTop: '4px',
              padding: '13px',
              borderRadius: '13px',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'var(--font-poppins), system-ui, sans-serif',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </main>
  )
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  color: 'var(--muted-text)',
  marginBottom: '6px',
  letterSpacing: '0.02em',
}
