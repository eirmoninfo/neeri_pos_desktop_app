import { apiClient } from "./apiClient";
import { normalizeListResponse } from "./helpers";
import type { BookingItem } from "../types";

export const bookingsApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/localdata/booking-view", { params });
    return normalizeListResponse<BookingItem>(response.data);
  },
  createByAdmin: async (payload: Partial<BookingItem>) =>
    (await apiClient.post("/api/bookings/admin", payload)).data,
  checkAvailability: async (payload: { date: string; duration: number }) =>
    (await apiClient.post("/api/bookings/check-availability", payload)).data
};
