import type { ChatMessage as Msg } from "../types/api";
import { FeedbackBar } from "./FeedbackBar";
import { WorkflowResultPanel } from "./WorkflowResultPanel";

type Props = {
  message: Msg;
  onFeedback: (messageId: string, rating: "up" | "down") => void;
  feedbackLoading?: boolean;
};

export function ChatMessage({ message, onFeedback, feedbackLoading }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`chat-row ${isUser ? "user" : "assistant"}`}>
      <div className="chat-avatar" aria-hidden>
        {isUser ? "You" : "AI"}
      </div>
      <div className="chat-bubble-wrap">
        <div className="chat-bubble">
          <pre className="chat-text">{message.content}</pre>
          {message.status && message.status !== "COMPLETED" && (
            <span className="mock-tag">Status: {message.status}</span>
          )}
        </div>
        {!isUser && message.workflow && <WorkflowResultPanel workflow={message.workflow} />}
        {!isUser && (
          <FeedbackBar
            selected={message.feedback}
            disabled={feedbackLoading || !!message.feedback}
            onRated={(rating) => onFeedback(message.id, rating)}
          />
        )}
      </div>
    </div>
  );
}
