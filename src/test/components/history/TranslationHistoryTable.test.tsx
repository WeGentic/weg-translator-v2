import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TranslationHistoryTable } from "@/components/history/TranslationHistoryTable";
import type { TranslationHistoryRecord } from "@/ipc";

const ISO_DATE = "2024-01-01T00:00:00.000Z";

function buildRecord(overrides: Partial<TranslationHistoryRecord> = {}): TranslationHistoryRecord {
  const record: TranslationHistoryRecord = {
    job: {
      jobId: "123e4567-e89b-12d3-a456-426614174000",
      sourceLanguage: "en",
      targetLanguage: "it",
      inputText: "Hello world",
      status: "completed",
      stage: "completed",
      progress: 1,
      queuedAt: ISO_DATE,
      startedAt: ISO_DATE,
      completedAt: ISO_DATE,
      failedAt: undefined,
      failureReason: undefined,
      metadata: null,
      updatedAt: ISO_DATE,
    },
    output: {
      outputText: "Ciao mondo",
      modelName: "demo-llm",
      inputTokenCount: 120,
      outputTokenCount: 140,
      totalTokenCount: 260,
      durationMs: 1500,
      createdAt: ISO_DATE,
      updatedAt: ISO_DATE,
    },
  };

  return {
    job: { ...record.job, ...overrides.job },
    output: overrides.output === undefined ? record.output : overrides.output,
  };
}

describe("TranslationHistoryTable", () => {
  it("renders a loading row when fetching results", () => {
    render(<TranslationHistoryTable records={[]} isLoading />);

    expect(screen.getByText("Loading history…")).toBeInTheDocument();
  });

  it("renders the empty state message when no records exist", () => {
    render(<TranslationHistoryTable records={[]} isLoading={false} />);

    expect(screen.getByText("No translation history yet.")).toBeInTheDocument();
  });

  it("renders persisted translation metadata", () => {
    const record = buildRecord();

    render(<TranslationHistoryTable records={[record]} />);

    const tableRow = screen.getByRole("row", { name: /en → it/i });

    expect(within(tableRow).getByText("123e4567")).toBeInTheDocument();
    expect(within(tableRow).getByText("en → it")).toBeInTheDocument();
    const statusChips = within(tableRow).getAllByText("completed");
    expect(statusChips.some((chip) => chip.className.includes("rounded-full"))).toBe(true);
    expect(within(tableRow).getByText("1.5 s")).toBeInTheDocument();
    expect(within(tableRow).getByText("demo-llm")).toBeInTheDocument();
  });

  it("invokes the selection handler when a row is clicked", async () => {
    const record = buildRecord();
    const handleSelect = vi.fn();
    const user = userEvent.setup();

    render(
      <TranslationHistoryTable
        records={[record]}
        onSelectRecord={handleSelect}
        selectedJobId={null}
      />,
    );

    const row = screen.getByRole("row", { name: /completed/i });
    await user.click(row);

    expect(handleSelect).toHaveBeenCalledWith(record);
  });

  it("marks the selected row using data attributes", () => {
    const record = buildRecord();

    render(
      <TranslationHistoryTable
        records={[record]}
        selectedJobId={record.job.jobId}
      />,
    );

    const tableRow = screen.getByRole("row", { name: /completed/i });
    expect(tableRow).toHaveAttribute("data-selected", "true");

    const statusChip = within(tableRow)
      .getAllByText("completed")
      .find((element) => element.className.includes("rounded-full"));
    expect(statusChip?.className).toContain("rounded-full");
  });
});
