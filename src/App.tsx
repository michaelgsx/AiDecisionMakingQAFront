import { useState } from "react";
import { ChatPage } from "./pages/ChatPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { ToolRegistryPage } from "./pages/ToolRegistryPage";

type Tab = "chat" | "evaluation" | "tools";

export function App() {
  const [tab, setTab] = useState<Tab>("chat");

  return (
    <div className="app-shell">
      <header>
        <div className="header-inner">
          <div className="brand">Risk Control Q&amp;A</div>
          <nav className="app-tabs" aria-label="Main">
            <button
              type="button"
              className={tab === "chat" ? "tab active" : "tab"}
              onClick={() => setTab("chat")}
            >
              Chat
            </button>
            <button
              type="button"
              className={tab === "evaluation" ? "tab active" : "tab"}
              onClick={() => setTab("evaluation")}
            >
              Evaluation
            </button>
            <button
              type="button"
              className={tab === "tools" ? "tab active" : "tab"}
              onClick={() => setTab("tools")}
            >
              Tools
            </button>
          </nav>
          <span className="header-sub">Agentic AI · AiDecisionMakingAgenticAI</span>
        </div>
      </header>
      <main>
        {tab === "chat" && <ChatPage />}
        {tab === "evaluation" && <EvaluationPage />}
        {tab === "tools" && <ToolRegistryPage />}
      </main>
    </div>
  );
}
