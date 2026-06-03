import { useState, useEffect } from "react";
import { ChatPage } from "./pages/ChatPage";
import { EvaluationPage } from "./pages/EvaluationPage";
import { ToolRegistryPage } from "./pages/ToolRegistryPage";
import { checkAgentHealth, type AgentConnectivity } from "./api/client";

type Tab = "chat" | "evaluation" | "tools";

export function App() {
  const [tab, setTab] = useState<Tab>("chat");
  const [connectivity, setConnectivity] = useState<AgentConnectivity | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkAgentHealth().then((status) => {
      if (!cancelled) setConnectivity(status);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const showConnectivityBanner =
    connectivity &&
    connectivity.state !== "ok" &&
    connectivity.state !== "mock";

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
      {showConnectivityBanner && connectivity && (
        <div className="api-status-banner" role="status">
          <strong>Backend unreachable.</strong> {connectivity.message}
          {connectivity.apiUrl && (
            <>
              {" "}
              API: <code>{connectivity.apiUrl}</code>
            </>
          )}
          <span className="api-status-hint">
            Service Principal is only for GitHub deploy — browser calls the API directly. Retry after
            backend deploy finishes or use Async chat.
          </span>
        </div>
      )}
      <main>
        {tab === "chat" && <ChatPage />}
        {tab === "evaluation" && <EvaluationPage />}
        {tab === "tools" && <ToolRegistryPage />}
      </main>
    </div>
  );
}
