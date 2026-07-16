import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { InvoiceItem, InvoiceItemLine } from "../types";

function unwrapInvoice(payload: unknown): InvoiceItem {
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    if (record.data && typeof record.data === "object") {
      return record.data as InvoiceItem;
    }
  }
  return payload as InvoiceItem;
}

export interface PosInvoiceSavePayload {
  _token?: string;
  payment_method?: "cash" | "eftpos" | "exact";
  customer_id: number;
  customer_name: string;
  customer_email?: string;
  customer_phone?: string;
  notes?: string;
  branch_id?: number;
  items: Array<InvoiceItemLine & { qty: number; note?: string }>;
  subtotal: number;
  total: number;
  discount: number;
  discount_type: "percent" | "flat";
  discount_value: number;
}

export const invoicesApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/invoices", { params });
    const items = normalizeListResponse<InvoiceItem>(response.data);
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: Partial<InvoiceItem> & { items?: InvoiceItemLine[] }) => {
    const items = Array.isArray(payload.items) ? payload.items : [];
    const body: Record<string, unknown> = {
      ...payload,
      // Send both keys for compatibility with different backend handlers.
      items,
      items_json: JSON.stringify(items)
    };
    return (await apiClient.post("/api/invoices", body)).data;
  },
  show: async (id: number) => unwrapInvoice((await apiClient.get(`/api/invoices/${id}`)).data),
  update: async (id: number, payload: Partial<InvoiceItem>) =>
    (await apiClient.put(`/api/invoices/${id}`, payload)).data,
  remove: async (id: number) => apiClient.delete(`/api/invoices/${id}`),
  download: async (id: number) => {
    const response = await apiClient.get(`/api/invoices/${id}/download`, { responseType: "blob" });
    const url = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoice-${id}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
  saveFromPos: async (payload: PosInvoiceSavePayload) => {
    const formData = new FormData();
    if (payload._token) formData.append("_token", payload._token);
    formData.append("customer_id", String(payload.customer_id));
    formData.append("customer_name", payload.customer_name);
    formData.append("customer_email", payload.customer_email ?? "");
    formData.append("customer_phone", payload.customer_phone ?? "");
    if (payload.notes) formData.append("notes", payload.notes);
    if (payload.branch_id != null) formData.append("branch_id", String(payload.branch_id));
    if (payload.payment_method) formData.append("payment_method", payload.payment_method);
    formData.append("subtotal", payload.subtotal.toFixed(2));
    formData.append("total", payload.total.toFixed(2));
    formData.append("discount", String(payload.discount));
    formData.append("discount_type", payload.discount_type);
    formData.append("discount_value", String(payload.discount_value));
    formData.append(
      "items_json",
      JSON.stringify(
        payload.items.map((item) => ({
          services: item.services,
          sub_category: item.sub_category ?? "",
          price: Number(item.price),
          qty: item.qty ?? 1
        }))
      )
    );

    return (
      await apiClient.post("/api/invoices/save", formData, {
        headers: { "Content-Type": "multipart/form-data" }
      })
    ).data;
  },
  openDrawerLog: async () => (await apiClient.post("/api/invoices/drawer/open")).data
};
