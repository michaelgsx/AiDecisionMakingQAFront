import type {
  AskRequest,
  AskResponse,
  EvaluationListResponse,
  EvaluationReviewRequest,
  EvaluationStatusFilter,
  FeedbackRequest,
  FeedbackResponse,
  HumanResponseRequest,
  EvaluationDto,
  RunStatusResponse,
  WorkflowDiagramResponse,
} from "../types/api";

const MOCK_WORKFLOW_MERMAID = `flowchart TD
  s1["s1<br/>data_acquisition<br/>COMPLETED"]
  s2["s2<br/>ai_decision_rag<br/>COMPLETED"]
  s3["s3<br/>llm_answer<br/>COMPLETED"]
  s1 --> s2
  s2 --> s3
  classDef wf_completed fill:#d1e7dd,stroke:#198754,color:#0f5132
  class s1,s2,s3 wf_completed`;

function baseUrl(): string {
  const u = import.meta.env.VITE_AGENT_API_BASE_URL?.trim();
  return u ? u.replace(/\/+$/, "") : "";
}

function useMock(): boolean {
  return import.meta.env.VITE_USE_MOCK === "true";
}

function opsHeaders(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const token = import.meta.env.VITE_OPS_TOKEN?.trim();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text) return {} as T;
  return JSON.parse(text) as T;
}

export async function submitQuestion(body: AskRequest): Promise<AskResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(300);
    const runId = crypto.randomUUID();
    return { runId, status: "PENDING", pollPath: `/agent/runs/${runId}` };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/ask`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<AskResponse & { message?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function getRunStatus(runId: string): Promise<RunStatusResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(400);
    return {
      runId,
      status: "COMPLETED",
      question: "mock",
      answer: "(Mock) Orchestrator completed with a demo DAG: data_acquisition → ai_decision_rag → llm_answer.",
      workflowMermaid: MOCK_WORKFLOW_MERMAID,
      steps: [
        { stepId: "1", stepKey: "s1", toolName: "data_acquisition", status: "COMPLETED", attemptCount: 1 },
        { stepId: "2", stepKey: "s2", toolName: "ai_decision_rag", status: "COMPLETED", attemptCount: 1 },
        { stepId: "3", stepKey: "s3", toolName: "llm_answer", status: "COMPLETED", attemptCount: 1 },
      ],
      waitingForHuman: false,
      pendingApprovals: [],
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}`, { headers: opsHeaders() });
  const data = await parseJson<RunStatusResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function getWorkflowDiagram(runId: string): Promise<string | null> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(100);
    return MOCK_WORKFLOW_MERMAID;
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}/workflow-diagram`, { headers: opsHeaders() });
  const data = await parseJson<WorkflowDiagramResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data.mermaid ?? null;
}

export async function pollUntilComplete(
  runId: string,
  onTick?: (s: RunStatusResponse) => void,
  maxAttempts = 120,
  intervalMs = 500,
): Promise<RunStatusResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const status = await getRunStatus(runId);
    onTick?.(status);
    if (status.waitingForHuman) {
      return status;
    }
    if (
      status.status === "COMPLETED" ||
      status.status === "FAILED" ||
      status.status === "CANCELLED"
    ) {
      return status;
    }
    await delay(intervalMs);
  }
  return getRunStatus(runId);
}

export async function submitHumanResponse(
  runId: string,
  body: HumanResponseRequest,
): Promise<RunStatusResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return getRunStatus(runId);
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}/human-response`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<RunStatusResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function listEvaluations(
  status: EvaluationStatusFilter = "pending",
): Promise<EvaluationListResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(300);
    const mock: EvaluationDto[] = [
      {
        evaluationId: crypto.randomUUID(),
        runId: crypto.randomUUID(),
        question: "Should we freeze this withdrawal?",
        answer: "(Mock) Similar cases suggest freeze pending review.",
        reviewStatus: "PENDING",
        createdAt: new Date().toISOString(),
      },
    ];
    if (status !== "pending") return { items: [], total: 0 };
    return { items: mock, total: mock.length };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/evaluations?status=${encodeURIComponent(status)}`, {
    headers: opsHeaders(),
  });
  const data = await parseJson<EvaluationListResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function submitEvaluationReview(
  evaluationId: string,
  body: EvaluationReviewRequest,
): Promise<EvaluationDto> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return {
      evaluationId,
      runId: crypto.randomUUID(),
      question: "mock",
      answer: "mock",
      reviewStatus: body.decision === "accept" ? "ACCEPTED" : "REJECTED",
      createdAt: new Date().toISOString(),
      reviewedAt: new Date().toISOString(),
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/evaluations/${evaluationId}/review`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<EvaluationDto & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function submitFeedback(body: FeedbackRequest): Promise<FeedbackResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return { ok: true, feedbackId: crypto.randomUUID(), message: "(Mock) Feedback recorded" };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/feedback`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<FeedbackResponse & { message?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

function delay(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
