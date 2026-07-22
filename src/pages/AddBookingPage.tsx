import { useEffect, useMemo, useState, type FormEvent } from "react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/bookingsApi";
import { branchesApi, formatBranchLabel } from "../api/branchesApi";
import { useAuthStore } from "../store/authStore";
import type { BranchItem } from "../types";

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

const DEFAULT_DURATION = 30;

function todayISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Melbourne",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
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
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "">(user?.branch_id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
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

    if (user?.branch_id != null) {
      return [
        {
          id: user.branch_id,
          name: user.branch?.name || user.branch_name || `Branch ${user.branch_id}`
        }
      ];
    }

    return [];
  }, [branches, user?.branch_id, user?.branch?.name, user?.branch_name]);

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
    if (!date || !time) {
      toast.error("Please select date and time");
      return;
    }

    setSubmitting(true);
    try {
      const start = time;
      const end = addMinutesToTime(time, DEFAULT_DURATION);
      await bookingsApi.createByAdmin({
        name: customerName.trim(),
        phone: customerPhone.trim(),
        date,
        time: start,
        start_time: start,
        end_time: end,
        duration: DEFAULT_DURATION,
        total_price: 0,
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
