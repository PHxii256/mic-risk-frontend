/**
 * The API document is OpenAPI 3.1 emitted from .NET, which renders every `int32`, `int64` and
 * `double` as `["integer","string"]`. The generated types therefore say `number | string` for
 * every id, count, page number and score in the contract.
 *
 * Everything crossing from `api/` into `domain/` passes through here, so no component ever has
 * to think about it.
 */

/** A numeric field as the generated types describe it. */
export type ApiNumber = number | string

/**
 * Thrown when the server sends something the contract says it cannot. This is a bug, not a
 * user-facing condition — it surfaces as an error state rather than rendering `NaN` into the UI.
 */
export class ContractViolationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ContractViolationError'
  }
}

export function toNumber(value: ApiNumber, field = 'value'): number {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new ContractViolationError(`Expected ${field} to be a finite number, received ${value}.`)
    }
    return value
  }

  const trimmed = value.trim()
  if (trimmed === '') {
    throw new ContractViolationError(`Expected ${field} to be numeric, received an empty string.`)
  }

  const parsed = Number(trimmed)
  if (!Number.isFinite(parsed)) {
    throw new ContractViolationError(`Expected ${field} to be numeric, received "${value}".`)
  }

  return parsed
}

export function toInteger(value: ApiNumber, field = 'value'): number {
  const parsed = toNumber(value, field)
  if (!Number.isInteger(parsed)) {
    throw new ContractViolationError(`Expected ${field} to be an integer, received ${parsed}.`)
  }
  return parsed
}

export function toOptionalNumber(
  value: ApiNumber | null | undefined,
  field = 'value',
): number | null {
  return value === null || value === undefined ? null : toNumber(value, field)
}

export function toDate(value: string, field = 'value'): Date {
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new ContractViolationError(`Expected ${field} to be a date-time, received "${value}".`)
  }
  return parsed
}

export function toOptionalDate(value: string | null | undefined, field = 'value'): Date | null {
  return value === null || value === undefined ? null : toDate(value, field)
}

/** Trims a nullable string and collapses blank values to null, so the UI has one empty case. */
export function toOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

/**
 * Narrows a free-form string to a known set. The contract types several enum-like fields as
 * plain `string`, so this is where the real domain values get enforced.
 */
export function toEnum<const T extends readonly string[]>(
  value: string,
  allowed: T,
  field = 'value',
): T[number] {
  if (!allowed.includes(value)) {
    throw new ContractViolationError(
      `Expected ${field} to be one of ${allowed.join(', ')}, received "${value}".`,
    )
  }
  return value as T[number]
}
