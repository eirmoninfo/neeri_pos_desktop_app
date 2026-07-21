import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Link, useNavigate } from "react-router-dom";
import { bookingsApi } from "../api/bookingsApi";
import type { BookingItem } from "../types";
import { useAuthStore } from "../store/authStore";
import Pagination from "../components/Pagination";
import { SkeletonRows } from "../components/Skeleton";
import { useBookingRealtime } from "../realtime/useBookingRealtime";

export default function BookingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

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

  const canManage = user?.role === "admin" || user?.role === "branch_manager";

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Bookings</h2>
        {canManage && (
          <Link to="/add-booking" className="btn-primary">
            + Add Booking
          </Link>
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
                {canManage && <th className="p-2">Action</th>}
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
                  {canManage && (
                    <td className="p-2">
                      <button
                        className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-600"
                        onClick={() => navigate(`/bookings/edit/${row.id}`, { state: { booking: row } })}
                      >
                        Edit
                      </button>
                    </td>
                  )}
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
