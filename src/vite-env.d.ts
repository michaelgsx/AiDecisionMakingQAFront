/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_API_BASE_URL: string;
  readonly VITE_OPS_TOKEN: string;
  readonly VITE_USE_MOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
