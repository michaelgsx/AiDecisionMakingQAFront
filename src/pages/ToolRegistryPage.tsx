import { useCallback, useEffect, useState } from "react";
import { listTools, registerTool, updateTool } from "../api/client";
import type {
  RegisterToolRequest,
  ToolRegistrationResponse,
  ToolSchemaFieldDto,
} from "../types/api";
import { SCHEMA_TYPE_OPTIONS, TOOL_TYPE_OPTIONS } from "../types/api";

const EMPTY_FIELD: ToolSchemaFieldDto = { name: "", type: "string", description: "" };

function emptyForm(): RegisterToolRequest {
  return {
    name: "",
    version: "1.1.0",
    maxRetry: 3,
    description: "",
    toolType: "DATA_ACQUISITION",
    executionMode: "SYNC",
    inputSchema: { description: "", fields: [{ ...EMPTY_FIELD }] },
    outputSchema: { description: "", fields: [{ ...EMPTY_FIELD }] },
    enabled: true,
  };
}

function toForm(tool: ToolRegistrationResponse): RegisterToolRequest {
  return {
    name: tool.name,
    version: tool.version,
    maxRetry: tool.maxRetry,
    description: tool.description,
    toolType: tool.toolType,
    executionMode: tool.executionMode,
    inputSchema: {
      description: tool.inputSchema.description ?? "",
      fields: tool.inputSchema.fields.length > 0 ? tool.inputSchema.fields : [{ ...EMPTY_FIELD }],
    },
    outputSchema: {
      description: tool.outputSchema.description ?? "",
      fields: tool.outputSchema.fields.length > 0 ? tool.outputSchema.fields : [{ ...EMPTY_FIELD }],
    },
    enabled: tool.enabled,
  };
}

export function ToolRegistryPage() {
  const [tools, setTools] = useState<ToolRegistrationResponse[]>([]);
  const [form, setForm] = useState<RegisterToolRequest>(emptyForm());
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTools(await listTools());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tools");
      setTools([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSelectTool = (tool: ToolRegistrationResponse) => {
    setForm(toForm(tool));
    setEditing(true);
    setSuccess(null);
    setError(null);
  };

  const onNewTool = () => {
    setForm(emptyForm());
    setEditing(false);
    setSuccess(null);
    setError(null);
  };

  const updateField = <K extends keyof RegisterToolRequest>(
    key: K,
    value: RegisterToolRequest[K],
  ) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateSchemaField = (
    side: "inputSchema" | "outputSchema",
    index: number,
    patch: Partial<ToolSchemaFieldDto>,
  ) => {
    setForm((prev) => {
      const schema = prev[side];
      const fields = schema.fields.map((f, i) => (i === index ? { ...f, ...patch } : f));
      return { ...prev, [side]: { ...schema, fields } };
    });
  };

  const addSchemaField = (side: "inputSchema" | "outputSchema") => {
    setForm((prev) => ({
      ...prev,
      [side]: { ...prev[side], fields: [...prev[side].fields, { ...EMPTY_FIELD }] },
    }));
  };

  const removeSchemaField = (side: "inputSchema" | "outputSchema", index: number) => {
    setForm((prev) => {
      const fields = prev[side].fields.filter((_, i) => i !== index);
      return {
        ...prev,
        [side]: { ...prev[side], fields: fields.length > 0 ? fields : [{ ...EMPTY_FIELD }] },
      };
    });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: RegisterToolRequest = {
        ...form,
        name: form.name.trim(),
        version: form.version.trim(),
        description: form.description.trim(),
        inputSchema: {
          description: form.inputSchema.description?.trim() || undefined,
          fields: form.inputSchema.fields
            .filter((f) => f.name.trim())
            .map((f) => ({
              name: f.name.trim(),
              type: f.type.trim(),
              description: f.description.trim(),
            })),
        },
        outputSchema: {
          description: form.outputSchema.description?.trim() || undefined,
          fields: form.outputSchema.fields
            .filter((f) => f.name.trim())
            .map((f) => ({
              name: f.name.trim(),
              type: f.type.trim(),
              description: f.description.trim(),
            })),
        },
      };
      if (!payload.name) throw new Error("Tool name is required");
      if (payload.inputSchema.fields.length === 0 || payload.outputSchema.fields.length === 0) {
        throw new Error("Input and output schemas need at least one field");
      }

      if (editing) {
        await updateTool(payload.name, payload);
        setSuccess(`Updated ${payload.name}`);
      } else {
        await registerTool(payload);
        setSuccess(`Registered ${payload.name}`);
      }
      await load();
      if (!editing) onNewTool();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tool-registry-page">
      <div className="tool-registry-toolbar">
        <h2>Tool registry</h2>
        <p className="tool-registry-hint">
          Register orchestrator tools in Azure SQL (<code>orchestrator_tool</code>). Schemas feed the
          LLM workflow planner for questions like user profile lookups.
        </p>
        <div className="tool-registry-actions">
          <button type="button" className="btn-ghost" onClick={() => void load()} disabled={loading}>
            Refresh
          </button>
          <button type="button" className="btn-ghost" onClick={onNewTool}>
            New tool
          </button>
        </div>
      </div>

      {error && <p className="chat-error">{error}</p>}
      {success && <p className="tool-registry-success">{success}</p>}

      <div className="tool-registry-layout">
        <section className="tool-registry-list-panel">
          <h3>Enabled tools</h3>
          {loading && <p className="evaluation-loading">Loading…</p>}
          {!loading && tools.length === 0 && (
            <p className="evaluation-empty">No tools registered.</p>
          )}
          <ul className="tool-registry-list">
            {tools.map((tool) => (
              <li key={tool.name}>
                <button
                  type="button"
                  className={form.name === tool.name ? "tool-registry-item active" : "tool-registry-item"}
                  onClick={() => onSelectTool(tool)}
                >
                  <span className="tool-registry-item-name">{tool.name}</span>
                  <span className="tool-registry-item-meta">
                    v{tool.version} · maxRetry {tool.maxRetry} · {tool.executionMode}
                  </span>
                  {!tool.executorAvailable && (
                    <span className="badge badge-rejected">No executor</span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="tool-registry-form-panel">
          <h3>{editing ? `Edit ${form.name}` : "Register tool"}</h3>
          <form className="tool-registry-form" onSubmit={(e) => void onSubmit(e)}>
            <div className="tool-registry-grid">
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(e) => updateField("name", e.target.value)}
                  disabled={editing}
                  placeholder="data_acquisition"
                  pattern="[a-z][a-z0-9_]*"
                  required
                />
              </label>
              <label>
                Version
                <input
                  value={form.version}
                  onChange={(e) => updateField("version", e.target.value)}
                  required
                />
              </label>
              <label>
                Max retry
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={form.maxRetry}
                  onChange={(e) => updateField("maxRetry", Number(e.target.value))}
                  required
                />
              </label>
              <label>
                Tool type
                <select
                  value={form.toolType}
                  onChange={(e) =>
                    updateField("toolType", e.target.value as RegisterToolRequest["toolType"])
                  }
                >
                  {TOOL_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Execution mode
                <select
                  value={form.executionMode}
                  onChange={(e) =>
                    updateField("executionMode", e.target.value as RegisterToolRequest["executionMode"])
                  }
                >
                  <option value="SYNC">SYNC</option>
                  <option value="ASYNC">ASYNC</option>
                </select>
              </label>
              <label className="tool-registry-check">
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) => updateField("enabled", e.target.checked)}
                />
                Enabled
              </label>
            </div>

            <label>
              Description
              <textarea
                value={form.description}
                onChange={(e) => updateField("description", e.target.value)}
                rows={3}
                required
              />
            </label>

            {(["inputSchema", "outputSchema"] as const).map((side) => (
              <fieldset key={side} className="tool-schema-fieldset">
                <legend>{side === "inputSchema" ? "Input schema" : "Output schema"}</legend>
                <label>
                  Schema description
                  <input
                    value={form[side].description ?? ""}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [side]: { ...prev[side], description: e.target.value },
                      }))
                    }
                  />
                </label>
                {form[side].fields.map((field, index) => (
                  <div key={`${side}-${index}`} className="tool-schema-row">
                    <input
                      value={field.name}
                      onChange={(e) => updateSchemaField(side, index, { name: e.target.value })}
                      placeholder="field name"
                    />
                    <select
                      value={field.type}
                      onChange={(e) => updateSchemaField(side, index, { type: e.target.value })}
                    >
                      {SCHEMA_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                    <input
                      className="tool-schema-desc"
                      value={field.description}
                      onChange={(e) =>
                        updateSchemaField(side, index, { description: e.target.value })
                      }
                      placeholder="description for LLM planner"
                    />
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => removeSchemaField(side, index)}
                      aria-label="Remove field"
                    >
                      −
                    </button>
                  </div>
                ))}
                <button type="button" className="btn-ghost" onClick={() => addSchemaField(side)}>
                  Add field
                </button>
              </fieldset>
            ))}

            <div className="tool-registry-submit">
              <button type="submit" className="btn-accept" disabled={saving}>
                {saving ? "Saving…" : editing ? "Update tool" : "Register tool"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}
