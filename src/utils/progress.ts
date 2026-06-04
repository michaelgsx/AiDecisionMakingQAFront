import type { StepStatusDto } from "../types/api";

/** Friendly, human-readable phase per tool so users see what is actually happening. */
const TOOL_PHASE: Record<string, string> = {
  data_acquisition: "Gathering data from the database",
  natural_language_to_sql: "Generating SQL from your question",
  ai_decision_rag: "Retrieving similar cases",
  similarity_retrieval: "Retrieving similar records",
  llm_answer: "Composing the final answer",
  human_in_the_loop: "Waiting for your approval",
};

function humanizeTool(toolName?: string): string {
  if (!toolName) return "the next tool";
  return TOOL_PHASE[toolName] ?? toolName.replace(/_/g, " ");
}

function describeRunningStep(steps?: StepStatusDto[]): string | null {
  const running = steps?.find((s) => s.status === "RUNNING");
  if (!running) return null;
  return `${humanizeTool(running.toolName)} (step ${running.stepKey})…`;
}

export type ProgressInput = {
  chatMode: "sync" | "async";
  runStatus: string | null;
  /** Async-chat statusDetail, e.g. "planning", "executing/s1/data_acquisition", "llm-answering". */
  statusDetail?: string | null;
  steps?: StepStatusDto[];
  waitingForApproval?: boolean;
  waitingForAsync?: boolean;
};

/**
 * Turn the latest polled status into a short message that reassures the user we are
 * still making progress, and tells them which phase the run is in.
 */
export function progressLabel(input: ProgressInput): string {
  const { chatMode, runStatus, statusDetail, steps, waitingForApproval, waitingForAsync } = input;

  if (waitingForApproval) {
    return "Waiting for your approval to continue…";
  }
  if (waitingForAsync) {
    return "Waiting on a long-running tool to report back…";
  }

  // Async chat path: statusDetail carries the most specific phase.
  if (statusDetail) {
    const detail = statusDetail.trim();
    if (detail === "planning") {
      return "Planning the workflow — choosing the right tools…";
    }
    if (detail === "llm-answering") {
      return "Composing the final answer…";
    }
    if (detail === "done") {
      return "Wrapping up…";
    }
    if (detail === "failed") {
      return "The run hit an error.";
    }
    if (detail.startsWith("executing/")) {
      // executing/{stepKey}/{toolName}
      const parts = detail.split("/");
      const stepKey = parts[1];
      const toolName = parts[2];
      const phase = humanizeTool(toolName);
      return stepKey ? `${phase} (step ${stepKey})…` : `${phase}…`;
    }
  }

  // Sync / human-response polling path: map the run status (+ running step if known).
  switch ((runStatus ?? "").toUpperCase()) {
    case "PENDING":
      // Sync execute blocks server-side without intermediate polling, so a single
      // PENDING tick really means "planning + running" rather than "queued".
      return chatMode === "sync"
        ? "Planning and executing the workflow…"
        : "Queued — a worker is about to pick this up…";
    case "PLANNING":
      return "Planning the workflow — choosing the right tools…";
    case "RUNNING": {
      const step = describeRunningStep(steps);
      return step ? `Running: ${step}` : "Executing the workflow…";
    }
    case "COMPLETED":
    case "DONE":
      return "Wrapping up…";
    case "FAILED":
      return "The run hit an error.";
    default:
      return "Planning and executing the workflow…";
  }
}
