import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { leavesApi } from "../api/leavesApi";
import { usersApi } from "../api/usersApi";
import { useAuthStore } from "../store/authStore";
import type { AssignedUser, LeaveItem } from "../types";

export default function LeavesPage() {
  const currentUser = useAuthStore((s) => s.user);
  const [rows, setRows] = useState<LeaveItem[]>([]);
  const [users, setUsers] = useState<AssignedUser[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ user_id: "", date: "" });
  const [savingLeave, setSavingLeave] = useState(false);

  const load = async () => {
    const result = await leavesApi.list({ search, page, per_page: perPage });
    setRows(result.items);
    setTotal(result.meta.total);
    setLastPage(result.meta.lastPage);
  };

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load leaves"));
  }, [search, page, perPage]);

  useEffect(() => {
    void usersApi
      .list({ page: 1, per_page: 200 })
      .then((result) => {
        const filtered =
          currentUser?.role === "branch_manager"
            ? result.items.filter((item) => item.branch_id === currentUser.branch_id)
            : result.items;
        setUsers(filtered);
      })
      .catch(() => toast.error("Unable to load users"));
  }, [currentUser?.role, currentUser?.branch_id]);

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Leaves</h2>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add Leave
        </button>
      </div>
      <div className="flex gap-3">
        <input className="field" placeholder="Search leaves" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="field max-w-28" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
      <div className="table-wrap">
        <table className="w-full text-sm">
          <thead>
            <tr className="table-head">
              <th className="p-2">User ID</th>
              <th className="p-2">Date</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.user_id}</td>
                <td className="p-2">{row.date}</td>
                <td className="p-2">
                  <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void leavesApi.remove(row.id).then(load)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total || rows.length)} of {total || rows.length}
        </p>
        <Pagination page={page} totalPages={Math.max(1, lastPage)} onPageChange={setPage} />
      </div>
      <Modal title="Create Leave" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.user_id) {
              toast.error("Please select a user");
              return;
            }
            setSavingLeave(true);
            void leavesApi
              .create({ user_id: Number(form.user_id), date: form.date })
              .then(async () => {
                toast.success("Leave created");
                setOpen(false);
                await load();
              })
              .catch(() => toast.error("Unable to create leave"))
              .finally(() => setSavingLeave(false));
          }}
        >
          <div>
            <label className="field-label">Select User</label>
            <select className="field" value={form.user_id} onChange={(e) => setForm((prev) => ({ ...prev, user_id: e.target.value }))}>
              <option value="">Select a user</option>
              {users.map((user) => (
                <option key={user.id} value={String(user.id)}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>
          </div>
          <div><label className="field-label">Date</label><input className="field" type="date" value={form.date} onChange={(e) => setForm((prev) => ({ ...prev, date: e.target.value }))} /></div>
          <button className="btn-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingLeave}>
            {savingLeave ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Leave"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
