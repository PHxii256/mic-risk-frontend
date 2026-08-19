import { useTranslation } from 'react-i18next'

import { LOCALE_LABELS, LOCALES, type Locale } from '@/i18n'
import { cn } from '@/lib/utils'

export function LocaleSwitch({ className }: { className?: string }) {
  const { i18n, t } = useTranslation()
  const active = (i18n.resolvedLanguage ?? 'en') as Locale

  return (
    <div
      className={cn('inline-flex rounded-sm border border-border-strong', className)}
      role="group"
      aria-label={t('nav.language')}
    >
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={locale === active}
          onClick={() => void i18n.changeLanguage(locale)}
          className={cn(
            'px-2 py-0.5 text-xs font-medium transition-colors',
            'first:rounded-s-sm last:rounded-e-sm',
            locale === active
              ? 'bg-accent text-accent-ink'
              : 'text-ink-muted hover:bg-surface-muted',
          )}
        >
          {LOCALE_LABELS[locale]}
        </button>
      ))}
    </div>
  )
}
