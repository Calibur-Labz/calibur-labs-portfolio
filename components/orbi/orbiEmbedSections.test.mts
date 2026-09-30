/**
 * ORBI embed — customer sections.
 *
 * Two halves, tested where they live. The frame's half is a pure module and is
 * tested directly. The page's half is `public/orbi/embed.js`, plain JavaScript
 * with no build step, so the real file is run in a `node:vm` context against a
 * fake page just large enough to watch what it does: the iframe it adds, the
 * messages it sends, and whether it scrolls.
 *
 * Run through `npm test`, or on its own:
 *
 *   npx tsc components/orbi/orbiEmbedSections.ts components/orbi/orbiAsk.ts \
 *           components/orbi/orbiGuideConfig.ts \
 *           components/orbi/orbiEmbedSections.test.mts \
 *       --outDir /tmp/orbi-embed --module nodenext --target es2022 \
 *       --skipLibCheck --lib es2022,dom
 *   node --test /tmp/orbi-embed
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import vm from 'node:vm'
import {
  embedActionLabels,
  embedGuideItems,
  ORBI_EMBED_LIMITS,
  ORBI_EMBED_SECTION_KEYS,
  customSectionKey,
  sanitizeEmbedSections,
  sectionForAction,
} from './orbiEmbedSections.js'
import { ORBI_ACTION_LABELS, ORBI_ACTION_TARGETS } from './orbiAsk.js'
import { guidePanelSize, ORBI_GUIDE_ITEMS } from './orbiGuideConfig.js'

/* ── The frame's half ─────────────────────────────────────────────────── */

test('custom labels come through under the customer’s names', () => {
  const sections = sanitizeEmbedSections([
    { key: 'services', label: 'What We Do' },
    { key: 'contact', label: 'Get In Touch' },
  ])
  assert.deepEqual(sections, [
    { key: 'services', label: 'What We Do' },
    { key: 'contact', label: 'Get In Touch' },
  ])
  assert.deepEqual(embedGuideItems(sections), [
    { id: 'services', label: 'What We Do', target: 'services' },
    { id: 'contact', label: 'Get In Touch', target: 'contact' },
  ])
  const labels = embedActionLabels(sections)
  assert.equal(labels.SHOW_SERVICES, 'What We Do')
  assert.equal(labels.SHOW_CONTACT, 'Get In Touch')
  // Not configured → no button, rather than a Calibur Labs label.
  assert.equal(labels.SHOW_ABOUT, undefined)
  assert.equal(labels.SHOW_PROJECTS, undefined)
})

test('the menu keeps one order, whatever order the customer wrote', () => {
  const sections = sanitizeEmbedSections([
    { key: 'contact', label: 'Contact' },
    { key: 'about', label: 'About' },
    { key: 'services', label: 'Services' },
  ])
  assert.deepEqual(sections.map((s) => s.key), ['services', 'about', 'contact'])
})

test('an unknown section is dropped, and only it', () => {
  const sections = sanitizeEmbedSections([
    { key: 'pricing', label: 'Pricing' },
    { key: '__proto__', label: 'Proto' },
    { key: 'about', label: 'About Us' },
  ])
  assert.deepEqual(sections, [{ key: 'about', label: 'About Us' }])
})

test('custom sections follow the five, in the order written, with no action', () => {
  const sections = sanitizeEmbedSections([
    { key: 'custom-pricing', label: 'Our Prices' },
    { key: 'contact', label: 'Contact' },
    { key: 'custom-faq', label: 'FAQ' },
    { key: 'custom-', label: 'Empty slug' },
    { key: 'custom-Bad Key', label: 'Bad' },
  ])
  assert.deepEqual(sections.map((s) => s.key), ['contact', 'custom-pricing', 'custom-faq'])
  assert.deepEqual(Object.keys(embedActionLabels(sections)), ['SHOW_CONTACT'])
  const many = Array.from({ length: 15 }, (_, i) => ({ key: `custom-s${i}`, label: `S${i}` }))
  assert.equal(sanitizeEmbedSections(many).length, ORBI_EMBED_LIMITS.customMax)
})

test('a section name becomes a custom key', () => {
  assert.equal(customSectionKey('Pricing'), 'custom-pricing')
  assert.equal(customSectionKey('  Our Team & Culture! '), 'custom-our-team-culture')
  assert.equal(customSectionKey('!!!'), '')
})

test('missing sections are simply not offered', () => {
  const sections = sanitizeEmbedSections([{ key: 'work', label: 'Our Projects' }])
  assert.equal(sections.length, 1)
  assert.equal(embedGuideItems(sections).length, 1)
  assert.deepEqual(Object.keys(embedActionLabels(sections)), ['SHOW_PROJECTS'])
})

test('anything malformed is dropped without throwing', () => {
  for (const raw of [undefined, null, 42, 'services', {}, { services: 'x' }, [null, 7, 'x']]) {
    assert.deepEqual(sanitizeEmbedSections(raw), [], `${JSON.stringify(raw)}`)
  }
  const sections = sanitizeEmbedSections([
    { key: 'services', label: 42 },
    { key: 'work', label: '   ' },
    { key: 'about', label: 'x'.repeat(ORBI_EMBED_LIMITS.labelMax + 1) },
    { key: 'contact' },
    { key: 'testimonials', label: 'Kind Words' },
  ])
  assert.deepEqual(sections, [{ key: 'testimonials', label: 'Kind Words' }])
})

test('labels lose control characters and duplicates keep the first', () => {
  const sections = sanitizeEmbedSections([
    { key: 'services', label: '  What\u0000 We\u001F Do\u007F ' },
    { key: 'services', label: 'Second' },
  ])
  assert.deepEqual(sections, [{ key: 'services', label: 'What We Do' }])
})

test('default configuration offers nothing and names nothing', () => {
  const sections = sanitizeEmbedSections(undefined)
  assert.deepEqual(embedGuideItems(sections), [])
  assert.deepEqual(embedActionLabels(sections), {})
})

test('every action names a section key, and NO_ACTION names none', () => {
  for (const [action, target] of Object.entries(ORBI_ACTION_TARGETS)) {
    assert.equal(sectionForAction(action as keyof typeof ORBI_ACTION_TARGETS), target)
    assert.ok(ORBI_EMBED_SECTION_KEYS.includes(target), `${target} is not an embed key`)
  }
  assert.equal(sectionForAction('NO_ACTION'), null)
})

/* ── Calibur Labs regression ──────────────────────────────────────────── */

test('the site’s own guide menu is untouched', () => {
  assert.deepEqual(
    ORBI_GUIDE_ITEMS.map((i) => [i.id, i.label, i.target]),
    [
      ['services', 'Our Services', 'services'],
      ['projects', 'Our Work', 'work'],
      ['testimonials', 'Client Stories', 'testimonials'],
      ['about', 'About Calibur', 'about'],
      ['contact', 'Let’s Talk', 'contact'],
    ],
  )
  // The embed keys are exactly the site's destinations — nothing new to map.
  assert.deepEqual(
    [...ORBI_GUIDE_ITEMS.map((i) => i.target)].sort(),
    [...ORBI_EMBED_SECTION_KEYS].sort(),
  )
  // Sized from the list now; the site's list gives the size it always had.
  for (const bp of ['desktop', 'tablet', 'mobile'] as const) {
    assert.deepEqual(guidePanelSize(bp, ORBI_GUIDE_ITEMS.length), guidePanelSize(bp))
  }
  assert.equal(ORBI_ACTION_LABELS.SHOW_SERVICES, 'View Services')
})

/* ── The page's half: the real embed.js ───────────────────────────────── */

const ORIGIN = 'https://www.caliburlabz.com'
const EMBED_SOURCE = readFileSync(resolve(process.cwd(), 'public/orbi/embed.js'), 'utf8')

interface Posted { message: { type: string; sections?: unknown }; origin: string }

const SITE_ID = 'orbi_abcdefghij0123456789'

/** What the fake `/api/orbi/authorize` answers: a JSON body, a status, or a network error. */
type AuthorizeAnswer = { status?: number; body?: unknown } | 'network-error'

interface EmbedOptions {
  reducedMotion?: boolean
  /** `data-orbi-site`; null leaves the attribute off. */
  siteId?: string | null
  authorize?: AuthorizeAnswer
}

/**
 * A page with a few elements, one ORBI script tag, and nothing else. `#broken`
 * stands in for a selector the browser rejects. Async because the iframe now
 * appears only after the authorization request resolves.
 */
async function runEmbed(attribute: string | null, options: EmbedOptions = {}) {
  const siteId = options.siteId === undefined ? SITE_ID : options.siteId
  const answer: AuthorizeAnswer = options.authorize ?? { body: { authorized: true, token: 'v1.test.token' } }
  const scrolled: Array<{ selector: string; options: unknown }> = []
  const elements = new Map(
    ['#services', '#company', '#portfolio', '#contact'].map((selector) => [
      selector,
      {
        scrollIntoView: (opts: unknown) =>
          scrolled.push({ selector, options: JSON.parse(JSON.stringify(opts)) }),
      },
    ]),
  )
  const posted: Posted[] = []
  const appended: unknown[] = []
  const removed: unknown[] = []
  const requests: Array<{ url: string; init: Record<string, unknown> }> = []
  const frameListeners: Record<string, () => void> = {}
  let onMessage: ((event: unknown) => void) | null = null

  const contentWindow = {
    // Copied out of the sandbox the way `postMessage` clones: plain data, this realm.
    postMessage: (message: Posted['message'], origin: string) =>
      posted.push({ message: JSON.parse(JSON.stringify(message)), origin }),
  }
  const body = {
    appendChild: (node: unknown) => appended.push(node),
    removeChild: (node: unknown) => removed.push(node),
  }
  const frame = {
    style: {} as Record<string, string>,
    src: '',
    title: '',
    contentWindow,
    parentNode: body,
    setAttribute: () => {},
    addEventListener: (type: string, fn: () => void) => {
      frameListeners[type] = fn
    },
  }
  const document = {
    currentScript: {
      src: `${ORIGIN}/orbi/embed.js`,
      getAttribute: (name: string) =>
        name === 'data-orbi-sections' ? attribute : name === 'data-orbi-site' ? siteId : null,
    },
    body,
    createElement: () => frame,
    addEventListener: () => {},
    querySelector: (selector: string) => {
      if (selector.includes('!!')) throw new SyntaxError(`'${selector}' is not a valid selector`)
      return elements.get(selector) ?? null
    },
  }
  const sandbox: Record<string, unknown> = {
    document,
    URL,
    console: { warn: () => {} },
    setInterval: () => 1,
    clearInterval: () => {},
    fetch: (url: string, init: Record<string, unknown>) => {
      requests.push({ url, init: JSON.parse(JSON.stringify(init)) })
      if (answer === 'network-error') return Promise.reject(new TypeError('Failed to fetch'))
      const status = answer.status ?? 200
      return Promise.resolve({
        ok: status >= 200 && status < 300,
        json: () =>
          typeof answer.body === 'string' ? Promise.reject(new SyntaxError('bad json')) : Promise.resolve(answer.body),
      })
    },
    matchMedia: (query: string) => ({
      matches: query.includes('reduced-motion') ? Boolean(options.reducedMotion) : false,
    }),
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      if (type === 'message') onMessage = fn
    },
  }
  sandbox.window = sandbox
  vm.runInContext(EMBED_SOURCE, vm.createContext(sandbox))
  // Let the authorization request settle, then the iframe "loads".
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve))
  frameListeners.load?.()

  return {
    appended,
    removed,
    requests,
    scrolled,
    frameSrc: () => frame.src,
    hello: posted.find((p) => p.message.type === 'orbi:hello'),
    /** A message as if the ORBI frame sent it. */
    fromFrame: (data: unknown, overrides: { origin?: string; source?: unknown } = {}) =>
      onMessage?.({ source: contentWindow, origin: ORIGIN, data, ...overrides }),
  }
}

const CUSTOMER = JSON.stringify({
  about: { label: 'About Us', selector: '#company' },
  services: { label: 'What We Do', selector: '#services' },
  work: { label: 'Our Projects', selector: '#portfolio' },
  contact: { label: 'Get In Touch', selector: '#contact' },
})

test('embed.js: custom sections reach the frame as names only', async () => {
  const page = await runEmbed(CUSTOMER)
  assert.equal(page.appended.length, 1)
  assert.equal(page.hello?.origin, ORIGIN)
  assert.deepEqual(page.hello?.message.sections, [
    { key: 'services', label: 'What We Do' },
    { key: 'work', label: 'Our Projects' },
    { key: 'about', label: 'About Us' },
    { key: 'contact', label: 'Get In Touch' },
  ])
  assert.ok(!JSON.stringify(page.hello).includes('#'), 'a selector left the page')
})

test('embed.js: navigating scrolls to the customer’s own selector', async () => {
  const page = await runEmbed(CUSTOMER)
  page.fromFrame({ type: 'orbi:navigate', section: 'services' })
  page.fromFrame({ type: 'orbi:navigate', section: 'about' })
  assert.deepEqual(page.scrolled, [
    { selector: '#services', options: { behavior: 'smooth', block: 'start' } },
    { selector: '#company', options: { behavior: 'smooth', block: 'start' } },
  ])
})

test('embed.js: reduced motion jumps instead of gliding', async () => {
  const page = await runEmbed(CUSTOMER, { reducedMotion: true })
  page.fromFrame({ type: 'orbi:navigate', section: 'contact' })
  assert.deepEqual(page.scrolled, [
    { selector: '#contact', options: { behavior: 'auto', block: 'start' } },
  ])
})

test('embed.js: a selector with nothing behind it does nothing', async () => {
  const page = await runEmbed(
    JSON.stringify({ testimonials: { label: 'Reviews', selector: '#reviews' } }),
  )
  assert.deepEqual(page.hello?.message.sections, [{ key: 'testimonials', label: 'Reviews' }])
  assert.doesNotThrow(() => page.fromFrame({ type: 'orbi:navigate', section: 'testimonials' }))
  assert.deepEqual(page.scrolled, [])
})

test('embed.js: unknown and unconfigured sections go nowhere', async () => {
  const page = await runEmbed(
    JSON.stringify({
      services: { label: 'What We Do', selector: '#services' },
      pricing: { label: 'Pricing', selector: '#contact' },
    }),
  )
  assert.deepEqual(page.hello?.message.sections, [{ key: 'services', label: 'What We Do' }])
  for (const section of ['pricing', 'contact', 'constructor', '__proto__', 42, null]) {
    page.fromFrame({ type: 'orbi:navigate', section })
  }
  assert.deepEqual(page.scrolled, [])
})

test('embed.js: custom sections are offered after the five and scroll the page', async () => {
  const page = await runEmbed(
    JSON.stringify({
      'custom-work-with-us': { label: 'Careers', selector: '#portfolio' },
      services: { label: 'What We Do', selector: '#services' },
    }),
  )
  assert.deepEqual(page.hello?.message.sections, [
    { key: 'services', label: 'What We Do' },
    { key: 'custom-work-with-us', label: 'Careers' },
  ])
  page.fromFrame({ type: 'orbi:navigate', section: 'custom-work-with-us' })
  assert.deepEqual(page.scrolled, [
    { selector: '#portfolio', options: { behavior: 'smooth', block: 'start' } },
  ])
})

test('embed.js: malformed configuration still installs ORBI, with no sections', async () => {
  for (const attribute of [
    '{"services": {"label": "What We Do", "selector": "#services"',
    'alert(1)',
    '[1, 2, 3]',
    '"services"',
    'null',
    '',
  ]) {
    const page = await runEmbed(attribute)
    assert.equal(page.appended.length, 1, attribute)
    assert.deepEqual(page.hello?.message.sections, [], attribute)
  }
})

test('embed.js: no attribute means the default — ORBI with no sections', async () => {
  const page = await runEmbed(null)
  assert.equal(page.appended.length, 1)
  assert.deepEqual(page.hello?.message.sections, [])
})

test('embed.js: bad entries are dropped one at a time', async () => {
  const page = await runEmbed(
    JSON.stringify({
      services: { label: 'What We Do', selector: 'div!!bad' },
      work: { label: 'Our Projects', selector: 42 },
      about: { label: '', selector: '#company' },
      testimonials: { label: 'x'.repeat(41), selector: '#services' },
      contact: { label: 'Get In Touch', selector: '#contact' },
    }),
  )
  assert.deepEqual(page.hello?.message.sections, [{ key: 'contact', label: 'Get In Touch' }])
})

test('embed.js: only the ORBI frame, from ORBI’s origin, is listened to', async () => {
  const page = await runEmbed(CUSTOMER)
  page.fromFrame({ type: 'orbi:navigate', section: 'services' }, { origin: 'https://evil.example' })
  page.fromFrame({ type: 'orbi:navigate', section: 'services' }, { source: {} })
  assert.deepEqual(page.scrolled, [])
})

/* ── embed.js: authorization before anything appears ─────────────────── */

test('embed.js: an authorized site gets its iframe, and the token rides the hello', async () => {
  const page = await runEmbed(CUSTOMER)
  assert.equal(page.requests.length, 1)
  const [request] = page.requests
  assert.equal(request.url, `${ORIGIN}/api/orbi/authorize`)
  assert.equal(request.init.method, 'POST')
  assert.equal(request.init.credentials, 'omit')
  // The body names the site and nothing else — never an origin.
  assert.deepEqual(JSON.parse(String(request.init.body)), { siteId: SITE_ID })
  assert.equal(page.appended.length, 1)
  assert.match(page.frameSrc(), /^https:\/\/www\.caliburlabz\.com\/orbi\/frame\?bp=(desktop|tablet|mobile)$/)
  assert.equal(page.hello?.origin, ORIGIN)
  assert.equal((page.hello?.message as { token?: string }).token, 'v1.test.token')
})

test('embed.js: an unauthorized site gets no iframe', async () => {
  const page = await runEmbed(CUSTOMER, { authorize: { body: { authorized: false } } })
  assert.equal(page.appended.length, 0)
  assert.equal(page.hello, undefined)
})

test('embed.js: a missing or malformed site id never even asks', async () => {
  for (const siteId of [null, '', 'orbi_short', 'ORBI_ABCDEFGHIJ0123456789', 'orbi_abcdefghij0123456789"><script>', '<script>']) {
    const page = await runEmbed(CUSTOMER, { siteId })
    assert.equal(page.requests.length, 0, String(siteId))
    assert.equal(page.appended.length, 0, String(siteId))
  }
})

test('embed.js: anything but an explicit yes with a token fails closed', async () => {
  const answers: AuthorizeAnswer[] = [
    'network-error',
    { status: 500, body: { authorized: true, token: 'x' } },
    { status: 429, body: { authorized: false } },
    { body: 'not json' },
    { body: null },
    { body: { authorized: 'true', token: 'x' } },
    { body: { authorized: 1, token: 'x' } },
    { body: { authorized: true } },
    { body: { authorized: true, token: 42 } },
    { body: { authorized: true, token: '' } },
    { body: { authorized: true, token: 'x'.repeat(2000) } },
  ]
  for (const answer of answers) {
    const page = await runEmbed(CUSTOMER, { authorize: answer })
    assert.equal(page.appended.length, 0, JSON.stringify(answer))
  }
})

test('embed.js: a frame that refuses the token takes the iframe away', async () => {
  const page = await runEmbed(CUSTOMER)
  page.fromFrame({ type: 'orbi:denied' })
  assert.equal(page.removed.length, 1)
})

test('embed.js: a denial from anyone but the ORBI frame is ignored', async () => {
  const page = await runEmbed(CUSTOMER)
  page.fromFrame({ type: 'orbi:denied' }, { origin: 'https://evil.example' })
  page.fromFrame({ type: 'orbi:denied' }, { source: {} })
  assert.equal(page.removed.length, 0)
})

test('embed.js: no eval, no Function, no HTML injection', () => {
  for (const banned of ['eval(', 'new Function', 'innerHTML', 'outerHTML', 'document.write', 'insertAdjacentHTML', "'*'", '"*"']) {
    assert.ok(!EMBED_SOURCE.includes(banned), `embed.js contains ${banned}`)
  }
})
