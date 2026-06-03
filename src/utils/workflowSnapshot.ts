import type { ExecuteResponse, RunStatusResponse, WorkflowSnapshot } from "../types/api";

export function buildWorkflowSnapshot(
  runId: string,
  tick: Pick<
    ExecuteResponse | RunStatusResponse,
    "status" | "answer" | "error" | "workflowMermaid" | "workflowJson" | "steps"
  >,
): WorkflowSnapshot {
  return {
    runId,
    status: tick.status,
    answer: tick.answer,
    error: tick.error,
    workflowMermaid: tick.workflowMermaid,
    workflowJson: tick.workflowJson,
    steps: tick.steps ?? [],
  };
}
