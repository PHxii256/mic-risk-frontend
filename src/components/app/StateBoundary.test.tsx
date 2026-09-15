import { CancelledError } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { StateBoundary } from "./StateBoundary";

function boundary(error: unknown, data?: string) {
  return (
    <StateBoundary
      isLoading={false}
      error={error}
      data={data}
      skeleton={<span>loading</span>}
      onRetry={() => undefined}
    >
      {(value) => <span>data: {value}</span>}
    </StateBoundary>
  );
}

describe("StateBoundary", () => {
  it("does not show a failure for a native aborted request", () => {
    render(
      boundary(new DOMException("The operation was aborted.", "AbortError")),
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("keeps already loaded data when TanStack cancels a refresh", () => {
    render(boundary(new CancelledError(), "reports"));

    expect(screen.getByText("data: reports")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
