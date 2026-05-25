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

export type RunStatusResponse = {
  runId: string;
  status: string;
  question: string;
  answer?: string;
  error?: string;
  workflowJson?: string;
  steps: StepStatusDto[];
  waitingForHuman: boolean;
  pendingApprovals: HumanApprovalDto[];
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
  status: string;
  error?: string;
  attemptCount: number;
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
