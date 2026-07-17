import { app, BrowserWindow, dialog, ipcMain, Notification, safeStorage } from "electron";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import dotenv from "dotenv";
import { autoUpdater } from "electron-updater";

dotenv.config();

const TOKEN_FILE = "session.token";
const API_BASE_URL = "https://neeri.sloton.app";
const UPDATE_OWNER = "eirmoninfo";
const UPDATE_REPO = "neeri_pos_desktop_app";
const execFileAsync = promisify(execFile);

function resolveAppIconPath() {
  const candidates = [
    path.join(app.getAppPath(), "assets", "icon.png"),
    path.join(__dirname, "..", "assets", "icon.png"),
    path.join(process.cwd(), "assets", "icon.png")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? undefined;
}

interface PrinterInfo {
  name: string;
  isDefault?: boolean;
  online?: boolean;
  statusLabel?: string;
}

type UpdateStage = "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "disabled";

let updateStatus: {
  stage: UpdateStage;
  message: string;
  progressPercent?: number;
  updatedAt: number;
} = {
  stage: "idle",
  message: "Updater is idle.",
  updatedAt: Date.now()
};

let triggerUpdateCheck: null | (() => Promise<{ ok: boolean; message?: string }>) = null;
let updateCheckInterval: NodeJS.Timeout | null = null;

function tokenPath() {
  return path.join(app.getPath("userData"), TOKEN_FILE);
}

function saveToken(token: string) {
  const buff = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(token)
    : Buffer.from(token, "utf8");
  fs.writeFileSync(tokenPath(), buff);
}

function getToken() {
  if (!fs.existsSync(tokenPath())) {
    return null;
  }
  const buff = fs.readFileSync(tokenPath());
  if (safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(buff);
    } catch {
      // Backward compatibility: older builds stored token as plain text.
      const plainToken = buff.toString("utf8");
      // Migrate old plain token to encrypted format for future reads.
      if (plainToken.trim()) {
        saveToken(plainToken);
      }
      return plainToken;
    }
  }
  return buff.toString("utf8");
}

function clearToken() {
  if (fs.existsSync(tokenPath())) {
    fs.unlinkSync(tokenPath());
  }
}

async function listPrintersMacLinux(): Promise<PrinterInfo[]> {
  const platform = process.platform;
  if (platform !== "darwin" && platform !== "linux") return [];

  const [{ stdout: printersRaw }, { stdout: defaultRaw }] = await Promise.all([
    execFileAsync("lpstat", ["-p"]),
    execFileAsync("lpstat", ["-d"]).catch(() => ({ stdout: "" }))
  ]);

  const defaultName = defaultRaw.match(/system default destination:\s*(.+)\s*$/m)?.[1]?.trim();
  const rows = printersRaw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("printer "))
    .map((line) => {
      const parts = line.split(/\s+/);
      const name = parts[1] ?? "";
      const disabled = line.includes("disabled");
      return {
        name,
        isDefault: name === defaultName,
        online: !disabled,
        statusLabel: disabled ? "Disabled" : "Ready"
      } as PrinterInfo;
    })
    .filter((p) => p.name);

  return rows;
}

async function listPrintersWindows(): Promise<PrinterInfo[]> {
  if (process.platform !== "win32") return [];
  const ps = [
    "Get-Printer | Select-Object Name,PrinterStatus,WorkOffline,Default | ConvertTo-Json -Depth 3"
  ].join(" ");
  const { stdout } = await execFileAsync("powershell", ["-NoProfile", "-Command", ps]);
  const parsed = stdout.trim() ? JSON.parse(stdout) : [];
  const rows = Array.isArray(parsed) ? parsed : [parsed];
  return rows
    .map((row: Record<string, unknown>) => {
      const name = String(row.Name ?? "");
      const offline = Boolean(row.WorkOffline);
      const statusCode = Number(row.PrinterStatus ?? 0);
      return {
        name,
        isDefault: Boolean(row.Default),
        online: !offline && statusCode !== 7,
        statusLabel: offline ? "Offline" : statusCode === 7 ? "Offline" : "Ready"
      } as PrinterInfo;
    })
    .filter((p) => p.name);
}

async function listPrinters(): Promise<PrinterInfo[]> {
  if (process.platform === "win32") return listPrintersWindows();
  return listPrintersMacLinux();
}

async function sendDrawerPulseMacLinux(printerName: string, pulseHex: string) {
  const bytes = Buffer.from(pulseHex, "hex");
  const tmpPath = path.join(os.tmpdir(), `drawer-pulse-${Date.now()}-${Math.random().toString(16).slice(2)}.bin`);
  fs.writeFileSync(tmpPath, bytes);
  try {
    await execFileAsync("lp", ["-d", printerName, "-o", "raw", tmpPath]);
  } finally {
    fs.rmSync(tmpPath, { force: true });
  }
}

async function sendDrawerPulseWindows(printerName: string, pulseHex: string) {
  const base64 = Buffer.from(pulseHex, "hex").toString("base64");
  const script = `
$name = '${printerName.replace(/'/g, "''")}';
$bytes = [Convert]::FromBase64String('${base64}');
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", EntryPoint="OpenPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", EntryPoint="StartDocPrinterW", SetLastError=true, CharSet=CharSet.Unicode)]
  public static extern bool StartDocPrinter(IntPtr hPrinter, int level, DOCINFO di);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr hPrinter);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr hPrinter, byte[] pBytes, int count, out int written);
}
"@;
$h = [IntPtr]::Zero;
if (-not [RawPrinter]::OpenPrinter($name, [ref]$h, [IntPtr]::Zero)) { throw "OpenPrinter failed"; }
try {
  $di = New-Object RawPrinter+DOCINFO;
  $di.pDocName = "Drawer";
  $di.pDataType = "RAW";
  # Do NOT use StartPagePrinter/EndPagePrinter — that often forces a full page = blank slip.
  if (-not [RawPrinter]::StartDocPrinter($h, 1, $di)) { throw "StartDocPrinter failed"; }
  $written = 0;
  if (-not [RawPrinter]::WritePrinter($h, $bytes, $bytes.Length, [ref]$written)) { throw "WritePrinter failed"; }
  [RawPrinter]::EndDocPrinter($h) | Out-Null;
} finally {
  [RawPrinter]::ClosePrinter($h) | Out-Null;
}
`;
  await execFileAsync("powershell", ["-NoProfile", "-Command", script]);
}

function sanitizeUpdaterMessage(raw: string): string {
  const text = (raw ?? "").trim();
  if (!text) return "Updater error";

  const lower = text.toLowerCase();
  if (lower.includes("404") || lower.includes("releases.atom") || lower.includes("authentication token")) {
    return `Could not reach GitHub releases for ${UPDATE_OWNER}/${UPDATE_REPO}. Confirm the repo exists, a release is published, and GH_TOKEN has access if the repo is private.`;
  }
  if (lower.includes("403")) {
    return "GitHub rejected the update check (403). Verify GH_TOKEN scopes include repo access.";
  }
  if (lower.includes("enotfound") || lower.includes("network")) {
    return "Network error while checking for updates. Check your internet connection.";
  }

  const firstLine = text.split(/\r?\n/)[0]?.trim() ?? text;
  return firstLine.length > 220 ? `${firstLine.slice(0, 217)}…` : firstLine;
}

function setupAutoUpdater(win: BrowserWindow) {
  if (!app.isPackaged) {
    updateStatus = {
      stage: "disabled",
      message: "Auto-updater is disabled in development mode.",
      updatedAt: Date.now()
    };
    triggerUpdateCheck = async () => ({ ok: false, message: "Auto-updater is disabled in development mode." });
    return;
  }

  const setUpdateStatus = (next: Omit<typeof updateStatus, "updatedAt">) => {
    updateStatus = {
      ...next,
      message: sanitizeUpdaterMessage(next.message),
      updatedAt: Date.now()
    };
  };

  const githubToken = (process.env.GH_TOKEN || process.env.GITHUB_TOKEN || "").trim();
  const feedConfig = {
    provider: "github" as const,
    owner: UPDATE_OWNER,
    repo: UPDATE_REPO,
    private: Boolean(githubToken),
    ...(githubToken ? { token: githubToken } : {})
  };

  try {
    autoUpdater.setFeedURL(feedConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to configure update feed";
    setUpdateStatus({ stage: "error", message });
  }

  if (!githubToken) {
    // Public feed still works when releases are public; warn so 404s are easier to diagnose.
    console.warn(
      `[updater] GH_TOKEN not set. If ${UPDATE_OWNER}/${UPDATE_REPO} is private, update checks will fail with 404.`
    );
  }

  triggerUpdateCheck = async () => {
    setUpdateStatus({ stage: "checking", message: "Checking for updates..." });
    try {
      await autoUpdater.checkForUpdates();
      return { ok: true, message: "Checking for updates..." };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not check for updates";
      setUpdateStatus({ stage: "error", message });
      return { ok: false, message: sanitizeUpdaterMessage(message) };
    }
  };

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;

  autoUpdater.on("checking-for-update", () => {
    setUpdateStatus({ stage: "checking", message: "Checking for updates..." });
  });

  autoUpdater.on("update-available", () => {
    setUpdateStatus({ stage: "available", message: "Update available. Downloading..." });
    if (win.isDestroyed()) return;
    void dialog.showMessageBox(win, {
      type: "info",
      title: "Update available",
      message: "A newer version of Neeri Saloon POS is available.",
      detail: "It will download in the background. You can keep using the app."
    });
  });

  autoUpdater.on("update-not-available", () => {
    setUpdateStatus({ stage: "up-to-date", message: "You are on the latest version." });
  });

  autoUpdater.on("download-progress", (progress) => {
    setUpdateStatus({
      stage: "downloading",
      message: `Downloading update... ${Math.round(progress.percent)}%`,
      progressPercent: progress.percent
    });
  });

  autoUpdater.on("update-downloaded", () => {
    setUpdateStatus({ stage: "downloaded", message: "Update downloaded and ready to install." });
    if (win.isDestroyed()) {
      autoUpdater.quitAndInstall(false, true);
      return;
    }
    const choice = dialog.showMessageBoxSync(win, {
      type: "info",
      title: "Update ready",
      message: "The update has been downloaded.",
      detail: "Restart now to install?",
      buttons: ["Restart now", "Later"],
      defaultId: 0,
      cancelId: 1
    });
    if (choice === 0) {
      autoUpdater.quitAndInstall(false, true);
    }
  });

  autoUpdater.on("error", (error) => {
    const message = error?.message ?? "Updater error";
    setUpdateStatus({ stage: "error", message });
  });

  void autoUpdater.checkForUpdates().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Could not check for updates";
    setUpdateStatus({ stage: "error", message });
  });
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
  }
  updateCheckInterval = setInterval(() => {
    void autoUpdater.checkForUpdates().catch(() => {
      // status already handled by error event / previous catch
    });
  }, 1000 * 60 * 120);
}

async function openDrawerOnly(printerName: string, pulseCommandHex: string) {
  if (process.platform === "win32") {
    await sendDrawerPulseWindows(printerName, pulseCommandHex);
    return;
  }
  await sendDrawerPulseMacLinux(printerName, pulseCommandHex);
}

async function printHtmlSilent(printerName: string, html: string) {
  if (!printerName.trim()) {
    return { ok: false, error: "Printer name is required." };
  }
  if (!html.trim()) {
    return { ok: false, error: "Print HTML is required." };
  }

  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true
    }
  });

  try {
    const dataUrl = `data:text/html;charset=UTF-8,${encodeURIComponent(html)}`;
    await printWindow.loadURL(dataUrl);
    await new Promise<void>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: true,
          printBackground: true,
          deviceName: printerName,
          margins: { marginType: "none" }
        },
        (success, failureReason) => {
          if (success) {
            resolve();
            return;
          }
          reject(new Error(failureReason || "Silent print failed"));
        }
      );
    });
    return { ok: true, message: `Printed successfully on ${printerName}` };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Silent print failed" };
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}


function createWindow() {
  const iconPath = resolveAppIconPath();
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    title: "Neeri Saloon POS",
    ...(iconPath ? { icon: iconPath } : {}),
    webPreferences: {
     preload: path.join(app.getAppPath(), "dist-electron/preload.js"),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (process.platform === "darwin" && iconPath && app.dock) {
    app.dock.setIcon(iconPath);
  }

  if (!app.isPackaged) {
    win.loadURL("http://localhost:5173");
    return win;
  }
  const indexPath = path.join(app.getAppPath(), "dist/index.html");
  win.loadFile(indexPath);
  return win;
}


app.whenReady().then(() => {
  ipcMain.handle("auth:save-token", (_evt, token: string) => saveToken(token));
  ipcMain.handle("auth:get-token", () => getToken());
  ipcMain.handle("auth:clear-token", () => clearToken());
  ipcMain.handle("env:get-api-base-url", () => API_BASE_URL);
  ipcMain.handle("app:check-for-updates", async () => {
    if (!triggerUpdateCheck) {
      return { ok: false, message: "Updater is not ready yet." };
    }
    return triggerUpdateCheck();
  });
  ipcMain.handle("app:get-update-status", () => updateStatus);
  ipcMain.handle("app:notify", (_evt, payload: { title?: string; body?: string }) => {
    const title = (payload?.title ?? "Notification").trim() || "Notification";
    const body = (payload?.body ?? "").trim();
    if (Notification.isSupported()) {
      const iconPath = resolveAppIconPath();
      new Notification({
        title,
        body,
        ...(iconPath ? { icon: iconPath } : {})
      }).show();
      return { ok: true, message: "Notification shown." };
    }
    return { ok: false, message: "System notifications are not supported on this device." };
  });
  ipcMain.handle("pos:list-printers", async () => {
    try {
      const printers = await listPrinters();
      return { ok: true, printers };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Unable to list printers" };
    }
  });
  ipcMain.handle("pos:print-html-silent", async (_evt, payload: { printerName?: string; html?: string }) => {
    const printerName = (payload?.printerName ?? "").trim();
    const html = payload?.html ?? "";
    return printHtmlSilent(printerName, html);
  });
  ipcMain.handle("pos:open-drawer-only", async (_evt, payload: { printerName?: string; pulseCommandHex?: string }) => {
    try {
      const printerName = (payload?.printerName ?? "").trim();
      if (!printerName) return { ok: false, error: "Printer name is required." };

      const pulseCommandHex = (payload?.pulseCommandHex ?? "1B700019FA").replace(/[^0-9A-Fa-f]/g, "");
      await openDrawerOnly(printerName, pulseCommandHex);
      return { ok: true, message: `Drawer pulse sent to ${printerName}` };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Drawer open failed" };
    }
  });
  const win = createWindow();
  setupAutoUpdater(win);
});

app.on("window-all-closed", () => {
  if (updateCheckInterval) {
    clearInterval(updateCheckInterval);
    updateCheckInterval = null;
  }
  if (process.platform !== "darwin") app.quit();
});
