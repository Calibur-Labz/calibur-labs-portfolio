import { ensureSchema, sql } from './db'

/**
 * Site-wide settings, stored as rows in the `settings` key/value table.
 *
 * Two things live here today:
 *  - `maintenance_mode` — when 'true', the public homepage shows the
 *    "sharpening our blade" maintenance screen instead of the site.
 *  - `emergency_phone`  — the number the maintenance screen's emergency
 *    contact button dials.
 *
 * The admin console reads/writes these through `/api/buddhima/settings`; the
 * public homepage reads them (server-side) via `readSiteSettingsSafe()`.
 */

export const MAINTENANCE_KEY = 'maintenance_mode'
export const EMERGENCY_PHONE_KEY = 'emergency_phone'

/** Falls back to the number published on the Contact section. */
export const DEFAULT_EMERGENCY_PHONE = '+94 76 58 31021'

export type SiteSettings = {
  maintenance: boolean
  emergencyPhone: string
}

type Row = { key: string; value: string }

/** Read the current settings, applying sensible defaults for missing rows. */
export async function getSiteSettings(): Promise<SiteSettings> {
  await ensureSchema()
  const rows = (await sql`
    SELECT key, value FROM settings
    WHERE key IN (${MAINTENANCE_KEY}, ${EMERGENCY_PHONE_KEY})
  `) as Row[]

  const map = new Map(rows.map((r) => [r.key, r.value]))
  const phone = map.get(EMERGENCY_PHONE_KEY)?.trim()

  return {
    maintenance: map.get(MAINTENANCE_KEY) === 'true',
    emergencyPhone: phone || DEFAULT_EMERGENCY_PHONE,
  }
}

/**
 * Read settings without ever throwing — used by the public homepage, where a
 * missing/unreachable database must not take the whole site down. On any error
 * we default to "live" (no maintenance) so the site keeps serving.
 */
export async function readSiteSettingsSafe(): Promise<SiteSettings> {
  try {
    return await getSiteSettings()
  } catch (error) {
    console.error('[settings] read failed, defaulting to live site:', error)
    return { maintenance: false, emergencyPhone: DEFAULT_EMERGENCY_PHONE }
  }
}

async function upsert(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, updated_at = now()
  `
}

/** Apply a partial update and return the full, current settings. */
export async function setSiteSettings(patch: Partial<SiteSettings>): Promise<SiteSettings> {
  await ensureSchema()
  if (patch.maintenance !== undefined) {
    await upsert(MAINTENANCE_KEY, patch.maintenance ? 'true' : 'false')
  }
  if (patch.emergencyPhone !== undefined) {
    await upsert(EMERGENCY_PHONE_KEY, patch.emergencyPhone.trim() || DEFAULT_EMERGENCY_PHONE)
  }
  return getSiteSettings()
}

/** Build a `tel:` href from a human-formatted phone number. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, '')}`
}
