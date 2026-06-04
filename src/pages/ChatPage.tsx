import { useCallback, useEffect, useRef, useState } from "react";
import {
  asyncChatSubmit,
  getRunStatus,
  getWorkflowDiagram,
  pollAsyncChatUntilComplete,
  pollUntilComplete,
  submitFeedback,
  submitHumanResponse,
  submitQuestion,
} from "../api/client";
import { ChatMessage } from "../components/ChatMessage";
import { HumanApprovalPanel } from "../components/HumanApprovalPanel";
import { WorkflowDiagram } from "../components/WorkflowDiagram";
import type {
  ChatMessage as Msg,
  HumanApprovalDto,
  RunStatusResponse,
  WorkflowSnapshot,
} from "../types/api";
import { buildWorkflowSnapshot } from "../utils/workflowSnapshot";
import { progressLabel } from "../utils/progress";

function firstInputRequired(
  tick: Partial<Pick<RunStatusResponse, "pendingAsync" | "pendingApprovals">>,
): HumanApprovalDto | null {
  const async = tick.pendingAsync?.find((p) => p.asyncKind === "INPUT_REQUIRED");
  if (async) {
    return {
      requestId: async.requestId,
      stepKey: async.stepKey,
      prompt: async.prompt ?? "",
      proposal: async.proposal ?? "",
    };
  }
  if (tick.pendingApprovals && tick.pendingApprovals.length > 0) {
    return tick.pendingApprovals[0];
  }
  return null;
}

function assistantMessage(
  id: string,
  tick: Pick<RunStatusResponse, "status" | "answer" | "error" | "workflowMermaid" | "workflowJson" | "steps">,
): Msg {
  return {
    id,
    role: "assistant",
    content: tick.answer ?? tick.error ?? "(No answer produced)",
    status: tick.status,
    workflow: buildWorkflowSnapshot(id, tick),
  };
}

type ChatMode = "sync" | "async";

const DEFAULT_QUESTION = "show me the information of user 'user-001'";

export function ChatPage() {
  const [chatMode, setChatMode] = useState<ChatMode>("sync");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState(DEFAULT_QUESTION);
  const [loading, setLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [statusDetail, setStatusDetail] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<HumanApprovalDto | null>(null);
  const [humanLoading, setHumanLoading] = useState(false);
  const [feedbackLoadingId, setFeedbackLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<WorkflowSnapshot | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, runStatus, statusDetail, activeWorkflow]);

  const applyWorkflowTick = (
    runId: string,
    tick: Pick<
      RunStatusResponse,
      "status" | "statusDetail" | "workflowMermaid" | "workflowJson" | "steps" | "answer" | "error"
    >,
  ) => {
    setRunStatus(tick.status);
    setStatusDetail(tick.statusDetail ?? null);
    setActiveWorkflow(buildWorkflowSnapshot(runId, tick));
  };

  const loadRunWorkflow = async (runId: string) => {
    try {
      const tick = await getRunStatus(runId);
      applyWorkflowTick(runId, tick);
      await ensureWorkflowDiagram(runId, tick);
      return tick;
    } catch {
      return null;
    }
  };

  const ensureWorkflowDiagram = async (
    runId: string,
    tick: Pick<RunStatusResponse, "workflowMermaid" | "workflowJson" | "steps" | "status" | "answer" | "error">,
  ) => {
    if (tick.workflowMermaid) {
      applyWorkflowTick(runId, tick);
      return;
    }
    try {
      const mermaid = await getWorkflowDiagram(runId);
      if (mermaid) {
        applyWorkflowTick(runId, { ...tick, workflowMermaid: mermaid });
      }
    } catch {
      /* diagram is optional */
    }
  };

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Msg = { id: `local-${Date.now()}`, role: "user", content: text };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setError(null);
    setLoading(true);
    setRunStatus("PENDING");
    setStatusDetail(null);
    setPendingApproval(null);
    setActiveRunId(null);
    setActiveWorkflow(null);

    try {
      if (chatMode === "async") {
        const submitted = await asyncChatSubmit({
          question: text,
          conversationId,
        });
        setConversationId(conversationId ?? submitted.requestId);
        setRunStatus(submitted.status);
        setStatusDetail("planning");

        const final = await pollAsyncChatUntilComplete(submitted.requestId, (tick) => {
          setRunStatus(tick.status);
          setStatusDetail(tick.statusDetail);
          if (tick.runId) {
            setActiveRunId(tick.runId);
            void loadRunWorkflow(tick.runId);
          }
        });

        if (final.status === "FAILED") {
          throw new Error(final.errorMessage ?? "Async chat failed");
        }

        const messageId = final.runId ?? submitted.requestId;
        if (final.runId) {
          const runTick = await loadRunWorkflow(final.runId);
          setMessages((m) => [
            ...m,
            assistantMessage(messageId, {
              status: "COMPLETED",
              answer: final.answer ?? runTick?.answer,
              error: final.errorMessage,
              workflowMermaid: runTick?.workflowMermaid,
              workflowJson: runTick?.workflowJson,
              steps: runTick?.steps ?? [],
            }),
          ]);
        } else {
          setMessages((m) => [
            ...m,
            {
              id: messageId,
              role: "assistant",
              content: final.answer ?? "(No answer produced)",
              status: final.status,
            },
          ]);
        }

        setRunStatus(final.status);
        setStatusDetail(final.statusDetail);
        setPendingApproval(null);
        setActiveRunId(null);
        setActiveWorkflow(null);
        return;
      }

      // Submit non-blocking (/agent/ask) and poll the run so the detailed phase
      // (planning → executing/{step}/{tool} → llm-answering → done) streams live,
      // instead of blocking on /agent/execute where only the optimistic status shows.
      const submitted = await submitQuestion({ question: text, conversationId });
      setConversationId(conversationId ?? submitted.runId);
      setActiveRunId(submitted.runId);
      setRunStatus(submitted.status);
      void loadRunWorkflow(submitted.runId);

      const polled = await pollUntilComplete(submitted.runId, (tick) => {
        applyWorkflowTick(submitted.runId, tick);
        setPendingApproval(firstInputRequired(tick));
      });
      await ensureWorkflowDiagram(submitted.runId, polled);

      if (polled.waitingForAsync || polled.waitingForHuman) {
        setPendingApproval(firstInputRequired(polled));
        setLoading(false);
        return;
      }
      if (polled.status === "FAILED") {
        throw new Error(polled.error ?? "Orchestrator run failed");
      }

      setMessages((m) => [...m, assistantMessage(submitted.runId, polled)]);
      setRunStatus(polled.status);
      setPendingApproval(null);
      setActiveRunId(null);
      setActiveWorkflow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [chatMode, conversationId, input, loading]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const onFeedback = async (messageId: string, rating: "up" | "down") => {
    if (!conversationId || feedbackLoadingId) return;
    setFeedbackLoadingId(messageId);
    setError(null);
    try {
      await submitFeedback({
        runId: messageId,
        messageId,
        conversationId,
        rating,
      });
      setMessages((m) =>
        m.map((msg) => (msg.id === messageId ? { ...msg, feedback: rating } : msg)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Feedback failed");
    } finally {
      setFeedbackLoadingId(null);
    }
  };

  const onHumanRespond = async (decision: "accept" | "reject") => {
    if (!activeRunId || !pendingApproval || humanLoading) return;
    setHumanLoading(true);
    setError(null);
    try {
      const updated = await submitHumanResponse(
        activeRunId,
        {
          requestId: pendingApproval.requestId,
          decision,
        },
        pendingApproval.stepKey,
      );
      setPendingApproval(null);
      applyWorkflowTick(activeRunId, updated);
      const pending = firstInputRequired(updated);
      if (pending) {
        setPendingApproval(pending);
        return;
      }
      setLoading(true);
      if (updated.status === "COMPLETED" || updated.status === "FAILED") {
        if (updated.status === "FAILED") {
          throw new Error(updated.error ?? "Run failed after human response");
        }
        setMessages((m) => [...m, assistantMessage(activeRunId, updated)]);
        setActiveRunId(null);
        setActiveWorkflow(null);
        setLoading(false);
        return;
      }
      const final = await pollUntilComplete(activeRunId, (tick) => {
        applyWorkflowTick(activeRunId, tick);
        setPendingApproval(firstInputRequired(tick));
      });
      await ensureWorkflowDiagram(activeRunId, final);
      if (final.status === "FAILED") {
        throw new Error(final.error ?? "Orchestrator run failed");
      }
      setMessages((m) => [...m, assistantMessage(activeRunId, final)]);
      setActiveRunId(null);
      setActiveWorkflow(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Human response failed");
    } finally {
      setHumanLoading(false);
    }
  };

  const newChat = () => {
    setConversationId(undefined);
    setMessages([]);
    setError(null);
    setInput(DEFAULT_QUESTION);
    setRunStatus(null);
    setStatusDetail(null);
    setPendingApproval(null);
    setActiveRunId(null);
    setActiveWorkflow(null);
  };

  const showLiveWorkflow = activeWorkflow && (loading || pendingApproval);

  const progress = progressLabel({
    chatMode,
    runStatus,
    statusDetail,
    steps: activeWorkflow?.steps,
    waitingForApproval: Boolean(pendingApproval),
  });

  return (
    <div className="chat-page">
      <div className="chat-toolbar">
        <p className="chat-hint">
          Questions go to the <strong>orchestrator</strong> (
          {chatMode === "sync"
            ? "sync — submit + poll run status for live progress"
            : "async chat — polls and shows live progress"}
          ).
        </p>
        <div className="chat-toolbar-actions">
          <div className="chat-mode-toggle" role="group" aria-label="Chat mode">
            <button
              type="button"
              className={chatMode === "sync" ? "mode-btn active" : "mode-btn"}
              onClick={() => setChatMode("sync")}
              disabled={loading}
            >
              Sync chat
            </button>
            <button
              type="button"
              className={chatMode === "async" ? "mode-btn active" : "mode-btn"}
              onClick={() => setChatMode("async")}
              disabled={loading}
            >
              Async chat
            </button>
          </div>
          <button type="button" className="btn-ghost" onClick={newChat}>
            New chat
          </button>
        </div>
      </div>

      {runStatus && (loading || pendingApproval) && (
        <p className="chat-status">{progress}</p>
      )}

      {showLiveWorkflow && (
        <WorkflowDiagram
          source={activeWorkflow.workflowMermaid}
          steps={activeWorkflow.steps}
          annotation={loading || pendingApproval ? progress : null}
          defaultOpen
        />
      )}

      {pendingApproval && (
        <HumanApprovalPanel
          approval={pendingApproval}
          loading={humanLoading}
          onRespond={(d) => void onHumanRespond(d)}
        />
      )}

      <div className="chat-thread" role="log" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <h2>Risk control assistant</h2>
            <p>Example: &quot;What similar cases support freezing this withdrawal?&quot;</p>
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            message={m}
            onFeedback={onFeedback}
            feedbackLoading={feedbackLoadingId === m.id}
          />
        ))}
        {loading && (
          <div className="chat-row assistant">
            <div className="chat-avatar">AI</div>
            <div className="chat-bubble-wrap">
              <div className="chat-bubble typing">
                <span className="dot" />
                <span className="dot" />
                <span className="dot" />
              </div>
              <p className="chat-loading-label">{progress}</p>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="chat-error">{error}</p>}

      <div className="composer">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Message the risk assistant…"
          rows={3}
          disabled={loading}
          aria-label="Your message"
        />
        <button type="button" className="btn-send" onClick={() => void send()} disabled={loading || !input.trim()}>
          Send
        </button>
      </div>
    </div>
  );
}
