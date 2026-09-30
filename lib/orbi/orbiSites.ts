// Relative rather than `@/`, matching the rest of `lib/orbi/`, so the module
// compiles and runs under plain Node in the test suite.
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { ORBI_EMBED_SECTION_KEYS } from '../../components/orbi/orbiEmbedSections'

/**
 * ORBI sites — who may run the embed, and where.
 *
 * Everything that decides whether ORBI runs on someone's website lives here,
 * as plain functions: no database, no request objects, no environment. The
 * routes are thin wrappers that hand these a lookup and a secret, which is
 * what lets every rule below be tested exactly as it runs.
 *
 * The rules, in one place:
 *
 *  - An origin is `scheme://host[:port]`, compared as an **exact string** after
 *    the browser's own normalisation (`new URL().origin`). `www` and the bare
 *    domain are different origins, so are two subdomains, so are http and
 *    https. There is no wildcard and no substring match anywhere.
 *  - Only https origins, except the loopback hosts (`localhost`, `127.0.0.1`,
 *    `[::1]`) over http — which is the whole development mechanism: an admin
 *    adds `http://localhost:3000` to a site explicitly, like any other origin.
 *  - A site runs only while it exists, is `active`, and has not passed its
 *    expiry date.
 */

/* ── The record ───────────────────────────────────────────────────────── */

/** The same three tiers the product page sells (`orbiPackages` in lib/data.ts). */
export const ORBI_SITE_PLANS = ['core', 'guide', 'intelligence'] as const
export type OrbiSitePlan = (typeof ORBI_SITE_PLANS)[number]

export const ORBI_SITE_STATUSES = ['active', 'disabled'] as const
export type OrbiSiteStatus = (typeof ORBI_SITE_STATUSES)[number]

export interface OrbiSite {
  id: number
  site_id: string
  customer_name: string
  allowed_origins: string[]
  plan: string
  status: string
  /** The customer's `data-orbi-sections` JSON, for their snippet. Never used to authorize. */
  sections_config: string | null
  /** `YYYY-MM-DD`. ORBI runs through the end of this day (UTC), not after. */
  expires_on: string | null
  created_at: string
  updated_at: string
}

export const ORBI_SITE_LIMITS = {
  customerName: 120,
  origins: 10,
  originLength: 255,
  sectionsConfig: 4000,
  labelMax: 40,
  selectorMax: 200,
} as const

/* ── Site IDs ─────────────────────────────────────────────────────────── */

const SITE_ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const SITE_ID_LENGTH = 20
const SITE_ID_PATTERN = /^orbi_[a-z0-9]{20}$/

/**
 * `orbi_` and twenty characters from a CSPRNG — about 103 bits, so IDs are
 * neither sequential nor guessable. Public by design: it sits in the
 * customer's HTML. It identifies a site; the origin check is what authorizes.
 */
export function generateSiteId(): string {
  let id = 'orbi_'
  for (let i = 0; i < SITE_ID_LENGTH; i++) id += SITE_ID_ALPHABET[randomInt(SITE_ID_ALPHABET.length)]
  return id
}

export function isValidSiteId(value: unknown): value is string {
  return typeof value === 'string' && SITE_ID_PATTERN.test(value)
}

/* ── Origins ──────────────────────────────────────────────────────────── */

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]'])

export type OriginResult = { ok: true; origin: string } | { ok: false; error: string }

/**
 * One origin, as typed by an admin or sent by a browser → its canonical form,
 * or the reason it is not one. Deliberately strict: anything that is more than
 * an origin (a path, a query, credentials) is refused rather than trimmed, so
 * what gets stored is exactly what was meant.
 */
export function normalizeOrigin(input: unknown): OriginResult {
  if (typeof input !== 'string') return { ok: false, error: 'Not a string' }
  const raw = input.trim()
  if (!raw) return { ok: false, error: 'Empty' }
  if (raw.length > ORBI_SITE_LIMITS.originLength) return { ok: false, error: 'Too long' }
  if (/\s/.test(raw)) return { ok: false, error: `"${raw}" contains spaces` }
  if (raw.includes('*')) return { ok: false, error: `"${raw}": wildcards are not allowed` }

  let url: URL
  try {
    url = new URL(raw)
  } catch {
    return { ok: false, error: `"${raw}" is not a URL — use https://example.com` }
  }

  const loopback = LOOPBACK.has(url.hostname)
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) {
    return { ok: false, error: `"${raw}" must use https:// (http is only allowed for localhost)` }
  }
  if (url.username || url.password) return { ok: false, error: `"${raw}" must not contain credentials` }
  if (url.pathname !== '/' || url.search || url.hash || raw.includes('?') || raw.includes('#')) {
    return { ok: false, error: `"${raw}" must be an origin only — no path, query or fragment` }
  }
  if (!url.hostname || url.hostname.endsWith('.')) {
    return { ok: false, error: `"${raw}" has an invalid host` }
  }
  if (!loopback && !url.hostname.includes('.')) {
    return { ok: false, error: `"${raw}" is not a public domain` }
  }
  return { ok: true, origin: url.origin }
}

/**
 * The admin's "allowed domains" field → a clean, de-duplicated list. Accepts
 * a list, or text with one origin per line (commas also split). Every bad
 * entry is reported, not silently dropped.
 */
export function parseAllowedOrigins(raw: unknown): { origins: string[]; errors: string[] } {
  const entries = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? raw.split(/[\n,]/)
      : []
  const origins: string[] = []
  const errors: string[] = []
  for (const entry of entries) {
    if (typeof entry === 'string' && !entry.trim()) continue
    const result = normalizeOrigin(entry)
    if (!result.ok) errors.push(result.error)
    else if (!origins.includes(result.origin)) origins.push(result.origin)
  }
  if (origins.length > ORBI_SITE_LIMITS.origins) {
    errors.push(`At most ${ORBI_SITE_LIMITS.origins} origins per site`)
  }
  return { origins, errors }
}

/* ── The decision ─────────────────────────────────────────────────────── */

type Authorizable = Pick<OrbiSite, 'status' | 'allowed_origins' | 'expires_on'>

/** Today's date in UTC, as `YYYY-MM-DD` — the unit expiry is written in. */
function utcDay(now: Date): string {
  return now.toISOString().slice(0, 10)
}

/**
 * The whole authorization rule. `origin` is what the browser said — an
 * `Origin` header, or a `MessageEvent.origin` — and it is normalised the same
 * way the stored origins were, then compared exactly.
 */
export function isSiteAuthorized(
  site: Authorizable | null | undefined,
  origin: unknown,
  now: Date = new Date(),
): boolean {
  if (!site || site.status !== 'active') return false
  if (site.expires_on && utcDay(now) > site.expires_on) return false
  const requested = normalizeOrigin(origin)
  if (!requested.ok) return false
  return Array.isArray(site.allowed_origins) && site.allowed_origins.includes(requested.origin)
}

/* ── The embed token ──────────────────────────────────────────────────── */

/**
 * Proof, carried from the host page into the ORBI frame, that the server
 * authorized *this* site on *this* origin a moment ago.
 *
 * `embed.js` asks `/api/orbi/authorize`, where the server reads the browser's
 * `Origin` header. The frame cannot see that header — it sees the host only
 * as the `MessageEvent.origin` of the hello — so the answer travels as a
 * signed token naming both, and the frame accepts it only when the origin in
 * the token is the origin that actually framed it. A snippet copied to another
 * site gets no token; a token lifted from an authorized page names the wrong
 * origin everywhere else.
 *
 * `v1.<payload>.<signature>` — three parts, and signed under a key derived
 * for this purpose alone, so it can never be mistaken for, or used as, the
 * admin session token that shares the server secret.
 */
export const ORBI_EMBED_TOKEN_TTL_SECONDS = 10 * 60

function embedKey(secret: string): Buffer {
  return createHmac('sha256', secret).update('orbi-embed-token-v1').digest()
}

function sign(payload: string, secret: string): string {
  return createHmac('sha256', embedKey(secret)).update(payload).digest('base64url')
}

export function signEmbedToken(
  claim: { siteId: string; origin: string },
  secret: string,
  now: Date = new Date(),
): string {
  const exp = Math.floor(now.getTime() / 1000) + ORBI_EMBED_TOKEN_TTL_SECONDS
  const payload = Buffer.from(JSON.stringify({ s: claim.siteId, o: claim.origin, e: exp })).toString('base64url')
  return `v1.${payload}.${sign(payload, secret)}`
}

export function verifyEmbedToken(
  token: unknown,
  secret: string,
  now: Date = new Date(),
): { siteId: string; origin: string } | null {
  if (typeof token !== 'string' || token.length > 1024) return null
  const parts = token.split('.')
  if (parts.length !== 3 || parts[0] !== 'v1') return null
  const [, payload, signature] = parts
  const expected = Buffer.from(sign(payload, secret))
  const given = Buffer.from(signature)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      s?: unknown
      o?: unknown
      e?: unknown
    }
    if (!isValidSiteId(claim.s) || typeof claim.o !== 'string' || typeof claim.e !== 'number') return null
    if (claim.e < Math.floor(now.getTime() / 1000)) return null
    return { siteId: claim.s, origin: claim.o }
  } catch {
    return null
  }
}

/* ── The two public questions ─────────────────────────────────────────── */

export interface AuthorizeDeps {
  findSite: (siteId: string) => Promise<Authorizable | null>
  /** The server secret, or null when unconfigured — which authorizes nothing. */
  secret: string | null
  now?: Date
}

/** Only ever one of these two shapes leaves the server. */
export type AuthorizeResult = { authorized: false } | { authorized: true; token: string }
export type VerifyResult = { authorized: false } | { authorized: true; origin: string }

const DENIED = { authorized: false } as const

/**
 * `embed.js` → "may ORBI run here?". `origin` must be the request's `Origin`
 * header; anything the body says about where it came from is never read.
 */
export async function authorizeEmbed(
  request: { siteId: unknown; origin: string | null },
  deps: AuthorizeDeps,
): Promise<AuthorizeResult> {
  if (!deps.secret || !isValidSiteId(request.siteId)) return DENIED
  const origin = normalizeOrigin(request.origin)
  if (!origin.ok) return DENIED
  const site = await deps.findSite(request.siteId)
  if (!isSiteAuthorized(site, origin.origin, deps.now)) return DENIED
  return {
    authorized: true,
    token: signEmbedToken({ siteId: request.siteId, origin: origin.origin }, deps.secret, deps.now),
  }
}

/**
 * The frame → "is this token real, and still good?". Re-checks the site, so a
 * site disabled after the token was issued stops on the next load, not in ten
 * minutes. Returns the origin the token was issued to; the frame compares it
 * with the origin that framed it.
 */
export async function verifyEmbed(token: unknown, deps: AuthorizeDeps): Promise<VerifyResult> {
  if (!deps.secret) return DENIED
  const claim = verifyEmbedToken(token, deps.secret, deps.now)
  if (!claim) return DENIED
  const site = await deps.findSite(claim.siteId)
  if (!isSiteAuthorized(site, claim.origin, deps.now)) return DENIED
  return { authorized: true, origin: claim.origin }
}

/* ── Admin input ──────────────────────────────────────────────────────── */

// Built from a string so the control-character range never sits in source.
const CONTROL = new RegExp('[\\u0000-\\u001F\\u007F]')

/**
 * The customer's section configuration, as the admin typed it → canonical
 * JSON, or why not. The same rules `embed.js` applies on the customer's page,
 * so a snippet the console hands out is one the embed will accept.
 */
export function validateSectionsConfig(
  raw: unknown,
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (raw == null || (typeof raw === 'string' && !raw.trim())) return { ok: true, value: null }
  if (typeof raw !== 'string') return { ok: false, error: 'Sections must be JSON text' }
  if (raw.length > ORBI_SITE_LIMITS.sectionsConfig) return { ok: false, error: 'Sections config is too long' }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false, error: 'Sections config is not valid JSON' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, error: 'Sections config must be a JSON object' }
  }
  const clean: Record<string, { label: string; selector: string }> = {}
  for (const [key, entry] of Object.entries(parsed as Record<string, unknown>)) {
    if (!ORBI_EMBED_SECTION_KEYS.includes(key)) {
      return { ok: false, error: `Unknown section "${key}" — use ${ORBI_EMBED_SECTION_KEYS.join(', ')}` }
    }
    const { label, selector } = (entry ?? {}) as { label?: unknown; selector?: unknown }
    if (typeof label !== 'string' || !label.trim() || label.trim().length > ORBI_SITE_LIMITS.labelMax || CONTROL.test(label)) {
      return { ok: false, error: `Section "${key}" needs a label of 1–${ORBI_SITE_LIMITS.labelMax} characters` }
    }
    if (typeof selector !== 'string' || !selector.trim() || selector.trim().length > ORBI_SITE_LIMITS.selectorMax || CONTROL.test(selector)) {
      return { ok: false, error: `Section "${key}" needs a CSS selector of 1–${ORBI_SITE_LIMITS.selectorMax} characters` }
    }
    clean[key] = { label: label.trim(), selector: selector.trim() }
  }
  return { ok: true, value: Object.keys(clean).length ? JSON.stringify(clean) : null }
}

export interface OrbiSiteInput {
  customer_name: string
  allowed_origins: string[]
  plan: OrbiSitePlan
  status: OrbiSiteStatus
  sections_config: string | null
  expires_on: string | null
}

type Validated<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Admin form → a record, or the first thing wrong with it. `partial` is for
 * edits: only the fields present are checked and returned, which is how
 * enable/disable is a one-field PATCH.
 */
export function validateSiteInput(body: unknown, partial: true): Validated<Partial<OrbiSiteInput>>
export function validateSiteInput(body: unknown, partial?: false): Validated<OrbiSiteInput>
export function validateSiteInput(body: unknown, partial = false): Validated<Partial<OrbiSiteInput>> {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { ok: false, error: 'Invalid request body' }
  const b = body as Record<string, unknown>
  const has = (key: string) => !partial || key in b
  const out: Partial<OrbiSiteInput> = {}

  if (has('customer_name')) {
    const name = typeof b.customer_name === 'string' ? b.customer_name.replace(new RegExp(CONTROL, 'g'), '').trim() : ''
    if (!name) return { ok: false, error: 'Customer name is required' }
    if (name.length > ORBI_SITE_LIMITS.customerName) return { ok: false, error: 'Customer name is too long' }
    out.customer_name = name
  }
  if (has('allowed_origins')) {
    const { origins, errors } = parseAllowedOrigins(b.allowed_origins)
    if (errors.length) return { ok: false, error: errors[0] }
    if (!origins.length) return { ok: false, error: 'Add at least one allowed domain, e.g. https://example.com' }
    out.allowed_origins = origins
  }
  if (has('plan')) {
    const plan = b.plan ?? 'core'
    if (!ORBI_SITE_PLANS.includes(plan as OrbiSitePlan)) return { ok: false, error: 'Unknown plan' }
    out.plan = plan as OrbiSitePlan
  }
  if (has('status')) {
    const status = b.status ?? 'active'
    if (!ORBI_SITE_STATUSES.includes(status as OrbiSiteStatus)) return { ok: false, error: 'Unknown status' }
    out.status = status as OrbiSiteStatus
  }
  if (has('sections_config')) {
    const sections = validateSectionsConfig(b.sections_config)
    if (!sections.ok) return sections
    out.sections_config = sections.value
  }
  if (has('expires_on')) {
    const raw = b.expires_on
    if (raw == null || raw === '') out.expires_on = null
    else if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw) || Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) || new Date(`${raw}T00:00:00Z`).toISOString().slice(0, 10) !== raw) {
      return { ok: false, error: 'Expiry must be a date (YYYY-MM-DD)' }
    } else out.expires_on = raw
  }
  if (partial && !Object.keys(out).length) return { ok: false, error: 'Nothing to update' }
  return { ok: true, value: out }
}

/* ── The customer's snippet ───────────────────────────────────────────── */

export const ORBI_EMBED_SRC = 'https://www.caliburlabz.com/orbi/embed.js'

/**
 * Safe inside a *single-quoted* HTML attribute: a `'` in a label can never
 * end the attribute early. Double quotes are left alone — they are the JSON's
 * own — and the browser decodes the entities before `embed.js` reads the
 * attribute, so the escaped text parses to the same JSON.
 */
function escapeSingleQuoted(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** What the customer pastes: one section per line, ready to read and edit. */
export function buildEmbedSnippet(siteId: string, sectionsConfig: string | null): string {
  if (!isValidSiteId(siteId)) throw new Error('Invalid site id')
  const lines = ['<script', `  src="${ORBI_EMBED_SRC}"`, `  data-orbi-site="${siteId}"`]
  if (sectionsConfig) {
    const parsed = JSON.parse(sectionsConfig) as Record<string, unknown>
    const body = Object.entries(parsed)
      .map(([key, value]) => `    ${JSON.stringify(key)}:${JSON.stringify(value)}`)
      .join(',\n')
    lines.push(`  data-orbi-sections='${escapeSingleQuoted(`{\n${body}\n  }`)}'`)
  }
  lines.push('  defer>', '</script>')
  return lines.join('\n')
}

/** A site as the console shows it: the record plus the snippet to hand over. */
export function withEmbedCode(site: OrbiSite): OrbiSite & { embed_code: string } {
  return { ...site, embed_code: buildEmbedSnippet(site.site_id, site.sections_config) }
}
