import { ensureSchema, sql } from '@/lib/db'
import { generateSiteId, type OrbiSite, type OrbiSiteInput } from './orbiSites'

/**
 * `orbi_sites`, through the same Neon client and `ensureSchema()` as the rest
 * of the console. All values are parameterised by the tagged template.
 */

/**
 * Development only: `ORBI_SITES_FIXTURE=/path/sites.json next dev` answers the
 * *read* paths from a file, so the embed can be exercised end to end without
 * touching the database. `NODE_ENV` is inlined as "production" by `next build`,
 * so in a deployed build this is always null — there is no switch to flip.
 */
async function devFixture(): Promise<OrbiSite[] | null> {
  if (process.env.NODE_ENV !== 'development') return null
  const path = process.env.ORBI_SITES_FIXTURE
  if (!path) return null
  const { readFile } = await import('node:fs/promises')
  return JSON.parse(await readFile(path, 'utf8')) as OrbiSite[]
}

export async function findSiteBySiteId(siteId: string): Promise<OrbiSite | null> {
  const fixture = await devFixture()
  if (fixture) return fixture.find((site) => site.site_id === siteId) ?? null
  await ensureSchema()
  const [site] = (await sql`SELECT id, site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on::text AS expires_on, created_at, updated_at FROM orbi_sites WHERE site_id = ${siteId}`) as OrbiSite[]
  return site ?? null
}

export async function listSites(): Promise<OrbiSite[]> {
  const fixture = await devFixture()
  if (fixture) return fixture
  await ensureSchema()
  return (await sql`SELECT id, site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on::text AS expires_on, created_at, updated_at FROM orbi_sites ORDER BY created_at DESC`) as OrbiSite[]
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: unknown })?.code === '23505'
}

export async function createSite(input: OrbiSiteInput): Promise<OrbiSite> {
  await ensureSchema()
  // A collision in ~103 bits is not going to happen; if it ever does, draw again.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [site] = (await sql`
        INSERT INTO orbi_sites
          (site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on)
        VALUES (
          ${generateSiteId()}, ${input.customer_name}, ${input.allowed_origins}::text[],
          ${input.plan}, ${input.status}, ${input.sections_config}, ${input.expires_on}::date
        )
        RETURNING id, site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on::text AS expires_on, created_at, updated_at
      `) as OrbiSite[]
      return site
    } catch (error) {
      if (!isUniqueViolation(error) || attempt === 2) throw error
    }
  }
  throw new Error('Could not allocate a site id')
}

/** Merge-and-write: only the fields given change. Null when there is no such site. */
export async function updateSite(id: number, changes: Partial<OrbiSiteInput>): Promise<OrbiSite | null> {
  await ensureSchema()
  const [current] = (await sql`SELECT id, site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on::text AS expires_on, created_at, updated_at FROM orbi_sites WHERE id = ${id}`) as OrbiSite[]
  if (!current) return null
  const next = { ...current, ...changes }
  const [site] = (await sql`
    UPDATE orbi_sites
    SET customer_name = ${next.customer_name}, allowed_origins = ${next.allowed_origins}::text[],
        plan = ${next.plan}, status = ${next.status}, sections_config = ${next.sections_config},
        expires_on = ${next.expires_on}::date, updated_at = now()
    WHERE id = ${id}
    RETURNING id, site_id, customer_name, allowed_origins, plan, status, sections_config, expires_on::text AS expires_on, created_at, updated_at
  `) as OrbiSite[]
  return site ?? null
}

export async function deleteSite(id: number): Promise<boolean> {
  await ensureSchema()
  const rows = (await sql`DELETE FROM orbi_sites WHERE id = ${id} RETURNING id`) as { id: number }[]
  return rows.length > 0
}
