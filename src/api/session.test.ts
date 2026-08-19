import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  __resetSessionForTests,
  clearSession,
  fromAuthResponse,
  getSession,
  refreshSession,
  setSession,
  subscribe,
} from './session'

function authPayload(overrides: { expiresInMs?: number; token?: string } = {}) {
  return {
    accessToken: overrides.token ?? 'token-1',
    accessTokenExpiresAt: new Date(Date.now() + (overrides.expiresInMs ?? 15 * 60_000)).toISOString(),
    roles: ['User'],
    employee: {
      id: 3,
      identityUserId: 'u1',
      email: 'user@mic.test',
      name: 'Plain User',
      department: { id: 1, name: 'Risk', branchLocation: 'HQ' },
      active: true,
      createdAt: '2026-08-18T10:51:48+03:00',
    },
  }
}

/** A minimal Web Locks stand-in that actually serialises, so ordering can be asserted. */
function installSerialisingLocks() {
  const queues = new Map<string, Promise<unknown>>()

  const locks = {
    request: (name: string, callback: () => Promise<unknown>) => {
      const previous = queues.get(name) ?? Promise.resolve()
      const next = previous.then(() => callback())
      queues.set(
        name,
        next.catch(() => undefined),
      )
      return next
    },
  }

  Object.defineProperty(globalThis.navigator, 'locks', {
    value: locks,
    configurable: true,
  })
}

function removeLocks() {
  Reflect.deleteProperty(globalThis.navigator as object, 'locks')
}

beforeEach(() => {
  __resetSessionForTests()
  installSerialisingLocks()
})

afterEach(() => {
  vi.restoreAllMocks()
  __resetSessionForTests()
  removeLocks()
})

describe('session state', () => {
  it('starts empty', () => {
    expect(getSession()).toBeNull()
  })

  it('notifies subscribers on change', () => {
    const listener = vi.fn()
    const unsubscribe = subscribe(listener)

    setSession(fromAuthResponse(authPayload()))
    expect(listener).toHaveBeenCalledTimes(1)

    clearSession()
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    setSession(fromAuthResponse(authPayload()))
    expect(listener).toHaveBeenCalledTimes(2)
  })

  it('converts the expiry timestamp into a comparable number', () => {
    const payload = authPayload({ expiresInMs: 900_000 })
    const session = fromAuthResponse(payload)
    expect(session.expiresAt).toBe(new Date(payload.accessTokenExpiresAt).getTime())
  })
})

describe('refreshSession', () => {
  it('stores the rotated token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(authPayload({ token: 'rotated' })), { status: 200 }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await refreshSession()

    expect(result?.accessToken).toBe('rotated')
    expect(getSession()?.accessToken).toBe('rotated')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  // The central guarantee. Several requests failing with 401 at once must produce exactly one
  // call to /refresh — a burst of them would present the same cookie repeatedly, which the
  // server reads as token theft and answers by revoking the whole family.
  it('collapses concurrent callers into a single request', async () => {
    let resolveFetch: (value: Response) => void = () => {}
    const pending = new Promise<Response>((resolve) => {
      resolveFetch = resolve
    })

    const fetchMock = vi.fn().mockReturnValue(pending)
    vi.stubGlobal('fetch', fetchMock)

    const calls = [refreshSession(), refreshSession(), refreshSession()]
    resolveFetch(new Response(JSON.stringify(authPayload({ token: 'once' })), { status: 200 }))

    const results = await Promise.all(calls)

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(results.every((r) => r?.accessToken === 'once')).toBe(true)
  })

  it('allows a further refresh once the first has settled', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(authPayload({ token: 'first' })), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(authPayload({ token: 'second' })), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await refreshSession()
    // Expire the stored token, or the lock's fast path would skip the second call.
    setSession({ ...getSession()!, expiresAt: Date.now() - 1000 })
    await refreshSession()

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(getSession()?.accessToken).toBe('second')
  })

  it('skips the network when another tab has already left a usable token', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    setSession(fromAuthResponse(authPayload({ token: 'still-good' })))
    const result = await refreshSession()

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result?.accessToken).toBe('still-good')
  })

  it('clears the session when the refresh cookie is rejected', async () => {
    setSession(fromAuthResponse(authPayload({ expiresInMs: -1000 })))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 401 })))

    const result = await refreshSession()

    expect(result).toBeNull()
    expect(getSession()).toBeNull()
  })

  // A dropped connection is not proof that the session ended, so it must not sign the user out.
  it('keeps the session when the network fails', async () => {
    setSession(fromAuthResponse(authPayload({ expiresInMs: -1000, token: 'kept' })))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    const result = await refreshSession()

    expect(result).toBeNull()
    expect(getSession()?.accessToken).toBe('kept')
  })

  it('works without the Web Locks API', async () => {
    removeLocks()
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(authPayload({ token: 'no-locks' })), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await refreshSession()

    expect(result?.accessToken).toBe('no-locks')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
