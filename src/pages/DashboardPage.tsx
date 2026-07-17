import { useEffect, useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiChevronDown,
  FiDollarSign,
  FiRefreshCw,
  FiScissors
} from "react-icons/fi";
import { bookingsApi } from "../api/bookingsApi";
import { branchesApi } from "../api/branchesApi";
import { dashboardApi } from "../api/dashboardApi";
import { Skeleton, SkeletonCard } from "../components/Skeleton";
import { useAuthStore } from "../store/authStore";
import type { BookingItem, BranchItem, DashboardData } from "../types";

type UpdateStage =
  | "idle"
  | "checking"
  | "available"
  | "downloading"
  | "downloaded"
  | "up-to-date"
  | "error"
  | "disabled";

interface UpdateStatusView {
  stage: UpdateStage;
  message: string;
  progressPercent?: number;
  updatedAt: number;
}

type CalendarValue = Date | null;

function todayISO(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toDateKey(value: string | Date) {
  if (value instanceof Date) return todayISO(value);
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  return todayISO(parsed);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "AUD",
    maximumFractionDigits: 2
  }).format(value);
}

function formatDisplayDate(iso: string) {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatTimeLabel(value?: string) {
  const raw = String(value ?? "").trim();
  if (!raw) return "—";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  let hours = Number(match[1]);
  const mins = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${String(hours).padStart(2, "0")}:${mins} ${suffix}`;
}

function friendlyUpdateMessage(raw: string, stage: UpdateStage): string {
  const text = raw.trim();
  if (!text) return "No update status available.";
  const lower = text.toLowerCase();
  if (stage === "error" || lower.includes("404") || lower.includes("authentication token")) {
    if (lower.includes("404") || lower.includes("releases.atom") || lower.includes("authentication token")) {
      return "Could not reach the update feed. Publish a release and ensure GH_TOKEN has repo access.";
    }
    if (lower.includes("403") || lower.includes("rate limit")) {
      return "Update check was blocked by GitHub. Verify GH_TOKEN permissions.";
    }
    const firstLine = text.split(/\n|\r/)[0]?.trim() ?? text;
    return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
  }
  return text;
}

function stageLabel(stage: UpdateStage) {
  switch (stage) {
    case "checking":
      return "Checking";
    case "available":
      return "Update available";
    case "downloading":
      return "Downloading";
    case "downloaded":
      return "Ready to install";
    case "up-to-date":
      return "Up to date";
    case "error":
      return "Error";
    case "disabled":
      return "Disabled";
    default:
      return "Idle";
  }
}

function stageTone(stage: UpdateStage) {
  switch (stage) {
    case "error":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "up-to-date":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "downloading":
    case "available":
    case "downloaded":
      return "bg-amber-50 text-amber-800 border-amber-200";
    case "checking":
      return "bg-sky-50 text-sky-700 border-sky-200";
    default:
      return "bg-slate-50 text-slate-600 border-slate-200";
  }
}

const SERVICE_BAR_COLORS = ["#6366f1", "#14b8a6", "#f97316", "#ec4899", "#38bdf8"];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [branches, setBranches] = useState<BranchItem[]>([]);
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [selectedBranchId, setSelectedBranchId] = useState<number | "all">("all");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusView | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    void Promise.allSettled([
      dashboardApi.getDashboard(),
      bookingsApi.list({ per_page: 500, status: "all" }),
      branchesApi.list({ per_page: 100 })
    ])
      .then((results) => {
        if (results[0].status === "fulfilled") setDashboard(results[0].value);
        if (results[1].status === "fulfilled") {
          const rows = results[1].value;
          const scoped =
            user?.role === "branch_manager" && user.branch_id != null
              ? rows.filter((item) => item.branch_id === user.branch_id)
              : rows;
          setBookings(scoped);
        }
        if (results[2].status === "fulfilled") {
          const rows = results[2].value;
          const scoped =
            user?.role === "branch_manager" && user.branch_id != null
              ? rows.filter((item) => item.id === user.branch_id)
              : rows;
          setBranches(scoped);
          if (user?.role === "branch_manager" && user.branch_id != null) {
            setSelectedBranchId(user.branch_id);
          }
        }
      })
      .finally(() => setLoading(false));
  }, [user?.role, user?.branch_id]);

  useEffect(() => {
    if (typeof window === "undefined" || !window.desktopApi?.getUpdateStatus) return;
    let active = true;
    const pullStatus = async () => {
      try {
        const result = await window.desktopApi.getUpdateStatus();
        if (active) setUpdateStatus(result);
      } catch {
        // ignore
      }
    };
    void pullStatus();
    const timer = window.setInterval(() => void pullStatus(), 3000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const branchFiltered = useMemo(() => {
    if (selectedBranchId === "all") return bookings;
    return bookings.filter((row) => row.branch_id === selectedBranchId);
  }, [bookings, selectedBranchId]);

  const todayKey = todayISO();
  const monthPrefix = todayKey.slice(0, 7);

  const todayCount = useMemo(
    () => branchFiltered.filter((row) => toDateKey(row.date) === todayKey).length,
    [branchFiltered, todayKey]
  );

  const monthlyCount = useMemo(
    () => branchFiltered.filter((row) => toDateKey(row.date).startsWith(monthPrefix)).length,
    [branchFiltered, monthPrefix]
  );

  const monthlyAmount = useMemo(() => {
    const fromBookings = branchFiltered
      .filter((row) => toDateKey(row.date).startsWith(monthPrefix))
      .reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    if (fromBookings > 0) return fromBookings;
    return Number(dashboard?.revenue ?? 0);
  }, [branchFiltered, monthPrefix, dashboard?.revenue]);

  const datesWithBookings = useMemo(() => {
    const set = new Set<string>();
    branchFiltered.forEach((row) => set.add(toDateKey(row.date)));
    return set;
  }, [branchFiltered]);

  const upcoming = useMemo(() => {
    return branchFiltered
      .filter((row) => toDateKey(row.date) === selectedDate)
      .sort((a, b) => String(a.start_time || a.time || "").localeCompare(String(b.start_time || b.time || "")));
  }, [branchFiltered, selectedDate]);

  const popularServices = useMemo(() => {
    const counts = new Map<string, number>();
    branchFiltered
      .filter((row) => toDateKey(row.date).startsWith(monthPrefix))
      .forEach((row) => {
        const parts = String(row.services || "")
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
        if (!parts.length) {
          counts.set("Unspecified", (counts.get("Unspecified") ?? 0) + 1);
          return;
        }
        parts.forEach((name) => counts.set(name, (counts.get(name) ?? 0) + 1));
      });
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [branchFiltered, monthPrefix]);

  const maxPopular = Math.max(1, ...popularServices.map((row) => row.count));

  const handleRetryUpdate = async () => {
    if (!window.desktopApi?.checkForUpdates) return;
    setCheckingUpdate(true);
    try {
      await window.desktopApi.checkForUpdates();
      const result = await window.desktopApi.getUpdateStatus();
      setUpdateStatus(result);
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Skeleton className="h-80 w-full rounded-[1.25rem]" />
          <Skeleton className="h-80 w-full rounded-[1.25rem]" />
          <Skeleton className="h-80 w-full rounded-[1.25rem]" />
        </div>
      </div>
    );
  }

  const calendarValue = new Date(`${selectedDate}T12:00:00`);
  const showAllChip = user?.role !== "branch_manager" || user.branch_id == null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {showAllChip ? (
          <button
            type="button"
            onClick={() => setSelectedBranchId("all")}
            className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              selectedBranchId === "all"
                ? "bg-[#dbeafe] text-[#2563eb] ring-1 ring-[#93c5fd]"
                : "bg-white text-[#6b7280] ring-1 ring-[#e5e7eb] hover:bg-[#f9fafb]"
            }`}
          >
            All
          </button>
        ) : null}
        {branches.map((branch) => (
          <button
            key={branch.id}
            type="button"
            onClick={() => setSelectedBranchId(branch.id)}
            className={`rounded-full px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition ${
              selectedBranchId === branch.id
                ? "bg-[#dbeafe] text-[#2563eb] ring-1 ring-[#93c5fd]"
                : "bg-white text-[#6b7280] ring-1 ring-[#e5e7eb] hover:bg-[#f9fafb]"
            }`}
          >
            {branch.name}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard
          title="Today Bookings"
          value={String(todayCount)}
          iconTone="text-[#3b82f6] bg-[#eff6ff]"
          waveColor="#60a5fa"
          icon={FiCalendar}
        />
        <SummaryCard
          title="Monthly Bookings"
          value={String(monthlyCount || dashboard?.total_bookings || 0)}
          iconTone="text-[#7c3aed] bg-[#f5f3ff]"
          waveColor="#a78bfa"
          icon={FiCalendar}
        />
        <SummaryCard
          title="Total Monthly Amount"
          value={formatCurrency(monthlyAmount)}
          iconTone="text-[#059669] bg-[#ecfdf5]"
          waveColor="#34d399"
          icon={FiDollarSign}
        />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-3">
        <div className="panel booking-calendar flex flex-col p-5">
          <div className="mb-2 flex items-center justify-end">
            <button
              type="button"
              className="rounded-lg border border-[#e5e7eb] bg-white px-3 py-1 text-xs font-semibold text-[#4b5563] hover:bg-[#f9fafb]"
              onClick={() => setSelectedDate(todayISO())}
            >
              Today
            </button>
          </div>
          <Calendar
            value={calendarValue}
            onChange={(value) => {
              const next = (Array.isArray(value) ? value[0] : value) as CalendarValue;
              if (next) setSelectedDate(todayISO(next));
            }}
            tileClassName={({ date, view }) => {
              if (view !== "month") return null;
              return datesWithBookings.has(todayISO(date)) ? "has-bookings" : null;
            }}
          />
          <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-[#f3f4f6] pt-4 text-xs text-[#6b7280]">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /> Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#8b5cf6]" /> Has bookings
            </span>
          </div>
        </div>

        <div className="panel relative flex h-[420px] overflow-y-auto flex-col p-5">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff6ff] text-[#3b82f6]">
                <FiCalendar />
              </span>
              <div>
                <h3 className="text-base font-semibold text-[#111827]">Upcoming Bookings</h3>
                <p className="text-xs text-[#6b7280]">{formatDisplayDate(selectedDate)}</p>
              </div>
            </div>
            <Link to="/bookings" className="text-xs font-semibold text-[#3b82f6] hover:underline">
              View all
            </Link>
          </div>

          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto pr-1">
            {upcoming.length ? (
              upcoming.map((booking) => (
                <div
                  key={booking.id}
                  className="rounded-2xl border border-[#eef2f7] bg-[#f8fafc] px-3.5 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#2563eb]">
                        {formatTimeLabel(booking.start_time || booking.time)}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-semibold text-[#111827]">{booking.name}</p>
                      <p className="mt-0.5 truncate text-xs text-[#6b7280]">
                        {booking.services || "Service TBA"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-[#dbeafe] px-2.5 py-1 text-[10px] font-bold text-[#1d4ed8]">
                      {booking.status || "Confirmed"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-3 py-10 text-center text-sm text-[#9ca3af]">
                No bookings for this date.
              </p>
            )}
          </div>

          {upcoming.length > 3 ? (
            <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <span className="inline-flex items-center gap-1 rounded-full bg-white/95 px-3 py-1 text-[11px] font-semibold text-[#6b7280] shadow-md ring-1 ring-[#e5e7eb]">
                Scroll for more <FiChevronDown />
              </span>
            </div>
          ) : null}
        </div>

        <div className="panel flex min-h-[420px] flex-col p-5">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eff6ff] text-[#3b82f6]">
                <FiScissors />
              </span>
              <h3 className="text-base font-semibold text-[#111827]">Most Used Services</h3>
            </div>
            <span className="inline-flex items-center gap-1 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#4b5563]">
              This Month <FiChevronDown className="text-xs opacity-70" />
            </span>
          </div>

          {popularServices.length ? (
            <div className="space-y-5">
              {popularServices.map((row, index) => (
                <div key={row.name}>
                  <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
                    <span className="truncate font-medium text-[#111827]">{row.name}</span>
                    <span className="shrink-0 text-xs font-semibold text-[#6b7280]">{row.count} bookings</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#f3f4f6]">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.max(10, (row.count / maxPopular) * 100)}%`,
                        background: SERVICE_BAR_COLORS[index % SERVICE_BAR_COLORS.length]
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-[#e5e7eb] bg-[#f9fafb] px-3 py-10 text-center text-sm text-[#9ca3af]">
              No service usage data this month yet.
            </p>
          )}
        </div>
      </div>

      <div className="panel p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#111827]">Auto Update</h3>
            <p className="truncate text-xs text-[#6b7280]">
              {updateStatus
                ? friendlyUpdateMessage(updateStatus.message, updateStatus.stage)
                : "Updater status not available yet."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {updateStatus ? (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${stageTone(updateStatus.stage)}`}>
                {stageLabel(updateStatus.stage)}
              </span>
            ) : null}
            {typeof window !== "undefined" && window.desktopApi ? (
              <button
                type="button"
                onClick={() => void handleRetryUpdate()}
                disabled={checkingUpdate}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5e7eb] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#4b5563] hover:bg-[#f9fafb] disabled:opacity-60"
              >
                <FiRefreshCw className={checkingUpdate ? "animate-spin" : ""} />
                Retry
              </button>
            ) : null}
          </div>
        </div>
        {typeof updateStatus?.progressPercent === "number" ? (
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-[10px] text-[#6b7280]">
              <span>Download</span>
              <span>{Math.round(updateStatus.progressPercent)}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#f3f4f6]">
              <div
                className="h-full rounded-full bg-[#c9a227] transition-all"
                style={{ width: `${Math.max(0, Math.min(100, updateStatus.progressPercent))}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  iconTone,
  waveColor
}: {
  title: string;
  value: string;
  icon: typeof FiCalendar;
  iconTone: string;
  waveColor: string;
}) {
  return (
    <div className="panel overflow-hidden">
      <div className="flex items-start gap-3 p-5 pb-3">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
          <Icon className="text-lg" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-[#6b7280]">{title}</p>
          <p className="mt-1 truncate text-3xl font-bold tracking-tight text-[#111827]">{value}</p>
        </div>
      </div>
      <svg className="h-8 w-full" viewBox="0 0 400 40" preserveAspectRatio="none" aria-hidden>
        <path
          d="M0 24 C60 8, 100 36, 160 20 C220 4, 280 32, 340 16 C370 8, 390 18, 400 14 L400 40 L0 40 Z"
          fill={waveColor}
          opacity="0.35"
        />
        <path
          d="M0 28 C70 14, 110 34, 170 22 C230 10, 290 30, 350 18 C375 12, 390 20, 400 18"
          fill="none"
          stroke={waveColor}
          strokeWidth="3"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
