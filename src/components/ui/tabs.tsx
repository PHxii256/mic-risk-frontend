import { useId, useRef, type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export interface TabDefinition<T extends string> {
  id: T
  label: string
}

/**
 * A minimal, fully keyboard-operable tab strip.
 *
 * Roving tabindex plus arrow keys, per the WAI-ARIA tabs pattern. Under `dir="rtl"` the left and
 * right arrows swap meaning, because "next" follows the reading direction rather than the screen.
 */
export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  children,
}: {
  tabs: readonly TabDefinition<T>[]
  active: T
  onChange: (id: T) => void
  className?: string
  children?: ReactNode
}) {
  const baseId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  function move(offset: number) {
    const index = tabs.findIndex((tab) => tab.id === active)
    const next = tabs[(index + offset + tabs.length) % tabs.length]
    if (!next) return

    onChange(next.id)
    listRef.current?.querySelector<HTMLButtonElement>(`[data-tab-id="${next.id}"]`)?.focus()
  }

  function onKeyDown(event: React.KeyboardEvent) {
    const rtl = document.documentElement.dir === 'rtl'

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault()
        move(rtl ? -1 : 1)
        break
      case 'ArrowLeft':
        event.preventDefault()
        move(rtl ? 1 : -1)
        break
      case 'Home':
        event.preventDefault()
        if (tabs[0]) onChange(tabs[0].id)
        break
      case 'End':
        event.preventDefault()
        if (tabs.at(-1)) onChange(tabs.at(-1)!.id)
        break
      default:
        break
    }
  }

  return (
    <>
      <div
        ref={listRef}
        role="tablist"
        onKeyDown={onKeyDown}
        className={cn('inline-flex rounded-sm border border-border-strong p-0.5', className)}
      >
        {tabs.map((tab) => {
          const selected = tab.id === active

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`${baseId}-tab-${tab.id}`}
              data-tab-id={tab.id}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              className={cn(
                'rounded-sm px-2.5 py-1 text-xs font-medium transition-colors',
                selected
                  ? 'bg-accent text-accent-ink'
                  : 'text-ink-muted hover:bg-surface-muted hover:text-ink',
              )}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      <div
        role="tabpanel"
        id={`${baseId}-panel-${active}`}
        aria-labelledby={`${baseId}-tab-${active}`}
        tabIndex={0}
      >
        {children}
      </div>
    </>
  )
}
