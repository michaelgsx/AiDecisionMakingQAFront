import type { HumanApprovalDto } from "../types/api";

type Props = {
  approval: HumanApprovalDto;
  loading: boolean;
  onRespond: (decision: "accept" | "reject") => void;
};

export function HumanApprovalPanel({ approval, loading, onRespond }: Props) {
  return (
    <div className="human-approval" role="region" aria-label="Human approval required">
      <p className="human-approval-title">{approval.prompt}</p>
      <pre className="human-approval-proposal">{approval.proposal}</pre>
      <div className="human-approval-actions">
        <button
          type="button"
          className="btn-accept"
          disabled={loading}
          onClick={() => onRespond("accept")}
        >
          Accept
        </button>
        <button
          type="button"
          className="btn-reject"
          disabled={loading}
          onClick={() => onRespond("reject")}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
