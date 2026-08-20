import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { ApiError, NetworkError } from "@/api/errors";
import { Button } from "@/components/ui/primitives";

/**
 * Renders the distinct outcomes of a query rather than collapsing them into "loading or error".
 * A 403 is not a failure the user can retry out of, and an empty list is not an error at all —
 * showing all three the same way is how a UI ends up telling people nothing useful.
 */
export function StateBoundary<T>({
  isLoading,
  error,
  data,
  skeleton,
  isEmpty,
  empty,
  onRetry,
  children,
}: {
  isLoading: boolean;
  error: unknown;
  data: T | undefined;
  skeleton: ReactNode;
  isEmpty?: (data: T) => boolean;
  empty?: ReactNode;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}) {
  if (isLoading) return <>{skeleton}</>;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (data === undefined)
    return <ErrorState error={undefined} onRetry={onRetry} />;
  if (isEmpty?.(data)) return <>{empty ?? <EmptyState />}</>;

  return <>{children(data)}</>;
}

export function EmptyState({
  message,
  onClick,
}: {
  message?: string;
  onClick?: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center"
      onClick={() => onClick?.()}
    >
      <p className="text-sm text-ink-muted">{message ?? t("state.empty")}</p>
    </div>
  );
}

export function EmptyStateTemplate({
  message1,
  message2,
  message3,
  onClick,
}: {
  message1: string;
  message2: string;
  message3: string;
  onClick?: () => void;
}) {
  return (
    <div
      className="rounded-md border border-dashed border-border-strong px-4 py-10 text-center flex gap-1 justify-center cursor-pointer"
      onClick={() => onClick?.()}
    >
      <p className="text-sm text-ink-muted">{message1}</p>
      <a className="text-sm text-accent underline">{message2}</a>
      <p className="text-sm text-ink-muted">{message3}</p>
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const { t } = useTranslation();

  const { title, body, canRetry } = describe(error, t);

  return (
    <div
      className="rounded-md border border-border-subtle bg-surface px-4 py-8 text-center"
      role="alert"
    >
      <p className="text-sm font-semibold text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
      {canRetry && onRetry ? (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          {t("state.retry")}
        </Button>
      ) : null}
    </div>
  );
}

/**
 * Maps an error to user-facing copy.
 *
 * The server's `detail` is English-only, so the common statuses get a translated message and
 * `detail` is only surfaced where it carries information the generic text cannot — a validation
 * message or a specific rejection reason. `traceId` is never shown; it goes to the console.
 */
function describe(
  error: unknown,
  t: (key: string) => string,
): { title: string; body: string; canRetry: boolean } {
  if (error instanceof NetworkError) {
    return {
      title: t("state.offlineTitle"),
      body: t("state.offlineBody"),
      canRetry: true,
    };
  }

  if (error instanceof ApiError) {
    if (error.isUnavailable) {
      return {
        title: t("state.offlineTitle"),
        body: t("state.offlineBody"),
        canRetry: true,
      };
    }

    if (error.isForbidden) {
      return {
        title: t("state.forbiddenTitle"),
        body: t("state.forbiddenBody"),
        canRetry: false,
      };
    }

    if (error.isNotFound) {
      return {
        title: t("state.notFoundTitle"),
        body: t("state.notFoundBody"),
        canRetry: false,
      };
    }

    if (error.traceId) {
      console.error(
        `[api] ${error.status} traceId=${error.traceId}`,
        error.detail,
      );
    }

    return {
      title: t("state.errorTitle"),
      body: error.detail ?? t("state.errorTitle"),
      canRetry: error.isRetryable,
    };
  }

  return {
    title: t("state.errorTitle"),
    body: t("state.errorTitle"),
    canRetry: true,
  };
}
