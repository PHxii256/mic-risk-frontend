import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, Outlet } from 'react-router'

import { restoreSession } from '@/api/session'
import { Spinner } from '@/components/ui/primitives'
import { useIsAdmin, useSession } from '@/features/auth/useSession'

/**
 * Nothing authenticated renders until the refresh attempt settles.
 *
 * The access token lives only in memory, so on a reload there is briefly no session even for a
 * signed-in user. Rendering the guard before that resolves would bounce them to the login screen
 * and straight back, which reads as a bug.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [restored, setRestored] = useState(false)

  useEffect(() => {
    let cancelled = false

    void restoreSession().finally(() => {
      if (!cancelled) setRestored(true)
    })

    return () => {
      cancelled = true
    }
  }, [])

  if (!restored) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-ink-muted">
        <span className="inline-flex items-center gap-2 text-sm">
          <Spinner />
          {t('state.loading')}
        </span>
      </div>
    )
  }

  return <>{children}</>
}

export function RequireSession() {
  const session = useSession()
  if (!session) return <Navigate to="/login" replace />
  return <Outlet />
}

/** Keeps admin screens out of the navigation history for non-admins. The API enforces it too. */
export function RequireAdmin() {
  const isAdmin = useIsAdmin()
  if (!isAdmin) return <Navigate to="/reports" replace />
  return <Outlet />
}

export function RedirectIfSignedIn() {
  const session = useSession()
  const isAdmin = useIsAdmin()
  if (session) return <Navigate to={isAdmin ? '/admin' : '/reports'} replace />
  return <Outlet />
}

/** Admins land on the dashboard; everyone else goes straight to their own reports. */
export function HomeRedirect() {
  const isAdmin = useIsAdmin()
  return <Navigate to={isAdmin ? '/admin' : '/reports'} replace />
}

export function Root() {
  return (
    <SessionGate>
      <Outlet />
    </SessionGate>
  )
}
