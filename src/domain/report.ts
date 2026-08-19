import {
  toDate,
  toEnum,
  toInteger,
  toOptionalText,
  type ApiNumber,
} from '@/api/coerce'
import type { components } from '@/api/schema'

import { riskBand, type RiskBand } from './scoring'

type EvaluationDto = components['schemas']['RiskReportEvaluationResponseDto']
type ReportDto = components['schemas']['RiskReportResponseDto']
type StatusHistoryDto = components['schemas']['RiskReportStatusHistoryResponseDto']
type EmployeeDto = components['schemas']['EmployeeResponseDto']
type SubcategoryDto = components['schemas']['RiskSubcategoryResponseDto']

/** The contract types status as a plain string; these are the values the server accepts. */
export const REPORT_STATUSES = ['Submitted', 'InReview', 'Resolved'] as const
export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const RISK_CATEGORIES = ['Financial', 'Operational', 'Strategic', 'Insurance'] as const
export type RiskCategory = (typeof RISK_CATEGORIES)[number]

/**
 * The transitions the server will accept, mirrored from `Validation/RiskValidators.cs`.
 * Offering an illegal target would produce a 400 the user cannot act on, so the triage UI
 * builds its options from here.
 */
const ALLOWED_TRANSITIONS: Record<ReportStatus, readonly ReportStatus[]> = {
  Submitted: ['InReview', 'Resolved'],
  InReview: ['Submitted', 'Resolved'],
  Resolved: ['InReview'],
}

export function allowedTransitions(from: ReportStatus): readonly ReportStatus[] {
  return ALLOWED_TRANSITIONS[from]
}

export function canTransition(from: ReportStatus, to: ReportStatus): boolean {
  // The server treats a no-op transition as acceptable, so the guard has to agree.
  if (from === to) return true
  return ALLOWED_TRANSITIONS[from].includes(to)
}

export interface Department {
  id: number
  name: string
  branchLocation: string
}

export interface Employee {
  id: number
  identityUserId: string
  email: string
  name: string
  department: Department
  active: boolean
  createdAt: Date
}

export interface Subcategory {
  id: number
  name: string
  category: RiskCategory
}

export interface Evaluation {
  id: number
  evaluator: Employee
  severity: number
  frequency: number
  controlEffectiveness: number
  inherentRisk: number
  residualRisk: number
  inherentBand: RiskBand
  residualBand: RiskBand
  existingMeasures: string | null
  proposedMeasures: string | null
  priority: number
  evaluatedAt: Date
}

export interface RiskReport {
  id: number
  reporter: Employee
  subCategory: Subcategory
  reportedEvaluation: Evaluation
  auditorEvaluation: Evaluation | null
  description: string
  status: ReportStatus
  submittedAt: Date
  /** The auditor's assessment supersedes the reporter's wherever one exists. */
  effectiveEvaluation: Evaluation
}

export interface StatusChange {
  id: number
  reportId: number
  changedBy: Employee
  oldStatus: ReportStatus
  newStatus: ReportStatus
  changedAt: Date
}

export interface Page<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

export function mapDepartment(dto: components['schemas']['DepartmentResponseDto']): Department {
  return {
    id: toInteger(dto.id, 'department.id'),
    name: dto.name,
    branchLocation: dto.branchLocation,
  }
}

export function mapEmployee(dto: EmployeeDto): Employee {
  return {
    id: toInteger(dto.id, 'employee.id'),
    identityUserId: dto.identityUserId,
    email: dto.email,
    name: dto.name,
    department: mapDepartment(dto.department),
    active: dto.active,
    createdAt: toDate(dto.createdAt, 'employee.createdAt'),
  }
}

export function mapSubcategory(dto: SubcategoryDto): Subcategory {
  return {
    id: toInteger(dto.id, 'subcategory.id'),
    name: dto.name,
    category: toEnum(dto.category, RISK_CATEGORIES, 'subcategory.category'),
  }
}

export function mapEvaluation(dto: EvaluationDto): Evaluation {
  const inherent = toInteger(dto.inherentRisk, 'evaluation.inherentRisk')
  const residual = toInteger(dto.residualRisk, 'evaluation.residualRisk')

  return {
    id: toInteger(dto.id, 'evaluation.id'),
    evaluator: mapEmployee(dto.evaluator),
    severity: toInteger(dto.severity, 'evaluation.severity'),
    frequency: toInteger(dto.frequency, 'evaluation.frequency'),
    controlEffectiveness: toInteger(dto.controlEffectiveness, 'evaluation.controlEffectiveness'),
    inherentRisk: inherent,
    residualRisk: residual,
    inherentBand: riskBand(inherent),
    residualBand: riskBand(residual),
    existingMeasures: toOptionalText(dto.existingMeasures),
    proposedMeasures: toOptionalText(dto.proposedMeasures),
    priority: toInteger(dto.priority, 'evaluation.priority'),
    evaluatedAt: toDate(dto.evaluatedAt, 'evaluation.evaluatedAt'),
  }
}

export function mapReport(dto: ReportDto): RiskReport {
  const reportedEvaluation = mapEvaluation(dto.reportedEvaluation)
  const auditorEvaluation =
    dto.auditorEvaluation === null || dto.auditorEvaluation === undefined
      ? null
      : mapEvaluation(dto.auditorEvaluation)

  return {
    id: toInteger(dto.id, 'report.id'),
    reporter: mapEmployee(dto.reporter),
    subCategory: mapSubcategory(dto.subCategory),
    reportedEvaluation,
    auditorEvaluation,
    description: dto.description,
    status: toEnum(dto.status, REPORT_STATUSES, 'report.status'),
    submittedAt: toDate(dto.submittedAt, 'report.submittedAt'),
    effectiveEvaluation: auditorEvaluation ?? reportedEvaluation,
  }
}

export function mapStatusChange(dto: StatusHistoryDto): StatusChange {
  return {
    id: toInteger(dto.id, 'statusChange.id'),
    reportId: toInteger(dto.reportId, 'statusChange.reportId'),
    changedBy: mapEmployee(dto.changedBy),
    oldStatus: toEnum(dto.oldStatus, REPORT_STATUSES, 'statusChange.oldStatus'),
    newStatus: toEnum(dto.newStatus, REPORT_STATUSES, 'statusChange.newStatus'),
    changedAt: toDate(dto.changedAt, 'statusChange.changedAt'),
  }
}

/** Maps any of the API's paged envelopes, all of which share this shape. */
export function mapPage<TDto, TModel>(
  dto: {
    items: TDto[]
    page: ApiNumber
    pageSize: ApiNumber
    totalCount: ApiNumber
    totalPages: ApiNumber
  },
  mapItem: (item: TDto) => TModel,
): Page<TModel> {
  return {
    items: dto.items.map(mapItem),
    page: toInteger(dto.page, 'page.page'),
    pageSize: toInteger(dto.pageSize, 'page.pageSize'),
    totalCount: toInteger(dto.totalCount, 'page.totalCount'),
    totalPages: toInteger(dto.totalPages, 'page.totalPages'),
  }
}
