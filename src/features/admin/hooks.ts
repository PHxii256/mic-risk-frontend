import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api, requestJson, unwrap, unwrapAllowingNotFound, uploadFile } from '@/api/client'
import type { components } from '@/api/schema'
import {
  mapActionSummary,
  mapDashboard,
  mapDepartmentEngagement,
  mapEmployeeDepartmentStats,
  mapEngagement,
  mapEngagementStats,
  mapResource,
  mapRiskAction,
  type ActionStatus,
  type AnalyticsDashboard,
  type DepartmentEngagement,
  type EmployeeDepartmentStats,
  type ResourceEngagement,
  type ResourceEngagementStats,
} from '@/domain/models'
import {
  mapDepartment,
  mapEmployee,
  mapPage,
  mapReport,
  mapSubcategory,
  type Department,
  type Employee,
  type ReportStatus,
  type RiskReport,
  type Subcategory,
} from '@/domain/report'

export const keys = {
  reports: (status: string | null, page: number, search: string, sortBy: string, sortDir: string) =>
    ['reports', 'all', status, page, search, sortBy, sortDir] as const,
  employees: ['employees'] as const,
  departments: ['departments'] as const,
  actionsByReport: (reportId: number) => ['actions', 'byReport', reportId] as const,
  actionSummary: ['actions', 'summary'] as const,
  resources: ['resources'] as const,
  myEngagement: ['engagement', 'mine'] as const,
  engagementStats: ['engagement', 'stats'] as const,
  engagementByDept: ['engagement', 'byDepartment'] as const,
  dashboard: (from: string | null, to: string | null) => ['analytics', 'dashboard', from, to] as const,
  employeesByDept: ['analytics', 'employeesByDepartment'] as const,
  categories: ['taxonomy', 'categories'] as const,
}

/* ------------------------------------------------------------------ reports (admin) */

/** The admin queue. Unlike `/mine`, this endpoint is paged and takes a status filter. */
export function useAllReports(
  status: ReportStatus | null,
  page: number,
  search = '',
  sortBy = 'submittedAt',
  sortDir: 'asc' | 'desc' = 'desc',
) {
  return useQuery({
    queryKey: keys.reports(status, page, search, sortBy, sortDir),
    queryFn: async ({ signal }) => {
      const data = await unwrap(
        api.GET('/api/risk-report', {
          params: {
            query: {
              ...(status ? { status } : {}),
              ...(search ? { search } : {}),
              page,
              pageSize: 20,
              sortBy,
              sortDir,
            },
          },
          signal,
        }),
      )
      return mapPage(data, mapReport)
    },
    // Keeps the current page on screen while the next one loads, instead of flashing a skeleton.
    placeholderData: (previous) => previous,
  })
}

/**
 * Status changes are optimistic: the transition is already constrained to what the server
 * accepts, and flipping a badge back on failure is cheap. The status history has to be
 * invalidated as well — the server writes a history row, so a stale panel would contradict
 * the badge directly above it.
 */
export function useUpdateReportStatus(reportId: number) {
  const queryClient = useQueryClient()
  const detailKey = ['reports', 'detail', reportId] as const

  return useMutation({
    mutationKey: ['reports', 'status', reportId],
    mutationFn: async (newStatus: ReportStatus): Promise<RiskReport> => {
      const data = await unwrap(
        api.PATCH('/api/risk-report/{id}/status', {
          params: { path: { id: reportId } },
          body: { newStatus },
        }),
      )
      return mapReport(data)
    },
    onMutate: async (newStatus) => {
      await queryClient.cancelQueries({ queryKey: detailKey })
      const previous = queryClient.getQueryData<RiskReport>(detailKey)

      if (previous) {
        queryClient.setQueryData<RiskReport>(detailKey, { ...previous, status: newStatus })
      }

      return { previous }
    },
    onError: (_error, _status, context) => {
      if (context?.previous) queryClient.setQueryData(detailKey, context.previous)
    },
    onSuccess: (report) => {
      queryClient.setQueryData(detailKey, report)
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['reports', 'history', reportId] })
      void queryClient.invalidateQueries({ queryKey: ['reports', 'all'] })
      void queryClient.invalidateQueries({ queryKey: ['reports', 'mine'] })
    },
  })
}

/* ------------------------------------------------------------------ employees */

export function useEmployees() {
  return useQuery({
    queryKey: keys.employees,
    queryFn: async ({ signal }): Promise<Employee[]> => {
      const data = await unwrap(api.GET('/api/employee', { signal }))
      return data.map(mapEmployee)
    },
  })
}

export interface CreateEmployeeInput {
  email: string
  password: string
  name: string
  deptId: number
  role: string
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['employees', 'create'],
    mutationFn: async (input: CreateEmployeeInput) =>
      mapEmployee(await unwrap(api.POST('/api/employee', { body: input }))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.employees }),
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['employees', 'update'],
    mutationFn: async (input: { id: number; name: string; deptId: number; active: boolean }) =>
      mapEmployee(
        await unwrap(
          api.PUT('/api/employee/{id}', {
            params: { path: { id: input.id } },
            body: { name: input.name, deptId: input.deptId, active: input.active },
          }),
        ),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.employees }),
  })
}

/**
 * Returns 204 with no body, so there is nothing to reconcile against — the list is invalidated
 * instead of being patched from a response.
 */
export function useToggleEmployeeActive() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['employees', 'toggle'],
    mutationFn: async (id: number) => {
      await unwrap(
        api.PATCH('/api/employee/{id}/toggle-active', { params: { path: { id } } }),
      )
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.employees }),
  })
}

export function useResetEmployeePassword() {
  return useMutation({
    mutationKey: ['employees', 'resetPassword'],
    mutationFn: async (input: { id: number; newPassword: string }) =>
      requestJson<void>('POST', `/api/employee/${input.id}/reset-password`, {
        newPassword: input.newPassword,
      }),
  })
}

/* ------------------------------------------------------------------ departments */

export function useDepartments() {
  return useQuery({
    queryKey: keys.departments,
    queryFn: async ({ signal }): Promise<Department[]> => {
      const data = await unwrap(api.GET('/api/department', { signal }))
      return data.map(mapDepartment)
    },
    staleTime: 5 * 60_000,
  })
}

export function useSaveDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['departments', 'save'],
    mutationFn: async (input: { id?: number; name: string; branchLocation: string }) => {
      const body = { name: input.name, branchLocation: input.branchLocation }

      const data =
        input.id === undefined
          ? await unwrap(api.POST('/api/department', { body }))
          : await unwrap(
              api.PUT('/api/department/{id}', { params: { path: { id: input.id } }, body }),
            )

      return mapDepartment(data)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.departments }),
  })
}

/* ------------------------------------------------------------------ risk actions */

export function useActionsByReport(reportId: number, enabled: boolean) {
  return useQuery({
    queryKey: keys.actionsByReport(reportId),
    queryFn: async ({ signal }) => {
      const data = await unwrap(
        api.GET('/api/risk-action/by-report/{reportId}', {
          params: { path: { reportId } },
          signal,
        }),
      )
      return data.map(mapRiskAction)
    },
    enabled: enabled && Number.isFinite(reportId),
  })
}

export function useActionSummary() {
  return useQuery({
    queryKey: keys.actionSummary,
    queryFn: async ({ signal }) =>
      mapActionSummary(await unwrap(api.GET('/api/risk-action/summary', { signal }))),
  })
}

export interface ActionInput {
  id?: number
  reportId: number
  title: string
  description: string | null
  assigneeEmpId: number
  dueDate: string
  status: ActionStatus
}

export function useSaveAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['actions', 'save'],
    mutationFn: async (input: ActionInput) => {
      const data =
        input.id === undefined
          ? await unwrap(
              api.POST('/api/risk-action', {
                body: {
                  reportId: input.reportId,
                  title: input.title,
                  description: input.description,
                  assigneeEmpId: input.assigneeEmpId,
                  dueDate: input.dueDate,
                },
              }),
            )
          : await unwrap(
              api.PUT('/api/risk-action/{id}', {
                params: { path: { id: input.id } },
                body: {
                  title: input.title,
                  description: input.description,
                  assigneeEmpId: input.assigneeEmpId,
                  dueDate: input.dueDate,
                  status: input.status,
                },
              }),
            )

      return mapRiskAction(data)
    },
    onSuccess: (action) => {
      void queryClient.invalidateQueries({ queryKey: ['actions'] })
      void queryClient.invalidateQueries({ queryKey: keys.actionsByReport(action.reportId) })
    },
  })
}

export function useDeleteAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['actions', 'delete'],
    mutationFn: async (id: number) => {
      await unwrap(api.DELETE('/api/risk-action/{id}', { params: { path: { id } } }))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ['actions'] }),
  })
}

/* ------------------------------------------------------------------ resources */

export function useResources() {
  return useQuery({
    queryKey: keys.resources,
    queryFn: async ({ signal }) => {
      const data = await unwrap(api.GET('/api/resource', { signal }))
      return data.map(mapResource)
    },
  })
}

export function useMyEngagement() {
  return useQuery({
    queryKey: keys.myEngagement,
    queryFn: async ({ signal }): Promise<ResourceEngagement[]> => {
      const data = await unwrap(api.GET('/api/resource-engagement/mine', { signal }))
      return data.map(mapEngagement)
    },
  })
}

/** An upsert returning 200, and a toggle the user can reverse, so it is safe to do optimistically. */
export function useRecordEngagement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['engagement', 'record'],
    mutationFn: async (input: {
      empId: number
      resourceId: number
      viewed: boolean
      surveyCompleted: boolean
    }) => mapEngagement(await unwrap(api.POST('/api/resource-engagement', { body: input }))),
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: keys.myEngagement })
      void queryClient.invalidateQueries({ queryKey: keys.engagementStats })
    },
  })
}

export function useEngagementStats(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: keys.engagementStats,
    // Admin-only endpoint: skipped entirely for employees rather than fetching a guaranteed 403.
    enabled: options.enabled ?? true,
    queryFn: async ({ signal }): Promise<ResourceEngagementStats[]> => {
      const data = await unwrap(api.GET('/api/resource-engagement/stats', { signal }))
      return data.map(mapEngagementStats)
    },
  })
}

export function useEngagementByDepartment() {
  return useQuery({
    queryKey: keys.engagementByDept,
    queryFn: async ({ signal }): Promise<DepartmentEngagement[]> => {
      const data = await unwrap(api.GET('/api/resource-engagement/by-department', { signal }))
      return data.map(mapDepartmentEngagement)
    },
  })
}

/**
 * Creates a resource that points at a URL rather than an uploaded file: a link, an embedded
 * video, or a survey. The upload endpoint covers files; this one covers everything else.
 */
export function useCreateLinkResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['resources', 'createLink'],
    mutationFn: async (input: {
      name: string
      uploadedByEmpId: number
      url: string
      type: string
      description: string | null
    }) => mapResource(await unwrap(api.POST('/api/resource', { body: input }))),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.resources }),
  })
}

export function useSaveResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['resources', 'save'],
    mutationFn: async (input: { id?: number; name: string; description: string | null }) => {
      if (input.id === undefined) throw new Error('Use the upload flow to create a resource.')

      return mapResource(
        await unwrap(
          api.PATCH('/api/resource/{id}', {
            params: { path: { id: input.id } },
            body: { name: input.name, description: input.description },
          }),
        ),
      )
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.resources }),
  })
}

export function useUploadResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['resources', 'upload'],
    mutationFn: async (input: { file: File; name: string; description: string }) =>
      mapResource(
        await uploadFile<components['schemas']['ResourceResponseDto']>('/api/resource/upload', {
          file: input.file,
          name: input.name,
          description: input.description,
        }),
      ),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.resources }),
  })
}

export function useDeleteResource() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['resources', 'delete'],
    mutationFn: async (id: number) => {
      await unwrap(api.DELETE('/api/resource/{id}', { params: { path: { id } } }))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.resources }),
  })
}

/* ------------------------------------------------------------------ analytics */

export function useDashboard(from: string | null, to: string | null) {
  return useQuery({
    queryKey: keys.dashboard(from, to),
    queryFn: async ({ signal }): Promise<AnalyticsDashboard> => {
      const query = { ...(from ? { from } : {}), ...(to ? { to } : {}) }
      return mapDashboard(await unwrap(api.GET('/api/analytics/dashboard', { params: { query }, signal })))
    },
  })
}

export function useEmployeesByDepartment() {
  return useQuery({
    queryKey: keys.employeesByDept,
    queryFn: async ({ signal }): Promise<EmployeeDepartmentStats[]> => {
      const data = await unwrap(api.GET('/api/analytics/employees-by-department', { signal }))
      return data.map(mapEmployeeDepartmentStats)
    },
  })
}

/* ------------------------------------------------------------------ taxonomy */

export interface CategoryGroup {
  category: string
  subcategories: Subcategory[]
}

export function useCategories() {
  return useQuery({
    queryKey: keys.categories,
    queryFn: async ({ signal }): Promise<CategoryGroup[]> => {
      const data = await unwrapAllowingNotFound(
        api.GET('/api/risk-subcategory/categories', { signal }),
        [] as components['schemas']['RiskCategoryResponseDto'][],
      )

      return data.map((group) => ({
        category: group.name,
        subcategories: group.riskSubcategories.map((sub) =>
          mapSubcategory({ id: sub.id, name: sub.name, category: group.name }),
        ),
      }))
    },
    staleTime: 10 * 60_000,
  })
}

export function useSaveSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['taxonomy', 'save'],
    mutationFn: async (input: { id?: number; name: string; category: string }) => {
      const body = { name: input.name, category: input.category }

      const data =
        input.id === undefined
          ? await unwrap(api.POST('/api/risk-subcategory', { body }))
          : await unwrap(
              api.PUT('/api/risk-subcategory/{id}', {
                params: { path: { id: input.id } },
                body,
              }),
            )

      return mapSubcategory(data)
    },
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.categories }),
  })
}

/** A soft delete: the subcategory is deactivated, and there is no endpoint to restore it. */
export function useDeleteSubcategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: ['taxonomy', 'delete'],
    mutationFn: async (id: number) => {
      await unwrap(api.DELETE('/api/risk-subcategory/{id}', { params: { path: { id } } }))
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.categories }),
  })
}

/* ------------------------------------------------------------------ account */

export function useChangePassword() {
  return useMutation({
    mutationKey: ['account', 'changePassword'],
    mutationFn: async (input: { currentPassword: string; newPassword: string }) =>
      requestJson<components['schemas']['AuthResponseDto']>(
        'POST',
        '/api/account/change-password',
        input,
      ),
  })
}
