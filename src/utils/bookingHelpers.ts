import type { ServiceItem } from "../types";
import { getServiceLabel } from "./serviceLabels";

function splitServiceParts(servicesText: string) {
  return servicesText
    .split(/[,;|\n]+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function getBookingServicesText(booking: {
  services?: unknown;
  service?: unknown;
  service_name?: unknown;
  sub_category?: unknown;
  booking_services?: unknown;
}) {
  if (typeof booking.services === "string" && booking.services.trim()) return booking.services.trim();
  if (typeof booking.service === "string" && booking.service.trim()) return booking.service.trim();
  if (typeof booking.service_name === "string" && booking.service_name.trim()) return booking.service_name.trim();
  if (typeof booking.sub_category === "string" && booking.sub_category.trim()) return booking.sub_category.trim();
  if (Array.isArray(booking.booking_services) && booking.booking_services.length) {
    return booking.booking_services
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (item && typeof item === "object") {
          const row = item as Record<string, unknown>;
          return String(row.sub_category ?? row.service_name ?? row.name ?? row.label ?? "").trim();
        }
        return "";
      })
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

export function toTimeInputValue(value?: string) {
  if (!value) return "";
  const trimmed = value.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (match12) {
    let hour = Number(match12[1]) % 12;
    if (match12[3].toUpperCase() === "PM") hour += 12;
    return `${String(hour).padStart(2, "0")}:${match12[2]}`;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})/);
  if (match24) {
    return `${String(Number(match24[1])).padStart(2, "0")}:${match24[2]}`;
  }
  return trimmed;
}

export function matchServicesFromBooking(servicesText: string | undefined, allServices: ServiceItem[]) {
  if (!servicesText?.trim()) return [];
  const parts = splitServiceParts(servicesText).map((part) => part.toLowerCase());
  return allServices.filter((service) => {
    const label = getServiceLabel(service).toLowerCase();
    const category = (service.service_name || service.services || "").trim().toLowerCase();
    return parts.some(
      (part) =>
        part === label ||
        part.includes(label) ||
        label.includes(part) ||
        (category && (part.includes(category) || category.includes(part)))
    );
  });
}

export function resolveSelectedServices(servicesText: string | undefined, allServices: ServiceItem[]) {
  if (!servicesText?.trim()) return [];
  const matched = matchServicesFromBooking(servicesText, allServices);
  if (matched.length) return matched;

  return splitServiceParts(servicesText).map((label, index) => ({
      id: -(index + 1),
      service_name: "",
      sub_category: label,
      price: 0,
      time: 30
    }));
}
