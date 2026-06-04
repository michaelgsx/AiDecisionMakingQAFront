import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";

let mermaidReady = false;

function ensureMermaid() {
  if (!mermaidReady) {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      flowchart: { curve: "basis" },
    });
    mermaidReady = true;
  }
}

type Props = {
  source: string | null | undefined;
  steps?: { stepKey: string; toolName: string; status: string }[];
  /** Live phase text shown next to the panel title while the run is in progress. */
  annotation?: string | null;
};

export function WorkflowDiagram({ source, steps, annotation }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);

  useEffect(() => {
    if (!source?.trim() || !hostRef.current) {
      setRenderError(null);
      return;
    }

    let cancelled = false;
    ensureMermaid();

    (async () => {
      try {
        const id = `wf-${crypto.randomUUID().replace(/-/g, "")}`;
        const { svg } = await mermaid.render(id, source);
        if (cancelled || !hostRef.current) return;
        hostRef.current.innerHTML = svg;
        setRenderError(null);
      } catch (e) {
        if (!cancelled) {
          setRenderError(e instanceof Error ? e.message : "Could not render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source]);

  if (!source?.trim() && (!steps || steps.length === 0)) {
    return null;
  }

  return (
    <details className="workflow-panel" open>
      <summary>
        <span className="workflow-title">Workflow DAG</span>
        {annotation && <span className="workflow-annotation">{annotation}</span>}
      </summary>
      {steps && steps.length > 0 && (
        <ul className="workflow-steps" aria-label="Step statuses">
          {steps.map((s) => (
            <li key={s.stepKey} className={`workflow-step workflow-step--${s.status.toLowerCase()}`}>
              <span className="workflow-step-key">{s.stepKey}</span>
              <span className="workflow-step-tool">{s.toolName}</span>
              <span className="workflow-step-status">{s.status}</span>
            </li>
          ))}
        </ul>
      )}
      {renderError && <p className="workflow-diagram-error">{renderError}</p>}
      <div ref={hostRef} className="workflow-diagram" role="img" aria-label="Workflow diagram" />
    </details>
  );
}
