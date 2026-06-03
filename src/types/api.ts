export type AskRequest = {
  question: string;
  conversationId?: string;
  userId?: string;
};

export type AskResponse = {
  runId: string;
  status: string;
  pollPath: string;
};

export type HumanApprovalDto = {
  requestId: string;
  stepKey: string;
  prompt: string;
  proposal: string;
};

export type PendingAsyncDto = {
  requestId: string;
  runId: string;
  workflowId: string;
  userId?: string;
  stepKey: string;
  stepId?: string;
  toolName: string;
  toolVersion: string;
  asyncKind: "INPUT_REQUIRED" | "POLL_ONLY";
  prompt?: string;
  proposal?: string;
  allowedDecisions: string[];
  feedbackPath?: string;
  pollPath?: string;
};

export type RunStatusResponse = {
  runId: string;
  status: string;
  question: string;
  answer?: string;
  error?: string;
  workflowJson?: string;
  workflowMermaid?: string;
  userId?: string;
  transactionId?: string;
  steps: StepStatusDto[];
  waitingForAsync: boolean;
  pendingAsync: PendingAsyncDto[];
  /** @deprecated use pendingAsync */
  waitingForHuman: boolean;
  /** @deprecated use pendingAsync */
  pendingApprovals: HumanApprovalDto[];
  pollPath?: string;
  feedbackPath?: string;
};

export type ExecuteRequest = {
  question: string;
  conversationId?: string;
  userId?: string;
  transactionId?: string;
};

export type ExecuteResponse = {
  runId: string;
  workflowId: string;
  status: string;
  completed: boolean;
  waitingForAsync: boolean;
  question: string;
  answer?: string;
  error?: string;
  userId?: string;
  transactionId?: string;
  workflowJson?: string;
  workflowMermaid?: string;
  steps: StepStatusDto[];
  pendingAsync: PendingAsyncDto[];
  pollPath?: string;
  feedbackPath?: string;
};

export type AsyncToolFeedbackRequest = {
  requestId: string;
  stepKey: string;
  userId?: string;
  toolName?: string;
  toolVersion?: string;
  result: "accept" | "reject" | string;
  comment?: string;
  metadata?: Record<string, unknown>;
};

export type AsyncToolPollRequest = {
  requestId?: string;
  stepKey: string;
  toolName?: string;
  toolVersion?: string;
};

export type HumanResponseRequest = {
  requestId: string;
  decision: "accept" | "reject";
  comment?: string;
};

export type StepStatusDto = {
  stepId: string;
  stepKey: string;
  toolName: string;
  toolVersion?: string;
  status: string;
  error?: string;
  attemptCount: number;
  outputJson?: string;
};

export type WorkflowSnapshot = {
  runId: string;
  status: string;
  answer?: string;
  error?: string;
  workflowMermaid?: string;
  workflowJson?: string;
  steps: StepStatusDto[];
};

export type FeedbackRequest = {
  runId: string;
  messageId: string;
  conversationId?: string;
  rating: "up" | "down";
  comment?: string;
};

export type FeedbackResponse = {
  ok: boolean;
  feedbackId: string;
  message: string;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: string;
  feedback?: "up" | "down";
  workflow?: WorkflowSnapshot;
};

export type EvaluationStatusFilter = "pending" | "accepted" | "rejected" | "all";

export type EvaluationDto = {
  evaluationId: string;
  runId: string;
  question: string;
  answer: string;
  reviewStatus: "PENDING" | "ACCEPTED" | "REJECTED";
  reviewerId?: string;
  comment?: string;
  createdAt: string;
  reviewedAt?: string;
};

export type EvaluationListResponse = {
  items: EvaluationDto[];
  total: number;
};

export type EvaluationReviewRequest = {
  decision: "accept" | "reject";
  reviewerId?: string;
  comment?: string;
};

export type WorkflowDiagramResponse = {
  format: string;
  mermaid: string;
};

export type ToolSchemaFieldDto = {
  name: string;
  type: string;
  description: string;
};

export type ToolSchemaDto = {
  description?: string;
  fields: ToolSchemaFieldDto[];
};

export type RegisterToolRequest = {
  name: string;
  version: string;
  maxRetry: number;
  description: string;
  toolType:
    | "DATA_ACQUISITION"
    | "SIMILARITY_RETRIEVAL"
    | "LLM_REASONING"
    | "AGGREGATE"
    | "FEEDBACK"
    | "VALIDATION";
  executionMode: "SYNC" | "ASYNC";
  inputSchema: ToolSchemaDto;
  outputSchema: ToolSchemaDto;
  enabled: boolean;
};

export type ToolRegistrationResponse = RegisterToolRequest & {
  executorAvailable: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export const TOOL_TYPE_OPTIONS = [
  "DATA_ACQUISITION",
  "SIMILARITY_RETRIEVAL",
  "LLM_REASONING",
  "AGGREGATE",
  "FEEDBACK",
  "VALIDATION",
] as const;

export const SCHEMA_TYPE_OPTIONS = ["string", "integer", "number", "boolean", "object", "array"] as const;
