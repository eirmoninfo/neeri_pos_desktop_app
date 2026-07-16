import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { bookingsApi } from "../api/bookingsApi";
import { servicesApi } from "../api/servicesApi";
import type { BookingItem, ServiceItem } from "../types";
import { useAuthStore } from "../store/authStore";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { SkeletonRows } from "../components/Skeleton";
import { useBookingRealtime } from "../realtime/useBookingRealtime";
import { getServiceCategory, getServiceLabel } from "../utils/serviceLabels";

interface BookingFormState {
  name: string;
  email: string;
  phone: string;
  date: string;
  start_time: string;
  end_time: string;
  total_price: string;
  notes: string;
}

const defaultForm: BookingFormState = {
  name: "",
  email: "",
  phone: "",
  date: "",
  start_time: "",
  end_time: "",
  total_price: "",
  notes: ""
};

export default function BookingsPage() {
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BookingFormState>(defaultForm);
  const [savingBooking, setSavingBooking] = useState(false);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const serviceBoxRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    setLoading(true);
    const result = await bookingsApi.list({ status, search, date, per_page: 10 });
    const branchRows =
      user?.role === "branch_manager" ? result.filter((item) => item.branch_id === user.branch_id) : result;
    setRows(branchRows);
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
  }, [status, search, date, perPage]);

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load bookings"));
  }, [status, search, date]);

  useEffect(() => {
    if (!open) return;
    void servicesApi
      .list({ per_page: 200 })
      .then((rowsResult) => {
        const scoped =
          user?.role === "branch_manager"
            ? rowsResult.filter((item) => item.branch_id === user.branch_id)
            : rowsResult;
        setServices(scoped);
      })
      .catch(() => setServices([]));
  }, [open, user?.role, user?.branch_id]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!serviceBoxRef.current?.contains(event.target as Node)) {
        setServiceOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filteredServices = useMemo(() => {
    const term = serviceSearch.trim().toLowerCase();
    return services.filter((service) => {
      if (selectedServices.some((row) => row.id === service.id)) return false;
      if (!term) return true;
      const haystack = `${getServiceCategory(service)} ${getServiceLabel(service)}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [services, serviceSearch, selectedServices]);

  const addService = (service: ServiceItem) => {
    setSelectedServices((prev) => {
      if (prev.some((row) => row.id === service.id)) return prev;
      const next = [...prev, service];
      const total = next.reduce((sum, row) => sum + Number(row.price || 0), 0);
      setForm((formPrev) => ({ ...formPrev, total_price: String(total) }));
      return next;
    });
    setServiceSearch("");
    setServiceOpen(true);
  };

  const removeService = (id: number) => {
    setSelectedServices((prev) => {
      const next = prev.filter((row) => row.id !== id);
      const total = next.reduce((sum, row) => sum + Number(row.price || 0), 0);
      setForm((formPrev) => ({ ...formPrev, total_price: next.length ? String(total) : "" }));
      return next;
    });
  };

  const resetCreateForm = () => {
    setForm(defaultForm);
    setSelectedServices([]);
    setServiceSearch("");
    setServiceOpen(false);
  };

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * perPage, page * perPage),
    [rows, page, perPage]
  );

  const totals = {
    total: rows.length,
    confirmed: rows.filter((row) => row.status === "Confirmed").length,
    pending: rows.filter((row) => row.status === "Pending").length,
    cancelled: rows.filter((row) => row.status === "Cancelled").length
  };

  const createBooking = async (event: FormEvent) => {
    event.preventDefault();
    if (!selectedServices.length) {
      toast.error("Please select at least one service");
      return;
    }
    setSavingBooking(true);
    try {
      await bookingsApi.createByAdmin({
        name: form.name,
        email: form.email,
        phone: form.phone,
        date: form.date,
        start_time: form.start_time,
        end_time: form.end_time,
        services: selectedServices.map((row) => getServiceLabel(row)).join(", "),
        total_price: Number(form.total_price || 0),
        notes: form.notes,
        duration: 60,
        time: form.start_time
      });
      toast.success("Booking created");
      setOpen(false);
      resetCreateForm();
      await load();
    } catch {
      toast.error("Unable to create booking");
    } finally {
      setSavingBooking(false);
    }
  };

  const appendRealtimeBooking = useCallback(
    (booking: BookingItem) => {
      if (user?.role === "branch_manager" && booking.branch_id !== user.branch_id) return;
      if (status !== "all" && booking.status !== status) return;
      if (date && booking.date !== date) return;
      if (search.trim()) {
        const term = search.toLowerCase();
        const haystack = `${booking.name} ${booking.services ?? ""} ${booking.phone}`.toLowerCase();
        if (!haystack.includes(term)) return;
      }
      setRows((prev) => {
        if (prev.some((row) => row.id === booking.id)) return prev;
        return [booking, ...prev];
      });
    },
    [user?.role, user?.branch_id, status, date, search]
  );

  useBookingRealtime({
    token,
    role: user?.role,
    branchId: user?.branch_id,
    onBookingCreated: appendRealtimeBooking
  });

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Bookings</h2>
        {(user?.role === "admin" || user?.role === "branch_manager") && (
          <button
            className="btn-primary"
            onClick={() => {
              resetCreateForm();
              setOpen(true);
            }}
          >
            + Add Booking
          </button>
        )}
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Total Bookings" value={totals.total} />
        <StatCard label="Confirmed" value={totals.confirmed} />
        <StatCard label="Pending" value={totals.pending} />
        <StatCard label="Cancelled" value={totals.cancelled} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="field"
          placeholder="Search booking"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex justify-end">
        <select className="field max-w-28" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
          <option value={5}>5</option>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>

      {loading ? (
        <SkeletonRows rows={7} />
      ) : rows.length ? (
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="p-2">#</th>
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Date</th>
                <th className="p-2">Start</th>
                <th className="p-2">End</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{(page - 1) * perPage + index + 1}</td>
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.phone}</td>
                  <td className="p-2">{row.email}</td>
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.start_time}</td>
                  <td className="p-2">{row.end_time}</td>
                  <td className="p-2">
                    <span className="rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700">{row.status ?? "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border p-4 text-sm text-slate-500">No bookings found.</div>
      )}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, rows.length)} of {rows.length}
          </p>
          <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
        </div>
      )}

      <Modal
        title="Create Booking"
        open={open}
        onClose={() => {
          setOpen(false);
          resetCreateForm();
        }}
      >
        <form className="grid grid-cols-2 gap-3" onSubmit={(e) => void createBooking(e)}>
          <div>
            <label className="field-label">Name</label>
            <input className="field" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Phone</label>
            <input className="field" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Email</label>
            <input className="field" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Date</label>
            <input className="field" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Start Time</label>
            <input className="field" type="time" value={form.start_time} onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">End Time</label>
            <input className="field" type="time" value={form.end_time} onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))} />
          </div>

          <div className="col-span-2" ref={serviceBoxRef}>
            <label className="field-label">Services</label>
            <div className="relative">
              <input
                className="field"
                value={serviceSearch}
                placeholder="Search & add services…"
                autoComplete="off"
                onFocus={() => setServiceOpen(true)}
                onChange={(e) => {
                  setServiceSearch(e.target.value);
                  setServiceOpen(true);
                }}
              />
              {serviceOpen ? (
                <div className="absolute z-20 mt-1 max-h-44 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                  {filteredServices.length ? (
                    filteredServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                        onClick={() => addService(service)}
                      >
                        <span>
                          {getServiceLabel(service)}
                          {getServiceCategory(service) ? ` (${getServiceCategory(service)})` : ""}
                        </span>
                        <span className="text-xs text-slate-500">${Number(service.price || 0).toFixed(2)}</span>
                      </button>
                    ))
                  ) : (
                    <p className="px-3 py-3 text-sm text-slate-500">No service found</p>
                  )}
                </div>
              ) : null}
            </div>
            {selectedServices.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedServices.map((service) => (
                  <button
                    key={service.id}
                    type="button"
                    className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200"
                    onClick={() => removeService(service.id)}
                    title="Remove"
                  >
                    {getServiceLabel(service)} ×
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <div className="col-span-2">
            <label className="field-label">Total Price</label>
            <input
              className="field"
              value={form.total_price}
              onChange={(e) => setForm((prev) => ({ ...prev, total_price: e.target.value }))}
            />
          </div>
          <div className="col-span-2">
            <label className="field-label">Notes</label>
            <textarea
              className="field min-h-24"
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
            />
          </div>
          <button
            className="col-span-2 rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60"
            disabled={savingBooking}
          >
            {savingBooking ? (
              <span className="inline-flex items-center gap-2">
                <span className="btn-spinner" /> Saving...
              </span>
            ) : (
              "Save Booking"
            )}
          </button>
        </form>
      </Modal>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border bg-slate-50 p-3 text-center">
      <p className="text-sm text-slate-600">{label}</p>
      <p className="text-3xl font-bold text-slate-800">{value}</p>
    </div>
  );
}
