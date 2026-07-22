import { apiClient } from "./apiClient";
import { normalizeListResponse } from "./helpers";
import type { BookingItem } from "../types";
import { toTimeInputValue } from "../utils/bookingHelpers";

function isMissingBookingRoute(error: unknown) {
  const status = (error as { response?: { status?: number } })?.response?.status;
  return status === 404 || status === 405 || status === 501;
}

function pickString(...values: unknown[]) {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function normalizeServicesField(value: unknown) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          return pickString(row.sub_category, row.service_name, row.services, row.name, row.label, row.title);
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

function unwrapBookingPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return payload;
  const record = payload as Record<string, unknown>;
  if (record.data && typeof record.data === "object") return record.data;
  if (record.booking && typeof record.booking === "object") return record.booking;
  return payload;
}

function bookingDurationMinutes(startTime?: string, endTime?: string) {
  const start = toTimeInputValue(startTime);
  const end = toTimeInputValue(endTime);
  if (!start || !end) return undefined;
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const minutes = eh * 60 + em - (sh * 60 + sm);
  return minutes > 0 ? minutes : undefined;
}

function buildBookingUpdatePayload(payload: Partial<BookingItem>) {
  const services = payload.services?.trim() ?? "";
  const subCategory = services.split(",")[0]?.trim() ?? "";
  const price = payload.total_price;
  const duration = payload.duration ?? bookingDurationMinutes(payload.start_time, payload.end_time);

  return {
    name: payload.name,
    email: payload.email,
    phone: payload.phone,
    date: payload.date,
    time: payload.time ?? payload.start_time,
    start_time: payload.start_time,
    end_time: payload.end_time,
    duration,
    services,
    sub_category: subCategory || undefined,
    price,
    total_price: price,
    message: payload.notes ?? "",
    notes: payload.notes ?? "",
    status: payload.status,
    branch_id: payload.branch_id
  };
}

export function normalizeBooking(raw: unknown): BookingItem {
  const record = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const services =
    normalizeServicesField(
      record.services ?? record.service ?? record.service_name ?? record.booking_services ?? record.service_list
    ) || pickString(record.sub_category);

  const rawPrice = record.total_price ?? record.price ?? record.amount;
  const isAdmin =
    record.is_admin_booking === true ||
    record.is_admin_booking === 1 ||
    record.is_admin_booking === "1" ||
    String(record.source || "").toLowerCase() === "admin";

  return {
    ...(record as unknown as BookingItem),
    id: Number(record.id),
    name: pickString(record.name, record.customer_name, record.client_name),
    phone: pickString(record.phone, record.mobile, record.contact),
    email: pickString(record.email),
    date: pickString(record.date, record.booking_date),
    time: pickString(record.time, record.start_time) || undefined,
    start_time: pickString(record.start_time, record.time),
    end_time: pickString(record.end_time),
    services,
    service: services,
    total_price:
      rawPrice != null && String(rawPrice).trim() !== "" ? Number(rawPrice) : undefined,
    notes: pickString(record.notes, record.note, record.message) || undefined,
    status: pickString(record.status) || undefined,
    branch_id: record.branch_id != null ? Number(record.branch_id) : undefined,
    is_admin_booking: isAdmin,
    source: isAdmin ? "admin" : "online"
  };
}

async function putWithFallback(id: number, payload: Partial<BookingItem>) {
  const body = buildBookingUpdatePayload(payload);
  const endpoints = [
    `/api/bookings/admin/${id}`,
    `/api/localdata/bookings/${id}`,
    `/api/bookings/${id}`
  ];
  let lastError: unknown;
  for (const endpoint of endpoints) {
    try {
      return (await apiClient.put(endpoint, body)).data;
    } catch (error) {
      lastError = error;
      if (!isMissingBookingRoute(error)) throw error;
    }
  }
  throw lastError;
}

export const bookingsApi = {
  list: async (params: Record<string, unknown>) => {
    const response = await apiClient.get("/api/localdata/booking-view", { params });
    return normalizeListResponse<BookingItem>(response.data).map((item) => normalizeBooking(item));
  },
  expired: async (params: Record<string, unknown> = {}) => {
    const response = await apiClient.get("/api/localdata/expiry-table", { params });
    return normalizeListResponse<BookingItem>(response.data).map((item) => normalizeBooking(item));
  },
  show: async (id: number): Promise<BookingItem> => {
    const listItems = await bookingsApi.list({ per_page: 500, status: "all" });
    const fromList = listItems.find((item) => item.id === id);

    let fromApi: BookingItem | null = null;
    const endpoints = [`/api/bookings/${id}`, `/api/bookings/admin/${id}`];
    for (const endpoint of endpoints) {
      try {
        const response = await apiClient.get(endpoint);
        fromApi = normalizeBooking(unwrapBookingPayload(response.data));
        break;
      } catch (error) {
        if (!isMissingBookingRoute(error)) throw error;
      }
    }

    if (fromList && fromApi) {
      return normalizeBooking({
        ...fromApi,
        ...fromList,
        services: pickString(fromList.services, fromApi.services),
        total_price: fromList.total_price ?? fromApi.total_price,
        notes: pickString(fromList.notes, fromApi.notes) || undefined
      });
    }

    if (fromList) return fromList;
    if (fromApi) return fromApi;
    throw new Error("Booking not found.");
  },
  createByAdmin: async (payload: Partial<BookingItem>) =>
    (await apiClient.post("/api/bookings/admin", {
      ...payload,
      message: payload.notes ?? "",
      notes: payload.notes ?? ""
    })).data,
  updateByAdmin: async (id: number, payload: Partial<BookingItem>) => putWithFallback(id, payload),
  checkAvailability: async (payload: { date: string; duration: number }) =>
    (await apiClient.post("/api/bookings/check-availability", payload)).data
};
