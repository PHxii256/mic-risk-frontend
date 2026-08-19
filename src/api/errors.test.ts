import { describe, expect, it } from 'vitest'

import { ApiError, flattenFieldErrors, toApiError } from './errors'

function problemResponse(status: number, body: unknown, statusText = ''): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText,
    headers: { 'Content-Type': 'application/problem+json' },
  })
}

describe('toApiError', () => {
  // Shape one: a plain problem, which is what 401/403/404 and the exception middleware produce.
  it('reads a plain ProblemDetails body', async () => {
    const error = await toApiError(
      problemResponse(404, {
        type: 'https://tools.ietf.org/html/rfc9110#section-15.5.5',
        title: 'Not Found',
        status: 404,
        detail: 'Employee with ID 99999 was not found.',
        instance: '/api/employee/99999',
        traceId: '00-2527-abc',
      }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(404)
    expect(error.title).toBe('Not Found')
    expect(error.detail).toBe('Employee with ID 99999 was not found.')
    expect(error.traceId).toBe('00-2527-abc')
    expect(error.isNotFound).toBe(true)
    expect(error.isValidation).toBe(false)
    expect(error.message).toBe('Employee with ID 99999 was not found.')
  })

  // Shape two: model validation, which adds `errors` keyed by field.
  it('reads a ValidationProblemDetails body', async () => {
    const error = await toApiError(
      problemResponse(400, {
        errors: {
          NewPassword: ["The field NewPassword must be a string or array type with a minimum length of '8'."],
          Email: ['The Email field is not a valid e-mail address.'],
        },
        title: 'One or more validation errors occurred.',
        status: 400,
      }),
    )

    expect(error.isValidation).toBe(true)
    expect(error.fieldErrors).toEqual({
      NewPassword: ["The field NewPassword must be a string or array type with a minimum length of '8'."],
      Email: ['The Email field is not a valid e-mail address.'],
    })
    expect(flattenFieldErrors(error.fieldErrors!)).toHaveLength(2)
  })

  it('keeps the status when the body is empty', async () => {
    const error = await toApiError(new Response('', { status: 403, statusText: 'Forbidden' }))

    expect(error.status).toBe(403)
    expect(error.isForbidden).toBe(true)
    expect(error.detail).toBeNull()
  })

  // A proxy or a crash before the middleware runs can return HTML. Losing the status code to a
  // JSON parse error would be worse than losing the message.
  it('survives a non-JSON body', async () => {
    const error = await toApiError(
      new Response('<html>502 Bad Gateway</html>', { status: 502, statusText: 'Bad Gateway' }),
    )

    expect(error.status).toBe(502)
    expect(error.title).toBe('Bad Gateway')
  })

  it('ignores an errors object that is not field-to-messages', async () => {
    const error = await toApiError(problemResponse(400, { errors: 'nope', status: 400 }))
    expect(error.isValidation).toBe(false)
  })

  it('drops non-string messages rather than rendering them', async () => {
    const error = await toApiError(
      problemResponse(400, { errors: { Email: ['valid', 42, null] }, status: 400 }),
    )
    expect(error.fieldErrors).toEqual({ Email: ['valid'] })
  })
})

describe('ApiError.isUnavailable', () => {
  // A dev proxy with nothing behind it answers ECONNREFUSED with a 502, so an unreachable
  // server arrives as an HTTP status rather than a thrown NetworkError. Reporting that as a
  // sign-in failure would send the user off to retype a password that was never wrong.
  it.each([
    [500, false],
    [502, true],
    [503, true],
    [504, true],
    [401, false],
  ])('status %i -> %s', (status, expected) => {
    expect(new ApiError({ status }).isUnavailable).toBe(expected)
  })
})

describe('ApiError.isRetryable', () => {
  it.each([
    [400, false],
    [401, false],
    [403, false],
    [404, false],
    [408, true],
    [429, true],
    [500, true],
    [503, true],
  ])('status %i -> %s', (status, expected) => {
    expect(new ApiError({ status }).isRetryable).toBe(expected)
  })
})
