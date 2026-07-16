import { apiClient } from "./apiClient";

export interface PosOverview {
  total_sales: number;
  bookings_today: number;
  pending_bookings: number;
  recent_bookings: Array<{ id: number; name: string; date: string; status: string }>;
}

export const posApi = {
  getOverview: async () => (await apiClient.get<PosOverview>("/api/pos/overview")).data
};
