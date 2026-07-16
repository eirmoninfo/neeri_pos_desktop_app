import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/bookingsApi";
import { branchesApi, formatBranchLabel } from "../api/branchesApi";
import { servicesApi } from "../api/servicesApi";
import { useAuthStore } from "../store/authStore";
import type { BranchItem, ServiceItem } from "../types";

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
  const serviceSelectRef = useRef<HTMLSelectElement>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">(user?.branch_id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedServiceId, setSelectedServiceId] = useState<number | "">("");
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

  const categories = useMemo(() => {
    const names = new Set<string>();
    servicePool.forEach((service) => {
      const value = service.sub_category?.trim();
      if (value) names.add(value);
    });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [servicePool]);

  const filteredServices = useMemo(() => {
    return servicePool.filter((service) => {
      if (selectedServices.some((row) => row.id === service.id)) return false;
      if (!selectedCategory) return true;
      return (service.sub_category ?? "") === selectedCategory;
    });
  }, [servicePool, selectedCategory, selectedServices]);

  const total = useMemo(() => selectedServices.reduce((sum, row) => sum + Number(row.price || 0), 0), [selectedServices]);
  const totalDuration = useMemo(
    () => selectedServices.reduce((sum, row) => sum + Number(row.time || 0), 0) || 30,
    [selectedServices]
  );

  const addService = (service: ServiceItem) => {
    setSelectedServices((prev) => (prev.some((row) => row.id === service.id) ? prev : [...prev, service]));
    setSelectedServiceId("");
    serviceSelectRef.current?.focus();
  };

  const removeService = (id: number) => {
    setSelectedServices((prev) => prev.filter((row) => row.id !== id));
  };

  const addSelectedService = () => {
    if (!selectedServiceId) {
      toast.error("Please select service");
      return;
    }
    const selected = filteredServices.find((item) => item.id === selectedServiceId);
    if (!selected) {
      toast.error("Selected service is not available");
      return;
    }
    addService(selected);
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
        services: selectedServices.map((row) => row.service_name).join(", "),
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
              setSelectedCategory("");
              setSelectedServiceId("");
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

        <div className="grid grid-cols-[1fr_1fr_auto] gap-3">
          <div>
            <label className="field-label" htmlFor="category">
              Category
            </label>
            <select
              id="category"
              className="field"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setSelectedServiceId("");
              }}
            >
              <option value="">Select category</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="service">
              Service
            </label>
            <select
              id="service"
              ref={serviceSelectRef}
              className="field"
              value={selectedServiceId}
              onChange={(e) => setSelectedServiceId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select service</option>
              {filteredServices.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.service_name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              className="rounded-lg border border-blue-300 px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-50"
              onClick={addSelectedService}
            >
              Add Service
            </button>
          </div>
        </div>

        {selectedServices.length ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap gap-2">
              {selectedServices.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-100"
                  onClick={() => removeService(service.id)}
                  title="Remove service"
                >
                  {service.service_name} x
                </button>
              ))}
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Total: ${total.toFixed(2)} | Duration: {totalDuration} min
            </p>
          </div>
        ) : (
          <p className="text-sm text-slate-500">No service added yet.</p>
        )}

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
