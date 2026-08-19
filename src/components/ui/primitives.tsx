import type { VariantProps } from 'class-variance-authority'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

import { buttonStyles } from './buttonStyles'

/*
  Deliberately compact primitives. Every spacing utility here is logical (`ps-`/`pe-`/`ms-`/`me-`,
  `text-start`) rather than physical, so the whole interface mirrors under `dir="rtl"` without
  any per-component special casing.
*/

export function Button({
  className,
  variant,
  size,
  ...props
}: ComponentProps<'button'> & VariantProps<typeof buttonStyles>) {
  return <button className={cn(buttonStyles({ variant, size }), className)} {...props} />
}

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'h-8 w-full rounded-sm border border-border-strong bg-surface px-2 text-sm text-ink',
        'placeholder:text-ink-subtle disabled:bg-surface-muted disabled:text-ink-muted',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      className={cn(
        'w-full rounded-sm border border-border-strong bg-surface px-2 py-1.5 text-sm text-ink',
        'placeholder:text-ink-subtle aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full rounded-sm border border-border-strong bg-surface px-2 text-sm text-ink',
        'aria-[invalid=true]:border-danger',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className, ...props }: ComponentProps<'label'>) {
  return (
    <label
      className={cn('block text-xs font-medium text-ink-muted', className)}
      {...props}
    />
  )
}

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
  optionalLabel,
}: {
  label: string
  hint?: string
  error?: string
  htmlFor: string
  children: ReactNode
  /** Marks the field as required, both visually and to assistive technology. */
  required?: boolean
  /** Translated word for "optional". Passing it labels the field as not required. */
  optionalLabel?: string
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined
  const errorId = error ? `${htmlFor}-error` : undefined

  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} className="flex items-baseline gap-1.5">
        <span>{label}</span>
        {required ? (
          // Carries no accessible name of its own; `aria-required` on the control is what
          // assistive technology reads. The mark is a visual cue only.
          <span className="text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
        {optionalLabel ? (
          <span className="font-normal text-ink-subtle">({optionalLabel})</span>
        ) : null}
      </Label>
      {children}
      {hint && !error ? (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  )
}

/**
 * A 1-5 rating slider.
 *
 * Native `<input type="range">` rather than a custom widget: it is keyboard-operable and
 * screen-reader-announced for free, and browsers reverse its axis automatically under
 * `dir="rtl"`, so the low end always sits at the start of the line in both directions.
 */
export function RatingSlider({
  id,
  value,
  valueLabel,
  min = 1,
  max = 5,
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type' | 'value'> & {
  id: string
  value: number
  valueLabel: string
  min?: number
  max?: number
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-ink" data-numeric>
          {value}
        </span>
        <span className="text-xs text-ink-muted">{valueLabel}</span>
      </div>

      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        className="h-4 w-full cursor-pointer accent-accent"
        {...props}
      />

      <div className="flex justify-between text-xs text-ink-subtle" aria-hidden="true">
        <span data-numeric>{min}</span>
        <span data-numeric>{max}</span>
      </div>
    </div>
  )
}

export function Card({ className, ref, ...props }: ComponentProps<'div'>) {
  return (
    <div
      ref={ref}
      className={cn('rounded-md border border-border-subtle bg-surface', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('border-b border-border-subtle px-4 py-2.5', className)}
      {...props}
    />
  )
}

export function CardTitle({ className, ...props }: ComponentProps<'h2'>) {
  return <h2 className={cn('text-sm font-semibold text-ink', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('px-4 py-3', className)} {...props} />
}

/** Layout-equivalent placeholder. Sized by the caller to match the content it stands in for. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      className={cn('animate-pulse rounded-sm bg-surface-muted', className)}
      aria-hidden="true"
      {...props}
    />
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block size-3.5 animate-spin rounded-full border-2 border-current border-e-transparent',
        className,
      )}
      aria-hidden="true"
    />
  )
}
