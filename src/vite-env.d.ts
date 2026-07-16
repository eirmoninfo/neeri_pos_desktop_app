/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_PUSHER_KEY: string;
  readonly VITE_WS_HOST: string;
  readonly VITE_WS_PORT: string;
  readonly VITE_WS_SCHEME: "http" | "https";
  readonly VITE_API_BASE_URL: string;
  readonly VITE_POS_RECEIPT_PRINTER?: string;
  readonly VITE_POS_DRAWER_PULSE_HEX?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface DesktopApi {
  saveToken: (token: string) => Promise<void>;
  getToken: () => Promise<string | null>;
  clearToken: () => Promise<void>;
  getApiBaseUrl: () => Promise<string>;
  listPrinters: () => Promise<{
    ok: boolean;
    printers?: Array<{ name: string; isDefault?: boolean; online?: boolean; statusLabel?: string }>;
    error?: string;
  }>;
  openDrawerOnly: (payload: { printerName: string; pulseCommandHex?: string }) => Promise<{
    ok: boolean;
    message?: string;
    error?: string;
  }>;
  printHtmlSilent: (payload: { printerName: string; html: string }) => Promise<{
    ok: boolean;
    message?: string;
    error?: string;
  }>;
  checkForUpdates: () => Promise<{ ok: boolean; message?: string }>;
  getUpdateStatus: () => Promise<{
    stage: "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "disabled";
    message: string;
    progressPercent?: number;
    updatedAt: number;
  }>;
  notify: (payload: { title: string; body?: string }) => Promise<{ ok: boolean; message?: string }>;
}

interface Window {
  desktopApi: DesktopApi;
}
