import {
  Controller,
  type Control,
  type FieldPath,
  type FieldValues,
  type UseFormRegister,
} from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { Field, RatingSlider, Textarea } from '@/components/ui/primitives'
import {
  CONTROL_EFFECTIVENESS_KEYS,
  FREQUENCY_KEYS,
  PRIORITY_KEYS,
  SEVERITY_KEYS,
  type Rating,
} from '@/domain/scoring'

/**
 * The four rating sliders and the two free-text control fields, shared by the reporter's submit
 * form and the auditor's revision form so the two can never drift apart.
 */
export function EvaluationFields<T extends FieldValues>({
  control,
  register,
  showPriority,
}: {
  control: Control<T>
  register: UseFormRegister<T>
  /** Priority is rendered only for admins, who are the ones who set it. */
  showPriority: boolean
}) {
  const { t } = useTranslation()

  return (
    <>
      <div className="grid gap-5 sm:grid-cols-2">
        <RatingField
          control={control}
          name={'severity' as FieldPath<T>}
          label={t('scoring.severity')}
          labelKeys={SEVERITY_KEYS}
        />
        <RatingField
          control={control}
          name={'frequency' as FieldPath<T>}
          label={t('scoring.frequency')}
          labelKeys={FREQUENCY_KEYS}
        />
        <RatingField
          control={control}
          name={'controlEffectiveness' as FieldPath<T>}
          label={t('scoring.controlEffectiveness')}
          hint={t('scoring.controlEffectivenessHint')}
          labelKeys={CONTROL_EFFECTIVENESS_KEYS}
        />
        {showPriority ? (
          <RatingField
            control={control}
            name={'priority' as FieldPath<T>}
            label={t('scoring.priority')}
            labelKeys={PRIORITY_KEYS}
          />
        ) : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          htmlFor="existingMeasures"
          label={t('report.existingMeasures')}
          optionalLabel={t('form.optional')}
        >
          <Textarea
            id="existingMeasures"
            rows={3}
            {...register('existingMeasures' as FieldPath<T>)}
          />
        </Field>
        <Field
          htmlFor="proposedMeasures"
          label={t('report.proposedMeasures')}
          optionalLabel={t('form.optional')}
        >
          <Textarea
            id="proposedMeasures"
            rows={3}
            {...register('proposedMeasures' as FieldPath<T>)}
          />
        </Field>
      </div>
    </>
  )
}

function RatingField<T extends FieldValues>({
  control,
  name,
  label,
  hint,
  labelKeys,
}: {
  control: Control<T>
  name: FieldPath<T>
  label: string
  hint?: string
  labelKeys: Record<Rating, string>
}) {
  const { t } = useTranslation()

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = Number(field.value)

        return (
          <Field htmlFor={name} label={label} hint={hint}>
            <RatingSlider
              id={name}
              value={value}
              valueLabel={t(labelKeys[value as Rating] ?? '')}
              onChange={(event) => field.onChange(Number(event.currentTarget.value))}
              onBlur={field.onBlur}
              ref={field.ref}
              name={field.name}
            />
          </Field>
        )
      }}
    />
  )
}
