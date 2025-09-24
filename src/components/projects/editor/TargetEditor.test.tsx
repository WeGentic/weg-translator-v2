import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SegmentRow } from "@/lib/jliff";
import { TargetEditor } from "./TargetEditor";

vi.mock("@/components/ui/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/ipc", () => ({
  updateJliffSegment: vi.fn(),
}));

vi.mock("./RowActions", () => {
  const MockRowActions = ({
    onCopySource,
    onReset,
    onInsertMissingPlaceholders,
    missingPlaceholderCount,
    canEdit,
    isDirty,
  }: {
    onCopySource: () => void;
    onReset: () => void;
    onInsertMissingPlaceholders: () => void;
    missingPlaceholderCount: number;
    canEdit: boolean;
    isDirty: boolean;
  }) => (
    <div data-testid="row-actions-mock">
      <button type="button" onClick={onCopySource} disabled={!canEdit}>
        Copy source
      </button>
      <button type="button" onClick={onReset} disabled={!canEdit}>
        Reset
      </button>
      <button
        type="button"
        onClick={onInsertMissingPlaceholders}
        disabled={!canEdit || missingPlaceholderCount === 0}
      >
        Insert missing ({missingPlaceholderCount})
      </button>
      <button type="submit" disabled={!canEdit || !isDirty}>
        Save
      </button>
    </div>
  );

  return {
    __esModule: true,
    RowActions: MockRowActions,
    default: MockRowActions,
  };
});

const baseRow: SegmentRow = {
  key: "u1-sseg-1",
  unitId: "1",
  segmentId: "seg-1",
  sourceRaw: "Hello {{ph:ph1}}",
  targetRaw: "",
  sourceTokens: [
    { kind: "text", value: "Hello " },
    { kind: "ph", value: "{{ph:ph1}}", placeholderId: "ph1" },
  ],
  targetTokens: [],
  placeholders: [
    {
      id: "ph1",
      token: "{{ph:ph1}}",
      elem: "ph",
      attrs: {},
      originalData: "<ph id=\"ph1\" />",
    },
  ],
  placeholderCounts: { source: 1, target: 0, missing: 1, extra: 0 },
  status: "missing",
  issues: null,
};

function renderTargetEditor(overrides: Partial<SegmentRow> = {}) {
  const row: SegmentRow = {
    ...baseRow,
    ...overrides,
  };
  return render(
    <TargetEditor
      row={row}
      projectId="project-1"
      jliffRelPath="artifacts/demo.jliff"
      onSaveSuccess={vi.fn()}
    />,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

describe("TargetEditor", () => {
  it("prevents manual brace typing and surfaces guidance", async () => {
    const user = userEvent.setup();
    renderTargetEditor();

    const textarea = screen.getByLabelText(/target translation/i);
    await user.type(textarea, "Hello");
    await user.type(textarea, "{{}");

    expect(textarea).toHaveValue("Hello");
    expect(screen.getByText(/Structured placeholders must be inserted via the controls below/i)).toBeInTheDocument();
  });

  it("focuses placeholder chips when pressing Alt\+P", async () => {
    const user = userEvent.setup();
    renderTargetEditor();

    const textarea = screen.getByLabelText(/target translation/i);
    const chipButton = await screen.findByRole("button", { name: /Insert placeholder \{\{ph:ph1\}\}/i });

    textarea.focus();
    fireEvent.keyDown(textarea, { key: "p", altKey: true });
    await waitFor(() => expect(chipButton).toHaveFocus());
    expect(screen.getByText(/Placeholder chips focused/i)).toBeInTheDocument();
  });

  it("inserts missing placeholders when using the quick action", async () => {
    const user = userEvent.setup();
    renderTargetEditor();

    const insertButton = screen.getByRole("button", { name: /Insert missing \(1\)/i });
    await user.click(insertButton);

    const textarea = screen.getByLabelText(/target translation/i);
    expect(textarea).toHaveValue("{{ph:ph1}}");
    expect(screen.getByRole("status")).toHaveTextContent(/Inserted one missing placeholder/i);
  });
});
