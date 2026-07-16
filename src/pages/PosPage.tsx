import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { customersApi, getCustomerApiError } from "../api/customersApi";
import { invoicesApi } from "../api/invoicesApi";
import { posApi } from "../api/posApi";
import { servicesApi } from "../api/servicesApi";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { Skeleton } from "../components/Skeleton";
import { useAuthStore } from "../store/authStore";
import type { CustomerItem, InvoiceItem, ServiceItem } from "../types";
import { invoiceLineLabel, invoiceLineTotal } from "../utils/invoiceLine";
import { resolveInvoiceAddress } from "../utils/invoiceAddress";
import { printReceiptHtml } from "../utils/receiptPrint";

interface CartItem extends ServiceItem {
  qty: number;
}

const tileColors = [
  "bg-[#ffc0cb]",
  "bg-[#48b0d8]",
 "bg-[#d2b48c]",
  
];

const csrfToken = import.meta.env.VITE_POS_CSRF_TOKEN ?? "";
const invoiceAddressFallback = {
  line1:
    import.meta.env.VITE_INVOICE_ADDRESS_LINE1 ??
    "Shop 131, Watergardens Shopping Centre, 399 Melton Hwy, Taylors Lakes VIC 3038",
  line2: import.meta.env.VITE_INVOICE_ADDRESS_LINE2 ?? "(Near Nando's, Next to Blank Jeans)"
};

function formatMoney(value: number | string | undefined) {
  return Number(value ?? 0).toFixed(2);
}

function formatDate(value?: string) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toISOString().slice(0, 10);
}

function invoiceNo(invoice: InvoiceItem) {
  return invoice.invoice_number ?? invoice.bill_no ?? invoice.reference ?? `INV-${invoice.id}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatServiceTileLabel(label: string) {
  const trimmed = label.trim();
  if (!trimmed) return [""];
  if (trimmed.includes("/")) {
    return trimmed
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [trimmed];
}

function scopeServicesForUser(services: ServiceItem[], role?: string, branchId?: number | null) {
  if (role !== "branch_manager" || branchId == null) return services;
  const scopedBranchId = Number(branchId);
  return services.filter(
    (service) => service.branch_id == null || Number(service.branch_id) === scopedBranchId
  );
}

function evaluateCalculatorExpression(input: string): number | null {
  const normalized = input.replace(/\s+/g, "");
  if (!normalized) return null;
  if (!/^[0-9.+-]+$/.test(normalized)) return null;

  const tokens = normalized.match(/[+-]?(\d+(\.\d+)?|\.\d+)/g);
  if (!tokens || tokens.join("") !== normalized) return null;

  const total = tokens.reduce((sum, token) => sum + Number(token), 0);
  if (!Number.isFinite(total)) return null;
  return total;
}

export default function PosPage() {
  const defaultPrinterNameRef = useRef<string | null>(null);

  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const [services, setServices] = useState<ServiceItem[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerItem[]>([]);
  const [customerSuggestions, setCustomerSuggestions] = useState<CustomerItem[]>([]);
  const [posBootLoading, setPosBootLoading] = useState(true);

  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
  const [customerNote, setCustomerNote] = useState("");
  const [customerSuburb, setCustomerSuburb] = useState("");
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const customerSearchWrapRef = useRef<HTMLDivElement | null>(null);

  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<"percent" | "flat">("percent");
  const [servicesPage, setServicesPage] = useState(1);

  const [savingInvoice, setSavingInvoice] = useState(false);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [openCustomerModal, setOpenCustomerModal] = useState(false);
  const [openCustomerListModal, setOpenCustomerListModal] = useState(false);
  const [customerListSearch, setCustomerListSearch] = useState("");
  const [customerForm, setCustomerForm] = useState({ name: "", phone: "", email: "", suburb: "", notes: "" });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [updatingCustomerDetails, setUpdatingCustomerDetails] = useState(false);

  const [ordersOpen, setOrdersOpen] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [orders, setOrders] = useState<InvoiceItem[]>([]);
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLastPage, setOrdersLastPage] = useState(1);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [paymentInput, setPaymentInput] = useState("0");

  const [viewInvoiceOpen, setViewInvoiceOpen] = useState(false);
  const [viewInvoiceLoading, setViewInvoiceLoading] = useState(false);
  const [viewInvoice, setViewInvoice] = useState<InvoiceItem | null>(null);

  const [miscPrice, setMiscPrice] = useState("");

  useEffect(() => {
    setPosBootLoading(true);
    void Promise.allSettled([
      posApi.getOverview(),
      servicesApi.list({ per_page: 80 }),
      customersApi.list({ per_page: 50, page: 1 })
    ])
      .then(([overviewResult, servicesResult, customersResult]) => {
        if (servicesResult.status === "fulfilled") {
          setServices(scopeServicesForUser(servicesResult.value, user?.role, user?.branch_id));
        } else {
          toast.error("Unable to load services");
        }

        if (customersResult.status === "fulfilled") {
          const customerData = customersResult.value.items;
          setAllCustomers(customerData);
          setCustomerSuggestions(customerData.slice(0, 8));
        } else {
          toast.error("Unable to load customers");
        }

        if (overviewResult.status === "rejected" && servicesResult.status === "rejected") {
          toast.error("Unable to load POS data");
        }
      })
      .finally(() => setPosBootLoading(false));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    setServicesPage(1);
  }, [serviceSearch, selectedCategory]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (!customerSearchWrapRef.current) return;
      if (!customerSearchWrapRef.current.contains(event.target as Node)) {
        setShowCustomerDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    const query = customerSearch.trim();
    if (!query) {
      setCustomerSuggestions(allCustomers.slice(0, 8));
      return;
    }

    const localMatches = allCustomers
      .filter((customer) => {
        const haystack = `${customer.name} ${customer.phone} ${customer.email ?? ""} ${customer.suburb ?? ""}`.toLowerCase();
        return haystack.includes(query.toLowerCase());
      })
      .slice(0, 8);

    setCustomerSuggestions(localMatches);

    const handle = setTimeout(() => {
      setLoadingCustomers(true);
      void customersApi
        .search({ search: query, per_page: 20, page: 1 })
        .then((result) => {
          setCustomerSuggestions(result.items.slice(0, 8));
        })
        .catch(() => {
          // keep local results silently
        })
        .finally(() => setLoadingCustomers(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [customerSearch, allCustomers, user?.role, user?.branch_id]);

  useEffect(() => {
    if (!ordersOpen) return;
    const handle = setTimeout(() => {
      setOrdersLoading(true);
      void invoicesApi
        .list({ search: ordersSearch, page: ordersPage, per_page: 15 })
        .then((result) => {
          setOrders(result.items);
          setOrdersLastPage(Math.max(1, result.meta.lastPage));
        })
        .catch(() => toast.error("Unable to load past orders"))
        .finally(() => setOrdersLoading(false));
    }, 250);

    return () => clearTimeout(handle);
  }, [ordersOpen, ordersSearch, ordersPage]);

  /** First screen = category buckets (group by service_name). Second screen = line items in that bucket. */
  const categories = useMemo(() => {
    const set = new Set(
      services
        .map((service) => (service.service_name || "General").trim())
        .filter((value) => value.length > 0)
    );
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [services]);

  const filteredCategories = useMemo(() => {
    if (!serviceSearch.trim()) return categories;
    return categories.filter((category) => category.toLowerCase().includes(serviceSearch.toLowerCase()));
  }, [categories, serviceSearch]);

  const filteredServices = useMemo(() => {
    return services.filter((service) => {
      const bucket = (service.service_name || "General").trim();
      if (selectedCategory && bucket !== selectedCategory) return false;
      if (!serviceSearch.trim()) return true;
      const term = `${service.service_name} ${service.sub_category}`.toLowerCase();
      return term.includes(serviceSearch.toLowerCase());
    });
  }, [services, selectedCategory, serviceSearch]);

  const filteredCustomerList = useMemo(() => {
    const term = customerListSearch.trim().toLowerCase();
    if (!term) return allCustomers;
    return allCustomers.filter((customer) =>
      `${customer.name ?? ""} ${customer.phone ?? ""} ${customer.email ?? ""}`.toLowerCase().includes(term)
    );
  }, [allCustomers, customerListSearch]);

  const serviceTilesPerPage = 18;
const currentTileSource = selectedCategory ? filteredServices : filteredCategories;

const serviceTilePages = selectedCategory
  ? 1
  : Math.max(1, Math.ceil(currentTileSource.length / serviceTilesPerPage));
const subtotal = useMemo(
  () => cart.reduce((total, item) => total + item.qty * Number(item.price), 0),
  [cart]
);
const serviceTileRows = useMemo(() => {
  // SHOW ALL SUB SERVICES
  if (selectedCategory) {
    return filteredServices;
  }

  // CATEGORY PAGINATION ONLY
  return currentTileSource.slice(
    (servicesPage - 1) * serviceTilesPerPage,
    (servicesPage - 1) * serviceTilesPerPage + serviceTilesPerPage
  );
}, [currentTileSource, servicesPage, selectedCategory, filteredServices]);
  const discount = useMemo(() => {
    if (discountType === "percent") {
      return (subtotal * Math.max(0, discountValue)) / 100;
    }
    return Math.max(0, discountValue);
  }, [discountType, discountValue, subtotal]);
  const total = Math.max(0, subtotal - discount);

  const addService = (service: ServiceItem) => {
    setCart((prev) => {
      const exists = prev.find((item) => item.id === service.id);
      if (exists) {
        return prev.map((item) => (item.id === service.id ? { ...item, qty: item.qty + 1 } : item));
      }
      return [...prev, { ...service, qty: 1 }];
    });
  };

  const addMiscService = () => {
    if (!selectedCategory) {
      toast.error("Please select a category first");
      return;
    }

    const price = Number(miscPrice);
    if (!Number.isFinite(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }

    const customItem: CartItem = {
      id: -Date.now(),
      service_name: selectedCategory,
      services: selectedCategory,
      sub_category: "Miscellaneous",
      price,
      time: 0,
      qty: 1
    };

    setCart((prev) => [...prev, customItem]);
    toast.success("Miscellaneous service added");
    setMiscPrice("");
  };

  const clearCategoryView = () => {
    setSelectedCategory(null);
    setServiceSearch("");
    setMiscPrice("");
  };

  const updateQty = (id: number, qty: number) => {
    if (qty <= 0) {
      setCart((prev) => prev.filter((item) => item.id !== id));
      return;
    }
    setCart((prev) => prev.map((item) => (item.id === id ? { ...item, qty } : item)));
  };

  const finishInvoice = async (options?: {
    openPreview?: boolean;
    payment_method?: "cash" | "eftpos" | "exact";
  }) => {
    const openPreview = options?.openPreview ?? true;
    if (!selectedCustomer) {
      toast.error("Please select a customer");
      return false;
    }
    if (cart.length === 0) {
      toast.error("Please add at least one service");
      return false;
    }

    setSavingInvoice(true);
    try {
      const saved = await invoicesApi.saveFromPos({
        _token: csrfToken,
        payment_method: options?.payment_method || "cash",
        customer_id: selectedCustomer.id,
        customer_name: selectedCustomer.name,
        customer_email: selectedCustomer.email,
        customer_phone: selectedCustomer.phone,
        notes: customerNote.trim() || undefined,
        branch_id: user?.branch_id ?? selectedCustomer.branch_id,
        items: cart.map((item) => ({
          services: item.service_name,
          sub_category: item.sub_category,
          price: Number(item.price),
          qty: item.qty
        })),
        subtotal,
        total,
        discount,
        discount_type: discountType,
        discount_value: discountValue
      });

      const asRecord = (saved ?? {}) as Record<string, unknown>;
      const createdId = Number(
        asRecord.id ??
          asRecord.invoice_id ??
          (asRecord.data as Record<string, unknown> | undefined)?.id ??
          (asRecord.invoice as Record<string, unknown> | undefined)?.id ??
          0
      );

      let createdInvoice: InvoiceItem | null = null;
      if (Number.isFinite(createdId) && createdId > 0) {
        try {
          createdInvoice = await invoicesApi.show(createdId);
          if (openPreview) {
            setViewInvoice(createdInvoice);
            setViewInvoiceOpen(true);
          }
        } catch {
          toast.error("Invoice saved but preview could not be opened");
        }
      } else {
        toast.error("Invoice saved but print id not found");
      }

      // toast.success("Invoice saved successfully");
      // setCart([]);
      // setCustomerNote("");
      // setDiscountValue(0);
      // setDiscountType("percent");
      return createdInvoice;
    } catch {
      toast.error("Unable to save invoice");
      return null;
    } finally {
      setSavingInvoice(false);
    }
  };

  const enteredAmount = useMemo(() => {
    const parsed = evaluateCalculatorExpression(paymentInput);
    return parsed ?? 0;
  }, [paymentInput]);
  const changeAmount = enteredAmount - total;

  const appendCalculatorValue = (value: string) => {
    setPaymentInput((prev) => (prev === "0" ? value : `${prev}${value}`));
  };

  const handleCalculatorEnter = () => {
    const parsed = evaluateCalculatorExpression(paymentInput);
    if (parsed == null) {
      toast.error("Invalid amount input");
      return;
    }
    setPaymentInput(parsed.toFixed(2));
  };

  useEffect(() => {
    if (!paymentOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (savingInvoice) return;

      const activeTag = (document.activeElement as HTMLElement | null)?.tagName;
      if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

      const key = event.key;
      const isDigit = /^[0-9]$/.test(key);
      const isOperator = key === "+" || key === "-" || key === ".";

      if (isDigit || isOperator) {
        event.preventDefault();
        appendCalculatorValue(key);
        return;
      }

      if (key === "Backspace") {
        event.preventDefault();
        setPaymentInput((prev) => {
          if (prev.length <= 1) return "0";
          return prev.slice(0, -1);
        });
        return;
      }

      if (key === "Enter" || key === "=") {
        event.preventDefault();
        handleCalculatorEnter();
        return;
      }

      if (key === "Escape") {
        event.preventDefault();
        setPaymentOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [paymentOpen, savingInvoice, appendCalculatorValue, paymentInput]);

async function getDefaultPrinterName() {
  if (defaultPrinterNameRef.current) {
    return defaultPrinterNameRef.current;
  }

  const result = await window.desktopApi.listPrinters();

  if (!result.ok || !result.printers?.length) {
    throw new Error("No printer found");
  }

  // REMOVE PDF / FILE PRINTERS
  const realPrinters = result.printers.filter((p) => {
    const name = p.name.toLowerCase();

    return (
      !name.includes("pdf") &&
      !name.includes("xps") &&
      !name.includes("onenote") &&
      !name.includes("fax")
    );
  });

  const defaultPrinter =
    realPrinters.find((p) => p.isDefault) ??
    realPrinters[0] ??
    result.printers[0];

  defaultPrinterNameRef.current = defaultPrinter.name;

  console.log("Selected Printer:", defaultPrinter.name);

  return defaultPrinter.name;
}
const resetPosAfterPayment = () => {
  setPaymentOpen(false);
  setPaymentInput("0");

  // RESET CUSTOMER
  setSelectedCustomer(null);
  setCustomerSearch("");
  setCustomerNote("");
  setCustomerSuburb("");
  setShowCustomerDropdown(false);

  // GO BACK TO CATEGORY PAGE
  setSelectedCategory(null);
  setMiscPrice("");

  // RESET SEARCH
  setServiceSearch("");

  // RESET CART
  setCart([]);

  // RESET DISCOUNT
  setDiscountValue(0);
  setDiscountType("percent");

  // RESET PAGE
  setServicesPage(1);
};

const completePayment = async (
  invoice: InvoiceItem,
  options: { openDrawer: boolean; successMessage: string }
) => {
  resetPosAfterPayment();
  setViewInvoice(invoice);
  setViewInvoiceOpen(true);

  try {
    const printerName = await getDefaultPrinterName();

    if (options.openDrawer) {
      void window.desktopApi.openDrawerOnly({
        printerName,
        pulseCommandHex: "1B700019FA"
      });
    }

    toast.success(options.successMessage);
  } catch (error) {
    toast.error(
      error instanceof Error ? error.message : "Drawer open failed"
    );
  }
};

const openDrawerFast = async () => {
  const printerName = await getDefaultPrinterName();

  void window.desktopApi.openDrawerOnly({
    printerName,
    pulseCommandHex: "1B700019FA"
  });
};


const handleExactPayment = async () => {
  setPaymentInput(total.toFixed(2));

  try {
    await openDrawerFast();
  } catch {
    toast.error("Drawer open failed");
  }

  const invoice = await finishInvoice({ openPreview: false, payment_method: "exact" });
  if (!invoice) return;

  resetPosAfterPayment();
  setViewInvoice(invoice);
  setViewInvoiceOpen(true);

  toast.success("Exact payment completed");
};

const handleCashPayment = async () => {
  const parsed = evaluateCalculatorExpression(paymentInput);

  if (parsed == null) {
    toast.error("Invalid amount input");
    return;
  }

  if (parsed < total) {
    toast.error("Entered amount is less than total");
    return;
  }

  try {
    await openDrawerFast();
  } catch {
    toast.error("Drawer open failed");
  }

  const invoice = await finishInvoice({ openPreview: false, payment_method: "cash" });
  if (!invoice) return;

  resetPosAfterPayment();
  setViewInvoice(invoice);
  setViewInvoiceOpen(true);

  toast.success("Cash payment completed");
};
const handleEftposPayment = async () => {
  setPaymentInput(total.toFixed(2));

  const invoice = await finishInvoice({ openPreview: false, payment_method: "eftpos" });
  if (!invoice) return;

  await completePayment(invoice, { openDrawer: false, successMessage: "EFTPOS payment completed" });
};
const getServiceColor = (service: string) => {
  const name = `${service}`.toLowerCase();

  if (name.includes("malificent") || name.includes("product")) {
    return "bg-[#9b59b6]"; // Purple for retail / Malificent
  }

  if (name.includes("men") || name.includes("boy") ) {
    return "bg-[#48b0d8]"; // Blue
  }

  if (name.includes("women") || name.includes("facial") || name.includes("bikini") || name.includes("girl") || name.includes("hair")  || name.includes("threading")) {
    return "bg-[#ffc0cb]"; // Pink
  }

  return "bg-[#d2b48c]"; // Default
};
  const selectCustomer = async (customer: CustomerItem) => {
    try {
      const full = await customersApi.show(customer.id);
      setSelectedCustomer(full);
      setCustomerSearch(full.name);
      setCustomerNote(full.notes?.trim() ?? "");
      setCustomerSuburb(full.suburb?.trim() ?? "");
      setShowCustomerDropdown(false);
    } catch (error) {
      toast.error(getCustomerApiError(error, "Customer not found"));
    }
  };

  const submitCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!customerForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    setSavingCustomer(true);
    try {
      const newCustomer = await customersApi.create({
        name: customerForm.name.trim(),
        phone: customerForm.phone.trim() || undefined,
        email: customerForm.email.trim() || undefined,
        suburb: customerForm.suburb.trim() || undefined,
        notes: customerForm.notes.trim() || undefined
      });

      setAllCustomers((prev) => [newCustomer, ...prev]);
      setSelectedCustomer(newCustomer);
      setCustomerSearch(newCustomer.name);
      setCustomerSuburb(newCustomer.suburb?.trim() ?? "");
      setCustomerNote(newCustomer.notes?.trim() ?? "");
      setShowCustomerDropdown(false);
      setOpenCustomerModal(false);
      setCustomerForm({ name: "", phone: "", email: "", suburb: "", notes: "" });
      toast.success("Customer added");
    } catch (error) {
      toast.error(getCustomerApiError(error, "Unable to add customer"));
    } finally {
      setSavingCustomer(false);
    }
  };

  const handleUpdateCustomerDetails = async () => {
    if (!selectedCustomer) {
      toast.error("Please select a customer first");
      return;
    }

    setUpdatingCustomerDetails(true);

    try {
      const updated = await customersApi.update(selectedCustomer.id, {
        name: selectedCustomer.name,
        phone: selectedCustomer.phone,
        email: selectedCustomer.email,
        suburb: customerSuburb.trim() || undefined,
        date_of_birth: selectedCustomer.date_of_birth,
        notes: customerNote.trim() || undefined
      });

      setSelectedCustomer(updated);
      setCustomerSuburb(updated.suburb?.trim() ?? "");
      setCustomerNote(updated.notes?.trim() ?? "");

      setAllCustomers((prev) =>
        prev.map((customer) => (customer.id === selectedCustomer.id ? updated : customer))
      );

      setCustomerSuggestions((prev) =>
        prev.map((customer) => (customer.id === selectedCustomer.id ? updated : customer))
      );

      toast.success("Customer details updated");
    } catch (error) {
      toast.error(getCustomerApiError(error, "Unable to update customer details"));
    } finally {
      setUpdatingCustomerDetails(false);
    }
  };

  const openViewInvoice = async (id: number) => {
    setViewInvoiceOpen(true);
    setViewInvoiceLoading(true);
    try {
      const invoice = await invoicesApi.show(id);
      setViewInvoice(invoice);
    } catch {
      toast.error("Unable to load invoice details");
      setViewInvoiceOpen(false);
    } finally {
      setViewInvoiceLoading(false);
    }
  };

  const buildInvoicePrintHtml = (invoice: InvoiceItem) => {
    const invoiceExtras = invoice as InvoiceItem & {
      tax?: number;
      tax_amount?: number;
      discount?: number;
    };
    const branch = user?.branch;
    const addressLines = branch
      ? [branch.name, branch.address]
      : [invoiceAddressFallback.line1, invoiceAddressFallback.line2];
    const items = invoice.items ?? [];
    const itemsRows =
      items.length === 0
        ? `<tr><td>-</td><td style="text-align:right;">0.00</td></tr>`
        : items
            .map(
              (item) =>
                `<tr><td>${escapeHtml(invoiceLineLabel(item))}</td><td style="text-align:right;">${formatMoney(invoiceLineTotal(item))}</td></tr>`
            )
            .join("");

    return `<!doctype html>
            <html>
            <head>
            <meta charset="utf-8" />
            <title>Invoice ${escapeHtml(invoiceNo(invoice))}</title>
            
            <style>
             @page {
  size: 80mm auto;
  margin: 0 !important;
}

html,
body {
  height: auto !important;
  min-height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
  width: 100% !important;
  max-width: 80mm;
  font-size: 12px !important;
  line-height: 1.25 !important;
  background: #fff !important;
  overflow-x: hidden !important;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}

body {
  font-family: Inter, "Segoe UI", Roboto, Arial, sans-serif !important;
  color: #000;
}

.container {
  border: 0 !important;
  border-radius: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  margin-left: 0 !important;
  padding-left: 0 !important;
  left: 0 !important;
  width: 100% !important;
  max-width: 80mm !important;
  box-sizing: border-box !important;
}

.center {
  text-align: center;
}

.shop-name {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.shop-address {
  margin-top: 3px;
  font-size: 12px;
  font-weight: 600;
  line-height: 1.3;
}

table {
  width: 100%;
  border-collapse: collapse;
}

th,
td {
  padding: 2px;
  vertical-align: top;
  font-size: 12px;
  font-weight: 700;
}

th {
  border-bottom: 1px solid #111;
  text-align: left;
}

td:last-child,
th:last-child {
  text-align: right;
}

.total {
  border-top: 1px solid #111;
  font-weight: 700;
}

.footer {
  margin-top: 14px;
  text-align: center;
  font-size: 12px;
  font-weight: 700;
}

.footer p {
  margin: 0;
}

.font-bold-more {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 700;
}
            </style>
            </head>
            
            <body>
            <div class="container">
            
              <div class="center">
                <div class="shop-name">${escapeHtml(addressLines[0] ?? "Neeri Salon")}</div>
                <div class="shop-address">${escapeHtml(addressLines[1] ?? "")}</div>
              </div>
            
              <hr/>
            
              <table>
                <tr><td><strong>Bill No:</strong></td><td>${escapeHtml(invoiceNo(invoice))}</td></tr>
                <tr><td><strong>Date:</strong></td><td>${formatDate(invoice.created_at)}</td></tr>
                <tr><td><strong>Name:</strong></td><td>${escapeHtml(invoice.customer_name || "-")}</td></tr>
                <tr><td><strong>Mobile:</strong></td><td>${escapeHtml(invoice.customer_phone || "-")}</td></tr>
              </table>
            
              <hr/>
            
              <table>
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Amt</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsRows}
                </tbody>
              </table>
            
              <hr/>
            
              <table>
                <tr>
                  <td>Sub Total</td>
                  <td>$${formatMoney(invoice.subtotal)}</td>
                </tr>
            
                ${
                  invoiceExtras.tax
                    ? `<tr>
                        <td>GST (${invoiceExtras.tax}% )</td>
                        <td>$${formatMoney(invoiceExtras.tax_amount)}</td>
                      </tr>`
                    : ""
                }
            
                ${
                  invoiceExtras.discount
                    ? `<tr>
                        <td>Discount</td>
                        <td>- $${formatMoney(invoiceExtras.discount)}</td>
                      </tr>`
                    : ""
                }
            
                <tr class="total">
                  <td>Total</td>
                  <td>$${formatMoney(invoice.total)}</td>
                </tr>
              </table>
            
              <div class="footer">
                <p>Thank You! Visit Again </p>
                <p class="font-bold-more">Powered by Eirmon Solutions</p>
              </div>
            
            </div>
            </body>
            </html>`;
  };

const printInvoiceNow = async (invoice: InvoiceItem) => {
  try {
    const printerName = await getDefaultPrinterName();

    await window.desktopApi.printHtmlSilent({
      printerName,
      html: buildInvoicePrintHtml(invoice)
    });
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Unable to print invoice");
  }
};

  return (
    <div className="flex h-full min-h-0 flex-col gap-2 overflow-hidden p-2">
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Point of Sale</h2>
            <p className="text-xs font-semibold text-slate-500">Professional checkout with fast service billing.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="min-h-11 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white" onClick={() => navigate("/dashboard")}>Dashboard</button>
            {/* <button
              type="button"
              className="rounded-lg bg-sky-600 px-3 py-2 text-xs font-medium text-white"
              onClick={() => {
                setSelectedCategory(null);
                setServiceSearch("");
                setServicesPage(1);
              }}
            >
              Home
            </button> */}
            <button type="button" className="min-h-11 rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-medium text-white" onClick={() => setOpenCustomerModal(true)}>Add Customer</button>
            <button type="button" className="min-h-11 rounded-lg bg-yellow-500 px-4 py-2.5 text-sm font-medium text-white" onClick={() => setOpenCustomerListModal(true)}>Customer List</button>
            <button
              type="button"
              className="min-h-11 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-medium text-white"
              onClick={() => {
                setOrdersPage(1);
                setOrdersSearch("");
                setOrdersOpen(true);
              }}
            >
              View Orders
            </button>
            <button type="button" className="min-h-11 rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-medium text-white" onClick={() => void logout().then(() => navigate("/login"))}>Logout</button>
          </div>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-3 overflow-hidden lg:grid-cols-[1.2fr_1fr]">
        <section className="flex min-h-[min(52vh,640px)] flex-col rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:h-full lg:min-h-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {selectedCategory ? (
                <button
                  type="button"
                  className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  onClick={clearCategoryView}
                >
                  Back
                </button>
              ) : null}
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600">
                {selectedCategory ? `Services — ${selectedCategory}` : "Categories"}
              </h3>
            </div>
            <input
              className="field max-w-xs"
              placeholder={selectedCategory ? "Search in this category" : "Search categories"}
              value={serviceSearch}
              onChange={(event) => setServiceSearch(event.target.value)}
            />
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-100 p-2 lg:min-h-[calc(100vh-12rem)]">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {posBootLoading
                ? Array.from({ length: 18 }).map((_, index) => (
                    <div key={`category-skeleton-${index}`} className="min-h-16 rounded-lg border border-slate-200 bg-white p-2">
                      <Skeleton className="h-5 w-full" />
                      <Skeleton className="mt-2 h-4 w-3/4" />
                    </div>
                  ))
                : selectedCategory
                ? (
                  <>
                    {serviceTileRows.map((service) => {
                      const typedService = service as ServiceItem;
                      const labelLines = formatServiceTileLabel(
                        (typedService.sub_category || "").trim() || typedService.service_name
                      );
                      return (
                        <button
                          key={typedService.id}
                          type="button"
                          className="flex min-h-[96px] w-full min-w-0 flex-col items-center justify-center rounded-xl bg-green-500 px-2 py-2.5 text-center text-[11px] font-bold leading-snug text-white transition hover:opacity-90 active:scale-[0.98]"
                          onClick={() => addService(typedService)}
                        >
                          <span className="flex w-full min-w-0 flex-col gap-0.5 uppercase [overflow-wrap:anywhere]">
                            {labelLines.map((line, lineIndex) => (
                              <span key={`${typedService.id}-${lineIndex}`} className="block break-words">
                                {line}
                              </span>
                            ))}
                          </span>
                          <span className="mt-1 shrink-0 text-[11px] font-bold">
                            ${Number(typedService.price).toFixed(2)}
                          </span>
                        </button>
                      );
                    })}
                    <div className="flex min-h-[96px] w-full min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-violet-400 bg-violet-100 px-2 py-2 text-center">
                      <span className="text-[10px] font-extrabold uppercase leading-tight text-violet-900">
                        Miscellaneous
                      </span>
                      <input
                        className="w-full max-w-[84px] rounded-md border border-violet-300 bg-white px-1.5 py-1 text-center text-xs font-semibold text-slate-800 outline-none focus:border-violet-500"
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="Price"
                        value={miscPrice}
                        onChange={(event) => setMiscPrice(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault();
                            addMiscService();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="rounded-md bg-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase text-white hover:bg-violet-700"
                        onClick={addMiscService}
                      >
                        Add
                      </button>
                    </div>
                  </>
                )
                : serviceTileRows.map((category) => {
                    const typedCategory = String(category);
                    const labelLines = formatServiceTileLabel(typedCategory);
                    return (
                      <button
                        key={typedCategory}
                        type="button"
                        className={`flex min-h-[80px] w-full min-w-0 flex-col items-center justify-center rounded-xl px-2 py-2.5 text-center text-[12px] font-extrabold leading-snug text-white transition hover:opacity-90 active:scale-[0.98] ${getServiceColor(typedCategory)}`}
                        onClick={() => setSelectedCategory(typedCategory)}
                      >
                        <span className="flex w-full min-w-0 flex-col gap-0.5 [overflow-wrap:anywhere]">
                          {labelLines.map((line, lineIndex) => (
                            <span key={`${typedCategory}-${lineIndex}`} className="block break-words">
                              {line}
                            </span>
                          ))}
                        </span>
                      </button>
                    );
                  })}
              {!posBootLoading && !selectedCategory && serviceTileRows.length === 0 ? (
                <p className="col-span-full rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                  No categories found.
                </p>
              ) : null}
            </div>
          </div>

          <div >
         {!selectedCategory ? (
  <div className="mt-4 shrink-0">
    <Pagination
      page={servicesPage}
      totalPages={serviceTilePages}
      onPageChange={setServicesPage}
    />
  </div>
) : null}
          </div>
        </section>

        <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-sm lg:h-full">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div ref={customerSearchWrapRef} className="relative md:col-span-2">
              <label className="field-label">Customer Search</label>
              <input
                className="field"
                placeholder="Search by name, phone, email"
                value={customerSearch}
                onChange={(event) => {
                  setCustomerSearch(event.target.value);
                  setSelectedCustomer(null);
                  setCustomerNote("");
                  setCustomerSuburb("");
                  setShowCustomerDropdown(true);
                }}
                onFocus={() => setShowCustomerDropdown(true)}
              />

              {showCustomerDropdown ? (
                <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {loadingCustomers ? (
                    <p className="p-2 text-xs text-slate-500">Searching customers...</p>
                  ) : customerSuggestions.length === 0 ? (
                    <p className="p-2 text-xs text-slate-500">No customers found</p>
                  ) : (
                    customerSuggestions.map((customer) => (
                      <button
                        key={customer.id}
                        type="button"
                        className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left hover:bg-slate-50"
                        onClick={() => void selectCustomer(customer)}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-medium text-slate-700">{customer.name}</span>
                          {customer.suburb ? (
                            <span className="block text-[10px] text-slate-500">{customer.suburb}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 text-xs text-slate-500">{customer.phone}</span>
                      </button>
                    ))
                  )}
                </div>
              ) : null}
            </div>
          </div>

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2.5 text-xs">
            {selectedCustomer ? (
              <div className="grid grid-cols-1 gap-2 text-slate-700 sm:grid-cols-2">
                <p><span className="font-semibold">Customer:</span> {selectedCustomer.name}</p>
                <p><span className="font-semibold">Phone:</span> {selectedCustomer.phone || "-"}</p>
                <p><span className="font-semibold">Email:</span> {selectedCustomer.email || "-"}</p>
                <p><span className="font-semibold">ID:</span> #{selectedCustomer.id}</p>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Suburb</label>
                  <input
                    className="field"
                    placeholder="Enter suburb"
                    value={customerSuburb}
                    onChange={(event) => setCustomerSuburb(event.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Customer Note</label>
                  <textarea
                    className="field min-h-16 resize-y"
                    placeholder="Enter customer notes"
                    value={customerNote}
                    onChange={(event) => setCustomerNote(event.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      className="min-h-9 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                      onClick={() => void handleUpdateCustomerDetails()}
                      disabled={updatingCustomerDetails}
                    >
                      {updatingCustomerDetails ? "Saving..." : "Save details"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-slate-500">No customer selected</p>
            )}
          </div>

          <div className="mt-3 h-[190px] overflow-y-auto overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[620px] text-xs">
              <thead>
                <tr className="table-head">
                  <th className="p-2 text-left">Service</th>
                  <th className="p-2 text-left">Qty</th>
                  <th className="p-2 text-left">Price</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {cart.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={4}>No services in cart.</td>
                  </tr>
                ) : (
                  cart.map((item) => (
                    <tr key={item.id} className="border-b last:border-b-0">
                      <td className="p-2">
                        <p className="text-xs font-medium leading-snug text-slate-800">{item.sub_category || item.service_name}</p>
                        {item.sub_category ? <p className="text-xs text-slate-500">{item.service_name}</p> : null}
                      </td>
                      <td className="p-2">
                        <input
                          className="field w-16"
                          type="number"
                          min={1}
                          value={item.qty}
                          onChange={(event) => updateQty(item.id, Number(event.target.value))}
                        />
                      </td>
                      <td className="p-2 font-medium">${(item.qty * Number(item.price)).toFixed(2)}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="min-h-9 rounded-md border border-rose-300 px-3 py-1.5 text-xs font-medium text-rose-600"
                          onClick={() => setCart((prev) => prev.filter((service) => service.id !== item.id))}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payment Summary</p>
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Subtotal</span>
                  <span className="font-semibold text-slate-900">${subtotal.toFixed(2)}</span>
                </div>
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Discount</label>
                  <div className="grid grid-cols-[1fr_1fr] gap-2">
                    <select
                      className="field h-11 text-sm"
                      value={discountType}
                      onChange={(event) => setDiscountType(event.target.value as "percent" | "flat")}
                    >
                      <option value="percent">Percent</option>
                      <option value="flat">Flat</option>
                    </select>
                    <input
                      type="number"
                      min={0}
                      className="field h-11 text-sm"
                      value={discountValue}
                      onChange={(event) => setDiscountValue(Number(event.target.value) || 0)}
                    />
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    {discountType === "percent" ? `${discountValue}% applied` : `$${discountValue} applied`}
                  </p>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-700">Discount Amount</span>
                  <span className="font-semibold text-slate-900">${discount.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm font-bold text-slate-900">Total Amount</span>
                  <span className="text-lg font-extrabold text-slate-900">${total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50 p-4 shadow-sm">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Payment</p>
              <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-indigo-600 px-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                    onClick={() => void handleExactPayment()}
                    disabled={savingInvoice || cart.length === 0}
                  >
                    Exact
                  </button>
                     <button
  type="button"
  className="min-h-11 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
onClick={() => {
  setPaymentInput("0");
  setPaymentOpen(true);
}}
  disabled={savingInvoice || cart.length === 0}
>
  Cash
</button>
                  <button
                    type="button"
                    className="min-h-11 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    onClick={() => void handleEftposPayment()}
                    disabled={savingInvoice || cart.length === 0}
                  >
                    EFTPOS
                  </button>
                </div>
            </div>
          </div>
        </section>
      </div>

      <Modal title="Add Customer" open={openCustomerModal} onClose={() => setOpenCustomerModal(false)}>
        <form className="grid grid-cols-2 gap-3" onSubmit={(event) => void submitCustomer(event)}>
          <div>
            <label className="field-label">Name</label>
            <input className="field" value={customerForm.name} onChange={(e) => setCustomerForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="field" value={customerForm.phone} onChange={(e) => setCustomerForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="field" type="email" value={customerForm.email} onChange={(e) => setCustomerForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Suburb</label>
            <input
              className="field"
              maxLength={255}
              value={customerForm.suburb}
              onChange={(e) => setCustomerForm((prev) => ({ ...prev, suburb: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="field-label">Notes</label>
            <input className="field" value={customerForm.notes} onChange={(e) => setCustomerForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
          <button className="btn-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={savingCustomer}>
            {savingCustomer ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Customer"}
          </button>
        </form>
      </Modal>

      <Modal
        title="Client List"
        open={openCustomerListModal}
        onClose={() => setOpenCustomerListModal(false)}
        sizeClassName="max-w-4xl"
      >
        <div className="space-y-3">
          <input
            className="field"
            placeholder="Search customer by name, phone, email"
            value={customerListSearch}
            onChange={(event) => setCustomerListSearch(event.target.value)}
          />
          <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="table-head">
                  <th className="p-2 text-left">Name</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Email</th>
                  <th className="p-2 text-left">Suburb</th>
                  <th className="p-2 text-left">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomerList.length === 0 ? (
                  <tr>
                    <td className="p-3 text-slate-500" colSpan={5}>No customers found.</td>
                  </tr>
                ) : (
                  filteredCustomerList.map((customer) => (
                    <tr key={customer.id} className="border-b last:border-b-0">
                      <td className="p-2">{customer.name || "-"}</td>
                      <td className="p-2">{customer.phone || "-"}</td>
                      <td className="p-2">{customer.email || "-"}</td>
                      <td className="p-2">{customer.suburb || "-"}</td>
                      <td className="p-2">
                        <button
                          type="button"
                          className="min-h-8 rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700"
                          onClick={() => {
                            void selectCustomer(customer);
                            setOpenCustomerListModal(false);
                          }}
                        >
                          Select
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {paymentOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Payment</h3>
              <button
                type="button"
                className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => setPaymentOpen(false)}
                disabled={savingInvoice}
              >
                Close
              </button>
            </div>

            <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="flex justify-between"><span>Bill Amount</span><span className="font-semibold">${formatMoney(total)}</span></p>
              <p className="mt-1 flex justify-between"><span>Customer Paid</span><span className="font-semibold">${formatMoney(enteredAmount)}</span></p>
              <p className="mt-1 flex justify-between"><span>Change</span><span className={`font-semibold ${changeAmount < 0 ? "text-rose-600" : "text-emerald-600"}`}>${formatMoney(Math.abs(changeAmount))}{changeAmount < 0 ? " due" : ""}</span></p>
            </div>

            <div className="mb-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-xl font-bold tracking-wide text-slate-900">
              {paymentInput}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {["7", "8", "9", "+", "4", "5", "6", "-", "1", "2", "3", "C", "0", ".", "00", "Enter"].map((key) => (
                <button
                  key={key}
                  type="button"
                  className={`min-h-11 rounded-lg px-3 text-sm font-semibold transition ${
                    key === "Enter"
                      ? "bg-emerald-600 text-white hover:bg-emerald-700"
                      : key === "C"
                      ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                      : "bg-slate-100 text-slate-800 hover:bg-slate-200"
                  }`}
                  onClick={() => {
                    if (key === "C") {
                      setPaymentInput("0");
                      return;
                    }
                    if (key === "Enter") {
                      handleCalculatorEnter();
                      return;
                    }
                    appendCalculatorValue(key);
                  }}
                  disabled={savingInvoice}
                >
                  {key}
                </button>
              ))}
            </div>

            </div>
            <div className="mt-3 rounded-xl bg-white p-2 shadow-lg">
              <button
                type="button"
                className="min-h-11 w-full rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                onClick={() => void handleCashPayment()}
                disabled={savingInvoice}
              >
                Complete Cash Payment
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {ordersOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h3 className="text-base font-semibold tracking-tight text-slate-900">Past Orders</h3>
              <button className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setOrdersOpen(false)}>
                Close
              </button>
            </div>

            <div className="space-y-3 p-5">
              <input
                className="field"
                placeholder="Search customer or invoice"
                value={ordersSearch}
                onChange={(e) => {
                  setOrdersPage(1);
                  setOrdersSearch(e.target.value);
                }}
              />

              <div className="max-h-[420px] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="table-head">
                      <th className="p-2">Invoice #</th>
                      <th className="p-2">Customer</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Total</th>
                      <th className="p-2">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordersLoading ? (
                      <tr>
                        <td className="p-3 text-center text-slate-500" colSpan={5}>Loading orders...</td>
                      </tr>
                    ) : orders.length === 0 ? (
                      <tr>
                        <td className="p-3 text-center text-slate-500" colSpan={5}>No orders found.</td>
                      </tr>
                    ) : (
                      orders.map((row) => (
                        <tr key={row.id} className="border-b">
                          <td className="p-2">{invoiceNo(row)}</td>
                          <td className="p-2">{row.customer_name || "-"}</td>
                          <td className="p-2">{formatDate(row.created_at)}</td>
                          <td className="p-2">${formatMoney(row.total)}</td>
                          <td className="p-2">
                            <button
                              className="min-h-9 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"
                              onClick={() => void openViewInvoice(row.id)}
                            >
                              View
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-end">
                <Pagination page={ordersPage} totalPages={ordersLastPage} onPageChange={setOrdersPage} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {viewInvoiceOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/45 px-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <h4 className="text-base font-semibold">Invoice Details</h4>
              <button
                className="min-h-10 rounded-lg border border-slate-300 px-4 py-2 text-sm"
                onClick={() => {
                  setViewInvoiceOpen(false);
                  setViewInvoice(null);
                }}
              >
                X
              </button>
            </div>

            <div className="space-y-2 p-3 text-xs">
              {viewInvoiceLoading ? (
                <p className="text-slate-500">Loading invoice...</p>
              ) : viewInvoice ? (
                <>
                  <div className="text-center">
                  <h2 className="text-lg font-bold text-slate-900">
  {user?.branch?.name || "Neeri Salon"}
</h2>
                    {(() => {
                      const addr = resolveInvoiceAddress(viewInvoice, user, invoiceAddressFallback);
                      return (
                        <>
                          <p className="mt-2 text-xs text-slate-700">{addr.line1}</p>
                          {addr.line2 ? <p className="text-xs text-slate-700">{addr.line2}</p> : null}
                        </>
                      );
                    })()}
                  </div>

                  <div className="space-y-1 border-t pt-2">
                    <p><span className="font-semibold">Name:</span> {viewInvoice.customer_name || "-"}</p>
                    <p><span className="font-semibold">Mobile:</span> {viewInvoice.customer_phone || "-"}</p>
                    <p><span className="font-semibold">Date:</span> {formatDate(viewInvoice.created_at)}</p>
                  </div>

                  <div className="border-t pt-2">
                    <p className="font-semibold">Order Details</p>
                    <p><span className="font-semibold">Bill No:</span> {invoiceNo(viewInvoice)}</p>
                  </div>

                  <table className="w-full border-t text-xs">
                    <thead>
                      <tr className="border-b">
                        <th className="py-1 text-left">Service</th>
                        <th className="py-1 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(viewInvoice.items ?? []).length === 0 ? (
                        <tr>
                          <td className="py-1">-</td>
                          <td className="py-1 text-right">0.00</td>
                        </tr>
                      ) : (
                        (viewInvoice.items ?? []).map((item, idx) => (
                          <tr key={idx} className="border-b last:border-b-0">
                            <td className="py-1">{invoiceLineLabel(item)}</td>
                            <td className="py-1 text-right">{formatMoney(invoiceLineTotal(item))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>

                  <div className="space-y-1 border-t pt-2">
                    <p className="flex justify-between"><span>Sub Total</span><span>${formatMoney(viewInvoice.subtotal)}</span></p>
                    <p className="flex justify-between"><span>Discount</span><span>{formatMoney(viewInvoice.discount_value)}{viewInvoice.discount_type === "percentage" ? "%" : ""}</span></p>
                    <p className="flex justify-between text-sm font-bold"><span>Total</span><span>${formatMoney(viewInvoice.total)}</span></p>
                  </div>

                  <p className="pt-2 text-center text-xs">Thanks, Visit Again!</p>

                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      className="rounded bg-slate-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => {
                        setViewInvoiceOpen(false);
                        setViewInvoice(null);
                      }}
                    >
                      Close
                    </button>
                    <button
                      className="rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white"
                      onClick={() => printInvoiceNow(viewInvoice)}
                    >
                      Print
                    </button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}