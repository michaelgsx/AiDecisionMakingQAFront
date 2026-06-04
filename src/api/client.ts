import type {
  AskRequest,
  AskResponse,
  AsyncChatPollResponse,
  AsyncChatSubmitResponse,
  EvaluationListResponse,
  EvaluationReviewRequest,
  EvaluationStatusFilter,
  FeedbackRequest,
  FeedbackResponse,
  HumanResponseRequest,
  EvaluationDto,
  ExecuteRequest,
  ExecuteResponse,
  AsyncToolFeedbackRequest,
  AsyncToolPollRequest,
  RegisterToolRequest,
  RunStatusResponse,
  ToolRegistrationResponse,
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

/**
 * Max time to poll async chat / run status before giving up. App Service B1 cold starts and
 * uncached LLM planning can push a single run past 45s, so allow generous headroom (120s)
 * to avoid surfacing a false "timed out" / "Load failed" while the backend is still working.
 */
export const FRONTEND_POLL_TIMEOUT_MS = 120_000;

export type AgentConnectivity = {
  state: "mock" | "ok" | "unreachable" | "error" | "no-url";
  message: string;
  apiUrl?: string;
};

function baseUrl(): string {
  const u = import.meta.env.VITE_AGENT_API_BASE_URL?.trim();
  return u ? u.replace(/\/+$/, "") : "";
}

function useMock(): boolean {
  return import.meta.env.VITE_USE_MOCK === "true";
}

export function getAgentApiBaseUrl(): string {
  return baseUrl();
}

/** Ping GET /health — used on page load to surface backend reachability (not SP/auth for deploy). */
export async function checkAgentHealth(timeoutMs = 12_000): Promise<AgentConnectivity> {
  if (useMock()) {
    return { state: "mock", message: "Mock mode — API calls are simulated." };
  }
  const apiUrl = baseUrl();
  if (!apiUrl) {
    return { state: "no-url", message: "VITE_AGENT_API_BASE_URL is not set in this build." };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiUrl}/health`, {
      signal: controller.signal,
      headers: opsHeaders(),
    });
    if (res.ok) {
      return { state: "ok", message: "Backend reachable.", apiUrl };
    }
    return {
      state: "error",
      message: `Backend returned HTTP ${res.status}. Check App Service logs.`,
      apiUrl,
    };
  } catch (e) {
    const timedOut = e instanceof Error && e.name === "AbortError";
    return {
      state: "unreachable",
      message: timedOut
        ? "Backend did not respond in time — App Service cold start on B1 can take 5–8 minutes after deploy."
        : "Cannot reach backend (server down, still starting, or browser blocked the request).",
      apiUrl,
    };
  } finally {
    clearTimeout(timer);
  }
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
        {
          stepId: "1",
          stepKey: "s1",
          toolName: "data_acquisition",
          toolVersion: "1.1.0",
          status: "COMPLETED",
          attemptCount: 1,
          outputJson: JSON.stringify({
            rowCount: 2,
            sql: "SELECT user_id, display_name FROM users WHERE user_id = 'songxiang1'",
            rows: [{ user_id: "songxiang1", display_name: "Song Xiang" }],
          }),
        },
        {
          stepId: "2",
          stepKey: "s2",
          toolName: "ai_decision_rag",
          toolVersion: "1.1.0",
          status: "COMPLETED",
          attemptCount: 1,
          outputJson: JSON.stringify({ matchCount: 3, topScore: 0.91 }),
        },
        {
          stepId: "3",
          stepKey: "s3",
          toolName: "llm_answer",
          toolVersion: "1.1.0",
          status: "COMPLETED",
          attemptCount: 1,
          outputJson: JSON.stringify({
            answer: "(Mock) Orchestrator completed with a demo DAG: data_acquisition → ai_decision_rag → llm_answer.",
          }),
        },
      ],
      waitingForAsync: false,
      pendingAsync: [],
      waitingForHuman: false,
      pendingApprovals: [],
      pollPath: `/agent/runs/${runId}`,
      feedbackPath: `/agent/runs/${runId}/feedback`,
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}`, { headers: opsHeaders() });
  const data = await parseJson<RunStatusResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return normalizeRunStatus(data);
}

export async function executeWorkflow(body: ExecuteRequest): Promise<ExecuteResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    const runId = crypto.randomUUID();
    const status = await getRunStatus(runId);
    return {
      runId,
      workflowId: runId,
      status: status.status,
      completed: true,
      waitingForAsync: false,
      question: body.question,
      answer: status.answer,
      userId: body.userId,
      transactionId: body.transactionId,
      workflowMermaid: status.workflowMermaid,
      steps: status.steps,
      pendingAsync: [],
      pollPath: `/agent/runs/${runId}`,
      feedbackPath: `/agent/runs/${runId}/feedback`,
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/execute`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<ExecuteResponse & { message?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function asyncChatSubmit(body: ExecuteRequest): Promise<AsyncChatSubmitResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    const requestId = crypto.randomUUID();
    return {
      requestId,
      status: "PLANNING",
      pollPath: `/agent/async-chat/${requestId}`,
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/async-chat`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<AsyncChatSubmitResponse & { message?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function asyncChatPoll(requestId: string): Promise<AsyncChatPollResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(300);
    return {
      requestId,
      status: "DONE",
      statusDetail: "done",
      question: "mock",
      answer: "(Mock) Async chat completed with a demo answer.",
      runId: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/async-chat/${encodeURIComponent(requestId)}`, {
    headers: opsHeaders(),
  });
  const data = await parseJson<AsyncChatPollResponse & { message?: string; error?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? data.error ?? `HTTP ${res.status}`);
  return data;
}

export async function pollAsyncChatUntilComplete(
  requestId: string,
  onTick?: (s: AsyncChatPollResponse) => void,
  timeoutMs = FRONTEND_POLL_TIMEOUT_MS,
  intervalMs = 1500,
): Promise<AsyncChatPollResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await asyncChatPoll(requestId);
    onTick?.(status);
    if (status.status === "DONE" || status.status === "FAILED") {
      return status;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    await delay(Math.min(intervalMs, remaining));
  }
  throw new Error(`Async chat timed out after ${Math.round(timeoutMs / 1000)}s`);
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
  timeoutMs = FRONTEND_POLL_TIMEOUT_MS,
  intervalMs = 500,
): Promise<RunStatusResponse> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getRunStatus(runId);
    onTick?.(status);
    if (status.waitingForAsync || status.waitingForHuman) {
      return status;
    }
    if (
      status.status === "COMPLETED" ||
      status.status === "FAILED" ||
      status.status === "CANCELLED"
    ) {
      return status;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      break;
    }
    await delay(Math.min(intervalMs, remaining));
  }
  throw new Error(`Run polling timed out after ${Math.round(timeoutMs / 1000)}s`);
}

export async function submitAsyncFeedback(
  runId: string,
  body: AsyncToolFeedbackRequest,
): Promise<RunStatusResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return getRunStatus(runId);
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}/feedback`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<RunStatusResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return normalizeRunStatus(data);
}

export async function submitHumanResponse(
  runId: string,
  body: HumanResponseRequest,
  stepKey?: string,
): Promise<RunStatusResponse> {
  if (stepKey) {
    return submitAsyncFeedback(runId, {
      requestId: body.requestId,
      stepKey,
      result: body.decision,
      comment: body.comment,
    });
  }
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
  return normalizeRunStatus(data);
}

export async function pollAsyncToolStep(
  runId: string,
  body: AsyncToolPollRequest,
): Promise<RunStatusResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return getRunStatus(runId);
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/runs/${runId}/poll`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<RunStatusResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return normalizeRunStatus(data);
}

function normalizeRunStatus(data: RunStatusResponse): RunStatusResponse {
  const pendingAsync =
    data.pendingAsync?.length > 0
      ? data.pendingAsync
      : (data.pendingApprovals ?? []).map((a) => ({
          requestId: a.requestId,
          runId: data.runId,
          workflowId: data.runId,
          userId: data.userId,
          stepKey: a.stepKey,
          toolName: "human_in_the_loop",
          toolVersion: "1.1.0",
          asyncKind: "INPUT_REQUIRED" as const,
          prompt: a.prompt,
          proposal: a.proposal,
          allowedDecisions: ["accept", "reject"],
          feedbackPath: data.feedbackPath ?? `/agent/runs/${data.runId}/feedback`,
        }));
  return {
    ...data,
    pendingAsync,
    waitingForAsync: pendingAsync.length > 0 || data.waitingForAsync,
    waitingForHuman: pendingAsync.some((p) => p.asyncKind === "INPUT_REQUIRED") || data.waitingForHuman,
  };
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

const MOCK_TOOLS: ToolRegistrationResponse[] = [
  {
    name: "data_acquisition",
    version: "1.1.0",
    maxRetry: 3,
    description: "LLM generates read-only SQL from schema_catalog + user question; returns context rows.",
    toolType: "DATA_ACQUISITION",
    executionMode: "SYNC",
    inputSchema: {
      description: "NL question + scenario for SQL generation",
      fields: [
        {
          name: "question",
          type: "string",
          description: "Natural-language question driving SQL generation.",
        },
      ],
    },
    outputSchema: {
      description: "SQL-backed context for downstream tools",
      fields: [{ name: "rowCount", type: "integer", description: "Number of rows returned." }],
    },
    enabled: true,
    executorAvailable: true,
  },
];

export async function listTools(): Promise<ToolRegistrationResponse[]> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return MOCK_TOOLS;
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/tools`, { headers: opsHeaders() });
  const data = await parseJson<ToolRegistrationResponse[] & { message?: string }>(res);
  if (!res.ok) throw new Error((data as { message?: string }).message ?? `HTTP ${res.status}`);
  return data;
}

export async function registerTool(body: RegisterToolRequest): Promise<ToolRegistrationResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return {
      ...body,
      executorAvailable: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/tools`, {
    method: "POST",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<ToolRegistrationResponse & { message?: string }>(res);
  if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
  return data;
}

export async function updateTool(
  toolName: string,
  body: RegisterToolRequest,
): Promise<ToolRegistrationResponse> {
  const root = baseUrl();
  if (!root && useMock()) {
    await delay(200);
    return { ...body, executorAvailable: true, updatedAt: new Date().toISOString() };
  }
  if (!root) throw new Error("Set VITE_AGENT_API_BASE_URL or VITE_USE_MOCK=true");

  const res = await fetch(`${root}/agent/tools/${encodeURIComponent(toolName)}`, {
    method: "PUT",
    headers: opsHeaders(),
    body: JSON.stringify(body),
  });
  const data = await parseJson<ToolRegistrationResponse & { message?: string }>(res);
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
