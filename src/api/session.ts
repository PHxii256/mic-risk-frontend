import type { components } from './schema'
import { toApiError } from './errors'

type AuthResponse = components['schemas']['AuthResponseDto']

/**
 * The live session. The access token is held here in memory and nowhere else — never in
 * localStorage or sessionStorage, where an XSS could read it. Survival across a page reload
 * comes from the HttpOnly refresh cookie, by calling `/refresh` on start-up.
 */
export interface Session {
  readonly accessToken: string
  readonly expiresAt: number
  readonly roles: readonly string[]
  readonly employee: AuthResponse['employee']
}

const REFRESH_LOCK = 'mic-refresh'

/** Refresh this long before expiry, so a request mid-form never fails and retries. */
const PROACTIVE_REFRESH_MARGIN_MS = 60_000

/** Treat a token this close to expiry as already gone, to cover clock drift and latency. */
const EXPIRY_GRACE_MS = 5_000

let session: Session | null = null
let inFlightRefresh: Promise<Session | null> | null = null
let proactiveTimer: ReturnType<typeof setTimeout> | null = null

const listeners = new Set<() => void>()

export function getSession(): Session | null {
  return session
}

export function isAuthenticated(): boolean {
  return session !== null
}

/** Subscribe to session changes. Shaped for `useSyncExternalStore`. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emit(): void {
  for (const listener of listeners) listener()
}

function tokenIsUsable(candidate: Session | null): candidate is Session {
  return candidate !== null && candidate.expiresAt - EXPIRY_GRACE_MS > Date.now()
}

export function setSession(next: Session | null): void {
  session = next
  scheduleProactiveRefresh()
  emit()
}

export function clearSession(): void {
  setSession(null)
}

export function fromAuthResponse(payload: AuthResponse): Session {
  return {
    accessToken: payload.accessToken,
    expiresAt: new Date(payload.accessTokenExpiresAt).getTime(),
    roles: payload.roles,
    employee: payload.employee,
  }
}

function scheduleProactiveRefresh(): void {
  if (proactiveTimer !== null) {
    clearTimeout(proactiveTimer)
    proactiveTimer = null
  }

  if (session === null) return

  const delay = session.expiresAt - PROACTIVE_REFRESH_MARGIN_MS - Date.now()
  proactiveTimer = setTimeout(
    () => {
      void refreshSession()
    },
    Math.max(delay, 0),
  )
}

/**
 * Exchanges the refresh cookie for a new access token.
 *
 * Deliberately a bare `fetch` rather than the generated client: this call must not carry an
 * Authorization header (the token it would carry is the expired one) and must not itself
 * trigger the 401-refresh path, or a failure would recurse.
 */
async function callRefreshEndpoint(): Promise<Session | null> {
  let response: Response

  try {
    response = await fetch(`${apiBaseUrl()}/api/account/refresh`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    })
  } catch {
    // Offline or the server is unreachable. Not an authentication failure, so the caller keeps
    // whatever session it had rather than being signed out by a flaky network.
    return null
  }

  if (!response.ok) {
    // 401 here means the refresh cookie is gone, expired or revoked: the session is genuinely over.
    if (response.status === 401 || response.status === 403) {
      clearSession()
    }
    return null
  }

  const payload = (await response.json()) as AuthResponse
  const next = fromAuthResponse(payload)
  setSession(next)
  return next
}

/**
 * Refreshes at most once at a time, across every tab.
 *
 * Within a tab, `inFlightRefresh` collapses concurrent 401s into one call. Across tabs, the Web
 * Locks API serialises them: tabs share one refresh cookie, so two refreshing at the same instant
 * would present the same token twice — which the server's reuse detection reads as theft and
 * answers by revoking the whole family, signing the user out everywhere. Serialised, each tab
 * refreshes against the cookie the previous one just rotated, and each gets its own token.
 */
export function refreshSession(): Promise<Session | null> {
  if (inFlightRefresh !== null) return inFlightRefresh

  const run = async (): Promise<Session | null> => {
    if (typeof navigator !== 'undefined' && 'locks' in navigator) {
      return navigator.locks.request(REFRESH_LOCK, async () => {
        // Another tab may have refreshed while this one waited for the lock. It rotated the
        // cookie, not this tab's token, so only skip when this tab's own token is still good.
        if (tokenIsUsable(session)) return session
        return callRefreshEndpoint()
      })
    }

    // No Web Locks: single-tab correctness only. The server's reuse-leeway window absorbs the
    // races this cannot prevent.
    return callRefreshEndpoint()
  }

  inFlightRefresh = run().finally(() => {
    inFlightRefresh = null
  })

  return inFlightRefresh
}

/** Ends the session on the server as well as locally. */
export async function endSession(): Promise<void> {
  try {
    await fetch(`${apiBaseUrl()}/api/account/logout`, {
      method: 'POST',
      credentials: 'include',
    })
  } catch {
    // Clearing local state matters more than reporting a failed logout call.
  } finally {
    clearSession()
  }
}

/** Restores a session on application start. Returns null when the user must sign in. */
export async function restoreSession(): Promise<Session | null> {
  return refreshSession()
}

/**
 * Empty in development, where Vite proxies `/api` to the API and same-origin is the point.
 * Falling back to the page origin keeps every request URL absolute, which both `fetch` and
 * `openapi-fetch` handle unambiguously.
 */
export function apiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL
  if (configured) return configured
  return typeof window === 'undefined' ? '' : window.location.origin
}

/** Test seam: resets every piece of module state between tests. */
export function __resetSessionForTests(): void {
  session = null
  inFlightRefresh = null
  if (proactiveTimer !== null) {
    clearTimeout(proactiveTimer)
    proactiveTimer = null
  }
  listeners.clear()
}

export async function login(email: string, password: string): Promise<Session> {
  const response = await fetch(`${apiBaseUrl()}/api/account/login`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) throw await toApiError(response)

  const next = fromAuthResponse((await response.json()) as AuthResponse)
  setSession(next)
  return next
}
