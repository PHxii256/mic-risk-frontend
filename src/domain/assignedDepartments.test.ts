import { describe, expect, it } from 'vitest'

import { ASSIGNED_DEPARTMENTS, assignedDepartmentLabel } from './assignedDepartments'

describe('assignedDepartmentLabel', () => {
  const t = (key: string) => key

  it('returns the unassigned copy when the value is missing', () => {
    expect(assignedDepartmentLabel(null, t)).toBe('report.unassignedDepartment')
    expect(assignedDepartmentLabel('  ', t)).toBe('report.unassignedDepartment')
  })

  it('looks up a known department by its stored Arabic name', () => {
    expect(assignedDepartmentLabel('ادارة المخاطر', t)).toBe('assignedDepartments.risk')
  })

  it('returns an unknown stored value as-is rather than rejecting it', () => {
    expect(assignedDepartmentLabel('Some other unit', t)).toBe('Some other unit')
  })

  it('covers every department in the admin dropdown', () => {
    expect(ASSIGNED_DEPARTMENTS).toHaveLength(34)
  })
})
