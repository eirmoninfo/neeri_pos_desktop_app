import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("desktopApi", {
  saveToken: async (token: string) => ipcRenderer.invoke("auth:save-token", token),
  getToken: async () => ipcRenderer.invoke("auth:get-token") as Promise<string | null>,
  clearToken: async () => ipcRenderer.invoke("auth:clear-token"),
  getApiBaseUrl: async () => ipcRenderer.invoke("env:get-api-base-url") as Promise<string>,
  checkForUpdates: async () =>
    ipcRenderer.invoke("app:check-for-updates") as Promise<{ ok: boolean; message?: string }>,
  getUpdateStatus: async () =>
    ipcRenderer.invoke("app:get-update-status") as Promise<{
      stage: "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "disabled";
      message: string;
      progressPercent?: number;
      updatedAt: number;
    }>,
  notify: async (payload: { title: string; body?: string }) =>
    ipcRenderer.invoke("app:notify", payload) as Promise<{ ok: boolean; message?: string }>,
  listPrinters: async () =>
    ipcRenderer.invoke("pos:list-printers") as Promise<{
      ok: boolean;
      printers?: Array<{ name: string; isDefault?: boolean; online?: boolean; statusLabel?: string }>;
      error?: string;
    }>,
  printHtmlSilent: async (payload: { printerName: string; html: string }) =>
    ipcRenderer.invoke("pos:print-html-silent", payload) as Promise<{
      ok: boolean;
      message?: string;
      error?: string;
    }>,
  openDrawerOnly: async (payload: { printerName: string; pulseCommandHex?: string }) =>
    ipcRenderer.invoke("pos:open-drawer-only", payload) as Promise<{ ok: boolean; message?: string; error?: string }>
});
