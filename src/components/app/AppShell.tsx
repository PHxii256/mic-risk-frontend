import { KeyRound, LogOut } from 'lucide-react'
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

  // Admins have a dashboard to come home to; everyone else has their own reports.
  const home = isAdmin ? '/admin' : '/reports'

  async function signOut() {
    await endSession()
    void navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:m-2 focus:rounded-sm focus:bg-surface focus:px-3 focus:py-1.5 focus:text-sm"
      >
        {t('nav.skipToContent')}
      </a>

      <header className="border-b border-border-subtle bg-surface">
        <div className="mx-auto flex min-h-12 max-w-7xl flex-wrap items-center gap-x-5 gap-y-1 px-4 py-1.5">
          <NavLink to={home} className="text-sm font-semibold text-ink hover:text-accent">
            {t('app.name')}
          </NavLink>

          <nav className="flex flex-wrap items-center gap-0.5" aria-label={t('app.tagline')}>
            {/* Employees have nowhere else to go home to, so Home is an admin affordance. */}
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

          <div className="ms-auto flex items-center gap-3">
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
                  {t('account.resetPasswordLink')}
                </NavLink>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className="inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
                >
                  <LogOut className="size-3.5" aria-hidden="true" />
                  {t('nav.signOut')}
                </button>
              </>
            ) : null}
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  )
}

function ShellLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      end
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
