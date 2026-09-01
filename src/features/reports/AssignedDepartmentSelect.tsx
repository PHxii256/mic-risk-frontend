import { useTranslation } from 'react-i18next'

import { Select } from '@/components/ui/primitives'
import { ASSIGNED_DEPARTMENTS } from '@/domain/assignedDepartments'

export function AssignedDepartmentSelect({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()

  return (
    <Select
      id={id}
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.currentTarget.value)}
    >
      <option value="">{t('report.unassignedDepartment')}</option>
      {ASSIGNED_DEPARTMENTS.map((department) => (
        <option key={department.id} value={department.value}>
          {t(`assignedDepartments.${department.id}`)}
        </option>
      ))}
    </Select>
  )
}
