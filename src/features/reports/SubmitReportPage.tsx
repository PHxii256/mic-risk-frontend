import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { ApiError } from '@/api/errors'
import { RiskScore } from '@/components/app/RiskBadge'
import { ErrorState } from '@/components/app/StateBoundary'
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Field,
  Select,
  Skeleton,
  Spinner,
  Textarea,
} from '@/components/ui/primitives'
import { useCurrentEmployeeId, useIsAdmin } from '@/features/auth/useSession'
import { inherentRisk, residualRisk, riskBand } from '@/domain/scoring'

import { EvaluationFields } from './evaluationFields'
import { evaluationSchema, UNSET_PRIORITY } from './evaluationSchema'
import { useCreateReport, useRiskCategories } from './hooks/queries'

const schema = evaluationSchema.extend({
  subCategoryId: z.coerce.number().int().positive(),
  description: z.string().trim().min(1),
})

type FormValues = z.input<typeof schema>

export function SubmitReportPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const employeeId = useCurrentEmployeeId()
  const isAdmin = useIsAdmin()

  const categories = useRiskCategories()
  const createReport = useCreateReport()

  const {
    control,
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subCategoryId: '' as unknown as number,
      description: '',
      severity: 3,
      frequency: 3,
      controlEffectiveness: 3,
      priority: UNSET_PRIORITY,
      existingMeasures: '',
      proposedMeasures: '',
    },
  })

  // Scores are previewed live from the same formulas the server uses, so the reporter can see
  // what their ratings amount to before submitting.
  const severity = Number(watch('severity'))
  const frequency = Number(watch('frequency'))
  const control_ = Number(watch('controlEffectiveness'))
  const inherent = inherentRisk(severity, frequency)
  const residual = residualRisk(severity, frequency, control_)

  function onSubmit(values: FormValues) {
    if (employeeId === null) return

    const parsed = schema.parse(values)

    createReport.mutate(
      {
        empId: employeeId,
        subCategoryId: parsed.subCategoryId,
        description: parsed.description,
        severity: parsed.severity,
        frequency: parsed.frequency,
        controlEffectiveness: parsed.controlEffectiveness,
        priority: isAdmin ? parsed.priority : UNSET_PRIORITY,
        existingMeasures: parsed.existingMeasures ? parsed.existingMeasures : null,
        proposedMeasures: parsed.proposedMeasures ? parsed.proposedMeasures : null,
      },
      { onSuccess: (report) => void navigate(`/reports/${report.id}`) },
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-base font-semibold text-ink">{t('nav.submitReport')}</h1>

      <form className="space-y-4" noValidate onSubmit={handleSubmit(onSubmit)}>
        <Card>
          <CardHeader>
            <CardTitle>{t('report.title')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-4">
            {categories.isPending ? (
              <Skeleton className="h-8 w-full" />
            ) : categories.isError ? (
              <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
            ) : (
              <Field
                htmlFor="subCategoryId"
                label={t('report.subcategory')}
                required
                error={errors.subCategoryId ? t('form.required') : undefined}
              >
                <Select
                  id="subCategoryId"
                  aria-required="true"
                  aria-invalid={errors.subCategoryId ? true : undefined}
                  {...register('subCategoryId')}
                >
                  <option value="">{t('form.selectPlaceholder')}</option>
                  {categories.data?.map((group) => (
                    <optgroup key={group.category} label={t(`riskCategory.${group.category}`)}>
                      {group.subcategories.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </Select>
              </Field>
            )}

            <Field
              htmlFor="description"
              label={t('report.description')}
              hint={t('report.descriptionHint')}
              required
              error={errors.description ? t('form.required') : undefined}
            >
              <Textarea
                id="description"
                rows={4}
                aria-required="true"
                aria-invalid={errors.description ? true : undefined}
                {...register('description')}
              />
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('report.evaluation')}</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <EvaluationFields control={control} register={register} showPriority={isAdmin} />

            <div className="flex flex-wrap gap-6 rounded-sm bg-surface-muted px-3 py-2.5">
              <ScorePreview
                label={t('scoring.inherentRisk')}
                hint={t('scoring.inherentRiskHint')}
                score={inherent}
              />
              <ScorePreview
                label={t('scoring.residualRisk')}
                hint={t('scoring.residualRiskHint')}
                score={residual}
              />
            </div>
          </CardBody>
        </Card>

        {createReport.isError ? (
          <p className="rounded-sm bg-danger-bg px-3 py-2 text-xs text-danger" role="alert">
            {createReport.error instanceof ApiError
              ? (createReport.error.detail ?? t('state.errorTitle'))
              : t('state.errorTitle')}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={() => void navigate('/reports')}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" disabled={createReport.isPending || employeeId === null}>
            {createReport.isPending ? (
              <>
                <Spinner />
                {t('report.submitting')}
              </>
            ) : (
              t('report.submit')
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}

function ScorePreview({ label, hint, score }: { label: string; hint: string; score: number }) {
  return (
    <div>
      <p className="text-xs font-medium text-ink-muted">{label}</p>
      <div className="mt-1">
        <RiskScore score={score} band={riskBand(score)} />
      </div>
      <p className="mt-1 max-w-xs text-xs text-ink-subtle">{hint}</p>
    </div>
  )
}
