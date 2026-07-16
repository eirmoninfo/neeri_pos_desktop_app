import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { ServiceItem } from "../types";

function hasCustomPriceFlag(item: ServiceItem) {
  const noteText = `${item.note ?? ""} ${item.notes ?? ""}`.toLowerCase();
  return (
    item.allow_custom_price === true ||
    noteText.includes("custom_price") ||
    noteText.includes("custom price")
  );
}

function normalizeServices(list: ServiceItem[]) {
  return list.map((item) => ({
    ...item,
    service_name: item.service_name || item.services || "",
    allow_custom_price: hasCustomPriceFlag(item)
  }));
}

export const servicesApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/services", { params });
    return normalizeServices(normalizeListResponse<ServiceItem>(response.data));
  },
  search: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/services/search", { params });
    return normalizeServices(normalizeListResponse<ServiceItem>(response.data));
  },
  listPaged: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/services", { params });
    const items = normalizeServices(normalizeListResponse<ServiceItem>(response.data));
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  searchPaged: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/services/search", { params });
    const items = normalizeServices(normalizeListResponse<ServiceItem>(response.data));
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: Partial<ServiceItem>) => (await apiClient.post("/api/services", payload)).data,
  show: async (id: number) => (await apiClient.get<ServiceItem>(`/api/services/${id}`)).data,
  update: async (id: number, payload: Partial<ServiceItem>) =>
    (await apiClient.put(`/api/services/${id}`, payload)).data,
  remove: async (id: number) => apiClient.delete(`/api/services/${id}`)
};
