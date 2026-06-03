# QA frontend deploy (ai-rag-agentic-qa)

Same pattern as **AiDecisionMakingFrontend** → SWA `ai-rag-webapp`: pre-build in CI, upload `dist/` with a deployment token from Key Vault.

## Azure resource

| Item | Value |
|------|--------|
| SWA name | `ai-rag-agentic-qa` |
| URL | `https://yellow-island-0fefe051e.7.azurestaticapps.net` |
| Key Vault | `ai-rag-key` |
| Deploy token secret | `ai-rag-agentic-qa` |
| Auth policy | **Deployment token** (not GitHub OIDC) |

## Workflow

Use **Deploy QA frontend (ai-rag-agentic-qa)** — `.github/workflows/deploy-qa-swa.yml` on push to `v1`.

The Portal auto-generated workflow (`azure-static-web-apps-yellow-island-0fefe051e.yml`) is disabled; do not re-enable OIDC / `AZURE_STATIC_WEB_APPS_API_TOKEN_*` deploys.

## GitHub Actions secrets

| Secret | Purpose |
|--------|---------|
| `AZURE_CREDENTIALS` | SP JSON: `{ "tenantId", "clientId", "clientSecret" }` |
| `VITE_AGENT_API_BASE_URL` | Agentic API URL (no trailing slash) |
| `VITE_OPS_TOKEN` | Optional; must match backend `OPS_TOKEN` |

Optional repository **variable** (not credentials): `AZURE_KEYVAULT_NAME` = `ai-rag-key`.

The SP needs **Key Vault Secrets User** on `ai-rag-key`.

## Refresh Key Vault token after reset

If you reset the SWA deployment token in Azure Portal:

```bash
TOKEN=$(az staticwebapp secrets list -n ai-rag-agentic-qa -g ai-rag-rg-1 --query properties.apiKey -o tsv)
az keyvault secret set --vault-name ai-rag-key --name ai-rag-agentic-qa --value "$TOKEN"
```

Then re-run the workflow (push to `v1` or workflow_dispatch).

## Portal checks (one-time)

1. **ai-rag-agentic-qa** → Configuration → **Deployment authorization policy** = **Deployment token**
2. No GitHub repo link required for token-based CI (disconnect GitHub if a broken link causes confusion)
