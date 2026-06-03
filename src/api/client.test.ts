import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getRunStatus,
  getWorkflowDiagram,
  listTools,
  pollUntilComplete,
  registerTool,
  submitQuestion,
} from "./client";

describe("api client", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_AGENT_API_BASE_URL", "");
    vi.stubEnv("VITE_USE_MOCK", "true");
    vi.stubEnv("VITE_OPS_TOKEN", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("submitQuestion in mock mode returns runId and pollPath", async () => {
    const res = await submitQuestion({ question: "freeze withdrawal?" });
    expect(res.runId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(res.status).toBe("PENDING");
    expect(res.pollPath).toContain(res.runId);
  });

  it("getRunStatus in mock mode returns workflowMermaid and steps", async () => {
    const runId = crypto.randomUUID();
    const res = await getRunStatus(runId);
    expect(res.runId).toBe(runId);
    expect(res.status).toBe("COMPLETED");
    expect(res.workflowMermaid).toContain("flowchart TD");
    expect(res.steps).toHaveLength(3);
    expect(res.steps[0].toolName).toBe("data_acquisition");
  });

  it("getWorkflowDiagram in mock mode returns mermaid source", async () => {
    const mermaid = await getWorkflowDiagram(crypto.randomUUID());
    expect(mermaid).toContain("data_acquisition");
  });

  it("pollUntilComplete in mock mode resolves immediately", async () => {
    const ticks: string[] = [];
    const final = await pollUntilComplete(crypto.randomUUID(), (s) => ticks.push(s.status));
    expect(final.status).toBe("COMPLETED");
    expect(ticks).toContain("COMPLETED");
  });

  it("listTools in mock mode returns registry entries", async () => {
    const tools = await listTools();
    expect(tools.length).toBeGreaterThan(0);
    expect(tools[0].name).toBe("data_acquisition");
    expect(tools[0].inputSchema.fields[0].name).toBe("question");
  });

  it("registerTool in mock mode echoes payload", async () => {
    const res = await registerTool({
      name: "data_acquisition",
      version: "1.1.0",
      maxRetry: 3,
      description: "test",
      toolType: "DATA_ACQUISITION",
      executionMode: "SYNC",
      inputSchema: { fields: [{ name: "q", type: "string", description: "d" }] },
      outputSchema: { fields: [{ name: "rows", type: "array", description: "d" }] },
      enabled: true,
    });
    expect(res.name).toBe("data_acquisition");
    expect(res.executorAvailable).toBe(true);
  });

  it("submitQuestion without mock or base URL throws", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    await expect(submitQuestion({ question: "x" })).rejects.toThrow(/VITE_AGENT_API_BASE_URL/);
  });

  it("calls live API when base URL is set", async () => {
    vi.stubEnv("VITE_USE_MOCK", "false");
    vi.stubEnv("VITE_AGENT_API_BASE_URL", "http://localhost:8788");

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        JSON.stringify({
          runId: "abc",
          status: "PENDING",
          pollPath: "/agent/runs/abc",
        }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const res = await submitQuestion({ question: "hello" });
    expect(res.runId).toBe("abc");
    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:8788/agent/ask",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
