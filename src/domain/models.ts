import { toDate, toEnum, toInteger, toNumber, toOptionalDate, toOptionalText } from '@/api/coerce'
import type { components } from '@/api/schema'

import { mapEmployee, type Employee } from './report'
import { riskBand, type RiskBand } from './scoring'

type ActionDto = components['schemas']['RiskActionResponseDto']
type ResourceDto = components['schemas']['ResourceResponseDto']
type EngagementDto = components['schemas']['ResourceEngagementResponseDto']
type DashboardDto = components['schemas']['AnalyticsDashboardDto']
type DepartmentStatsDto = components['schemas']['EmployeeDepartmentStatsDto']
type EngagementStatsDto = components['schemas']['ResourceEngagementStatsDto']
type DeptEngagementDto = components['schemas']['DepartmentEngagementStatsDto']

/* ------------------------------------------------------------------ risk actions */

export const ACTION_STATUSES = ['Pending', 'Completed'] as const
export type ActionStatus = (typeof ACTION_STATUSES)[number]

export interface RiskAction {
  id: number
  reportId: number
  title: string
  description: string | null
  assignee: Employee
  dueDate: Date
  status: ActionStatus
  createdAt: Date
  completedAt: Date | null
  /** Derived, not sent by the server: a pending action past its due date. */
  isOverdue: boolean
}

export function mapRiskAction(dto: ActionDto): RiskAction {
  const status = toEnum(dto.status, ACTION_STATUSES, 'action.status')
  const dueDate = toDate(dto.dueDate, 'action.dueDate')

  return {
    id: toInteger(dto.id, 'action.id'),
    reportId: toInteger(dto.reportId, 'action.reportId'),
    title: dto.title,
    description: toOptionalText(dto.description),
    assignee: mapEmployee(dto.assignee),
    dueDate,
    status,
    createdAt: toDate(dto.createdAt, 'action.createdAt'),
    completedAt: toOptionalDate(dto.completedAt, 'action.completedAt'),
    isOverdue: status === 'Pending' && dueDate.getTime() < Date.now(),
  }
}

export interface ActionSummary {
  overdueCount: number
  dueThisWeekCount: number
}

export function mapActionSummary(
  dto: components['schemas']['RiskActionSummaryDto'],
): ActionSummary {
  return {
    overdueCount: toInteger(dto.overdueCount, 'summary.overdueCount'),
    dueThisWeekCount: toInteger(dto.dueThisWeekCount, 'summary.dueThisWeekCount'),
  }
}

/* ------------------------------------------------------------------ resources */

export interface Resource {
  id: number
  name: string
  uploadedBy: Employee
  url: string
  type: string
  description: string | null
  uploadedAt: Date
}

export function mapResource(dto: ResourceDto): Resource {
  return {
    id: toInteger(dto.id, 'resource.id'),
    name: dto.name,
    uploadedBy: mapEmployee(dto.uploadedBy),
    url: dto.url,
    type: dto.type,
    description: toOptionalText(dto.description),
    uploadedAt: toDate(dto.uploadedAt, 'resource.uploadedAt'),
  }
}

export interface ResourceEngagement {
  id: number
  employee: Employee
  resource: Resource
  viewed: boolean
  surveyCompleted: boolean
  viewedAt: Date | null
  completedAt: Date | null
}

export function mapEngagement(dto: EngagementDto): ResourceEngagement {
  return {
    id: toInteger(dto.id, 'engagement.id'),
    employee: mapEmployee(dto.employee),
    resource: mapResource(dto.resource),
    viewed: dto.viewed,
    // Nullable on the wire; absent simply means not done.
    surveyCompleted: dto.surveyCompleted === true,
    viewedAt: toOptionalDate(dto.viewedAt, 'engagement.viewedAt'),
    completedAt: toOptionalDate(dto.completedAt, 'engagement.completedAt'),
  }
}

export interface ResourceEngagementStats {
  resourceId: number
  resourceName: string
  resourceType: string
  viewCount: number
  quizCompletionCount: number
  completionRate: number
  /** Active non-admin employees: the people the resource is actually aimed at. */
  eligibleEmployees: number
}

export function mapEngagementStats(dto: EngagementStatsDto): ResourceEngagementStats {
  return {
    resourceId: toInteger(dto.resourceId, 'stats.resourceId'),
    resourceName: dto.resourceName,
    resourceType: dto.resourceType,
    viewCount: toInteger(dto.viewCount, 'stats.viewCount'),
    quizCompletionCount: toInteger(dto.quizCompletionCount, 'stats.quizCompletionCount'),
    completionRate: toNumber(dto.completionRate, 'stats.completionRate'),
    eligibleEmployees: toInteger(dto.eligibleEmployees, 'stats.eligibleEmployees'),
  }
}

export interface DepartmentEngagement {
  departmentId: number
  departmentName: string
  activeEmployees: number
  employeesWithQuizCompletion: number
  awarenessPercentage: number
}

export function mapDepartmentEngagement(dto: DeptEngagementDto): DepartmentEngagement {
  return {
    departmentId: toInteger(dto.departmentId, 'deptEngagement.departmentId'),
    departmentName: dto.departmentName,
    activeEmployees: toInteger(dto.activeEmployees, 'deptEngagement.activeEmployees'),
    employeesWithQuizCompletion: toInteger(
      dto.employeesWithQuizCompletion,
      'deptEngagement.employeesWithQuizCompletion',
    ),
    awarenessPercentage: toNumber(dto.awarenessPercentage, 'deptEngagement.awarenessPercentage'),
  }
}

/* ------------------------------------------------------------------ analytics */

export interface CountByLabel {
  label: string
  count: number
}

export interface MatrixCell {
  severity: number
  frequency: number
  count: number
}

export interface BandCount {
  band: RiskBand
  count: number
}

export interface AnalyticsDashboard {
  riskAwarenessPercentage: number
  criticalResidualRisks: number
  weakControls: number
  pendingReview: number
  overdueActions: number
  dueThisWeekActions: number
  averageResolutionHours: number | null
  risksThisWeek: number
  risksThisMonth: number
  risksByDepartment: CountByLabel[]
  risksByLocation: CountByLabel[]
  subcategoryDistribution: CountByLabel[]
  maturityByDepartment: { departmentName: string; maturityScore: number }[]
  /** Severity x frequency for open reports, before controls are credited. */
  inherentMatrix: MatrixCell[]
  /** Open reports counted per residual band, showing the effect of controls. */
  residualBands: BandCount[]
}

function mapCount(dto: components['schemas']['CountByLabelDto']): CountByLabel {
  return { label: dto.label, count: toInteger(dto.count, 'count.count') }
}

export function mapDashboard(dto: DashboardDto): AnalyticsDashboard {
  return {
    riskAwarenessPercentage: toNumber(dto.riskAwarenessPercentage, 'dashboard.awareness'),
    criticalResidualRisks: toInteger(
      dto.earlyWarningIndicators.criticalResidualRisks,
      'dashboard.criticalResidualRisks',
    ),
    weakControls: toInteger(dto.earlyWarningIndicators.weakControls, 'dashboard.weakControls'),
    pendingReview: toInteger(dto.earlyWarningIndicators.pendingReview, 'dashboard.pendingReview'),
    overdueActions: toInteger(dto.outstandingActions.overdueCount, 'dashboard.overdue'),
    dueThisWeekActions: toInteger(dto.outstandingActions.dueThisWeekCount, 'dashboard.dueThisWeek'),
    averageResolutionHours:
      dto.averageRiskResolutionTimeHours === null ||
      dto.averageRiskResolutionTimeHours === undefined
        ? null
        : toNumber(dto.averageRiskResolutionTimeHours, 'dashboard.averageResolution'),
    risksThisWeek: toInteger(dto.risksSubmittedThisWeek, 'dashboard.thisWeek'),
    risksThisMonth: toInteger(dto.risksSubmittedThisMonth, 'dashboard.thisMonth'),
    risksByDepartment: dto.risksByDepartment.map(mapCount),
    risksByLocation: dto.risksByLocation.map(mapCount),
    subcategoryDistribution: dto.riskSubcategoryDistribution.map(mapCount),
    maturityByDepartment: dto.riskMaturityByDepartment.map((m) => ({
      departmentName: m.departmentName,
      maturityScore: toNumber(m.maturityScore, 'dashboard.maturity'),
    })),
    inherentMatrix: dto.inherentRiskMatrix.cells.map((cell) => ({
      severity: toInteger(cell.severity, 'matrix.severity'),
      frequency: toInteger(cell.frequency, 'matrix.frequency'),
      count: toInteger(cell.count, 'matrix.count'),
    })),
    residualBands: dto.residualRiskBands.map((b) => ({
      band: b.band as RiskBand,
      count: toInteger(b.count, 'bands.count'),
    })),
  }
}

export interface EmployeeDepartmentStats {
  departmentId: number
  departmentName: string
  activeEmployees: number
  employeesWithQuizCompletion: number
  awarenessPercentage: number
  riskReportCount: number
}

export function mapEmployeeDepartmentStats(dto: DepartmentStatsDto): EmployeeDepartmentStats {
  return {
    departmentId: toInteger(dto.departmentId, 'deptStats.departmentId'),
    departmentName: dto.departmentName,
    activeEmployees: toInteger(dto.activeEmployees, 'deptStats.activeEmployees'),
    employeesWithQuizCompletion: toInteger(
      dto.employeesWithQuizCompletion,
      'deptStats.employeesWithQuizCompletion',
    ),
    awarenessPercentage: toNumber(dto.awarenessPercentage, 'deptStats.awarenessPercentage'),
    riskReportCount: toInteger(dto.riskReportCount, 'deptStats.riskReportCount'),
  }
}

/** Convenience for tiles that colour a count by the band it represents. */
export function bandOf(score: number): RiskBand {
  return riskBand(score)
}
