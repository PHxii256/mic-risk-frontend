import { describe, expect, it } from 'vitest'

import { inherentRisk, isWeakControl, residualRisk, riskBand } from './scoring'

describe('inherentRisk', () => {
  it('is severity times frequency', () => {
    expect(inherentRisk(1, 1)).toBe(1)
    expect(inherentRisk(4, 3)).toBe(12)
    expect(inherentRisk(5, 5)).toBe(25)
  })
})

describe('residualRisk', () => {
  // These are the worked examples from the design spec, each verified against the database's
  // own computed column. If this table ever disagrees with the server, the server is right.
  it.each([
    { severity: 5, frequency: 5, control: 1, inherent: 25, residual: 25 },
    { severity: 5, frequency: 5, control: 3, inherent: 25, residual: 75 },
    { severity: 5, frequency: 5, control: 5, inherent: 25, residual: 125 },
    { severity: 4, frequency: 3, control: 3, inherent: 12, residual: 36 },
    { severity: 2, frequency: 2, control: 4, inherent: 4, residual: 16 },
    { severity: 1, frequency: 1, control: 1, inherent: 1, residual: 1 },
    { severity: 1, frequency: 1, control: 5, inherent: 1, residual: 5 },
  ])(
    'severity $severity x frequency $frequency, control $control -> $inherent / $residual',
    ({ severity, frequency, control, inherent, residual }) => {
      expect(inherentRisk(severity, frequency)).toBe(inherent)
      expect(residualRisk(severity, frequency, control)).toBe(residual)
    },
  )

  // The defining property of this scale's direction: a perfectly controlled risk is unchanged,
  // and residual can never come out below inherent.
  it('equals inherent when controls are strongest, and never falls below it', () => {
    for (let severity = 1; severity <= 5; severity += 1) {
      for (let frequency = 1; frequency <= 5; frequency += 1) {
        expect(residualRisk(severity, frequency, 1)).toBe(inherentRisk(severity, frequency))

        for (let control = 1; control <= 5; control += 1) {
          expect(residualRisk(severity, frequency, control)).toBeGreaterThanOrEqual(
            inherentRisk(severity, frequency),
          )
        }
      }
    }
  })

  it('stays inside 1 to 125 across the whole rating space', () => {
    for (let severity = 1; severity <= 5; severity += 1) {
      for (let frequency = 1; frequency <= 5; frequency += 1) {
        for (let control = 1; control <= 5; control += 1) {
          const score = residualRisk(severity, frequency, control)
          expect(score).toBeGreaterThanOrEqual(1)
          expect(score).toBeLessThanOrEqual(125)
        }
      }
    }
  })
})

describe('riskBand', () => {
  it.each([
    [1, 'Low'],
    [5, 'Low'],
    [6, 'Moderate'],
    [10, 'Moderate'],
    [11, 'High'],
    [15, 'High'],
    [16, 'Critical'],
    [125, 'Critical'],
  ])('score %i is %s', (score, band) => {
    expect(riskBand(score)).toBe(band)
  })
})

describe('isWeakControl', () => {
  // The backend's original test was `<= 2`, which under this scale flagged the STRONGEST
  // controls as weak. Pinning the direction here so the mistake cannot come back.
  it.each([
    [1, false],
    [2, false],
    [3, false],
    [4, true],
    [5, true],
  ])('rating %i is weak: %s', (rating, expected) => {
    expect(isWeakControl(rating)).toBe(expected)
  })
})
