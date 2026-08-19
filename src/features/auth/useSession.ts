import { useSyncExternalStore } from 'react'

import { getSession, subscribe, type Session } from '@/api/session'

/**
 * Reads the session from the module that owns it. `useSyncExternalStore` keeps React in step
 * with a store the network layer can update outside of any render — which is exactly what a
 * background token refresh does.
 */
export function useSession(): Session | null {
  return useSyncExternalStore(subscribe, getSession, () => null)
}

export function useIsAdmin(): boolean {
  const session = useSession()
  return session?.roles.includes('Admin') ?? false
}

/**
 * The caller's own employee id, which the API requires in `empId` and `uploadedByEmpId`.
 * Sending anything else is a 403, so no screen should ever source it from elsewhere.
 */
export function useCurrentEmployeeId(): number | null {
  const session = useSession()
  if (!session) return null

  const raw = session.employee.id
  return typeof raw === 'number' ? raw : Number(raw)
}
