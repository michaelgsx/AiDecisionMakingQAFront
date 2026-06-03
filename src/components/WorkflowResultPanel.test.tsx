import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowResultPanel } from "./WorkflowResultPanel";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg data-testid='mermaid-svg'></svg>" }),
  },
}));

describe("WorkflowResultPanel", () => {
  it("renders step outputs and status summary", async () => {
    render(
      <WorkflowResultPanel
        workflow={{
          runId: "run-1",
          status: "COMPLETED",
          steps: [
            {
              stepId: "1",
              stepKey: "s1",
              toolName: "data_acquisition",
              toolVersion: "1.1.0",
              status: "COMPLETED",
              attemptCount: 1,
              outputJson: '{"rowCount":2,"sql":"SELECT 1"}',
            },
          ],
          workflowMermaid: "flowchart TD\n  s1[\"s1\"]",
        }}
      />,
    );

    expect(screen.getByText("Workflow output")).toBeInTheDocument();
    expect(screen.getByText("1 step · 1 completed")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow step outputs")).toBeInTheDocument();
    expect(screen.getByText("Step output")).toBeInTheDocument();
    expect(await screen.findByTestId("mermaid-svg")).toBeInTheDocument();
  });
});
