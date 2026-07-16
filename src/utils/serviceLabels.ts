import type { ServiceItem } from "../types";

/** API `service_name` is the category bucket (BODY WAXING, FACIALS, …). */
export function getServiceCategory(service: Pick<ServiceItem, "service_name" | "services">) {
  return (service.service_name || service.services || "General").trim() || "General";
}

/** API `sub_category` is the actual service line item. */
export function getServiceLabel(service: Pick<ServiceItem, "service_name" | "services" | "sub_category">) {
  const label = (service.sub_category || "").trim();
  if (label) return label;
  return getServiceCategory(service);
}

export function formatServiceOption(service: ServiceItem) {
  return getServiceLabel(service);
}
