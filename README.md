# AI Decision Making — QA (Frontend)

ChatGPT-style **risk control Q&A** UI. Talks to **[AiDecisionMakingAgenticAI](https://github.com/michaelgsx/AiDecisionMakingAgenticAI)** (`POST /agent/chat`, `POST /agent/feedback`).

> **Synthetic data:** Example questions and demo replies are for illustration only.

## Features

- Full-height chat thread (user / assistant bubbles)
- **Thumbs up / thumbs down** on each assistant answer → persisted via `/agent/feedback`
- **New chat** clears conversation id
- Mock mode: `VITE_USE_MOCK=true` without a backend

## Quick start

```bash
npm ci
cp .env.example .env
npm run dev
```

Open http://localhost:5174

```env
VITE_AGENT_API_BASE_URL=http://localhost:8788
VITE_OPS_TOKEN=
```

Run the agentic backend first (`AiDecisionMakingAgenticAI/backend`, port 8788) and apply `db/V1__create_qa_agent_tables.sql` on Azure SQL.

## Azure deploy (Static Web App `ai-rag-agentic-qa`)

| Item | Value |
|------|--------|
| SWA resource | `ai-rag-agentic-qa` |
| Key Vault | `ai-rag-key` |
| Deploy token secret | `ai-rag-agentic-qa` |

Workflow: `.github/workflows/deploy-qa-swa.yml` (push to `main`).

**GitHub Actions secrets:**

- `AZURE_CREDENTIALS` — service principal with Key Vault Secrets User on `ai-rag-key`
- `VITE_AGENT_API_BASE_URL` — Agentic API URL (e.g. `https://ai-rag-agentic-api.azurewebsites.net`)
- `VITE_OPS_TOKEN` — optional, same as API `OPS_TOKEN`

## Related repos

| Repo | Role |
|------|------|
| **AiDecisionMakingAgenticAI** | This chat API |
| AiDecisionMakingBackend | Ingest / Assess RAG API |
| AiDecisionMakingFrontend | Risk console UI |
