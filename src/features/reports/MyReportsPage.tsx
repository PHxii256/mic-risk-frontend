import { Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router";

import { RiskScore, StatusBadge } from "@/components/app/RiskBadge";
import {
  EmptyState,
  EmptyStateTemplate,
  StateBoundary,
} from "@/components/app/StateBoundary";
import { buttonStyles } from "@/components/ui/buttonStyles";
import { Card, Skeleton } from "@/components/ui/primitives";
import type { RiskReport } from "@/domain/report";
import { formatDate } from "@/lib/format";

import { useMyReports } from "./hooks/queries";

export function MyReportsPage() {
  const { t, i18n } = useTranslation();
  const query = useMyReports();
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-base font-semibold text-ink">
          {t("nav.myReports")}
        </h1>
        <Link to="/reports/new" className={buttonStyles()}>
          <Plus className="size-3.5" aria-hidden="true" />
          {t("nav.submitReport")}
        </Link>
      </div>

      <StateBoundary
        isLoading={query.isPending}
        error={query.error}
        data={query.data}
        onRetry={() => void query.refetch()}
        skeleton={<TableSkeleton />}
        isEmpty={(reports) => reports.length === 0}
        empty={
          <EmptyStateTemplate
            message1={t("state.emptyReports1")}
            message2={t("state.emptyReportsTapHere")}
            message3={t("state.emptyReports2")}
            onClick={() => void navigate("/reports/new")} // 3. Use navigate here
          />
        }
      >
        {(reports) => <ReportsTable reports={reports} locale={i18n.language} />}
      </StateBoundary>
    </div>
  );
}

function ReportsTable({
  reports,
  locale,
}: {
  reports: RiskReport[];
  locale: string;
}) {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-start text-sm">
          <thead>
            <tr className="border-b border-border-subtle bg-surface-muted text-xs text-ink-muted">
              <Th>{t("report.description")}</Th>
              <Th>{t("report.subcategory")}</Th>
              <Th>{t("scoring.inherentRisk")}</Th>
              <Th>{t("scoring.residualRisk")}</Th>
              <Th>{t("report.status")}</Th>
              <Th>{t("report.submittedAt")}</Th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr
                key={report.id}
                className="border-b border-border-subtle last:border-0 hover:bg-surface-muted"
              >
                <Td>
                  <Link
                    to={`/reports/${report.id}`}
                    className="font-medium text-accent hover:underline"
                  >
                    {truncate(report.description)}
                  </Link>
                </Td>
                <Td className="text-ink-muted">{report.subCategory.nameEn}</Td>
                <Td>
                  <RiskScore
                    score={report.effectiveEvaluation.inherentRisk}
                    band={report.effectiveEvaluation.inherentBand}
                  />
                </Td>
                <Td>
                  <RiskScore
                    score={report.effectiveEvaluation.residualRisk}
                    band={report.effectiveEvaluation.residualBand}
                  />
                </Td>
                <Td>
                  <StatusBadge status={report.status} />
                </Td>
                <Td className="whitespace-nowrap text-ink-muted">
                  {formatDate(report.submittedAt, locale)}
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2 text-start font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={`px-3 py-2 align-middle ${className ?? ""}`}>{children}</td>
  );
}

function truncate(text: string, max = 70): string {
  return text.length <= max ? text : `${text.slice(0, max).trimEnd()}…`;
}

/** Matches the table's real geometry rather than showing a generic spinner. */
function TableSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="border-b border-border-subtle bg-surface-muted px-3 py-2">
        <Skeleton className="h-3 w-40" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-b border-border-subtle px-3 py-2.5 last:border-0"
        >
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      ))}
    </Card>
  );
}
