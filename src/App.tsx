import { DirectionProvider } from '@radix-ui/react-direction'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RouterProvider } from 'react-router'

import { direction } from '@/i18n'
import { router } from '@/routes/router'

/**
 * Radix positions its own popovers and menus in script, so it needs the writing direction
 * explicitly — the CSS `dir` attribute alone would leave them anchored on the wrong side
 * under Arabic.
 */
export function App({ queryClient }: { queryClient: QueryClient }) {
  const { i18n } = useTranslation()

  return (
    <DirectionProvider dir={direction(i18n.resolvedLanguage ?? 'en')}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </DirectionProvider>
  )
}
