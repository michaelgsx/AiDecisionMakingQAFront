import { describe, expect, it } from "vitest";
import type { RunStatusResponse } from "./api";

describe("api types", () => {
  it("RunStatusResponse shape accepts workflowMermaid", () => {
    const sample: RunStatusResponse = {
      runId: "r1",
      status: "RUNNING",
      question: "q",
      workflowJson: "{}",
      workflowMermaid: "flowchart TD",
      steps: [],
      waitingForHuman: false,
      pendingApprovals: [],
    };
    expect(sample.workflowMermaid).toContain("flowchart");
  });
});
