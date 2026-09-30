import { ORBI_ACTION_TARGETS, type OrbiAskAction } from './orbiAsk'
import type { OrbiGuideItem } from './orbiGuideConfig'

/**
 * ORBI embedded on a customer's website: *their* sections, under *their* names.
 *
 * The customer names up to five sections on the script tag:
 *
 *   <script src=".../orbi/embed.js"
 *     data-orbi-sections='{"services":{"label":"What We Do","selector":"#services"}}'
 *     defer></script>
 *
 * The keys are the five destinations ORBI already knows how to offer — the
 * same ids `ORBI_ACTION_TARGETS` maps the model's actions to — so an answer's
 * `SHOW_SERVICES` still lands on "services", whatever the customer calls it.
 *
 * Only `{ key, label }` ever reaches the frame. The selectors stay on the
 * customer's page with `embed.js`, which is the only thing that can scroll it:
 * the frame asks for a key, the page looks up its own selector. Everything
 * here is the frame's half, and it trusts nothing the parent sends it.
 *
 * `public/orbi/embed.js` applies the same rules to the attribute itself; it is
 * plain JavaScript with no build step, so the limits are repeated there.
 */

/** Every key a customer may configure, in the order the menu offers them. */
export const ORBI_EMBED_SECTION_KEYS: readonly string[] = [
  'services',
  'work',
  'testimonials',
  'about',
  'contact',
]

export const ORBI_EMBED_LIMITS = {
  /** Long enough for "Frequently Asked Questions", short enough for the menu. */
  labelMax: 40,
  /** Extra sections a customer may add beyond the five above. */
  customMax: 10,
} as const

/**
 * A customer's own section ("Pricing", "FAQ"…): `custom-` plus a lowercase
 * slug. The prefix keeps it clear of the five keys ORBI's answers point at and
 * of anything on `Object.prototype`. Menu-only — no answer action leads there.
 */
export const ORBI_EMBED_CUSTOM_KEY = /^custom-[a-z0-9]+(?:-[a-z0-9]+)*$/
export const ORBI_EMBED_KEY_MAX = 48

export function isCustomSectionKey(key: string): boolean {
  return key.length <= ORBI_EMBED_KEY_MAX && ORBI_EMBED_CUSTOM_KEY.test(key)
}

/** A section name → its custom key ('' when nothing usable is left). */
export function customSectionKey(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, ORBI_EMBED_KEY_MAX - 'custom-'.length)
    .replace(/-+$/, '')
  return slug ? `custom-${slug}` : ''
}

export interface OrbiEmbedSection {
  key: string
  label: string
}

// Built from a string so the control-character range never sits in source.
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001F\\u007F]', 'g')

function cleanLabel(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const label = value.replace(CONTROL_CHARS, '').trim()
  if (!label || label.length > ORBI_EMBED_LIMITS.labelMax) return null
  return label
}

/**
 * Whatever the parent sent → a list the menu can render.
 *
 * Unknown keys, duplicates, and any entry without a usable label are dropped
 * one at a time; anything that is not a list at all is no sections. Never
 * throws. The five known sections come first in `ORBI_EMBED_SECTION_KEYS`
 * order, then up to `customMax` custom ones in the order the customer wrote.
 */
export function sanitizeEmbedSections(raw: unknown): OrbiEmbedSection[] {
  if (!Array.isArray(raw)) return []
  const labels = new Map<string, string>()
  const custom: string[] = []
  for (const entry of raw.slice(0, 20)) {
    if (!entry || typeof entry !== 'object') continue
    const { key, label } = entry as { key?: unknown; label?: unknown }
    if (typeof key !== 'string' || labels.has(key)) continue
    const known = ORBI_EMBED_SECTION_KEYS.includes(key)
    if (!known && (!isCustomSectionKey(key) || custom.length >= ORBI_EMBED_LIMITS.customMax)) continue
    const clean = cleanLabel(label)
    if (!clean) continue
    labels.set(key, clean)
    if (!known) custom.push(key)
  }
  return [...ORBI_EMBED_SECTION_KEYS.filter((key) => labels.has(key)), ...custom].map((key) => ({
    key,
    label: labels.get(key)!,
  }))
}

/** The guide menu's items. `target` is the key, which is what the actions name. */
export function embedGuideItems(sections: readonly OrbiEmbedSection[]): OrbiGuideItem[] {
  return sections.map(({ key, label }) => ({ id: key, label, target: key }))
}

/** The section an action leads to. */
export function sectionForAction(action: OrbiAskAction): string | null {
  return action === 'NO_ACTION' ? null : ORBI_ACTION_TARGETS[action]
}

/**
 * The words under an answer, in the customer's language. An action whose
 * section they did not configure has no label, so it gets no button.
 */
export function embedActionLabels(
  sections: readonly OrbiEmbedSection[],
): Partial<Record<Exclude<OrbiAskAction, 'NO_ACTION'>, string>> {
  const byKey = new Map(sections.map((s) => [s.key, s.label]))
  const labels: Partial<Record<Exclude<OrbiAskAction, 'NO_ACTION'>, string>> = {}
  for (const action of Object.keys(ORBI_ACTION_TARGETS) as Array<
    Exclude<OrbiAskAction, 'NO_ACTION'>
  >) {
    const label = byKey.get(ORBI_ACTION_TARGETS[action])
    if (label) labels[action] = label
  }
  return labels
}
