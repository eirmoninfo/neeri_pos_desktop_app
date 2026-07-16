export function normalizeListResponse<T>(payload: unknown): T[] {
  const asList = (value: unknown): T[] | null => {
    if (Array.isArray(value)) return value as T[];
    if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (Array.isArray(record.data)) return record.data as T[];
    }
    return null;
  };

  const direct = asList(payload);
  if (direct) return direct;

  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    const topData = asList(record.data);
    if (topData) return topData;

    const topCustomers = asList(record.customers);
    if (topCustomers) return topCustomers;

    const topBookings = asList(record.bookings);
    if (topBookings) return topBookings;

    const topServices = asList(record.services);
    if (topServices) return topServices;

    if (record.data && typeof record.data === "object") {
      const nested = record.data as Record<string, unknown>;
      const nestedCustomers = asList(nested.customers);
      if (nestedCustomers) return nestedCustomers;

      const nestedBookings = asList(nested.bookings);
      if (nestedBookings) return nestedBookings;

      const nestedServices = asList(nested.services);
      if (nestedServices) return nestedServices;

      const nestedData = asList(nested.data);
      if (nestedData) return nestedData;
    }
  }
  return [];
}

export interface PaginationMeta {
  currentPage: number;
  lastPage: number;
  total: number;
}

export function normalizePaginationMeta(payload: unknown, fallbackCount: number): PaginationMeta {
  const fallback = { currentPage: 1, lastPage: 1, total: fallbackCount };
  if (!payload || typeof payload !== "object") return fallback;

  const record = payload as Record<string, unknown>;

  const topCurrent = Number(record.current_page);
  const topLast = Number(record.last_page);
  const topTotal = Number(record.total);
  if (Number.isFinite(topCurrent) && Number.isFinite(topLast) && Number.isFinite(topTotal)) {
    return { currentPage: topCurrent, lastPage: topLast, total: topTotal };
  }

  if (record.data && typeof record.data === "object") {
    const nested = record.data as Record<string, unknown>;
    const nestedCurrent = Number(nested.current_page);
    const nestedLast = Number(nested.last_page);
    const nestedTotal = Number(nested.total);
    if (Number.isFinite(nestedCurrent) && Number.isFinite(nestedLast) && Number.isFinite(nestedTotal)) {
      return { currentPage: nestedCurrent, lastPage: nestedLast, total: nestedTotal };
    }
  }

  return fallback;
}
