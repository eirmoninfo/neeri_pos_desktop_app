import { apiClient } from "./apiClient";
import { normalizeListResponse, normalizePaginationMeta } from "./helpers";
import type { AssignedUser } from "../types";

export const usersApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/users", { params });
    const items = normalizeListResponse<AssignedUser>(response.data);
    return { items, meta: normalizePaginationMeta(response.data, items.length) };
  },
  create: async (payload: {
    name: string;
    email: string;
    password: string;
    role: string;
    is_available: boolean;
    branch_id?: number | null;
  }) => (await apiClient.post("/api/users", payload)).data
};
