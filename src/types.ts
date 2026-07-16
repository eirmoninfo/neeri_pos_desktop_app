export type UserRole = "admin" | "manager" | "branch_manager" | "staff";

export interface AssignedUser {
  id: number;
  name: string;
  email: string | null;
  role: UserRole;
  is_available?: number | boolean;
  branch_id?: number | null;
}

/** When /api/user includes branch relation (Laravel) */
export interface UserBranchInfo {
  id?: number;
  name?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
}

export interface BranchItem {
  id: number;
  name: string;
  address?: string;
  location?: string;
  suburb?: string;
  city?: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  branch_id: number | null;
  branch?: UserBranchInfo | null;
  branch_name?: string;
  branch_address?: string;
  branch_address_line1?: string;
  branch_address_line2?: string;
  assigned_users?: AssignedUser[];
}

export interface ApiListResponse<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  total?: number;
}

export interface DashboardData {
  total_bookings: number;
  total_customers: number;
  revenue: number;
}

export interface AnalyticsData {
  daily_sales: Array<{ date: string; amount: number }>;
}

export interface ServiceItem {
  id: number;
  service_name: string;
  services?: string;
  sub_category: string;
  price: number;
  time: number;
  note?: string;
  notes?: string;
  branch_id?: number;
  /** When true, staff can enter price at POS checkout */
  allow_custom_price?: boolean;
}

export interface BookingItem {
  id: number;
  name: string;
  phone: string;
  email: string;
  date: string;
  time?: string;
  start_time: string;
  end_time: string;
  duration?: number;
  services?: string;
  total_price?: number;
  notes?: string;
  status?: string;
  branch_id?: number;
}

export interface CustomerItem {
  id: number;
  name: string;
  phone: string;
  email: string;
  suburb?: string;
  date_of_birth?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  /** Legacy field – customers are shared across stores; do not filter by branch */
  branch_id?: number;
}

export interface OfferItem {
  id: number;
  title: string;
  description?: string;
  discount_type?: "flat" | "percentage";
  discount_value?: number;
  valid_from?: string;
  valid_to?: string;
  is_active?: boolean;
  branch_id?: number;
}

export interface LeaveItem {
  id: number;
  user_id: number;
  user_name?: string;
  date: string;
  branch_id?: number;
}

export interface TimeSlotItem {
  id: number;
  branch_id?: number;
  day?: string;
  start_time?: string;
  end_time?: string;
  is_active?: boolean;
}

export interface InvoiceItemLine {
  services: string;
  sub_category?: string;
  price: number;
  qty?: number;
}

/** Nested branch payload when API includes it on invoice show */
export interface InvoiceBranchInfo {
  id?: number;
  name?: string;
  address?: string;
  address_line1?: string;
  address_line2?: string;
  street?: string;
  suburb?: string;
  location?: string;
}

export interface InvoiceItem {
  id: number;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  subtotal: number;
  total: number;
  discount_type?: "flat" | "percentage";
  discount_value?: number;
  surcharge?: number;
  notes?: string;
  branch_id?: number;
  /** When API returns branch relation or flat address fields */
  branch?: InvoiceBranchInfo;
  branch_name?: string;
  branch_address?: string;
  branch_address_line1?: string;
  branch_address_line2?: string;
  salon_address?: string;
  items?: InvoiceItemLine[];
  /** Bill / reference number when provided by API */
  invoice_number?: string;
  reference?: string;
  bill_no?: string;
  created_at?: string;
  updated_at?: string;
}
