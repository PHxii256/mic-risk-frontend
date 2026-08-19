import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { ApiError } from '@/api/errors'
import { fromAuthResponse, setSession } from '@/api/session'
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input, Spinner } from '@/components/ui/primitives'
import { useChangePassword } from '@/features/admin/hooks'

const schema = z
  .object({
    currentPassword: z.string().min(1),
    // Matches the server's own minimum; anything shorter is rejected there too.
    newPassword: z.string().min(8),
    confirmPassword: z.string().min(1),
  })
  .refine((values) => values.newPassword === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  })

type Values = z.infer<typeof schema>

export function ChangePasswordPage() {
  const { t } = useTranslation()
  const change = useChangePassword()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  function onSubmit(values: Values) {
    change.mutate(
      { currentPassword: values.currentPassword, newPassword: values.newPassword },
      {
        onSuccess: (payload) => {
          // The endpoint returns a fresh session and revokes every other device. Adopting the
          // new token here is what keeps this tab signed in.
          setSession(fromAuthResponse(payload))
          reset()
        },
      },
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-base font-semibold text-ink">{t('account.changePassword')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('account.changePassword')}</CardTitle>
        </CardHeader>
        <CardBody>
          <form className="space-y-3" noValidate onSubmit={handleSubmit(onSubmit)}>
            <Field
              htmlFor="currentPassword"
              label={t('account.currentPassword')}
              required
              error={errors.currentPassword ? t('form.required') : undefined}
            >
              <Input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                aria-required="true"
                {...register('currentPassword')}
              />
            </Field>

            <Field
              htmlFor="newPassword"
              label={t('account.newPassword')}
              hint={t('account.passwordHint')}
              required
              error={errors.newPassword ? t('account.passwordTooShort') : undefined}
            >
              <Input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                {...register('newPassword')}
              />
            </Field>

            <Field
              htmlFor="confirmPassword"
              label={t('account.confirmPassword')}
              required
              error={errors.confirmPassword ? t('account.passwordMismatch') : undefined}
            >
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                aria-required="true"
                {...register('confirmPassword')}
              />
            </Field>

            <p className="text-xs text-ink-subtle">{t('account.signsOutOthers')}</p>

            {change.isError ? (
              <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
                {change.error instanceof ApiError
                  ? (change.error.fieldErrors
                      ? Object.values(change.error.fieldErrors).flat().join(' ')
                      : (change.error.detail ?? t('state.errorTitle')))
                  : t('state.errorTitle')}
              </p>
            ) : null}

            {change.isSuccess ? (
              <p className="rounded-sm bg-band-low-bg px-2 py-1.5 text-xs text-band-low">
                {t('account.passwordChanged')}
              </p>
            ) : null}

            <Button type="submit" className="w-full" disabled={change.isPending}>
              {change.isPending ? (
                <>
                  <Spinner />
                  {t('account.saving')}
                </>
              ) : (
                t('account.changePassword')
              )}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  )
}
