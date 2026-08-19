import { normalizeCurrency } from './currency'

/**
 * Document vocabulary and metadata validation, kept out of `db.ts` so the
 * admin UI can import the lists without pulling the database driver into the
 * client bundle.
 */
export const DOCUMENT_KINDS = [
  'quotation',
  'invoice',
  'template',
  'contract',
  'receipt',
  'other',
] as const

export type DocumentKind = (typeof DOCUMENT_KINDS)[number]

export const DOCUMENT_KIND_LABELS: Record<DocumentKind, string> = {
  quotation: 'Quotation',
  invoice: 'Invoice',
  template: 'Template',
  contract: 'Contract',
  receipt: 'Receipt',
  other: 'Other',
}

export const DOCUMENT_STATUSES = ['active', 'draft', 'sent', 'paid', 'archived'] as const

export type ParsedDocumentFields = {
  title: string
  kind: DocumentKind
  projectId: number | null
  client: string | null
  amount: number | null
  currency: string
  issuedOn: string | null
  status: string
  notes: string | null
}

/** Shared by the create and update routes — same rules for both. */
export function parseDocumentFields(
  body: Record<string, unknown>
): ParsedDocumentFields | { error: string } {
  const title = String(body.title ?? '').trim()
  if (!title) return { error: 'Title is required' }

  const kind = String(body.kind ?? 'other') as DocumentKind
  if (!DOCUMENT_KINDS.includes(kind)) return { error: 'Invalid document type' }

  const projectId =
    body.project_id === '' || body.project_id == null ? null : Number(body.project_id)
  if (projectId != null && !Number.isInteger(projectId)) return { error: 'Invalid project_id' }

  const amount = body.amount === '' || body.amount == null ? null : Number(body.amount)
  if (amount != null && !Number.isFinite(amount)) return { error: 'Amount must be a number' }

  const status = String(body.status ?? '')

  return {
    title: title.slice(0, 200),
    kind,
    projectId,
    client: body.client ? String(body.client).trim().slice(0, 160) : null,
    amount,
    currency: normalizeCurrency(body.currency),
    issuedOn: body.issued_on ? String(body.issued_on) : null,
    status: (DOCUMENT_STATUSES as readonly string[]).includes(status) ? status : 'active',
    notes: body.notes ? String(body.notes).trim() : null,
  }
}

/**
 * Build a safe blob pathname. Everything is filed under `documents/<kind>/`,
 * with the original name reduced to ASCII-ish characters — the random suffix
 * Blob adds keeps collisions impossible.
 */
export function documentPathname(kind: string, fileName: string): string {
  const safe = fileName
    .normalize('NFKD')
    .replace(/[^\w.\- ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(-120)
  return `documents/${kind}/${safe || 'file'}`
}
