import type { StepStatusDto, WorkflowSnapshot } from "../types/api";
import { WorkflowDiagram } from "./WorkflowDiagram";

function formatJson(raw?: string): string | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function stepSummary(steps: StepStatusDto[]) {
  const completed = steps.filter((s) => s.status === "COMPLETED").length;
  const failed = steps.filter((s) => s.status === "FAILED" || s.status === "TIMED_OUT").length;
  return { total: steps.length, completed, failed };
}

type Props = {
  workflow: WorkflowSnapshot;
};

export function WorkflowResultPanel({ workflow }: Props) {
  const { total, completed, failed } = stepSummary(workflow.steps);
  const formattedPlan = formatJson(workflow.workflowJson);

  return (
    <div className="workflow-result">
      <div className="workflow-result-header">
        <span className="workflow-result-title">Workflow output</span>
        <span className={`workflow-result-status workflow-result-status--${workflow.status.toLowerCase()}`}>
          {workflow.status}
        </span>
      </div>

      <p className="workflow-result-summary">
        {total} step{total === 1 ? "" : "s"} · {completed} completed
        {failed > 0 ? ` · ${failed} failed` : ""}
      </p>

      {workflow.error && <p className="workflow-result-error">{workflow.error}</p>}

      {workflow.steps.length > 0 && (
        <ol className="workflow-result-steps" aria-label="Workflow step outputs">
          {workflow.steps.map((step) => {
            const output = formatJson(step.outputJson);
            return (
              <li key={step.stepId} className={`workflow-result-step workflow-result-step--${step.status.toLowerCase()}`}>
                <div className="workflow-result-step-head">
                  <span className="workflow-result-step-key">{step.stepKey}</span>
                  <span className="workflow-result-step-tool">{step.toolName}</span>
                  {step.toolVersion && <span className="workflow-result-step-version">v{step.toolVersion}</span>}
                  <span className="workflow-result-step-status">{step.status}</span>
                  {step.attemptCount > 1 && (
                    <span className="workflow-result-step-attempts">{step.attemptCount} attempts</span>
                  )}
                </div>
                {step.error && <p className="workflow-result-step-error">{step.error}</p>}
                {output && (
                  <details className="workflow-result-output">
                    <summary>Step output</summary>
                    <pre className="workflow-result-json">{output}</pre>
                  </details>
                )}
              </li>
            );
          })}
        </ol>
      )}

      <WorkflowDiagram source={workflow.workflowMermaid} steps={workflow.steps} />

      {formattedPlan && (
        <details className="workflow-result-plan">
          <summary>Planned workflow JSON</summary>
          <pre className="workflow-result-json">{formattedPlan}</pre>
        </details>
      )}
    </div>
  );
}
