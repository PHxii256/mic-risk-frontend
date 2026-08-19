import { Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ApiError } from '@/api/errors'
import { HeadRow, Row, TableShell, TableSkeleton, Td, Th } from '@/components/app/DataTable'
import { StateBoundary } from '@/components/app/StateBoundary'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Input,
  Spinner,
} from '@/components/ui/primitives'
import type { Department } from '@/domain/report'

import { useDepartments, useSaveDepartment } from './hooks'

export function DepartmentsPage() {
  const { t } = useTranslation()
  const departments = useDepartments()
  const [editing, setEditing] = useState<Department | 'new' | null>(null)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">{t('nav.departments')}</h1>
        <Button type="button" onClick={() => setEditing('new')}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t('department.add')}
        </Button>
      </div>

      {editing ? (
        <DepartmentForm
          department={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      ) : null}

      <StateBoundary
        isLoading={departments.isPending}
        error={departments.error}
        data={departments.data}
        onRetry={() => void departments.refetch()}
        skeleton={<TableSkeleton columns={3} />}
        isEmpty={(list) => list.length === 0}
      >
        {(list) => (
          <TableShell>
            <HeadRow>
              <Th>{t('department.name')}</Th>
              <Th>{t('department.branch')}</Th>
              <Th />
            </HeadRow>
            <tbody>
              {list.map((department) => (
                <Row key={department.id}>
                  <Td className="font-medium">{department.name}</Td>
                  <Td className="text-ink-muted">{department.branchLocation}</Td>
                  <Td>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditing(department)}
                      >
                        <Pencil className="size-3.5" aria-hidden="true" />
                        {t('common.edit')}
                      </Button>
                    </div>
                  </Td>
                </Row>
              ))}
            </tbody>
          </TableShell>
        )}
      </StateBoundary>

      {/* There is no delete endpoint for departments, so no delete affordance is offered. */}
    </div>
  )
}

function DepartmentForm({
  department,
  onClose,
}: {
  department?: Department
  onClose: () => void
}) {
  const { t } = useTranslation()
  const save = useSaveDepartment()

  const [name, setName] = useState(department?.name ?? '')
  const [branch, setBranch] = useState(department?.branchLocation ?? '')

  return (
    <Card>
      <CardHeader>
        <CardTitle>{department ? t('department.edit') : t('department.add')}</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          className="grid gap-4 sm:grid-cols-2"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save.mutate(
              { id: department?.id, name, branchLocation: branch },
              { onSuccess: onClose },
            )
          }}
        >
          <Field htmlFor="dept-name" label={t('department.name')} required>
            <Input
              id="dept-name"
              value={name}
              aria-required="true"
              onChange={(e) => setName(e.currentTarget.value)}
            />
          </Field>
          <Field htmlFor="dept-branch" label={t('department.branch')} required>
            <Input
              id="dept-branch"
              value={branch}
              aria-required="true"
              onChange={(e) => setBranch(e.currentTarget.value)}
            />
          </Field>

          {save.isError ? (
            <p className="sm:col-span-2 rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
              {save.error instanceof ApiError
                ? (save.error.detail ?? t('state.errorTitle'))
                : t('state.errorTitle')}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 sm:col-span-2">
            <Button type="button" variant="secondary" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? <Spinner /> : null}
              {t('common.save')}
            </Button>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
