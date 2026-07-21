import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { bookingsApi } from "../api/bookingsApi";
import { branchesApi, formatBranchLabel } from "../api/branchesApi";
import { servicesApi } from "../api/servicesApi";
import { Skeleton } from "../components/Skeleton";
import { useAuthStore } from "../store/authStore";
import type { BookingItem, BranchItem, ServiceItem } from "../types";
import { getBookingServicesText, resolveSelectedServices, toTimeInputValue } from "../utils/bookingHelpers";
import { getServiceCategory, getServiceLabel } from "../utils/serviceLabels";

export default function EditBookingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const bookingFromList = (location.state as { booking?: BookingItem } | null)?.booking;
  const { id } = useParams();
  const bookingId = Number(id);
  const user = useAuthStore((s) => s.user);
  const serviceBoxRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState<BookingItem | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState("Pending");
  const [totalPrice, setTotalPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedServices, setSelectedServices] = useState<ServiceItem[]>([]);
  const [originalServicesText, setOriginalServicesText] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [serviceOpen, setServiceOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(bookingId)) {
      toast.error("Invalid booking");
      navigate("/bookings");
      return;
    }

    setLoading(true);
    Promise.all([
      bookingsApi.show(bookingId),
      branchesApi.list({ per_page: 100 }),
      servicesApi.list({ per_page: 200 })
    ])
      .then(([bookingRow, branchRows, serviceRows]) => {
        const mergedBooking = bookingFromList
          ? {
              ...bookingRow,
              ...bookingFromList,
              services: getBookingServicesText(bookingFromList) || bookingRow.services,
              total_price: bookingFromList.total_price ?? bookingRow.total_price,
              notes: bookingFromList.notes ?? bookingRow.notes
            }
          : bookingRow;

        if (user?.role === "branch_manager" && mergedBooking.branch_id !== user.branch_id) {
          toast.error("You cannot edit this booking");
          navigate("/bookings");
          return;
        }

        const scopedBranches =
          user?.role === "branch_manager" && user.branch_id != null
            ? branchRows.filter((item) => item.id === user.branch_id)
            : branchRows;
        const scopedServices =
          user?.role === "branch_manager"
            ? serviceRows.filter((item) => item.branch_id === user.branch_id)
            : serviceRows;

        const bookingServicesText = getBookingServicesText(mergedBooking);

        setBooking(mergedBooking);
        setBranches(scopedBranches);
        setServices(scopedServices);
        setSelectedBranchId(mergedBooking.branch_id ?? user?.branch_id ?? "");
        setCustomerName(mergedBooking.name ?? "");
        setCustomerPhone(mergedBooking.phone ?? "");
        setCustomerEmail(mergedBooking.email ?? "");
        setDate(mergedBooking.date ?? "");
        setStartTime(toTimeInputValue(mergedBooking.start_time || mergedBooking.time));
        setEndTime(toTimeInputValue(mergedBooking.end_time));
        setStatus(mergedBooking.status ?? "Pending");
        setTotalPrice(mergedBooking.total_price != null ? String(mergedBooking.total_price) : "");
        setNotes(mergedBooking.notes ?? "");
        setOriginalServicesText(bookingServicesText);
        setSelectedServices(resolveSelectedServices(bookingServicesText, scopedServices));
      })
      .catch(() => {
        toast.error("Unable to load booking");
        navigate("/bookings");
      })
      .finally(() => setLoading(false));
  }, [bookingId, bookingFromList, navigate, user?.branch_id, user?.role]);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (!serviceBoxRef.current?.contains(event.target as Node)) {
        setServiceOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const branchOptions = useMemo(() => {
    if (branches.length) return branches;
    if (booking?.branch_id != null) {
      return [{ id: booking.branch_id, name: `Branch ${booking.branch_id}` }];
    }
    return [];
  }, [branches, booking?.branch_id]);

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

  const computedTotal = useMemo(
    () => selectedServices.reduce((sum, row) => sum + Number(row.price || 0), 0),
    [selectedServices]
  );

  const addService = (service: ServiceItem) => {
    setSelectedServices((prev) => {
      if (prev.some((row) => row.id === service.id)) return prev;
      const next = [...prev, service];
      const total = next.reduce((sum, row) => sum + Number(row.price || 0), 0);
      setTotalPrice(String(total));
      return next;
    });
    setServiceSearch("");
    setServiceOpen(false);
  };

  const removeService = (serviceId: number) => {
    setSelectedServices((prev) => {
      const next = prev.filter((row) => row.id !== serviceId);
      const total = next.reduce((sum, row) => sum + Number(row.price || 0), 0);
      setTotalPrice(next.length ? String(total) : "");
      return next;
    });
  };

  const submitBooking = async (e: FormEvent) => {
    e.preventDefault();
    if (!customerName.trim() || !customerPhone.trim()) {
      toast.error("Please enter customer name and phone");
      return;
    }
    if (!selectedServices.length && !originalServicesText.trim()) {
      toast.error("Please select at least one service");
      return;
    }
    if (!date || !startTime || !endTime) {
      toast.error("Please select date and time");
      return;
    }

    setSubmitting(true);
    try {
      await bookingsApi.updateByAdmin(bookingId, {
        name: customerName.trim(),
        email: customerEmail.trim(),
        phone: customerPhone.trim(),
        date,
        start_time: startTime,
        end_time: endTime,
        time: startTime,
        services: selectedServices.length
          ? selectedServices.map((row) => getServiceLabel(row)).join(", ")
          : originalServicesText,
        total_price: Number(totalPrice || computedTotal || 0),
        notes: notes.trim(),
        status,
        branch_id: selectedBranchId || booking?.branch_id || user?.branch_id || undefined
      });
      toast.success("Booking updated");
      navigate("/bookings");
    } catch {
      toast.error("Unable to update booking");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="panel mx-auto max-w-3xl space-y-4 p-5">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="panel mx-auto max-w-3xl p-5">
      <h2 className="panel-title mb-5">Edit Booking</h2>

      <form className="space-y-4" onSubmit={(e) => void submitBooking(e)}>
        {branchOptions.length > 0 ? (
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
              }}
              disabled={user?.role === "branch_manager"}
            >
              {branchOptions.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {formatBranchLabel(branch)}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="name">
              Name
            </label>
            <input
              id="name"
              className="field"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
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
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
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
            />
          </div>
          <div>
            <label className="field-label" htmlFor="date">
              Date
            </label>
            <input
              id="date"
              type="date"
              className="field"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="field-label" htmlFor="start-time">
              Start Time
            </label>
            <input
              id="start-time"
              type="time"
              className="field"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="end-time">
              End Time
            </label>
            <input
              id="end-time"
              type="time"
              className="field"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="field-label" htmlFor="status">
              Status
            </label>
            <select id="status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
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
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Selected services</p>
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
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">No service added yet.</p>
          )}
        </div>

        <div>
          <label className="field-label" htmlFor="total-price">
            Total Price
          </label>
          <input
            id="total-price"
            className="field"
            value={totalPrice}
            onChange={(e) => setTotalPrice(e.target.value)}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="notes">
            Notes
          </label>
          <textarea
            id="notes"
            className="field min-h-24"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="submit" className="btn-primary" disabled={submitting}>
            {submitting ? "Updating..." : "Update Booking"}
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
