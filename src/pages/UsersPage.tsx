import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { useAuthStore } from "../store/authStore";
import { usersApi } from "../api/usersApi";
import type { AssignedUser } from "../types";

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user);
  const canAdd = currentUser?.role === "admin" || currentUser?.role === "manager" || currentUser?.role === "branch_manager";
  const [rows, setRows] = useState<AssignedUser[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [open, setOpen] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    is_available: true
  });

  useEffect(() => {
    void usersApi
      .list({ page: 1, per_page: 100 })
      .then((result) => {
        const filtered =
          currentUser?.role === "branch_manager"
            ? result.items.filter((item) => item.branch_id === currentUser.branch_id)
            : result.items;
        setRows(filtered);
      })
      .catch(() => {
        toast.error("Unable to load users");
      });
  }, [currentUser?.role, currentUser?.branch_id]);

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const paginatedUsers = useMemo(
    () => rows.slice((page - 1) * perPage, (page - 1) * perPage + perPage),
    [rows, page, perPage]
  );

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div>
          <h2 className="panel-title">Users</h2>
          <p className="text-sm text-slate-500">Manage staff users for your branch.</p>
        </div>
        <div className="flex gap-2">
          <select className="field" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
          {canAdd && (
            <button className="btn-primary" onClick={() => setOpen(true)}>
              + Add User
            </button>
          )}
        </div>
      </div>

      {rows.length > 0 ? (
        <>
          <div className="table-wrap">
            <table className="w-full text-sm">
              <thead>
                <tr className="table-head">
                  <th className="p-2">Name</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Role</th>
                  <th className="p-2">Availability</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((user) => (
                  <tr key={user.id} className="border-b">
                    <td className="p-2">{user.name}</td>
                    <td className="p-2">{user.email ?? "-"}</td>
                    <td className="p-2 capitalize">{user.role.replace("_", " ")}</td>
                    <td className="p-2">{user.is_available ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, rows.length)} of {rows.length}
            </p>
            <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
          </div>
        </>
      ) : (
        <div className="rounded border p-4 text-sm text-slate-500">No users found.</div>
      )}

      <Modal title="Add User" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSavingUser(true);
            void usersApi
              .create({
                name: form.name,
                email: form.email,
                password: form.password,
                role: "staff",
                is_available: form.is_available,
                branch_id: currentUser?.branch_id ?? undefined
              })
              .then(async () => {
                toast.success("User created");
                setOpen(false);
                const refreshed = await usersApi.list({ page: 1, per_page: 100 });
                const filtered =
                  currentUser?.role === "branch_manager"
                    ? refreshed.items.filter((item) => item.branch_id === currentUser.branch_id)
                    : refreshed.items;
                setRows(filtered);
                setForm({ name: "", email: "", password: "", is_available: true });
              })
              .catch(() => toast.error("Unable to create user"))
              .finally(() => setSavingUser(false));
          }}
        >
          <div><label className="field-label">Name</label><input className="field" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} /></div>
          <div><label className="field-label">Email</label><input className="field" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} /></div>
          <div><label className="field-label">Password</label><input className="field" type="password" value={form.password} onChange={(e) => setForm((prev) => ({ ...prev, password: e.target.value }))} /></div>
          <div>
            <label className="field-label">Role</label>
            <input className="field bg-slate-100" value="Staff" disabled />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.is_available} onChange={(e) => setForm((prev) => ({ ...prev, is_available: e.target.checked }))} />
            Available for orders
          </label>
          <button className="btn-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingUser}>
            {savingUser ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save User"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
