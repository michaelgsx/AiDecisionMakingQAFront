import { useCallback, useEffect, useRef, useState } from "react";
import {
  getWorkflowDiagram,
  pollUntilComplete,
  submitFeedback,
  submitHumanResponse,
  submitQuestion,
} from "../api/client";
import { ChatMessage } from "../components/ChatMessage";
import { HumanApprovalPanel } from "../components/HumanApprovalPanel";
import { WorkflowDiagram } from "../components/WorkflowDiagram";
import type { ChatMessage as Msg, HumanApprovalDto, RunStatusResponse, StepStatusDto } from "../types/api";

export function ChatPage() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [pendingApproval, setPendingApproval] = useState<HumanApprovalDto | null>(null);
  const [humanLoading, setHumanLoading] = useState(false);
  const [feedbackLoadingId, setFeedbackLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [workflowMermaid, setWorkflowMermaid] = useState<string | null>(null);
  const [workflowSteps, setWorkflowSteps] = useState<StepStatusDto[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, runStatus]);

  const applyWorkflowTick = (tick: RunStatusResponse) => {
    setRunStatus(tick.status);
    if (tick.workflowMermaid) {
      setWorkflowMermaid(tick.workflowMermaid);
    }
    if (tick.steps.length > 0) {
      setWorkflowSteps(tick.steps);
    }
  };

  const ensureWorkflowDiagram = async (runId: string, tick: RunStatusResponse) => {
    if (tick.workflowMermaid) {
      setWorkflowMermaid(tick.workflowMermaid);
      return;
    }
    try {
      const mermaid = await getWorkflowDiagram(runId);
      if (mermaid) setWorkflowMermaid(mermaid);
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
    setPendingApproval(null);
    setActiveRunId(null);
    setWorkflowMermaid(null);
    setWorkflowSteps([]);

    try {
      const ask = await submitQuestion({
        question: text,
        conversationId,
      });
      setConversationId(conversationId ?? ask.runId);
      setActiveRunId(ask.runId);

      const final = await pollUntilComplete(ask.runId, (tick) => {
        applyWorkflowTick(tick);
        if (tick.waitingForHuman && tick.pendingApprovals.length > 0) {
          setPendingApproval(tick.pendingApprovals[0]);
        } else {
          setPendingApproval(null);
        }
      });
      await ensureWorkflowDiagram(ask.runId, final);

      if (final.waitingForHuman) {
        setLoading(false);
        return;
      }

      if (final.status === "FAILED") {
        throw new Error(final.error ?? "Orchestrator run failed");
      }

      setMessages((m) => [
        ...m,
        {
          id: ask.runId,
          role: "assistant",
          content: final.answer ?? "(No answer produced)",
          status: final.status,
        },
      ]);
      setRunStatus(final.status);
      setPendingApproval(null);
      setActiveRunId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
      setMessages((m) => m.filter((x) => x.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }, [conversationId, input, loading]);

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
      const updated = await submitHumanResponse(activeRunId, {
        requestId: pendingApproval.requestId,
        decision,
      });
      setPendingApproval(null);
      applyWorkflowTick(updated);
      if (updated.waitingForHuman && updated.pendingApprovals.length > 0) {
        setPendingApproval(updated.pendingApprovals[0]);
        return;
      }
      setLoading(true);
      if (updated.status === "COMPLETED" || updated.status === "FAILED") {
        if (updated.status === "FAILED") {
          throw new Error(updated.error ?? "Run failed after human response");
        }
        setMessages((m) => [
          ...m,
          {
            id: activeRunId,
            role: "assistant",
            content: updated.answer ?? "(No answer produced)",
            status: updated.status,
          },
        ]);
        setActiveRunId(null);
        setLoading(false);
        return;
      }
      const final = await pollUntilComplete(activeRunId, (tick) => {
        applyWorkflowTick(tick);
        if (tick.waitingForHuman && tick.pendingApprovals.length > 0) {
          setPendingApproval(tick.pendingApprovals[0]);
        }
      });
      await ensureWorkflowDiagram(activeRunId, final);
      if (final.status === "FAILED") {
        throw new Error(final.error ?? "Orchestrator run failed");
      }
      setMessages((m) => [
        ...m,
        {
          id: activeRunId,
          role: "assistant",
          content: final.answer ?? "(No answer produced)",
          status: final.status,
        },
      ]);
      setActiveRunId(null);
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
    setInput("");
    setRunStatus(null);
    setPendingApproval(null);
    setActiveRunId(null);
    setWorkflowMermaid(null);
    setWorkflowSteps([]);
  };

  return (
    <div className="chat-page">
      <div className="chat-toolbar">
        <p className="chat-hint">
          Questions go to the <strong>orchestrator</strong> (DAG planner + tool executor). Poll until complete.
        </p>
        <button type="button" className="btn-ghost" onClick={newChat}>
          New chat
        </button>
      </div>

      {runStatus && (loading || pendingApproval) && (
        <p className="chat-status">
          Orchestrator: {pendingApproval ? "waiting for your approval" : runStatus}
        </p>
      )}

      {(workflowMermaid || workflowSteps.length > 0) && (
        <WorkflowDiagram source={workflowMermaid} steps={workflowSteps} />
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
            <div className="chat-bubble typing">
              <span className="dot" />
              <span className="dot" />
              <span className="dot" />
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
