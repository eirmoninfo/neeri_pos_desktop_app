import type { InvoiceItem, User } from "../types";

export interface AddressLines {
  line1: string;
  line2: string;
}

function linesFromBranchLike(b: Record<string, unknown>): AddressLines | null {
  const line1 = String(
    b.address_line1 ?? b.address ?? b.street ?? b.location ?? b.name ?? ""
  ).trim();
  const line2 = String(b.address_line2 ?? b.suburb ?? "").trim();
  if (!line1 && !line2) return null;
  return { line1: line1 || line2, line2: line1 ? line2 : "" };
}

/** Address embedded on invoice payload */
export function addressFromInvoice(invoice: InvoiceItem): AddressLines | null {
  const rec = invoice as unknown as Record<string, unknown>;

  const branch = rec.branch;
  if (branch && typeof branch === "object") {
    const fromBranch = linesFromBranchLike(branch as Record<string, unknown>);
    if (fromBranch) return fromBranch;
  }

  const flat1 = String(
    rec.branch_address_line1 ?? rec.branch_address ?? rec.salon_address ?? ""
  ).trim();
  const flat2 = String(rec.branch_address_line2 ?? "").trim();
  if (flat1 || flat2) {
    return { line1: flat1 || flat2, line2: flat1 ? flat2 : "" };
  }

  return null;
}

/** Address from logged-in user (/api/user) when branch is included */
export function addressFromUser(user: User | null): AddressLines | null {
  if (!user) return null;

  const branch = user.branch;
  if (branch && typeof branch === "object") {
    const fromBranch = linesFromBranchLike(branch as unknown as Record<string, unknown>);
    if (fromBranch) return fromBranch;
  }

  const flat1 = String(
    user.branch_address_line1 ?? user.branch_address ?? user.branch_name ?? ""
  ).trim();
  const flat2 = String(user.branch_address_line2 ?? "").trim();
  if (flat1 || flat2) {
    return { line1: flat1 || flat2, line2: flat1 ? flat2 : "" };
  }

  return null;
}

/**
 * Invoice branch → logged-in user branch → env defaults.
 */
export function resolveInvoiceAddress(
  invoice: InvoiceItem,
  user: User | null,
  fallback: AddressLines
): AddressLines {
  return addressFromInvoice(invoice) ?? addressFromUser(user) ?? fallback;
}
