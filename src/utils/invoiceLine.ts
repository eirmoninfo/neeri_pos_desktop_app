import type { InvoiceItemLine } from "../types";

export function invoiceLineQty(line: InvoiceItemLine) {
  const qty = Number(line.qty);
  return Number.isFinite(qty) && qty > 0 ? qty : 1;
}

export function invoiceLineUnitPrice(line: InvoiceItemLine) {
  return Number(line.price ?? 0);
}

export function invoiceLineTotal(line: InvoiceItemLine) {
  return invoiceLineUnitPrice(line) * invoiceLineQty(line);
}

export function invoiceLineLabel(line: InvoiceItemLine) {
  const sub = line.sub_category?.trim();
  const base = sub ? `${line.services} — ${sub}` : line.services;
  const qty = invoiceLineQty(line);
  return qty > 1 ? `${base} (x${qty})` : base;
}
