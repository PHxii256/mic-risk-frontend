import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import type { PropsWithChildren } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";

import { useMyReports, useRiskCategories } from "./queries";

const mineReport = {
  id: 1,
  reporter: {
    id: 1,
    identityUserId: "user-1",
    email: "user@mic.test",
    name: "Plain User",
    jobTitle: null,
    department: { id: 1, name: "Risk", branchLocation: "HQ" },
    active: true,
    createdAt: "2026-09-15T07:11:05.144Z",
  },
  category: "Financial",
  subCategory: null,
  reportedEvaluation: {
    id: 1,
    evaluator: {
      id: 1,
      identityUserId: "user-1",
      email: "user@mic.test",
      name: "Plain User",
      jobTitle: null,
      department: { id: 1, name: "Risk", branchLocation: "HQ" },
      active: true,
      createdAt: "2026-09-15T07:11:05.144Z",
    },
    severity: 1,
    frequency: 1,
    controlEffectiveness: 1,
    inherentRisk: 1,
    residualRisk: 1,
    existingMeasures: null,
    proposedMeasures: null,
    priority: 1,
    evaluatedAt: "2026-09-15T07:11:05.144Z",
  },
  auditorEvaluation: null,
  cause: "Test cause",
  consequences: "Test consequences",
  assignedDepartment: null,
  status: "Submitted",
  submittedAt: "2026-09-15T07:11:05.144Z",
  dueDate: "2026-09-15T07:11:05.144Z",
  sendReminderEmails: true,
  lastReminderSentAt: null,
  reminderTemplateId: null,
  ownerEmails: ["owner@mic.test"],
};

const server = setupServer(
  http.get("http://localhost/api/risk-report/mine", () =>
    HttpResponse.json({
      items: [mineReport],
      page: 1,
      pageSize: 1,
      totalCount: 1,
      totalPages: 1,
    }),
  ),
  http.get("http://localhost/api/risk-subcategory/categories", () =>
    HttpResponse.json([
      {
        nameEn: "Financial",
        nameAr: "Financial",
        riskSubcategories: [{ id: 12, nameEn: "Fraud", nameAr: "احتيال" }],
      },
    ]),
  ),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("useRiskCategories", () => {
  it("adds the parent category to nested bilingual subcategories", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useRiskCategories(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([
      {
        category: "Financial",
        subcategories: [
          { id: 12, nameEn: "Fraud", nameAr: "احتيال", category: "Financial" },
        ],
      },
    ]);

    queryClient.clear();
  });
});

describe("useMyReports", () => {
  it("maps reports from the paged response envelope", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const wrapper = ({ children }: PropsWithChildren) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useMyReports(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0]?.id).toBe(1);

    queryClient.clear();
  });
});
