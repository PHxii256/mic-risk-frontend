import { cva } from 'class-variance-authority'

/**
 * Kept apart from the component module so links can be styled as buttons without dragging a
 * non-component export into a file that fast refresh wants to be components-only.
 */
export const buttonStyles = cva(
  'inline-flex items-center justify-center gap-2 rounded-sm font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-ink hover:bg-accent-hover',
        secondary: 'bg-surface text-ink border border-border-strong hover:bg-surface-muted',
        ghost: 'text-ink-muted hover:bg-surface-muted hover:text-ink',
        danger: 'bg-danger text-accent-ink hover:opacity-90',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs',
        md: 'h-8 px-3 text-sm',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)
