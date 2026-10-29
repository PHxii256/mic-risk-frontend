import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router";

import { Pagination } from "@/components/app/DataTable";
import { EmptyState, StateBoundary } from "@/components/app/StateBoundary";

import { ReportsTable } from "./MyReportsPage";
import { useDepartmentReports } from "./hooks/queries";

export function DepartmentReportsPage() {
  const { t, i18n } = useTranslation();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page") ?? "1") || 1);
  const query = useDepartmentReports(page);

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-ink">
        {t("nav.departmentReports")}
      </h1>
      <StateBoundary
        isLoading={query.isPending}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        skeleton={<div className="h-48 animate-pulse rounded-sm bg-surface-muted" />}
        isEmpty={(result) => result.items.length === 0}
        empty={<EmptyState message={t("report.noReportsMatch")} />}
      >
        {(result) => (
          <>
            <ReportsTable reports={result.items} locale={i18n.language} />
            <Pagination
              page={result.page}
              totalPages={result.totalPages}
              totalCount={result.totalCount}
              isFetching={query.isFetching}
              onChange={(next) => {
                const nextParams = new URLSearchParams(params);
                nextParams.set("page", String(next));
                setParams(nextParams);
              }}
            />
          </>
        )}
      </StateBoundary>
    </div>
  );
}
