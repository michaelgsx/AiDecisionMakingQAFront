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
      // Stop Mermaid from injecting its "Syntax error in text" bomb SVG into the
      // document body when a render (or its lazy-loaded renderer chunk) fails.
      suppressErrorRendering: true,
    });
    mermaidReady = true;
  }
}

function describeRenderError(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  // Mermaid lazy-loads each diagram renderer as a hashed chunk; after a redeploy a
  // stale page can request a chunk hash that no longer exists, so the import 404s.
  if (/dynamically imported module|Failed to fetch|importing a module script failed/i.test(msg)) {
    return "Diagram renderer could not load (the app was updated). Refresh the page to load the latest version.";
  }
  return "Could not render the workflow diagram.";
}

type Props = {
  source: string | null | undefined;
  steps?: { stepKey: string; toolName: string; status: string }[];
  /** Live phase text shown next to the panel title while the run is in progress. */
  annotation?: string | null;
  /** Whether the panel starts expanded. Defaults to collapsed; click the summary to open. */
  defaultOpen?: boolean;
};

export function WorkflowDiagram({ source, steps, annotation, defaultOpen = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [open, setOpen] = useState(defaultOpen);

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
          // Clear any partial output so a broken render never lingers in the panel.
          if (hostRef.current) hostRef.current.innerHTML = "";
          setRenderError(describeRenderError(e));
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
    <details
      className="workflow-panel"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
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
