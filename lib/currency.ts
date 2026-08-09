/**
 * Currency helpers shared by server routes (validation) and client UI
 * (display). Only two currencies are supported: USD and LKR.
 *
 * This module is framework-agnostic (no next/react imports) so it is safe to
 * import from both server and client code.
 */

export const CURRENCIES = ['USD', 'LKR'] as const
export type Currency = (typeof CURRENCIES)[number]

export const CURRENCY_SYMBOL: Record<Currency, string> = {
  USD: '$',
  LKR: 'Rs ',
}

export function isCurrency(value: unknown): value is Currency {
  return value === 'USD' || value === 'LKR'
}

/** Coerce arbitrary input to a supported currency, defaulting to USD. */
export function normalizeCurrency(value: unknown): Currency {
  return isCurrency(value) ? value : 'USD'
}

/** Format an amount with its currency symbol, e.g. "$1,200.00" / "Rs 45,000.00". */
export function money(
  amount: number | string | null | undefined,
  currency: unknown = 'USD'
): string {
  const cur = normalizeCurrency(currency)
  const value = Number(amount ?? 0)
  const formatted = (Number.isFinite(value) ? value : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  return `${CURRENCY_SYMBOL[cur]}${formatted}`
}
