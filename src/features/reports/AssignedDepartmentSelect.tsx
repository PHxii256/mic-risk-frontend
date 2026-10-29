import { useTranslation } from 'react-i18next'

import { Select } from '@/components/ui/primitives'
import type { Department } from '@/domain/report'

export function AssignedDepartmentSelect({
  id,
  value,
  departments,
  onChange,
  disabled,
}: {
  id: string
  value: number | null
  departments: Department[]
  onChange: (value: number | null) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Select
      id={id}
      value={value ?? ''}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value ? Number(event.currentTarget.value) : null)}
    >
      <option value="">{t('report.unassignedDepartment')}</option>
      {departments.map((department) => (
        <option key={department.id} value={department.id}>
          {department.name} ({department.branchLocation})
        </option>
      ))}
    </Select>
  )
}
