import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/bookingsApi";
import { branchesApi, formatBranchLabel } from "../api/branchesApi";
import { servicesApi } from "../api/servicesApi";
import { useAuthStore } from "../store/authStore";
import type { BranchItem, ServiceItem } from "../types";
import { getServiceCategory, getServiceLabel } from "../utils/serviceLabels";

const TIME_SLOTS = [
  "08:00",
  "08:30",
  "09:00",
  "09:30",
  "10:00",
  "10:30",
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00"
];

function todayISO() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMinutesToTime(time24: string, minutesToAdd: number) {
  const [hours, mins] = time24.split(":").map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(mins)) return time24;
  const total = hours * 60 + mins + minutesToAdd;
  const clamped = Math.max(0, Math.min(total, 23 * 60 + 59));
  const endHour = Math.floor(clamped / 60);
  const endMinute = clamped % 60;
  return `${String(endHour).padStart(2, "0")}:${String(endMinute).padStart(2, "0")}`;
}

export default function AddBookingPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const serviceBoxRef = useRef<HTMLDivElement>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">(user?.branch_id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [date, setDate] = useState(todayISO);
  const [time, setTime] = useState("09:00");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void branchesApi
      .list({ per_page: 100 })
      .then((rows) => {
        const scopedRows =
          user?.role === "branch_manager" && user.branch_id != null
            ? rows.filter((item) => item.id === user.branch_id)
            : rows;
        setBranches(scopedRows);
      })
      .catch(() => setBranches([]));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    void servicesApi
      .list({ per_page: 200 })
      .then((rows) => {
        const scopedRows =
          user?.role === "branch_manager"
            ? rows.filter((item) => item.branch_id === user.branch_id)
            : rows;
        setServices(scopedRows);
      })
      .catch(() => setServices([]));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!serviceBoxRef.current?.contains(event.target as Node)) {
        setServiceOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  useEffect(() => {
    if (user?.branch_id != null) {
      setSelectedBranchId(user.branch_id);
      return;
    }
    if (branches.length === 1) {
      setSelectedBranchId(branches[0].id);
    }
  }, [user?.branch_id, branches]);

  const branchOptions = useMemo(() => {
    if (branches.length) return branches;

    const fallback = new Map<number, BranchItem>();
    if (user?.branch_id != null) {
      fallback.set(user.branch_id, {
        id: user.branch_id,
        name: user.branch?.name || user.branch_name || `Branch ${user.branch_id}`
      });
    }
    services.forEach((item) => {
      if (item.branch_id == null || fallback.has(item.branch_id)) return;
      fallback.set(item.branch_id, {
        id: item.branch_id,
        name: `Branch ${item.branch_id}`
      });
    });
    return Array.from(fallback.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [branches, services, user?.branch_id, user?.branch?.name, user?.branch_name]);

  const servicePool = useMemo(() => {
    if (!selectedBranchId) return services;
    return services.filter((service) => service.branch_id == null || service.branch_id === selectedBranchId);
  }, [services, selectedBranchId]);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    return servicePool.filter((service) => {
      if (selectedServices.some((row) => row.id === service.id)) return false;
      if (!term) return true;
      const haystack = `${getServiceCategory(service)} ${getServiceLabel(service)}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [servicePool, serviceSearch, selectedServices]);

  const total = useMemo(() => selectedServices.reduce((sum, row) => sum + Number(row.price || 0), 0), [selectedServices]);
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, row) => sum + Number(row.time || 0), 0) || 30,
    [selectedServices]
  );

  const addService = (service: ServiceItem) => {
    setSelectedServices((prev) => (prev.some((row) => row.id === service.id) ? prev : [...prev, service]));
    setServiceSearch("");
    setServiceOpen(false);
  };

  const removeService = (id: number) => {
    setSelectedServices((prev) => prev.filter((row) => row.id !== id));
  };

  const submitBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter customer name and phone");
      return;
    }
    if (!selectedBranchId) {
      toast.error("Please select a branch");
      return;
    }
    if (!selectedServices.length) {
      toast.error("Please select at least one service");
      return;
    }
    if (!date || !time) {
      toast.error("Please select date and time");
      return;
    }

    setSubmitting(true);
    try {
      const start = time;
      const end = addMinutesToTime(time, totalDuration);
      await bookingsApi.createByAdmin({
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim(),
        date,
        time: start,
        start_time: start,
        end_time: end,
        duration: totalDuration,
        services: selectedServices.map((row) => getServiceLabel(row)).join(", "),
        total_price: total,
        notes: notes.trim(),
        branch_id: selectedBranchId || user?.branch_id || undefined
      });
      toast.success("Booking created");
      navigate("/bookings");
    } catch {
      toast.error("Unable to create booking");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="panel mx-auto max-w-3xl p-5">
      <h2 className="panel-title mb-5">Add Booking</h2>

      <form className="space-y-4" onSubmit={(e) => void submitBooking(e)}>
        <div>
          <label className="field-label" htmlFor="branch">
            Branch
          </label>
          <select
            id="branch"
            className="field"
            value={selectedBranchId}
            onChange={(e) => {
              const value = e.target.value ? Number(e.target.value) : "";
              setSelectedBranchId(value);
              setServiceSearch("");
              setServiceOpen(false);
              setSelectedServices((prev) =>
                value ? prev.filter((item) => item.branch_id == null || item.branch_id === value) : prev
              );
            }}
          >
            {!user?.branch_id && branchOptions.length > 1 && <option value="">Select branch</option>}
            {branchOptions.map((branch) => (
              <option key={branch.id} value={branch.id}>
                {formatBranchLabel(branch)}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="name">
              Customer name
            </label>
            <input
              id="name"
              className="field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Customer name"
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="phone">
              Phone
            </label>
            <input
              id="phone"
              className="field"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="Phone number"
              required
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            className="field"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div ref={serviceBoxRef}>
          <label className="field-label" htmlFor="service-search">
            Services
          </label>
          <div className="relative">
            <input
              id="service-search"
              className="field"
              value={serviceSearch}
              placeholder="Search services or click to see all…"
              autoComplete="off"
              onFocus={() => setServiceOpen(true)}
              onChange={(e) => {
                setServiceSearch(e.target.value);
                setServiceOpen(true);
              }}
            />
            {serviceOpen ? (
              <div className="absolute z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                {filteredServices.length ? (
                  filteredServices.map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-slate-50"
                      onClick={() => addService(service)}
                    >
                      <span>
                        <span className="font-medium text-slate-800">{getServiceLabel(service)}</span>
                        {getServiceCategory(service) ? (
                          <span className="ml-1 text-xs text-slate-500">({getServiceCategory(service)})</span>
                        ) : null}
                      </span>
                      <span className="shrink-0 text-xs font-semibold text-slate-500">
                        ${Number(service.price || 0).toFixed(2)}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-3 text-sm text-slate-500">
                    {serviceSearch.trim() ? "No matching services" : "No services available"}
                  </p>
                )}
              </div>
            ) : null}
          </div>

          {selectedServices.length ? (
            <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="space-y-2">
                {selectedServices.map((service) => (
                  <div
                    key={service.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 ring-1 ring-slate-200"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-800">{getServiceLabel(service)}</p>
                      {getServiceCategory(service) ? (
                        <p className="truncate text-xs text-slate-500">{getServiceCategory(service)}</p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="text-sm font-semibold text-slate-700">
                        ${Number(service.price || 0).toFixed(2)}
                      </span>
                      <button
                        type="button"
                        className="rounded border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() => removeService(service.id)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-sm font-medium text-slate-600">
                Total: ${total.toFixed(2)} · Duration: {totalDuration} min
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No service added yet.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="field"
              min={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="time">
              Time
            </label>
            <select
              id="time"
              className="field"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              required
            >
              <option value="">Select time</option>
              {TIME_SLOTS.map((slot) => (
                <option key={slot} value={slot}>
                  {slot}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="notes">
            Notes (optional)
          </label>
          <textarea
            id="notes"
            className="field min-h-20"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Booking"}
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
            onClick={() => navigate("/bookings")}
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
