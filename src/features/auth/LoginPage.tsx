import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { z } from 'zod'

import { ApiError, NetworkError } from '@/api/errors'
import { login } from '@/api/session'
import { LocaleSwitch } from '@/components/app/LocaleSwitch'
import { Button, Card, CardBody, Field, Input, Spinner } from '@/components/ui/primitives'

const schema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

type LoginValues = z.infer<typeof schema>

export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginValues) => login(email, password),
    onSuccess: () => {
      void navigate('/reports', { replace: true })
    },
  })

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-baseline justify-between">
          <div>
            <h1 className="text-base font-semibold text-ink">{t('app.name')}</h1>
            <p className="text-xs text-ink-subtle">{t('app.tagline')}</p>
          </div>
          <LocaleSwitch />
        </div>

        <Card>
          <CardBody className="space-y-4 py-5">
            <div>
              <h2 className="text-sm font-semibold text-ink">{t('login.title')}</h2>
              <p className="mt-0.5 text-xs text-ink-muted">{t('login.subtitle')}</p>
            </div>

            <form
              className="space-y-3"
              noValidate
              onSubmit={handleSubmit((values) => mutation.mutate(values))}
            >
              <Field
                htmlFor="email"
                label={t('login.email')}
                error={errors.email ? t('form.invalidEmail') : undefined}
              >
                <Input
                  id="email"
                  type="email"
                  autoComplete="username"
                  aria-invalid={errors.email ? true : undefined}
                  {...register('email')}
                />
              </Field>

              <Field
                htmlFor="password"
                label={t('login.password')}
                error={errors.password ? t('form.required') : undefined}
              >
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  aria-invalid={errors.password ? true : undefined}
                  {...register('password')}
                />
              </Field>

              {mutation.isError ? (
                <p className="rounded-sm bg-danger-bg px-2 py-1.5 text-xs text-danger" role="alert">
                  {describeLoginError(mutation.error, t)}
                </p>
              ) : null}

              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? (
                  <>
                    <Spinner />
                    {t('login.submitting')}
                  </>
                ) : (
                  t('login.submit')
                )}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/**
 * The server's rejection text is deliberately vague ("Invalid credentials.") and is safe to
 * show. An unreachable server is a different situation entirely and must not be reported as a
 * sign-in failure, or the user retypes a password that was never wrong.
 */
function describeLoginError(error: unknown, t: (key: string) => string): string {
  if (error instanceof NetworkError) return t('state.offlineBody')
  if (error instanceof ApiError) {
    if (error.isUnavailable) return t('state.offlineBody')
    return error.detail ?? t('login.failed')
  }
  return t('login.failed')
}
