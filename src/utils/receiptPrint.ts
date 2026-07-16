const PRINTER_STORAGE_KEY = "pos.receiptPrinterName";

export function getSavedReceiptPrinterName(): string {
  return localStorage.getItem(PRINTER_STORAGE_KEY)?.trim() ?? "";
}

export function saveReceiptPrinterName(name: string) {
  const trimmed = name.trim();
  if (trimmed) {
    localStorage.setItem(PRINTER_STORAGE_KEY, trimmed);
  } else {
    localStorage.removeItem(PRINTER_STORAGE_KEY);
  }
}

export async function resolveReceiptPrinterName(): Promise<string | null> {
  const saved = getSavedReceiptPrinterName();
  if (saved) return saved;

  const fromEnv = import.meta.env.VITE_POS_RECEIPT_PRINTER?.trim();
  if (fromEnv) return fromEnv;

  if (typeof window === "undefined" || !window.desktopApi?.listPrinters) {
    return null;
  }

  const listed = await window.desktopApi.listPrinters();
  if (!listed.ok || !listed.printers?.length) {
    return null;
  }

  const preferred = listed.printers.find((printer) => printer.isDefault) ?? listed.printers[0];
  return preferred?.name?.trim() || null;
}

function printViaBrowserDialog(html: string): void {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const frameWindow = iframe.contentWindow;
  const frameDoc = iframe.contentDocument ?? frameWindow?.document;
  if (!frameWindow || !frameDoc) {
    iframe.remove();
    throw new Error("Unable to open print dialog.");
  }

  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();

  const cleanup = () => {
    iframe.remove();
  };

  frameWindow.onafterprint = cleanup;
  window.setTimeout(() => {
    frameWindow.focus();
    frameWindow.print();
    window.setTimeout(cleanup, 30_000);
  }, 250);
}

export interface PrintReceiptOptions {
  /** Open cash drawer pulse — use for cash payments only. */
  openDrawer?: boolean;
}

export async function printReceiptHtml(html: string, options: PrintReceiptOptions = {}): Promise<void> {
  const openDrawer = options.openDrawer === true;
  const printerName = await resolveReceiptPrinterName();
  const desktop = typeof window !== "undefined" ? window.desktopApi : undefined;
  const pulseHex = import.meta.env.VITE_POS_DRAWER_PULSE_HEX?.trim();

  if (printerName && desktop?.printHtmlSilent) {
    const printed = await desktop.printHtmlSilent({ printerName, html });
    if (!printed.ok) {
      throw new Error(printed.error ?? "Receipt print failed");
    }

    if (openDrawer && desktop.openDrawerOnly) {
      const drawer = await desktop.openDrawerOnly({
        printerName,
        pulseCommandHex: pulseHex || undefined
      });
      if (!drawer.ok) {
        throw new Error(drawer.error ?? "Cash drawer could not be opened");
      }
    }
    return;
  }

  printViaBrowserDialog(html);

  if (openDrawer && printerName && desktop?.openDrawerOnly) {
    const drawer = await desktop.openDrawerOnly({
      printerName,
      pulseCommandHex: pulseHex || undefined
    });
    if (!drawer.ok) {
      throw new Error(drawer.error ?? "Cash drawer could not be opened");
    }
  }
}
