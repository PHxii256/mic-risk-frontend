import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'

import { ContractViolationError } from '@/api/coerce'
import { ApiError, NetworkError } from '@/api/errors'

/**
 * Retrying a 401, 403, 404 or a rejected field produces the identical failure a moment later —
 * it only delays the error the user needs to see. A 401 in particular is already handled one
 * layer down, where the transport refreshes and replays once; if it still fails, the session
 * is genuinely over and retrying would just repeat that conclusion.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (failureCount >= 2) return false
  if (error instanceof NetworkError) return true
  if (error instanceof ApiError) return error.isRetryable
  return false
}

/**
 * A contract violation means the server sent something its own OpenAPI document says it cannot.
 * The user sees a generic failure, which is right — there is nothing they can do — but it must
 * not vanish silently, because it is a bug in the API or the mappers rather than a user error.
 */
function report(error: unknown, context: string): void {
  if (error instanceof ContractViolationError) {
    console.error(`[contract] ${context}: ${error.message}`)
    return
  }

  if (error instanceof ApiError && error.traceId) {
    console.error(`[api] ${context}: ${error.status} traceId=${error.traceId}`, error.detail)
  }
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => report(error, String(query.queryKey)),
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) =>
        report(error, String(mutation.options.mutationKey ?? 'mutation')),
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetry,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: false,
      },
    },
  })
}
