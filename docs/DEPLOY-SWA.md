# QA frontend deploy troubleshooting (ai-rag-agentic-qa)

## Root cause of "api key was invalid"

Azure Static Web App **`ai-rag-agentic-qa`** had:

- `deploymentAuthPolicy: GitHub` — token-only uploads rejected unless GitHub link is valid
- `repositoryToken: null` — broken GitHub connection

Resetting the deployment token (Option A) does **not** fix this if the policy is still **GitHub** and the repo is disconnected.

## Fix in Azure Portal (required)

1. Open **ai-rag-agentic-qa** → **Settings** → **Configuration** → **Deployment configuration**
2. **Connect** GitHub:
   - Repo: `michaelgsx/AiDecisionMakingQAFront`
   - Branch: `v1`
3. Set **Deployment authorization policy** to **Deployment token** (recommended for Key Vault / CI token deploy)
   - If the dropdown is greyed out, click **Disconnect**, then connect again
4. **Overview** → **Manage deployment token** → **Reset** → **Copy**

## Update secrets

### GitHub (AiDecisionMakingQAFront → Settings → Secrets → Actions)

| Secret | Value |
|--------|--------|
| `AZURE_STATIC_WEB_APPS_API_TOKEN_YELLOW_ISLAND_0FEFE051E` | Paste token from step 4 |
| `AZURE_CREDENTIALS` | SP JSON (optional Key Vault fallback) |
| `VITE_AGENT_API_BASE_URL` | Backend URL |

### Key Vault (optional, for deploy-qa-swa.yml)

```bash
TOKEN=$(az staticwebapp secrets list -n ai-rag-agentic-qa -g ai-rag-rg-1 --query properties.apiKey -o tsv)
az keyvault secret set --vault-name ai-rag-key --name ai-rag-agentic-qa --value "$TOKEN"
```

## Re-run deploy

GitHub → Actions → **Azure Static Web Apps CI/CD** → Re-run
