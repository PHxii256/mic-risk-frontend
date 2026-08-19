import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { PropsWithChildren } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

import { useRiskCategories } from './queries'

const server = setupServer(
  http.get('http://localhost:5166/api/risk-subcategory/categories', () =>
    HttpResponse.json([
      {
        nameEn: 'Financial',
        nameAr: 'Financial',
        riskSubcategories: [
          { id: 12, nameEn: 'Fraud', nameAr: 'احتيال' },
        ],
      },
    ]),
  ),
)

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('useRiskCategories', () => {
  it('adds the parent category to nested bilingual subcategories', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )

    const { result } = renderHook(() => useRiskCategories(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toEqual([
      {
        category: 'Financial',
        subcategories: [
          { id: 12, nameEn: 'Fraud', nameAr: 'احتيال', category: 'Financial' },
        ],
      },
    ])

    queryClient.clear()
  })
})
