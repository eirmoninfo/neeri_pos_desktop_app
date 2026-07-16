import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { LeaveItem } from "../types";

export const leavesApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/leaves", { params });
    const items = normalizeListResponse<LeaveItem>(response.data);
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: Partial<LeaveItem>) => (await apiClient.post("/api/leaves", payload)).data,
  update: async (id: number, payload: Partial<LeaveItem>) =>
    (await apiClient.put(`/api/leaves/${id}`, payload)).data,
  remove: async (id: number) => apiClient.delete(`/api/leaves/${id}`)
};
