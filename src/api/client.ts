import createClient from 'openapi-fetch'


import { ApiError, fromProblemBody, NetworkError, toApiError } from './errors'
import type { paths } from './schema'
import { apiBaseUrl, clearSession, getSession, refreshSession } from './session'

/**
 * Requests that must never trigger the refresh-and-replay path. `/refresh` failing with 401 is
 * the definitive end of a session, and retrying `/login` after a rejected password would be
 * both pointless and a way to burn through lockout attempts.
 */
const AUTH_PATHS = ['/api/account/login', '/api/account/refresh', '/api/account/logout']

function isAuthPath(url: string): boolean {
  return AUTH_PATHS.some((path) => new URL(url, 'http://placeholder').pathname === path)
}

function withAuthorization(request: Request, token: string | undefined): Request {
  if (token === undefined) return request

  const headers = new Headers(request.headers)
  headers.set('Authorization', `Bearer ${token}`)
  return new Request(request, { headers })
}

/**
 * The transport for every generated call.
 *
 * On a 401 it refreshes once and replays the original request once — never a loop. The retry
 * copy is taken before the first attempt, because a Request body can only be consumed once.
 */
async function authFetch(input: Request): Promise<Response> {
  const retryable = !isAuthPath(input.url)
  const replayable = retryable ? input.clone() : null

  const send = async (request: Request): Promise<Response> => {
    try {
      return await fetch(request)
    } catch (cause) {
      // An aborted request is the caller's own doing, so let it propagate untouched.
      if (cause instanceof DOMException && cause.name === 'AbortError') throw cause
      throw new NetworkError(cause)
    }
  }

  const first = await send(withAuthorization(input, getSession()?.accessToken))

  if (first.status !== 401 || replayable === null) return first

  const refreshed = await refreshSession()
  if (refreshed === null) {
    clearSession()
    return first
  }

  return send(withAuthorization(replayable, refreshed.accessToken))
}

export const api = createClient<paths>({
  baseUrl: apiBaseUrl(),

  // Required for the refresh cookie to travel with requests.
  credentials: 'include',

  fetch: authFetch,
})

/** The shape every openapi-fetch call resolves to. */
interface FetchResult<T> {
  data?: T
  error?: unknown
  response: Response
}

/**
 * Turns openapi-fetch's `{ data, error }` result into a value or a thrown `ApiError`, which is
 * what TanStack Query expects. Keeping this in one place means no call site forgets to check
 * `error`, which would otherwise silently render an undefined body.
 */
export async function unwrap<T>(promise: Promise<FetchResult<T>>): Promise<T> {
  const result = await promise

  if (!result.response.ok) {
    // openapi-fetch has already read the body, so the parsed `error` it returns is the only
    // copy — the response itself can no longer be cloned or re-read.
    throw fromProblemBody(result.error, result.response.status, result.response.statusText)
  }

  if (result.data === undefined) {
    // 204 responses legitimately carry no body; callers type those as void.
    return undefined as T
  }

  return result.data
}

/**
 * Runs a request that treats 404 as an empty result rather than an error.
 *
 * `GET /api/risk-subcategory/by-category/{category}` returns 404 when a category simply has no
 * subcategories, so a picker showing "no options" must not present that as a failure.
 */
export async function unwrapAllowingNotFound<T>(
  promise: Promise<FetchResult<T>>,
  fallback: T,
): Promise<T> {
  try {
    return await unwrap(promise)
  } catch (error) {
    if (error instanceof ApiError && error.isNotFound) return fallback
    throw error
  }
}

/**
 * Escape hatch for calls the generated types cannot express: routes the OpenAPI document does
 * not describe, and multipart bodies, whose generated shape makes every field optional.
 *
 * Goes through the same transport as everything else, so it still carries the access token,
 * the refresh-and-replay behaviour and the cookie.
 */
async function rawRequest(
  method: string,
  path: string,
  init: { body?: BodyInit; json?: unknown; signal?: AbortSignal; accept?: string } = {},
): Promise<Response> {
  const headers = new Headers({ Accept: init.accept ?? 'application/json' })
  let body = init.body

  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }

  const request = new Request(`${apiBaseUrl()}${path}`, {
    method,
    headers,
    body,
    credentials: 'include',
    signal: init.signal ?? null,
  })

  return authFetch(request)
}

async function readOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) throw await toApiError(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export async function requestJson<T>(
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  json?: unknown,
  signal?: AbortSignal,
): Promise<T> {
  return readOrThrow<T>(await rawRequest(method, path, { json, signal }))
}

/**
 * Multipart upload. The browser sets the multipart boundary itself, so the content type is
 * deliberately never set by hand — doing so produces a body the server cannot parse.
 */
export async function uploadFile<T>(
  path: string,
  fields: Record<string, string | Blob>,
  signal?: AbortSignal,
): Promise<T> {
  const form = new FormData()
  for (const [key, value] of Object.entries(fields)) form.append(key, value)

  return readOrThrow<T>(await rawRequest('POST', path, { body: form, signal }))
}

export interface DownloadedFile {
  blob: Blob
  fileName: string | null
}

/**
 * Downloads an authenticated binary response through the same token refresh path as API calls.
 * Reading the filename from Content-Disposition also preserves the server-selected extension.
 */
export async function downloadFile(
  path: string,
  signal?: AbortSignal,
): Promise<DownloadedFile> {
  const response = await rawRequest('GET', path, { signal, accept: '*/*' })
  if (!response.ok) throw await toApiError(response)

  return {
    blob: await response.blob(),
    fileName: contentDispositionFileName(response.headers.get('Content-Disposition')),
  }
}

function contentDispositionFileName(header: string | null): string | null {
  if (header === null) return null

  const encoded = /(?:^|;)\s*filename\*\s*=\s*UTF-8''([^;]+)/i.exec(header)?.[1]
  if (encoded) {
    try {
      return decodeURIComponent(encoded.trim().replace(/^"|"$/g, ''))
    } catch {
      // Fall through to the plain filename when a third-party proxy emits bad encoding.
    }
  }

  const quoted = /(?:^|;)\s*filename\s*=\s*"([^"]*)"/i.exec(header)?.[1]
  if (quoted) return quoted.replace(/\\"/g, '"')

  return /(?:^|;)\s*filename\s*=\s*([^;]+)/i.exec(header)?.[1]?.trim() ?? null
}
