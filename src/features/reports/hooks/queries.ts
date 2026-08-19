import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, unwrap, unwrapAllowingNotFound } from '@/api/client'
import type { components } from '@/api/schema'
import {
  mapPage,
  mapReport,
  mapStatusChange,
  mapSubcategory,
  type Page,
  type RiskReport,
  type StatusChange,
  type Subcategory,
} from '@/domain/report'

export const reportKeys = {
  all: ['reports'] as const,
  mine: () => [...reportKeys.all, 'mine'] as const,
  detail: (id: number) => [...reportKeys.all, 'detail', id] as const,
  history: (id: number, page: number) => [...reportKeys.all, 'history', id, page] as const,
}

export const taxonomyKeys = {
  categories: ['taxonomy', 'categories'] as const,
}

export interface CategoryGroup {
  category: string
  subcategories: Subcategory[]
}

/**
 * The picker source. There is no list-all subcategory endpoint, so the grouped categories
 * response is what populates the form.
 */
export function useRiskCategories() {
  return useQuery({
    queryKey: taxonomyKeys.categories,
    queryFn: async ({ signal }): Promise<CategoryGroup[]> => {
      const data = await unwrapAllowingNotFound(
        api.GET('/api/risk-subcategory/categories', { signal }),
        [] as components['schemas']['RiskCategoryResponseDto'][],
      )

      return data.map((group) => ({
        category: group.nameEn,
        // The nested items carry no category of their own, so it comes from the group.
        subcategories: group.riskSubcategories.map((sub) =>
          mapSubcategory({
            id: sub.id,
            nameEn: sub.nameEn,
            nameAr: sub.nameAr,
            category: group.nameEn,
          }),
        ),
      }))
    },
    // The taxonomy changes rarely and every form needs it; a long stale time avoids refetching
    // it on each visit to the submit screen.
    staleTime: 10 * 60_000,
  })
}

/** `/mine` returns a plain array, unlike the paged `/api/risk-report` an admin sees. */
export function useMyReports() {
  return useQuery({
    queryKey: reportKeys.mine(),
    queryFn: async ({ signal }): Promise<RiskReport[]> => {
      const data = await unwrap(api.GET('/api/risk-report/mine', { signal }))
      return data.map(mapReport)
    },
  })
}

export function useReport(reportId: number) {
  return useQuery({
    queryKey: reportKeys.detail(reportId),
    queryFn: async ({ signal }): Promise<RiskReport> => {
      const data = await unwrap(
        api.GET('/api/risk-report/{id}', { params: { path: { id: reportId } }, signal }),
      )
      return mapReport(data)
    },
    enabled: Number.isFinite(reportId),
  })
}

/** Unlike `/mine`, the history endpoint is paged. */
export function useReportHistory(reportId: number, page = 1) {
  return useQuery({
    queryKey: reportKeys.history(reportId, page),
    queryFn: async ({ signal }): Promise<Page<StatusChange>> => {
      const data = await unwrap(
        api.GET('/api/risk-report/{id}/history', {
          params: { path: { id: reportId }, query: { page } },
          signal,
        }),
      )
      return mapPage(data, mapStatusChange)
    },
    enabled: Number.isFinite(reportId),
    placeholderData: (previous) => previous,
  })
}

export interface CreateReportInput {
  empId: number
  subCategoryId: number
  description: string
  severity: number
  frequency: number
  controlEffectiveness: number
  priority: number
  existingMeasures: string | null
  proposedMeasures: string | null
}

/**
 * Creating a report is not optimistic: it is not locally reversible, the server assigns the id
 * and both computed scores, and a duplicate submission would be a real duplicate risk entry.
 */
export function useCreateReport() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateReportInput): Promise<RiskReport> => {
      const data = await unwrap(
        api.POST('/api/risk-report', {
          body: {
            empId: input.empId,
            subCategoryId: input.subCategoryId,
            description: input.description,
            evaluation: {
              severity: input.severity,
              frequency: input.frequency,
              controlEffectiveness: input.controlEffectiveness,
              priority: input.priority,
              existingMeasures: input.existingMeasures,
              proposedMeasures: input.proposedMeasures,
            },
          },
        }),
      )
      return mapReport(data)
    },
    onSuccess: (report) => {
      queryClient.setQueryData(reportKeys.detail(report.id), report)
      void queryClient.invalidateQueries({ queryKey: reportKeys.mine() })
    },
  })
}

export interface AuditorEvaluationInput {
  reportId: number
  severity: number
  frequency: number
  controlEffectiveness: number
  priority: number
  existingMeasures: string | null
  proposedMeasures: string | null
}

function evaluationBody(input: AuditorEvaluationInput) {
  return {
    severity: input.severity,
    frequency: input.frequency,
    controlEffectiveness: input.controlEffectiveness,
    priority: input.priority,
    existingMeasures: input.existingMeasures,
    proposedMeasures: input.proposedMeasures,
  }
}

/**
 * Creating and revising are separate calls because the server treats them differently: a second
 * POST is rejected, so that one auditor cannot silently overwrite another's assessment. Both
 * return the whole report, which already carries the recomputed scores.
 */
export function useSaveAuditorEvaluation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['reports', 'auditor-evaluation'],
    mutationFn: async ({
      input,
      mode,
    }: {
      input: AuditorEvaluationInput
      mode: 'create' | 'revise'
    }): Promise<RiskReport> => {
      const params = { path: { id: input.reportId } }
      const body = evaluationBody(input)

      const data =
        mode === 'create'
          ? await unwrap(api.POST('/api/risk-report/{id}/auditor-evaluation', { params, body }))
          : await unwrap(api.PUT('/api/risk-report/{id}/auditor-evaluation', { params, body }))

      return mapReport(data)
    },
    onSuccess: (report) => {
      queryClient.setQueryData(reportKeys.detail(report.id), report)
      void queryClient.invalidateQueries({ queryKey: reportKeys.mine() })
    },
  })
}
