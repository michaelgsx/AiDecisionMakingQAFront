import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorkflowDiagram } from "./WorkflowDiagram";

vi.mock("mermaid", () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: "<svg data-testid='mermaid-svg'></svg>" }),
  },
}));

describe("WorkflowDiagram", () => {
  it("renders nothing when source and steps are empty", () => {
    const { container } = render(<WorkflowDiagram source={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders step chips and diagram panel", async () => {
    render(
      <WorkflowDiagram
        source={"flowchart TD\n  s1[\"s1\"]"}
        steps={[
          { stepKey: "s1", toolName: "data_acquisition", status: "COMPLETED" },
          { stepKey: "s2", toolName: "llm_answer", status: "RUNNING" },
        ]}
      />,
    );

    expect(screen.getByText("Workflow DAG")).toBeInTheDocument();
    expect(screen.getByText("data_acquisition")).toBeInTheDocument();
    expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    expect(await screen.findByTestId("mermaid-svg")).toBeInTheDocument();
  });
});
