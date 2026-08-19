/**
 * Formatting always goes through Intl with the active locale, so Arabic gets its own month
 * names and ordering for free. Numerals stay Western in both locales: the `latn` numbering
 * system is what regional business software uses, and mixed-script tables are harder to scan.
 */
const NUMBER_LOCALE: Record<string, string> = {
  ar: 'ar-u-nu-latn',
  en: 'en',
}

function resolve(locale: string): string {
  return NUMBER_LOCALE[locale] ?? locale
}

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(resolve(locale)).format(value)
}

export function formatDate(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(resolve(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(value)
}

export function formatDateTime(value: Date, locale: string): string {
  return new Intl.DateTimeFormat(resolve(locale), {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(value)
}
