import { useCallback, useEffect, useMemo, useState } from "react";
import { listEvaluations, submitEvaluationReview } from "../api/client";
import type { EvaluationDto, EvaluationStatusFilter } from "../types/api";

type RunEvaluationGroup = {
  runId: string;
  run: EvaluationDto | null;
  steps: EvaluationDto[];
};

function groupByRun(items: EvaluationDto[]): RunEvaluationGroup[] {
  const map = new Map<string, RunEvaluationGroup>();
  for (const item of items) {
    let group = map.get(item.runId);
    if (!group) {
      group = { runId: item.runId, run: null, steps: [] };
      map.set(item.runId, group);
    }
    if (item.evaluationScope === "RUN") {
      group.run = item;
    } else {
      group.steps.push(item);
    }
  }
  for (const group of map.values()) {
    group.steps.sort((a, b) => (a.stepKey ?? "").localeCompare(b.stepKey ?? ""));
  }
  return [...map.values()].sort((a, b) => {
    const ta = a.run?.createdAt ?? a.steps[0]?.createdAt ?? "";
    const tb = b.run?.createdAt ?? b.steps[0]?.createdAt ?? "";
    return tb.localeCompare(ta);
  });
}

type EvaluationCardProps = {
  item: EvaluationDto;
  compact?: boolean;
  actingId: string | null;
  onReview: (evaluationId: string, decision: "accept" | "reject") => void;
};

function EvaluationCard({ item, compact = false, actingId, onReview }: EvaluationCardProps) {
  const isRun = item.evaluationScope === "RUN";

  return (
    <article className={compact ? "evaluation-step-card" : "evaluation-card"}>
      <div className="evaluation-meta">
        <div className="evaluation-meta-badges">
          <span className={`badge badge-${item.reviewStatus.toLowerCase()}`}>
            {item.reviewStatus}
          </span>
          {!isRun && item.toolName && (
            <span className="evaluation-step-tag">
              {item.stepKey} / {item.toolName}
            </span>
          )}
          <span className="evaluation-confidence" title="Model confidence">
            {(item.confidence * 100).toFixed(0)}% conf.
          </span>
        </div>
        <span className="evaluation-date">{new Date(item.createdAt).toLocaleString()}</span>
      </div>
      <div className="evaluation-qa">
        {!compact && (
          <div>
            <span className="evaluation-label">{isRun ? "Question" : "Run question"}</span>
            <p>{item.question}</p>
          </div>
        )}
        <div>
          <span className="evaluation-label">{isRun ? "Answer" : "Step output"}</span>
          <p className="evaluation-answer">{item.answer}</p>
        </div>
      </div>
      {item.reviewStatus === "PENDING" && (
        <div className="evaluation-actions">
          <button
            type="button"
            className="btn-accept"
            disabled={actingId === item.evaluationId}
            onClick={() => void onReview(item.evaluationId, "accept")}
          >
            Accept
          </button>
          <button
            type="button"
            className="btn-reject"
            disabled={actingId === item.evaluationId}
            onClick={() => void onReview(item.evaluationId, "reject")}
          >
            Reject
          </button>
        </div>
      )}
      {item.reviewStatus !== "PENDING" && item.reviewedAt && (
        <p className="evaluation-reviewed">
          Reviewed {new Date(item.reviewedAt).toLocaleString()}
          {item.comment ? ` — ${item.comment}` : ""}
        </p>
      )}
    </article>
  );
}

export function EvaluationPage() {
  const [filter, setFilter] = useState<EvaluationStatusFilter>("pending");
  const [items, setItems] = useState<EvaluationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const groups = useMemo(() => groupByRun(items), [items]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listEvaluations(filter);
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load evaluations");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const onReview = async (evaluationId: string, decision: "accept" | "reject") => {
    if (actingId) return;
    setActingId(evaluationId);
    setError(null);
    try {
      await submitEvaluationReview(evaluationId, { decision });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Review failed");
    } finally {
      setActingId(null);
    }
  };

  return (
    <div className="evaluation-page">
      <div className="evaluation-toolbar">
        <h2>Human evaluation</h2>
        <p className="evaluation-hint">
          Review end-to-end answers first; expand a run to review individual workflow steps.
        </p>
        <div className="evaluation-filters" role="tablist" aria-label="Evaluation filter">
          {(["pending", "accepted", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              type="button"
              role="tab"
              aria-selected={filter === f}
              className={filter === f ? "tab active" : "tab"}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
        </div>
      </div>

      {error && <p className="chat-error">{error}</p>}

      {loading && <p className="evaluation-loading">Loading…</p>}

      {!loading && items.length === 0 && (
        <p className="evaluation-empty">No evaluations in this filter.</p>
      )}

      <ul className="evaluation-list">
        {groups.map((group) => (
          <li key={group.runId} className="evaluation-run-group">
            {group.run ? (
              <EvaluationCard item={group.run} actingId={actingId} onReview={onReview} />
            ) : (
              <div className="evaluation-card evaluation-card-run-fallback">
                <div className="evaluation-meta">
                  <span className="badge badge-scope-run">Run</span>
                  <span className="evaluation-date">
                    {group.steps[0]
                      ? new Date(group.steps[0].createdAt).toLocaleString()
                      : ""}
                  </span>
                </div>
                {group.steps[0] && (
                  <div className="evaluation-qa">
                    <span className="evaluation-label">Question</span>
                    <p>{group.steps[0].question}</p>
                  </div>
                )}
              </div>
            )}

            {group.steps.length > 0 && (
              <details className="evaluation-step-details">
                <summary>
                  Step evaluations ({group.steps.length})
                  {group.steps.some((s) => s.reviewStatus === "PENDING") && (
                    <span className="evaluation-step-pending"> · pending</span>
                  )}
                </summary>
                <ul className="evaluation-step-list">
                  {group.steps.map((step) => (
                    <li key={step.evaluationId}>
                      <EvaluationCard
                        item={step}
                        compact
                        actingId={actingId}
                        onReview={onReview}
                      />
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
