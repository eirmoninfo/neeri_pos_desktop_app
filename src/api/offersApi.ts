import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { OfferItem } from "../types";

export const offersApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/offers", { params });
    const items = normalizeListResponse<OfferItem>(response.data);
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: Partial<OfferItem>) => (await apiClient.post("/api/offers", payload)).data,
  update: async (id: number, payload: Partial<OfferItem>) =>
    (await apiClient.put(`/api/offers/${id}`, payload)).data,
  remove: async (id: number) => apiClient.delete(`/api/offers/${id}`)
};
