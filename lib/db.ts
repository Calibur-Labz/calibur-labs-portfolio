import { neon } from '@neondatabase/serverless'
import { NextResponse } from 'next/server'
import type { DocumentKind } from './documents'

/**
 * Neon serverless Postgres client.
 *
 * The connection string is read from `DATABASE_URL`. On Vercel this is added
 * automatically when you create a Neon database from the Storage tab; locally
 * it lives in `.env.local` (see `.env.example`).
 */
type SqlClient = ReturnType<typeof neon>

// Build the Neon client lazily. Constructing it eagerly with a missing
// DATABASE_URL throws at module-evaluation time, which would break
// `next build` (page-data collection imports every route module).
let client: SqlClient | null = null

function getClient(): SqlClient {
  if (!client) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error(
        'DATABASE_URL is not set. Create a Neon database and add the connection string to your environment.'
      )
    }
    client = neon(connectionString)
  }
  return client
}

// `neon()` returns a tagged-template function that runs one SQL statement over
// HTTP — ideal for serverless. Values interpolated via `${}` are parameterised,
// so this is safe against SQL injection. This wrapper defers client creation to
// the first query so importing the module is always side-effect free.
export const sql: SqlClient = ((...args: Parameters<SqlClient>) =>
  getClient()(...args)) as unknown as SqlClient

let schemaReady: Promise<void> | null = null

/**
 * Idempotently create the tables this admin panel needs. Guarded by a
 * module-level promise so the DDL only runs once per warm server instance.
 */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS projects (
          id          SERIAL PRIMARY KEY,
          name        TEXT NOT NULL,
          client      TEXT,
          status      TEXT NOT NULL DEFAULT 'active',
          budget      NUMERIC(14, 2),
          currency    TEXT NOT NULL DEFAULT 'USD',
          notes       TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Migration: add the budget currency to projects created before it existed.
      await sql`ALTER TABLE projects ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'USD'`
      await sql`
        CREATE TABLE IF NOT EXISTS transactions (
          id           SERIAL PRIMARY KEY,
          kind         TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
          amount       NUMERIC(14, 2) NOT NULL,
          currency     TEXT NOT NULL DEFAULT 'USD',
          category     TEXT,
          note         TEXT,
          project_id   INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          occurred_on  DATE NOT NULL DEFAULT CURRENT_DATE,
          created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Domains & hosting, each optionally tied to a project.
      await sql`
        CREATE TABLE IF NOT EXISTS infra (
          id          SERIAL PRIMARY KEY,
          kind        TEXT NOT NULL CHECK (kind IN ('domain', 'hosting')),
          name        TEXT NOT NULL,
          provider    TEXT,
          project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          cost        NUMERIC(14, 2),
          currency    TEXT NOT NULL DEFAULT 'USD',
          renews_on   DATE,
          status      TEXT NOT NULL DEFAULT 'active',
          notes       TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Team members.
      await sql`
        CREATE TABLE IF NOT EXISTS team_members (
          id             SERIAL PRIMARY KEY,
          name           TEXT NOT NULL,
          role           TEXT,
          email          TEXT,
          phone          TEXT,
          status         TEXT NOT NULL DEFAULT 'active',
          bank_name      TEXT,
          account_name   TEXT,
          account_number TEXT,
          branch         TEXT,
          notes          TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Migration: add bank detail columns to team members created before they existed.
      await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS bank_name TEXT`
      await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS account_name TEXT`
      await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS account_number TEXT`
      await sql`ALTER TABLE team_members ADD COLUMN IF NOT EXISTS branch TEXT`
      // Salary payments to team members, related to a project.
      await sql`
        CREATE TABLE IF NOT EXISTS salaries (
          id          SERIAL PRIMARY KEY,
          member_id   INTEGER REFERENCES team_members(id) ON DELETE SET NULL,
          project_id  INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          amount      NUMERIC(14, 2) NOT NULL,
          currency    TEXT NOT NULL DEFAULT 'USD',
          paid_on     DATE NOT NULL DEFAULT CURRENT_DATE,
          note        TEXT,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Contact-form messages from the public site. Written by the public
      // `/api/contact` route, read only by the admin console.
      await sql`
        CREATE TABLE IF NOT EXISTS contact_messages (
          id          SERIAL PRIMARY KEY,
          name        TEXT NOT NULL,
          email       TEXT NOT NULL,
          company     TEXT,
          message     TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'read', 'archived')),
          read_at     TIMESTAMPTZ,
          created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      // Added after the table shipped, so existing databases need the column.
      await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS phone TEXT`
      // The pricing tier a visitor clicked "Get started" on, when the enquiry
      // came from the ORBI page rather than the homepage form.
      await sql`ALTER TABLE contact_messages ADD COLUMN IF NOT EXISTS package TEXT`
      // Unread lookups drive the console's notification badge.
      await sql`
        CREATE INDEX IF NOT EXISTS contact_messages_status_idx
        ON contact_messages (status, created_at DESC)
      `
      // Documents — quotations, invoices, templates and anything else worth
      // filing. The bytes live in Vercel Blob (private); this table holds the
      // metadata plus the blob pathname needed to read or delete them.
      await sql`
        CREATE TABLE IF NOT EXISTS documents (
          id             SERIAL PRIMARY KEY,
          title          TEXT NOT NULL,
          kind           TEXT NOT NULL DEFAULT 'other'
                         CHECK (kind IN ('quotation', 'invoice', 'template', 'contract', 'receipt', 'other')),
          project_id     INTEGER REFERENCES projects(id) ON DELETE SET NULL,
          client         TEXT,
          amount         NUMERIC(14, 2),
          currency       TEXT NOT NULL DEFAULT 'USD',
          issued_on      DATE,
          status         TEXT NOT NULL DEFAULT 'active',
          notes          TEXT,
          file_name      TEXT NOT NULL,
          file_pathname  TEXT NOT NULL,
          file_url       TEXT NOT NULL,
          file_size      BIGINT,
          file_type      TEXT,
          created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
      await sql`
        CREATE INDEX IF NOT EXISTS documents_kind_idx
        ON documents (kind, created_at DESC)
      `
      // Site-wide key/value settings (maintenance mode, emergency phone, …).
      await sql`
        CREATE TABLE IF NOT EXISTS settings (
          key         TEXT PRIMARY KEY,
          value       TEXT NOT NULL,
          updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `
    })().catch((err) => {
      // Reset so a later request can retry after a transient failure.
      schemaReady = null
      throw err
    })
  }
  return schemaReady
}

/**
 * Turn a database/connection error into a clean JSON response. A missing
 * DATABASE_URL becomes a 503 with a clear setup hint; anything else is a 500.
 */
export function dbErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : 'Database error'
  const isConfig = message.includes('DATABASE_URL')
  console.error('[db]', message)
  return NextResponse.json(
    { error: isConfig ? message : 'Database error. Please try again.' },
    { status: isConfig ? 503 : 500 }
  )
}

export type Project = {
  id: number
  name: string
  client: string | null
  status: string
  budget: number | null
  currency: string
  notes: string | null
  created_at: string
}

export type Transaction = {
  id: number
  kind: 'income' | 'expense'
  amount: number
  currency: string
  category: string | null
  note: string | null
  project_id: number | null
  occurred_on: string
  created_at: string
}

export type Infra = {
  id: number
  kind: 'domain' | 'hosting'
  name: string
  provider: string | null
  project_id: number | null
  cost: number | null
  currency: string
  renews_on: string | null
  status: string
  notes: string | null
  created_at: string
}

export type TeamMember = {
  id: number
  name: string
  role: string | null
  email: string | null
  phone: string | null
  status: string
  bank_name: string | null
  account_name: string | null
  account_number: string | null
  branch: string | null
  notes: string | null
  created_at: string
}

export type Salary = {
  id: number
  member_id: number | null
  project_id: number | null
  amount: number
  currency: string
  paid_on: string
  note: string | null
  created_at: string
}

export type ContactMessage = {
  id: number
  name: string
  email: string
  company: string | null
  phone: string | null
  package: string | null
  message: string
  status: 'new' | 'read' | 'archived'
  read_at: string | null
  created_at: string
}

export type Document = {
  id: number
  title: string
  kind: DocumentKind
  project_id: number | null
  client: string | null
  amount: number | null
  currency: string
  issued_on: string | null
  status: string
  notes: string | null
  file_name: string
  /** Blob pathname — what `get()`/`del()` address the object by. */
  file_pathname: string
  file_url: string
  file_size: number | null
  file_type: string | null
  created_at: string
}
