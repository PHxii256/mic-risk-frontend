import i18n from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'

import ar from './locales/ar/common.json'
import en from './locales/en/common.json'

export const LOCALES = ['en', 'ar'] as const
export type Locale = (typeof LOCALES)[number]

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
}

const RTL_LOCALES: readonly Locale[] = ['ar']

export function isRtl(locale: string): boolean {
  return RTL_LOCALES.includes(locale as Locale)
}

export function direction(locale: string): 'rtl' | 'ltr' {
  return isRtl(locale) ? 'rtl' : 'ltr'
}

/**
 * Keeps the document in step with the active locale. `dir` drives every logical CSS property in
 * the app, and `lang` drives font selection and screen-reader pronunciation.
 */
function applyDocumentLocale(locale: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.documentElement.dir = direction(locale)
}

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      ar: { common: ar },
    },
    fallbackLng: 'en',
    supportedLngs: [...LOCALES],
    defaultNS: 'common',
    interpolation: {
      // React escapes for us; doing it twice mangles apostrophes in Arabic and English alike.
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'mic-locale',
    },
  })

applyDocumentLocale(i18n.resolvedLanguage ?? 'en')
i18n.on('languageChanged', applyDocumentLocale)

export default i18n
