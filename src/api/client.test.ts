import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { api, unwrap, unwrapAllowingNotFound } from './client'
import { ApiError } from './errors'
import { __resetSessionForTests, fromAuthResponse, getSession, setSession } from './session'

const employee = {
  id: 3,
  identityUserId: 'u1',
  email: 'user@mic.test',
  name: 'Plain User',
  department: { id: 1, name: 'Risk', branchLocation: 'HQ' },
  active: true,
  createdAt: '2026-08-18T10:51:48+03:00',
}

function authPayload(token: string, expiresInMs = 15 * 60_000) {
  return {
    accessToken: token,
    accessTokenExpiresAt: new Date(Date.now() + expiresInMs).toISOString(),
    roles: ['User'],
    employee,
  }
}

/** Records the Authorization header of every /mine call, so replays can be inspected. */
let seenTokens: (string | null)[] = []
let refreshCalls = 0
let refreshOutcome: 'ok' | 'expired' = 'ok'
let mineBehaviour: 'requires-fresh-token' | 'always-ok' = 'requires-fresh-token'

const server = setupServer(
  http.post('http://localhost/api/account/refresh', () => {
    refreshCalls += 1
    if (refreshOutcome === 'expired') {
      return HttpResponse.json({ status: 401, title: 'Unauthorized' }, { status: 401 })
    }
    return HttpResponse.json(authPayload('fresh-token'))
  }),

  http.get('http://localhost/api/risk-report/mine', ({ request }) => {
    const header = request.headers.get('Authorization')
    seenTokens.push(header)

    if (mineBehaviour === 'always-ok') return HttpResponse.json([])

    // Anything other than a freshly rotated token is rejected, which is what forces the
    // refresh-and-replay path the same way an expired token would in production.
    if (header !== 'Bearer fresh-token') {
      return HttpResponse.json(
        { status: 401, title: 'Unauthorized', detail: 'Authentication is required.' },
        { status: 401 },
      )
    }
    return HttpResponse.json([])
  }),

  http.post('http://localhost/api/account/login', () =>
    HttpResponse.json(
      { status: 401, title: 'Unauthorized', detail: 'Invalid credentials.' },
      { status: 401 },
    ),
  ),

  http.get('http://localhost/api/risk-subcategory/categories', () =>
    HttpResponse.json({ status: 404, title: 'Not Found' }, { status: 404 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterAll(() => server.close())

beforeEach(() => {
  __resetSessionForTests()
  seenTokens = []
  refreshCalls = 0
  refreshOutcome = 'ok'
  mineBehaviour = 'requires-fresh-token'
})

afterEach(() => server.resetHandlers())

describe('authFetch', () => {
  it('attaches the in-memory access token', async () => {
    mineBehaviour = 'always-ok'
    setSession(fromAuthResponse(authPayload('stored-token')))

    await api.GET('/api/risk-report/mine')

    expect(seenTokens).toEqual(['Bearer stored-token'])
  })

  it('sends no Authorization header when there is no session', async () => {
    mineBehaviour = 'always-ok'

    await api.GET('/api/risk-report/mine')

    expect(seenTokens).toEqual([null])
  })

  // The core recovery path: one refresh, one replay, and the replay must carry the new token.
  it('refreshes once and replays the request on 401', async () => {
    setSession(fromAuthResponse(authPayload('stale-token')))

    const result = await api.GET('/api/risk-report/mine')

    expect(refreshCalls).toBe(1)
    expect(seenTokens).toEqual(['Bearer stale-token', 'Bearer fresh-token'])
    expect(result.response.status).toBe(200)
    expect(getSession()?.accessToken).toBe('fresh-token')
  })

  // Without this the app would refresh, get another 401, refresh again, and spin.
  it('replays only once and does not loop when the replay also fails', async () => {
    server.use(
      http.get('http://localhost/api/risk-report/mine', ({ request }) => {
        seenTokens.push(request.headers.get('Authorization'))
        return HttpResponse.json({ status: 401, title: 'Unauthorized' }, { status: 401 })
      }),
    )
    setSession(fromAuthResponse(authPayload('stale-token')))

    const result = await api.GET('/api/risk-report/mine')

    expect(refreshCalls).toBe(1)
    expect(seenTokens).toHaveLength(2)
    expect(result.response.status).toBe(401)
  })

  it('gives up and clears the session when the refresh itself fails', async () => {
    refreshOutcome = 'expired'
    setSession(fromAuthResponse(authPayload('stale-token')))

    const result = await api.GET('/api/risk-report/mine')

    expect(refreshCalls).toBe(1)
    expect(seenTokens).toEqual(['Bearer stale-token'])
    expect(result.response.status).toBe(401)
    expect(getSession()).toBeNull()
  })

  // Several requests failing at once must not each start their own refresh: presenting the same
  // refresh cookie repeatedly is what the server's reuse detection treats as theft.
  it('collapses concurrent 401s into a single refresh', async () => {
    setSession(fromAuthResponse(authPayload('stale-token')))

    const results = await Promise.all([
      api.GET('/api/risk-report/mine'),
      api.GET('/api/risk-report/mine'),
      api.GET('/api/risk-report/mine'),
    ])

    expect(refreshCalls).toBe(1)
    expect(results.every((r) => r.response.status === 200)).toBe(true)
    expect(seenTokens.filter((t) => t === 'Bearer fresh-token')).toHaveLength(3)
  })

  // A rejected password is a final answer, not something a token refresh could fix.
  it('never refreshes on a failed login', async () => {
    await api.POST('/api/account/login', { body: { email: 'a@b.io', password: 'wrong' } })

    expect(refreshCalls).toBe(0)
  })
})

describe('unwrap', () => {
  it('returns the body on success', async () => {
    mineBehaviour = 'always-ok'
    setSession(fromAuthResponse(authPayload('stored-token')))

    await expect(unwrap(api.GET('/api/risk-report/mine'))).resolves.toEqual([])
  })

  it('throws a typed ApiError carrying the server detail', async () => {
    const error = await unwrap(
      api.POST('/api/account/login', { body: { email: 'a@b.io', password: 'wrong' } }),
    ).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).status).toBe(401)
    expect((error as ApiError).detail).toBe('Invalid credentials.')
  })
})

describe('unwrapAllowingNotFound', () => {
  // `by-category` and `categories` answer 404 for "no rows", which is an empty picker rather
  // than a failure the user should see.
  it('treats 404 as an empty result', async () => {
    setSession(fromAuthResponse(authPayload('stored-token')))

    await expect(
      unwrapAllowingNotFound(api.GET('/api/risk-subcategory/categories'), []),
    ).resolves.toEqual([])
  })
})
