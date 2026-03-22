/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FASTAPI_URL: string;
  readonly VITE_EXPRESS_URL: string;
  readonly VITE_GO_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
