/**
 * Minimal session auth for the /buddhima admin area.
 *
 * A single admin logs in with credentials stored in environment variables.
 * On success we issue a stateless, HMAC-signed session token stored in an
 * httpOnly cookie. No database or third-party auth provider required.
 *
 * All crypto uses the Web Crypto API (`crypto.subtle`) so the same code runs
 * in both the Node.js runtime (route handlers) and inside `proxy.ts`.
 */

export const SESSION_COOKIE = 'buddhima_session'
const SESSION_TTL_SECONDS = 60 * 60 * 12 // 12 hours

type SessionPayload = {
  sub: string // admin email
  exp: number // expiry, epoch seconds
}

function getSecret(): string {
  const secret = process.env.SESSION_SECRET
  if (!secret) {
    throw new Error('SESSION_SECRET is not set')
  }
  return secret
}

// --- base64url helpers (binary-safe, no Buffer dependency) ---

function bytesToBase64url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(value: string): Uint8Array {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function hmac(data: string): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(getSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  return new Uint8Array(signature)
}

// Constant-time string comparison to avoid signature timing leaks.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let mismatch = 0
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return mismatch === 0
}

/**
 * Verify the submitted email + password against the configured admin
 * credentials. Comparison is length-agnostic but content-timing-safe.
 */
export function verifyCredentials(email: string, password: string): boolean {
  const adminEmail = process.env.ADMIN_EMAIL ?? ''
  const adminPassword = process.env.ADMIN_PASSWORD ?? ''
  if (!adminEmail || !adminPassword) return false
  const emailOk = timingSafeEqual(email.trim().toLowerCase(), adminEmail.trim().toLowerCase())
  const passwordOk = timingSafeEqual(password, adminPassword)
  return emailOk && passwordOk
}

/** Create a signed session token for the given admin email. */
export async function createSessionToken(email: string): Promise<string> {
  const payload: SessionPayload = {
    sub: email,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const body = bytesToBase64url(new TextEncoder().encode(JSON.stringify(payload)))
  const signature = bytesToBase64url(await hmac(body))
  return `${body}.${signature}`
}

/** Return the payload if the token is valid and unexpired, else null. */
export async function verifySessionToken(token: string | undefined): Promise<SessionPayload | null> {
  if (!token || !token.includes('.')) return null
  const [body, signature] = token.split('.')
  if (!body || !signature) return null

  const expected = bytesToBase64url(await hmac(body))
  if (!timingSafeEqual(signature, expected)) return null

  try {
    const payload = JSON.parse(new TextDecoder().decode(base64urlToBytes(body))) as SessionPayload
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

/** Cookie options for the session cookie. */
export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  }
}
