import { apiClient } from "./apiClient";
import { normalizeListResponse } from "./helpers";
import type { BranchItem } from "../types";

function pickString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalizeBranch(raw: Record<string, unknown>): BranchItem | null {
  const id = Number(raw.id);
  if (!Number.isFinite(id)) return null;

  const name = pickString(raw.name, raw.branch_name, raw.title);
  const location = pickString(
    raw.location,
    raw.branch_location,
    raw.store_location,
    raw.area,
    raw.suburb,
    raw.city
  );
  const suburb = pickString(raw.suburb, raw.area);
  const city = pickString(raw.city);

  return {
    id,
    name: name || location || `Branch ${id}`,
    location: location || undefined,
    suburb: suburb || undefined,
    city: city || undefined,
    address: pickString(raw.address, raw.address_line1, raw.address_line2) || undefined
  };
}

export function formatBranchLabel(branch: BranchItem) {
  const location = pickString(branch.location, branch.suburb, branch.city);
  if (!location) return branch.name;
  if (branch.name.toLowerCase() === location.toLowerCase()) return branch.name;
  if (branch.name.toLowerCase().includes(location.toLowerCase())) return branch.name;
  return `${branch.name} — ${location}`;
}

async function fetchFrom(path: string, params?: Record<string, unknown>) {
  const response = await apiClient.get(path, { params });
  return normalizeListResponse<Record<string, unknown>>(response.data)
    .map(normalizeBranch)
    .filter((item): item is BranchItem => item != null);
}

export const branchesApi = {
  list: async (params?: Record<string, unknown>) => {
    const paths = ["/api/branches", "/api/localdata/branches"];
    for (const path of paths) {
      try {
        const items = await fetchFrom(path, params);
        if (items.length) return items;
      } catch {
        // try next endpoint
      }
    }
    return [];
  }
};
