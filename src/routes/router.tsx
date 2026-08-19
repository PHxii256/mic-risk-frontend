import { createBrowserRouter, Navigate } from 'react-router'

import { AppShell } from '@/components/app/AppShell'
import { ChangePasswordPage } from '@/features/account/ChangePasswordPage'
import { DepartmentsPage } from '@/features/admin/DepartmentsPage'
import { EmployeesPage } from '@/features/admin/EmployeesPage'
import { TaxonomyPage } from '@/features/admin/TaxonomyPage'
import { AnalyticsPage } from '@/features/analytics/AnalyticsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { AllReportsPage } from '@/features/reports/AllReportsPage'
import { MyReportsPage } from '@/features/reports/MyReportsPage'
import { ReportDetailPage } from '@/features/reports/ReportDetailPage'
import { SubmitReportPage } from '@/features/reports/SubmitReportPage'
import { ResourcesPage } from '@/features/resources/ResourcesPage'

import { HomeRedirect, RedirectIfSignedIn, RequireAdmin, RequireSession, Root } from './guards'

export const router = createBrowserRouter([
  {
    element: <Root />,
    children: [
      {
        element: <RedirectIfSignedIn />,
        children: [{ path: '/login', element: <LoginPage /> }],
      },
      {
        element: <RequireSession />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <HomeRedirect /> },

              // Available to everyone.
              { path: 'reports', element: <MyReportsPage /> },
              { path: 'reports/new', element: <SubmitReportPage /> },
              { path: 'reports/:reportId', element: <ReportDetailPage /> },
              { path: 'resources', element: <ResourcesPage /> },
              { path: 'account/password', element: <ChangePasswordPage /> },

              // Admin only. The backend enforces this too; these guards only keep the
              // navigation honest and avoid rendering screens that would 403.
              {
                element: <RequireAdmin />,
                children: [
                  { path: 'admin', element: <DashboardPage /> },
                  { path: 'admin/reports', element: <AllReportsPage /> },
                  { path: 'admin/analytics', element: <AnalyticsPage /> },
                  { path: 'admin/employees', element: <EmployeesPage /> },
                  { path: 'admin/departments', element: <DepartmentsPage /> },
                  { path: 'admin/taxonomy', element: <TaxonomyPage /> },
                ],
              },
            ],
          },
        ],
      },
      { path: '*', element: <Navigate to="/reports" replace /> },
    ],
  },
])
