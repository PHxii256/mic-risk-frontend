/**
 * Canonical assigned-department names stored on a risk report.
 *
 * These are not employee org units from GET /api/department. The API accepts any string (or
 * null); this list is the admin dropdown, not a client-side constraint.
 */
export const ASSIGNED_DEPARTMENTS = [
  { id: 'fireUnderwriting', value: 'ادارة اصدار الحريق' },
  { id: 'accidentUnderwriting', value: 'ادارة اصدار الحوادث' },
  { id: 'motorUnderwriting', value: 'ادارة اصدار السيارات' },
  { id: 'medicalUnderwriting', value: 'ادارة اصدار الطبى' },
  { id: 'marineTransportUnderwriting', value: 'ادارة اصدار النقل و البحرى' },
  { id: 'engineeringUnderwriting', value: 'ادارة اصدار الهندسى' },
  { id: 'guaranteeUnderwritingClaims', value: 'ادارة اصدار وتعويضات الضمان' },
  { id: 'hullUnderwriting', value: 'ادارة اصدار اجسام السفن' },
  { id: 'reinsurance', value: 'ادارة اعادة التأمين' },
  { id: 'investment', value: 'ادارة الأستثمار' },
  { id: 'collection', value: 'ادارة التحصيل' },
  { id: 'marketing', value: 'ادارة التسويق' },
  { id: 'itSystems', value: 'ادارة الحاسب الألى ونظم المعلومات' },
  { id: 'accounts', value: 'ادارة الحسابات' },
  { id: 'governanceCompliance', value: 'ادارة الحوكمة و الألتزام' },
  { id: 'treasury', value: 'ادارة الخزنة' },
  { id: 'legalAffairs', value: 'ادارة الشئون القانونية' },
  { id: 'tax', value: 'ادارة الضرائب' },
  { id: 'risk', value: 'ادارة المخاطر' },
  { id: 'internalAudit', value: 'ادارة المراجعة الداخلية' },
  { id: 'internalControlInspection', value: 'ادارة المراقبة و التفتيش الداخلى' },
  { id: 'survey', value: 'ادارة المعاينات' },
  { id: 'hrAdmin', value: 'ادارة الموارد البشرية و الشئون الأدارية' },
  { id: 'businessDevelopment', value: 'ادارة تطوير الأعمال' },
  { id: 'fireClaims', value: 'ادارة تعويضات الحريق' },
  { id: 'accidentClaims', value: 'ادارة تعويضات الحوادث' },
  { id: 'motorClaims', value: 'ادارة تعويضات السيارات' },
  { id: 'medicalClaims', value: 'ادارة تعويضات الطبى' },
  { id: 'landMarineHullClaims', value: 'ادارة تعويضات النقل البرى والبحرى و اجسام السفن' },
  { id: 'engineeringClaims', value: 'ادارة تعويضات الهندسى' },
  { id: 'reinsuranceAccounts', value: 'ادارة حسابات اعادة التأمين' },
  { id: 'producersAffairs', value: 'ادارة شئون المنتجين' },
  { id: 'collectionControl', value: 'ادارة مراقبة التحصيل' },
  { id: 'amlCft', value: 'ادارة مكافحة غسل الأموال و تمويل الأرهاب' },
] as const

export type AssignedDepartmentId = (typeof ASSIGNED_DEPARTMENTS)[number]['id']

export function assignedDepartmentLabel(
  value: string | null,
  t: (key: string) => string,
): string {
  if (value === null || value.trim() === '') return t('report.unassignedDepartment')
  const match = ASSIGNED_DEPARTMENTS.find((department) => department.value === value)
  return match ? t(`assignedDepartments.${match.id}`) : value
}
