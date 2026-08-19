import { describe, expect, it } from 'vitest'

import { ContractViolationError } from '@/api/coerce'

import {
  allowedTransitions,
  canTransition,
  mapEvaluation,
  mapPage,
  mapReport,
  REPORT_STATUSES,
  type ReportStatus,
} from './report'

const employeeDto = {
  id: '3',
  identityUserId: 'u1',
  email: 'user@mic.test',
  name: 'Plain User',
  department: { id: '1', name: 'Risk', branchLocation: 'HQ' },
  active: true,
  createdAt: '2026-08-18T10:51:48.3768637+03:00',
}

// Numbers deliberately arrive as strings here: that is the half of the `number | string`
// contract union a real .NET response can produce, and the mappers must handle it.
const evaluationDto = {
  id: '10',
  evaluator: employeeDto,
  severity: '4',
  frequency: '3',
  controlEffectiveness: '3',
  inherentRisk: '12',
  residualRisk: '36',
  existingMeasures: '  some controls  ',
  proposedMeasures: null,
  priority: '2',
  evaluatedAt: '2026-08-18T09:00:00+00:00',
}

const reportDto = {
  id: 1,
  reporter: employeeDto,
  subCategory: { id: 1, name: 'Fraud', category: 'Financial' },
  reportedEvaluation: evaluationDto,
  auditorEvaluation: null,
  description: 'Test risk',
  status: 'Submitted',
  submittedAt: '2026-08-18T09:00:00+00:00',
}

describe('canTransition', () => {
  it('accepts the transitions the server allows', () => {
    expect(canTransition('Submitted', 'InReview')).toBe(true)
    expect(canTransition('Submitted', 'Resolved')).toBe(true)
    expect(canTransition('InReview', 'Submitted')).toBe(true)
    expect(canTransition('InReview', 'Resolved')).toBe(true)
    expect(canTransition('Resolved', 'InReview')).toBe(true)
  })

  it('rejects the one transition the server refuses', () => {
    expect(canTransition('Resolved', 'Submitted')).toBe(false)
  })

  it('treats a no-op as allowed, matching the server', () => {
    for (const status of REPORT_STATUSES) {
      expect(canTransition(status, status)).toBe(true)
    }
  })

  // The triage UI builds its menu from allowedTransitions, so anything it offers must be legal.
  it('never offers a target that canTransition would reject', () => {
    for (const from of REPORT_STATUSES) {
      for (const to of allowedTransitions(from)) {
        expect(canTransition(from, to as ReportStatus)).toBe(true)
      }
    }
  })
})

describe('mapEvaluation', () => {
  it('coerces the string form of every numeric field', () => {
    const evaluation = mapEvaluation(evaluationDto)

    expect(evaluation.id).toBe(10)
    expect(evaluation.severity).toBe(4)
    expect(evaluation.frequency).toBe(3)
    expect(evaluation.controlEffectiveness).toBe(3)
    expect(evaluation.inherentRisk).toBe(12)
    expect(evaluation.residualRisk).toBe(36)
    expect(evaluation.priority).toBe(2)
  })

  it('bands both scores independently', () => {
    const evaluation = mapEvaluation(evaluationDto)
    expect(evaluation.inherentBand).toBe('High')
    expect(evaluation.residualBand).toBe('Critical')
  })

  it('normalises optional text', () => {
    const evaluation = mapEvaluation(evaluationDto)
    expect(evaluation.existingMeasures).toBe('some controls')
    expect(evaluation.proposedMeasures).toBeNull()
  })

  it('parses offset timestamps into real dates', () => {
    expect(mapEvaluation(evaluationDto).evaluatedAt.toISOString()).toBe('2026-08-18T09:00:00.000Z')
  })
})

describe('mapReport', () => {
  it('maps a report with no auditor evaluation', () => {
    const report = mapReport(reportDto)

    expect(report.status).toBe('Submitted')
    expect(report.auditorEvaluation).toBeNull()
    expect(report.subCategory.category).toBe('Financial')
  })

  // The auditor's assessment is authoritative once it exists; every score shown on the report
  // should follow it rather than the reporter's original.
  it('prefers the auditor evaluation as the effective one', () => {
    const withAuditor = mapReport({
      ...reportDto,
      auditorEvaluation: { ...evaluationDto, id: '11', severity: '5', inherentRisk: '15', residualRisk: '45' },
    })

    expect(withAuditor.effectiveEvaluation.id).toBe(11)
    expect(withAuditor.effectiveEvaluation.residualRisk).toBe(45)
  })

  it('falls back to the reporter evaluation when there is no auditor one', () => {
    expect(mapReport(reportDto).effectiveEvaluation.id).toBe(10)
  })

  it('rejects a status outside the known set rather than rendering it', () => {
    expect(() => mapReport({ ...reportDto, status: 'Archived' })).toThrow(ContractViolationError)
  })

  it('rejects an unknown risk category', () => {
    expect(() =>
      mapReport({ ...reportDto, subCategory: { id: 1, name: 'X', category: 'Reputational' } }),
    ).toThrow(ContractViolationError)
  })
})

describe('mapPage', () => {
  it('maps items and coerces the envelope counters', () => {
    const page = mapPage(
      { items: [reportDto], page: '1', pageSize: '20', totalCount: '1', totalPages: '1' },
      mapReport,
    )

    expect(page.items).toHaveLength(1)
    expect(page.page).toBe(1)
    expect(page.pageSize).toBe(20)
    expect(page.totalCount).toBe(1)
    expect(page.totalPages).toBe(1)
  })

  it('handles an empty page', () => {
    const page = mapPage(
      { items: [], page: 1, pageSize: 20, totalCount: 0, totalPages: 0 },
      mapReport,
    )
    expect(page.items).toEqual([])
    expect(page.totalCount).toBe(0)
  })
})
