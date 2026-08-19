import { describe, expect, it } from 'vitest'

import {
  ContractViolationError,
  toDate,
  toEnum,
  toInteger,
  toNumber,
  toOptionalDate,
  toOptionalNumber,
  toOptionalText,
} from './coerce'

describe('toNumber', () => {
  it('passes numbers through', () => {
    expect(toNumber(42)).toBe(42)
    expect(toNumber(0)).toBe(0)
    expect(toNumber(-7)).toBe(-7)
    expect(toNumber(7.2)).toBe(7.2)
  })

  // The whole reason this module exists: OpenAPI 3.1 from .NET types every number as
  // `["integer","string"]`, so the same field can arrive either way.
  it('parses the string half of the contract union', () => {
    expect(toNumber('42')).toBe(42)
    expect(toNumber('0')).toBe(0)
    expect(toNumber('-7')).toBe(-7)
    expect(toNumber('7.2')).toBe(7.2)
  })

  it('tolerates surrounding whitespace', () => {
    expect(toNumber('  42  ')).toBe(42)
  })

  it('rejects values the contract says cannot occur', () => {
    expect(() => toNumber('')).toThrow(ContractViolationError)
    expect(() => toNumber('   ')).toThrow(ContractViolationError)
    expect(() => toNumber('abc')).toThrow(ContractViolationError)
    expect(() => toNumber(Number.NaN)).toThrow(ContractViolationError)
    expect(() => toNumber(Number.POSITIVE_INFINITY)).toThrow(ContractViolationError)
  })

  it('names the offending field, so a failure is diagnosable', () => {
    expect(() => toNumber('abc', 'residualRisk')).toThrow(/residualRisk/)
  })
})

describe('toInteger', () => {
  it('accepts integers in either representation', () => {
    expect(toInteger(12)).toBe(12)
    expect(toInteger('12')).toBe(12)
  })

  it('rejects fractional values', () => {
    expect(() => toInteger(7.2)).toThrow(ContractViolationError)
    expect(() => toInteger('7.2')).toThrow(ContractViolationError)
  })
})

describe('toOptionalNumber', () => {
  it('maps absent values to null rather than 0', () => {
    expect(toOptionalNumber(null)).toBeNull()
    expect(toOptionalNumber(undefined)).toBeNull()
  })

  it('keeps zero, which is a real value', () => {
    expect(toOptionalNumber(0)).toBe(0)
    expect(toOptionalNumber('0')).toBe(0)
  })
})

describe('toDate', () => {
  it('parses the offset-bearing timestamps the API sends', () => {
    expect(toDate('2026-08-18T08:08:19+00:00').toISOString()).toBe('2026-08-18T08:08:19.000Z')
    expect(toDate('2026-08-18T10:51:48.3768637+03:00').getTime()).toBe(
      Date.parse('2026-08-18T07:51:48.376Z'),
    )
  })

  it('rejects unparseable input', () => {
    expect(() => toDate('not a date')).toThrow(ContractViolationError)
    expect(() => toDate('')).toThrow(ContractViolationError)
  })
})

describe('toOptionalDate', () => {
  it('maps absent values to null', () => {
    expect(toOptionalDate(null)).toBeNull()
    expect(toOptionalDate(undefined)).toBeNull()
  })

  it('parses present values', () => {
    expect(toOptionalDate('2026-08-18T08:08:19Z')).toBeInstanceOf(Date)
  })
})

describe('toOptionalText', () => {
  it('collapses absent and blank to a single empty case', () => {
    expect(toOptionalText(null)).toBeNull()
    expect(toOptionalText(undefined)).toBeNull()
    expect(toOptionalText('')).toBeNull()
    expect(toOptionalText('   ')).toBeNull()
  })

  it('trims real content', () => {
    expect(toOptionalText('  hello  ')).toBe('hello')
  })
})

describe('toEnum', () => {
  const statuses = ['Submitted', 'InReview', 'Resolved'] as const

  it('accepts known values', () => {
    expect(toEnum('InReview', statuses)).toBe('InReview')
  })

  it('rejects anything outside the set, including case variants', () => {
    expect(() => toEnum('Closed', statuses)).toThrow(ContractViolationError)
    expect(() => toEnum('inreview', statuses)).toThrow(ContractViolationError)
  })
})
