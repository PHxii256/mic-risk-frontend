/**
 * The API returns RFC 9457 `application/problem+json` for every non-2xx, in one of two shapes:
 * a plain problem carrying a `detail`, or a validation problem that additionally carries
 * `errors` keyed by field name. Everything below normalises those into a single type so the UI
 * never branches on transport details.
 */

/** Field name to messages, as ASP.NET model validation emits it (PascalCase keys). */
export type FieldErrors = Record<string, string[]>

export class ApiError extends Error {
  readonly status: number
  readonly title: string | null
  readonly detail: string | null
  readonly fieldErrors: FieldErrors | null
  readonly traceId: string | null

  constructor(init: {
    status: number
    title?: string | null
    detail?: string | null
    fieldErrors?: FieldErrors | null
    traceId?: string | null
  }) {
    super(init.detail ?? init.title ?? `Request failed with status ${init.status}`)
    this.name = 'ApiError'
    this.status = init.status
    this.title = init.title ?? null
    this.detail = init.detail ?? null
    this.fieldErrors = init.fieldErrors ?? null
    this.traceId = init.traceId ?? null
  }

  /** True when the server rejected specific fields, so the form can attach them to inputs. */
  get isValidation(): boolean {
    return this.fieldErrors !== null && Object.keys(this.fieldErrors).length > 0
  }

  get isUnauthorized(): boolean {
    return this.status === 401
  }

  get isForbidden(): boolean {
    return this.status === 403
  }

  get isNotFound(): boolean {
    return this.status === 404
  }

  /**
   * The server could not be reached or could not answer: a dead upstream, a restarting API, a
   * proxy with nothing behind it. Distinct from a rejected request, because the user's input was
   * never the problem — a dev proxy turns a refused connection into a 502, so this arrives as an
   * HTTP status rather than as a thrown NetworkError.
   */
  get isUnavailable(): boolean {
    return this.status === 502 || this.status === 503 || this.status === 504
  }

  /**
   * Whether retrying could plausibly succeed. Drives the query client's retry policy: a 404 or
   * a rejected field will fail identically every time, so retrying only delays the error.
   */
  get isRetryable(): boolean {
    return this.status === 408 || this.status === 429 || this.status >= 500
  }
}

/** The request never reached the server, or the connection failed mid-flight. */
export class NetworkError extends Error {
  readonly cause: unknown

  constructor(cause: unknown) {
    super('The server could not be reached.')
    this.name = 'NetworkError'
    this.cause = cause
  }
}

function emptyToNull(value: string): string | null {
  return value === '' ? null : value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readString(source: Record<string, unknown>, key: string): string | null {
  const value = source[key]
  return typeof value === 'string' && value !== '' ? value : null
}

/** Accepts only the shape ASP.NET actually produces: string keys to arrays of strings. */
function readFieldErrors(source: Record<string, unknown>): FieldErrors | null {
  const raw = source['errors']
  if (!isRecord(raw)) return null

  const result: FieldErrors = {}
  for (const [field, messages] of Object.entries(raw)) {
    if (Array.isArray(messages)) {
      const strings = messages.filter((m): m is string => typeof m === 'string')
      if (strings.length > 0) result[field] = strings
    }
  }

  return Object.keys(result).length > 0 ? result : null
}

/**
 * Builds an ApiError from an already-parsed problem body.
 *
 * Separate from `toApiError` because openapi-fetch consumes the response body itself, leaving
 * it unreadable; the parsed payload it hands back is the only copy.
 */
export function fromProblemBody(
  body: unknown,
  status: number,
  statusText = '',
): ApiError {
  if (!isRecord(body)) {
    return new ApiError({ status, title: emptyToNull(statusText) })
  }

  return new ApiError({
    status: readNumber(body, 'status') ?? status,
    title: readString(body, 'title') ?? emptyToNull(statusText),
    detail: readString(body, 'detail'),
    fieldErrors: readFieldErrors(body),
    traceId: readString(body, 'traceId'),
  })
}

/**
 * Builds an ApiError from a failed response whose body has not been read. Deliberately
 * tolerant: a proxy, a gateway or a crash before the middleware runs can all produce a
 * non-JSON body, and losing the status code to a parse error would be worse than losing
 * the message.
 */
export async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown = null

  try {
    const text = await response.text()
    if (text !== '') body = JSON.parse(text)
  } catch {
    body = null
  }

  return fromProblemBody(body, response.status, response.statusText)
}

function readNumber(source: Record<string, unknown>, key: string): number | null {
  const value = source[key]
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

/** Flattens field errors into a list, for forms that show a summary above the inputs. */
export function flattenFieldErrors(fieldErrors: FieldErrors): string[] {
  return Object.values(fieldErrors).flat()
}
