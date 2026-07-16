import { apiClient } from "./apiClient";
import type { AnalyticsData, DashboardData } from "../types";

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function pickNumber(source: Record<string, unknown>, keys: string[], fallback = 0) {
  for (const key of keys) {
    const value = Number(source[key]);
    if (Number.isFinite(value)) return value;
  }
  return fallback;
}

export const dashboardApi = {
  getDashboard: async () => {
    const response = await apiClient.get("/api/localdata/dashboard");
    const top = toRecord(response.data);
    const nested = toRecord(top.data);
    const combined = { ...nested, ...top };
    return {
      total_bookings: pickNumber(combined, ["total_bookings", "bookings", "total_booking", "booking_count"]),
      total_customers: pickNumber(combined, ["total_customers", "customers", "customer_count"]),
      revenue: pickNumber(combined, ["revenue", "total_revenue", "sales"])
    } as DashboardData;
  },
  getAnalytics: async () => {
    const response = await apiClient.get("/api/localdata/analytics");
    const top = toRecord(response.data);
    const nested = toRecord(top.data);
    const candidate = Array.isArray(top.daily_sales)
      ? top.daily_sales
      : Array.isArray(nested.daily_sales)
      ? nested.daily_sales
      : [];
    return {
      daily_sales: candidate as AnalyticsData["daily_sales"]
    } as AnalyticsData;
  }
};
