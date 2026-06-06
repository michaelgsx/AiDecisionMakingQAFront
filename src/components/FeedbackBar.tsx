import type { FeedbackRequest } from "../types/api";

type Props = {
  selected?: "up" | "down";
  disabled?: boolean;
  onRated: (rating: FeedbackRequest["rating"]) => void;
};

export function FeedbackBar({ selected, disabled, onRated }: Props) {
  return (
    <div className="feedback-bar" role="group" aria-label="Rate this answer">
      <button
        type="button"
        className={`feedback-btn ${selected === "up" ? "active up" : ""}`}
        disabled={disabled}
        title="Helpful — save this workflow for similar questions"
        aria-pressed={selected === "up"}
        onClick={() => onRated("up")}
      >
        <span aria-hidden>👍</span> Helpful
      </button>
      <button
        type="button"
        className={`feedback-btn ${selected === "down" ? "active down" : ""}`}
        disabled={disabled}
        title="Not helpful"
        aria-pressed={selected === "down"}
        onClick={() => onRated("down")}
      >
        <span aria-hidden>👎</span> Not helpful
      </button>
    </div>
  );
}
