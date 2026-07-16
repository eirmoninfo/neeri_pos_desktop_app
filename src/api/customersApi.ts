import axios from "axios";
import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { CustomerItem } from "../types";

export interface CustomerListParams {
  search?: string;
  per_page?: number;
  page?: number;
}

export interface CustomerListResult {
  items: CustomerItem[];
  meta: {
    currentPage: number;
    lastPage: number;
    total: number;
  };
}

export interface CustomerPayload {
  name: string;
  phone?: string;
  email?: string;
  suburb?: string;
  date_of_birth?: string;
  notes?: string;
}

function normalizeCustomer(raw: Record<string, unknown>): CustomerItem {
  const suburbRaw = raw.suburb ?? raw.subav;
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    phone: String(raw.phone ?? ""),
    email: String(raw.email ?? ""),
    suburb: suburbRaw != null && String(suburbRaw).trim() ? String(suburbRaw) : undefined,
    date_of_birth: raw.date_of_birth != null ? String(raw.date_of_birth) : undefined,
    notes: raw.notes != null ? String(raw.notes) : undefined,
    created_at: raw.created_at != null ? String(raw.created_at) : undefined,
    updated_at: raw.updated_at != null ? String(raw.updated_at) : undefined
  };
}

function unwrapCustomer(payload: unknown): CustomerItem {
  if (!payload || typeof payload !== "object") {
    throw new Error("Invalid customer response");
  }
  const record = payload as Record<string, unknown>;

  if (record.customer && typeof record.customer === "object") {
    return normalizeCustomer(record.customer as Record<string, unknown>);
  }

  if (record.data && typeof record.data === "object" && !Array.isArray(record.data)) {
    return normalizeCustomer(record.data as Record<string, unknown>);
  }

  return normalizeCustomer(record);
}

function resolveListMetaSource(payload: unknown): unknown {
  if (!payload || typeof payload !== "object") {
    return payload;
  }
  const record = payload as Record<string, unknown>;

  if (
    Number.isFinite(Number(record.current_page)) &&
    Number.isFinite(Number(record.last_page)) &&
    Number.isFinite(Number(record.total))
  ) {
    return record;
  }

  const data = record.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const nested = data as Record<string, unknown>;
    if (nested.customers && typeof nested.customers === "object") {
      return nested.customers;
    }
    if (
      Number.isFinite(Number(nested.current_page)) &&
      Number.isFinite(Number(nested.last_page)) &&
      Number.isFinite(Number(nested.total))
    ) {
      return nested;
    }
  }
  if (record.customers && typeof record.customers === "object") {
    return record.customers;
  }
  return payload;
}

function normalizeCustomerList(payload: unknown): CustomerListResult {
  const rows = normalizeListResponse<Record<string, unknown>>(payload);
  const items = rows.map((row) => normalizeCustomer(row));
  const meta = normalizePaginationMeta(resolveListMetaSource(payload), items.length);
  return { items, meta };
}

function toBackendPayload(payload: CustomerPayload | Partial<CustomerPayload>) {
  const body: Record<string, unknown> = { ...payload };
  if (payload.suburb !== undefined) {
    body.subav = payload.suburb;
    delete body.suburb;
  }
  return body;
}

function isMissingCustomersRoute(error: unknown) {
  return axios.isAxiosError(error) && (error.response?.status === 404 || error.response?.status === 405);
}

export function getCustomerApiError(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) {
    return error instanceof Error ? error.message : fallback;
  }

  const status = error.response?.status;
  if (status === 401) {
    return "Session expired. Please sign in again.";
  }
  if (status === 404) {
    return "Customer not found.";
  }

  if (status === 422) {
    const body = error.response?.data as Record<string, unknown> | undefined;
    const errors = body?.errors;
    if (errors && typeof errors === "object") {
      const messages = Object.values(errors)
        .flatMap((value) => (Array.isArray(value) ? value : [String(value)]))
        .map((value) => String(value).trim())
        .filter(Boolean);
      if (messages.length) {
        return messages.join(" ");
      }
    }
    return String(body?.message ?? "Validation failed.");
  }

  const body = error.response?.data as Record<string, unknown> | undefined;
  return String(body?.message ?? fallback);
}

export const customersApi = {
  list: async (params: CustomerListParams = {}): Promise<CustomerListResult> => {
    try {
      const response = await apiClient.get("/api/customers", { params });
      return normalizeCustomerList(response.data);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      const response = await apiClient.get("/api/localdata/coussearch", { params });
      return normalizeCustomerList(response.data);
    }
  },

  search: async (params: CustomerListParams): Promise<CustomerListResult> => {
    const term = params.search?.trim();
    if (!term) {
      return customersApi.list(params);
    }

    try {
      const response = await apiClient.get("/api/customers/search", {
        params: { search: term, per_page: params.per_page, page: params.page }
      });
      return normalizeCustomerList(response.data);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      const response = await apiClient.get("/api/localdata/coussearch", { params });
      return normalizeCustomerList(response.data);
    }
  },

  show: async (id: number): Promise<CustomerItem> => {
    try {
      const response = await apiClient.get(`/api/customers/${id}`);
      return unwrapCustomer(response.data);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      const response = await apiClient.get("/api/localdata/showallcus");
      const items = normalizeCustomerList(response.data).items;
      const match = items.find((item) => item.id === id);
      if (!match) throw new Error("Customer not found.");
      return match;
    }
  },

  create: async (payload: CustomerPayload): Promise<CustomerItem> => {
    const body = toBackendPayload(payload);
    try {
      const response = await apiClient.post("/api/customers", body);
      return unwrapCustomer(response.data);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      const response = await apiClient.post("/api/localdata/customers", body);
      return unwrapCustomer(response.data);
    }
  },

  update: async (id: number, payload: Partial<CustomerPayload>): Promise<CustomerItem> => {
    const body = toBackendPayload(payload);
    try {
      const response = await apiClient.put(`/api/customers/${id}`, body);
      return unwrapCustomer(response.data);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      const response = await apiClient.put(`/api/localdata/customers/${id}`, body);
      return unwrapCustomer(response.data);
    }
  },

  remove: async (id: number): Promise<void> => {
    try {
      await apiClient.delete(`/api/customers/${id}`);
    } catch (error) {
      if (!isMissingCustomersRoute(error)) throw error;
      await apiClient.delete(`/api/localdata/customers/${id}`);
    }
  }
};
