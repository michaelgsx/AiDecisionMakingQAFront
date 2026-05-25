import { useCallback, useEffect, useState } from "react";
import { listEvaluations, submitEvaluationReview } from "../api/client";
import type { EvaluationDto, EvaluationStatusFilter } from "../types/api";

export function EvaluationPage() {
  const [filter, setFilter] = useState<EvaluationStatusFilter>("pending");
  const [items, setItems] = useState<EvaluationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
          Review completed Q&amp;A pairs. Accept or reject for further human review.
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
        {items.map((item) => (
          <li key={item.evaluationId} className="evaluation-card">
            <div className="evaluation-meta">
              <span className={`badge badge-${item.reviewStatus.toLowerCase()}`}>
                {item.reviewStatus}
              </span>
              <span className="evaluation-date">
                {new Date(item.createdAt).toLocaleString()}
              </span>
            </div>
            <div className="evaluation-qa">
              <div>
                <span className="evaluation-label">Question</span>
                <p>{item.question}</p>
              </div>
              <div>
                <span className="evaluation-label">Answer</span>
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
          </li>
        ))}
      </ul>
    </div>
  );
}
