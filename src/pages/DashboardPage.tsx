import { useEffect, useState } from "react";
import { FiBarChart2, FiCalendar, FiRefreshCw, FiUsers } from "react-icons/fi";
import { dashboardApi } from "../api/dashboardApi";
import type { AnalyticsData, DashboardData } from "../types";
import { Skeleton, SkeletonCard } from "../components/Skeleton";

type UpdateStage = "idle" | "checking" | "available" | "downloading" | "downloaded" | "up-to-date" | "error" | "disabled";

interface UpdateStatusView {
  stage: UpdateStage;
  message: string;
  progressPercent?: number;
  updatedAt: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 0
  }).format(value);
}

function friendlyUpdateMessage(raw: string, stage: UpdateStage): string {
  const text = raw.trim();
  if (!text) return "No update status available.";

  const lower = text.toLowerCase();
  if (stage === "error" || lower.includes("404") || lower.includes("authentication token")) {
    if (lower.includes("404") || lower.includes("releases.atom") || lower.includes("authentication token")) {
      return "Could not reach the update feed. The GitHub release repo may be private, missing, or the GH_TOKEN may be invalid. Publish a release and ensure GH_TOKEN has repo access.";
    }
    if (lower.includes("403") || lower.includes("rate limit")) {
      return "Update check was blocked by GitHub. Wait a moment or verify GH_TOKEN permissions.";
    }
    // Strip raw HTTP/header dumps for the dashboard
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

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatusView | null>(null);
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => {
    void Promise.allSettled([dashboardApi.getDashboard(), dashboardApi.getAnalytics()])
      .then((results) => {
        const dashboardResult = results[0];
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value);
        }

        const analyticsResult = results[1];
        if (analyticsResult.status === "fulfilled") {
          setAnalytics(analyticsResult.value);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !window.desktopApi?.getUpdateStatus) return;

    let active = true;
    const pullStatus = async () => {
      try {
        const result = await window.desktopApi.getUpdateStatus();
        if (active) setUpdateStatus(result);
      } catch {
        // keep existing dashboard experience if updater status is unavailable
      }
    };

    void pullStatus();
    const timer = window.setInterval(() => {
      void pullStatus();
    }, 3000);

    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

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
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="panel space-y-3 p-5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-56" />
        </div>
      </div>
    );
  }

  const dataPoints = analytics?.daily_sales?.length ?? 0;
  const latestSale = analytics?.daily_sales?.[analytics.daily_sales.length - 1];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="panel-title">Dashboard</h2>
        <p className="text-sm text-slate-500">Quick overview of bookings, customers and sales.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Bookings"
          value={String(dashboard?.total_bookings ?? 0)}
          hint="Total bookings"
          icon={FiCalendar}
          accent="bg-[#5f4d40]/10 text-[#5f4d40]"
        />
        <StatCard
          title="Customers"
          value={String(dashboard?.total_customers ?? 0)}
          hint="Registered clients"
          icon={FiUsers}
          accent="bg-sky-100 text-sky-700"
        />
        <StatCard
          title="Revenue"
          value={formatCurrency(dashboard?.revenue ?? 0)}
          hint="Reported sales"
          icon={FiBarChart2}
          accent="bg-emerald-100 text-emerald-700"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Analytics</h3>
              <p className="mt-1 text-sm text-slate-500">Sales trend snapshot from the backend.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {dataPoints} data points
            </span>
          </div>
          {dataPoints === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
              No analytics data yet. Sales appear here once invoices are recorded.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest day</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{latestSale?.date ?? "-"}</p>
              </div>
              <div className="rounded-lg bg-slate-50 px-3 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Latest amount</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {formatCurrency(latestSale?.amount ?? 0)}
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="panel p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Auto Update Status</h3>
              <p className="mt-1 text-sm text-slate-500">Desktop app update checks from GitHub Releases.</p>
            </div>
            {typeof window !== "undefined" && window.desktopApi ? (
              <button
                type="button"
                onClick={() => void handleRetryUpdate()}
                disabled={checkingUpdate}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <FiRefreshCw className={checkingUpdate ? "animate-spin" : ""} />
                Retry
              </button>
            ) : null}
          </div>

          {updateStatus ? (
            <div className="mt-4 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${stageTone(updateStatus.stage)}`}>
                  {stageLabel(updateStatus.stage)}
                </span>
                <span className="text-xs text-slate-500">
                  Updated {new Date(updateStatus.updatedAt).toLocaleTimeString()}
                </span>
              </div>
              <p className="text-sm leading-relaxed text-slate-700">
                {friendlyUpdateMessage(updateStatus.message, updateStatus.stage)}
              </p>
              {typeof updateStatus.progressPercent === "number" ? (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-slate-500">
                    <span>Download progress</span>
                    <span>{Math.round(updateStatus.progressPercent)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-[#5f4d40] transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, updateStatus.progressPercent))}%` }}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Updater status not available yet.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  hint,
  icon: Icon,
  accent
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof FiCalendar;
  accent: string;
}) {
  return (
    <div className="panel flex items-start gap-4 p-5">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="text-lg" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="mt-0.5 truncate text-2xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400">{hint}</p>
      </div>
    </div>
  );
}
