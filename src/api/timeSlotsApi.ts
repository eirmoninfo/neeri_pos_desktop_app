import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { TimeSlotItem } from "../types";

export const timeSlotsApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/salon-times", { params });
    const items = normalizeListResponse<TimeSlotItem>(response.data);
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: Partial<TimeSlotItem>) => (await apiClient.post("/api/salon-times", payload)).data,
  update: async (id: number, payload: Partial<TimeSlotItem>) =>
    (await apiClient.put(`/api/salon-times/${id}`, payload)).data,
  remove: async (id: number) => apiClient.delete(`/api/salon-times/${id}`)
};
