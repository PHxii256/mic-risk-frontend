import { useState } from 'react'
import { KeyRound, LogOut, Menu, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, Outlet, useNavigate } from 'react-router'

import { endSession } from '@/api/session'
import { useIsAdmin, useSession } from '@/features/auth/useSession'
import { cn } from '@/lib/utils'

import { LocaleSwitch } from './LocaleSwitch'

export function AppShell() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const session = useSession()
  const isAdmin = useIsAdmin()
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  // Admins have a dashboard to come home to; everyone else has their own reports.
  const home = isAdmin ? '/admin' : '/reports'

  async function signOut() {
    await endSession()
    void navigate('/login', { replace: true })
  }

  const closeMobileMenu = () => setIsMobileMenuOpen(false)

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-1.5 focus:text-sm"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex min-h-12 max-w-7xl items-center px-6 py-2">
          {/* Brand + Desktop Navigation Grouped */}
          <div className="me-auto flex items-center gap-4">
            {/* Logo / Brand & Mobile Toggle */}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen((prev) => !prev)}
                className="rounded-sm p-1 text-ink-muted hover:bg-surface-muted hover:text-ink focus:outline-none md:hidden"
                aria-expanded={isMobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                {isMobileMenuOpen ? (
                  <X className="size-5" aria-hidden="true" />
                ) : (
                  <Menu className="size-5" aria-hidden="true" />
                )}
              </button>

              <NavLink
                to={home}
                className="flex items-center gap-2 text-sm font-semibold text-ink hover:text-accent"
              >
                <img src="src/assets/colored-mic.png" alt="logo" className="h-5 pt-[0.5px]" />
                {t('app.name')}
              </NavLink>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden gap-1 md:flex" aria-label={t('app.tagline')}>
              {isAdmin ? <ShellLink to="/admin">{t('nav.home')}</ShellLink> : null}

              <ShellLink to="/reports">{t('nav.myReports')}</ShellLink>
              <ShellLink to="/resources">{t('nav.resources')}</ShellLink>

              {isAdmin ? (
                <>
                  <ShellLink to="/admin/reports">{t('nav.allReports')}</ShellLink>
                  <ShellLink to="/admin/analytics">{t('nav.analytics')}</ShellLink>
                  <ShellLink to="/admin/employees">{t('nav.employees')}</ShellLink>
                  <ShellLink to="/admin/departments">{t('nav.departments')}</ShellLink>
                  <ShellLink to="/admin/taxonomy">{t('nav.taxonomy')}</ShellLink>
                </>
              ) : null}
            </nav>
          </div>

          {/* User Controls & Session Info */}
          <div className="flex items-center gap-3">
            <LocaleSwitch />

            {session ? (
              <>
                <span className="hidden text-xs text-ink-muted sm:inline">
                  {session.employee.name}
                </span>
                <NavLink
                  to="/account/password"
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                >
                  <KeyRound className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('account.resetPasswordLink')}</span>
                </NavLink>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">{t('nav.signOut')}</span>
                </button>
              </>
            ) : null}
          </div>
        </div>

        {/* Mobile Navigation Panel */}
        {isMobileMenuOpen && (
          <nav
            className="border-t border-border-subtle bg-surface px-6 py-3 md:hidden"
            aria-label={t('app.tagline')}
          >
            <div className="flex flex-col gap-1">
              {isAdmin ? (
                <ShellLink to="/admin" onClick={closeMobileMenu}>
                  {t('nav.home')}
                </ShellLink>
              ) : null}

              <ShellLink to="/reports" onClick={closeMobileMenu}>
                {t('nav.myReports')}
              </ShellLink>
              <ShellLink to="/resources" onClick={closeMobileMenu}>
                {t('nav.resources')}
              </ShellLink>

              {isAdmin ? (
                <>
                  <div className="my-1.5 border-t border-border-subtle" />
                  <ShellLink to="/admin/reports" onClick={closeMobileMenu}>
                    {t('nav.allReports')}
                  </ShellLink>
                  <ShellLink to="/admin/analytics" onClick={closeMobileMenu}>
                    {t('nav.analytics')}
                  </ShellLink>
                  <ShellLink to="/admin/employees" onClick={closeMobileMenu}>
                    {t('nav.employees')}
                  </ShellLink>
                  <ShellLink to="/admin/departments" onClick={closeMobileMenu}>
                    {t('nav.departments')}
                  </ShellLink>
                  <ShellLink to="/admin/taxonomy" onClick={closeMobileMenu}>
                    {t('nav.taxonomy')}
                  </ShellLink>
                </>
              ) : null}
            </div>
          </nav>
        )}
      </header>

      <main id="main" className="mx-auto max-w-7xl px-6 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function ShellLink({
  to,
  children,
  onClick,
}: {
  to: string
  children: React.ReactNode
  onClick?: () => void
}) {
  return (
    <NavLink
      to={to}
      end
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'rounded-sm px-2 py-1 text-sm transition-colors',
          isActive ? 'bg-surface-muted font-medium text-ink' : 'text-ink-muted hover:text-ink',
        )
      }
    >
      {children}
    </NavLink>
  )
}