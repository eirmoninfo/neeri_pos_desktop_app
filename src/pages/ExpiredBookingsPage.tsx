import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { bookingsApi } from "../api/bookingsApi";
import type { BookingItem } from "../types";
import { useAuthStore } from "../store/authStore";
import Pagination from "../components/Pagination";
import { SkeletonRows } from "../components/Skeleton";

export default function ExpiredBookingsPage() {
  const user = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<BookingItem[]>([]);
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const load = async () => {
    setLoading(true);
    const result = await bookingsApi.expired({ status, search, date, source });
    const branchRows =
      user?.role === "branch_manager" ? result.filter((item) => item.branch_id === user.branch_id) : result;
    setRows(branchRows);
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
  }, [status, source, search, date, perPage]);

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load expired bookings"));
  }, [status, source, search, date]);

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const paginatedRows = useMemo(
    () => rows.slice((page - 1) * perPage, page * perPage),
    [rows, page, perPage]
  );

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Expired Booking</h2>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <select className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">All Status</option>
          <option value="Confirmed">Confirmed</option>
          <option value="Pending">Pending</option>
          <option value="Cancelled">Cancelled</option>
        </select>
        <select className="field" value={source} onChange={(e) => setSource(e.target.value)}>
          <option value="all">All Bookings</option>
          <option value="admin">Admin Bookings</option>
          <option value="online">Online Bookings</option>
        </select>
        <input className="field" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <input
          className="field"
          placeholder="Search name, phone, notes"
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
                <th className="p-2">Service</th>
                <th className="p-2">Notes</th>
                <th className="p-2">Date</th>
                <th className="p-2">Time</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {paginatedRows.map((row, index) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{(page - 1) * perPage + index + 1}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span>{row.name}</span>
                      {row.is_admin_booking ? (
                        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                          Admin
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="p-2">{row.phone}</td>
                  <td className="p-2">{row.services || ""}</td>
                  <td className="p-2 max-w-[220px]">
                    <p className="truncate" title={row.notes || ""}>
                      {row.notes || ""}
                    </p>
                  </td>
                  <td className="p-2">{row.date}</td>
                  <td className="p-2">{row.start_time || row.time || ""}</td>
                  <td className="p-2">
                    <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">{row.status ?? "-"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border p-4 text-sm text-slate-500">No expired bookings found.</div>
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
