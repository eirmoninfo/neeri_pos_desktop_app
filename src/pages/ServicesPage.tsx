import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { servicesApi } from "../api/servicesApi";
import { useAuthStore } from "../store/authStore";
import type { ServiceItem } from "../types";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { SkeletonRows } from "../components/Skeleton";

const defaultForm = { service_name: "", sub_category: "", price: "", time: "", allow_custom_price: false };

export default function ServicesPage() {
  const user = useAuthStore((s) => s.user);
  const canAdd = user?.role === "admin" || user?.role === "manager" || user?.role === "branch_manager";
  const canEdit = canAdd;
  const canDelete = user?.role === "admin";
  const [rows, setRows] = useState<ServiceItem[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState(defaultForm);
  const [savingCreate, setSavingCreate] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);

  const load = async () => {
    setLoading(true);
    const result = search
      ? await servicesApi.searchPaged({ search, per_page: perPage, page })
      : await servicesApi.listPaged({ per_page: perPage, page });
    const branchRows =
      user?.role === "branch_manager"
        ? result.items.filter((item) => item.branch_id === user.branch_id)
        : result.items;
    setRows(branchRows);
    setTotal(result.meta.total);
    setLastPage(result.meta.lastPage);
    setLoading(false);
  };
  useEffect(() => {
    setPage(1);
  }, [search, perPage, user?.role, user?.branch_id]);

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load services"));
  }, [search, page, perPage, user?.role, user?.branch_id]);

  const remove = async (id: number) => {
    await servicesApi.remove(id);
    toast.success("Service deleted");
    await load();
  };

  const openEdit = (service: ServiceItem) => {
    setEditingId(service.id);
    setEditForm({
      service_name: service.service_name ?? "",
      sub_category: service.sub_category ?? "",
      price: String(service.price ?? ""),
      time: String(service.time ?? ""),
      allow_custom_price: Boolean(service.allow_custom_price)
    });
    setEditOpen(true);
  };

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Services</h2>
        {canAdd && (
          <button className="btn-primary" onClick={() => setOpen(true)}>
            + Add Service
          </button>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input className="field" placeholder="Search services" onChange={(e) => setSearch(e.target.value)} />
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
                <th className="p-2">Service</th>
                <th className="p-2">Sub Category</th>
                <th className="p-2">Price</th>
                <th className="p-2">Time</th>
                {(canEdit || canDelete) && <th className="p-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.service_name}</td>
                  <td className="p-2">{row.sub_category}</td>
                  <td className="p-2">${row.price}</td>
                  <td className="p-2">{row.time} min</td>
                  {(canEdit || canDelete) && (
                    <td className="p-2">
                      <div className="flex items-center gap-2">
                        {canEdit ? (
                          <button
                            className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-600"
                            onClick={() => openEdit(row)}
                          >
                            Edit
                          </button>
                        ) : null}
                        {canDelete ? (
                          <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void remove(row.id)}>
                            Delete
                          </button>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border p-4 text-sm text-slate-500">No services found.</div>
      )}
      {!loading && rows.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total || rows.length)} of {total || rows.length}
          </p>
          <Pagination page={page} totalPages={Math.max(1, lastPage)} onPageChange={setPage} />
        </div>
      )}
      <Modal title="Create Service" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSavingCreate(true);
            void servicesApi
              .create({
                service_name: form.service_name,
                sub_category: form.sub_category,
                price: Number(form.price),
                time: Number(form.time),
                branch_id: user?.branch_id ?? undefined,
                note: form.allow_custom_price ? "custom_price" : undefined,
                allow_custom_price: form.allow_custom_price
              })
              .then(async () => {
                toast.success("Service created");
                setOpen(false);
                setForm(defaultForm);
                await load();
              })
              .catch(() => toast.error("Unable to create service"))
              .finally(() => setSavingCreate(false));
          }}
        >
          <div>
            <label className="field-label">Service Name</label>
            <input className="field" value={form.service_name} onChange={(e) => setForm((prev) => ({ ...prev, service_name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Sub Category</label>
            <input className="field" value={form.sub_category} onChange={(e) => setForm((prev) => ({ ...prev, sub_category: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Price</label>
            <input className="field" value={form.price} onChange={(e) => setForm((prev) => ({ ...prev, price: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Time (Min)</label>
            <input className="field" value={form.time} onChange={(e) => setForm((prev) => ({ ...prev, time: e.target.value }))} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.allow_custom_price}
              onChange={(e) => setForm((prev) => ({ ...prev, allow_custom_price: e.target.checked }))}
            />
            Custom price at POS (staff enters price during checkout)
          </label>
          <button className="col-span-2 rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={savingCreate}>
            {savingCreate ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Service"}
          </button>
        </form>
      </Modal>
      <Modal title="Edit Service" open={editOpen} onClose={() => setEditOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editingId) return;
            setSavingEdit(true);
            void servicesApi
              .update(editingId, {
                service_name: editForm.service_name,
                sub_category: editForm.sub_category,
                price: Number(editForm.price),
                time: Number(editForm.time),
                branch_id: user?.branch_id ?? undefined,
                note: editForm.allow_custom_price ? "custom_price" : "",
                allow_custom_price: editForm.allow_custom_price
              })
              .then(async () => {
                toast.success("Service updated");
                setEditOpen(false);
                setEditingId(null);
                setEditForm(defaultForm);
                await load();
              })
              .catch(() => toast.error("Unable to update service"))
              .finally(() => setSavingEdit(false));
          }}
        >
          <div>
            <label className="field-label">Service Name</label>
            <input className="field" value={editForm.service_name} onChange={(e) => setEditForm((prev) => ({ ...prev, service_name: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Sub Category</label>
            <input className="field" value={editForm.sub_category} onChange={(e) => setEditForm((prev) => ({ ...prev, sub_category: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Price</label>
            <input className="field" value={editForm.price} onChange={(e) => setEditForm((prev) => ({ ...prev, price: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">Time (Min)</label>
            <input className="field" value={editForm.time} onChange={(e) => setEditForm((prev) => ({ ...prev, time: e.target.value }))} />
          </div>
          <label className="col-span-2 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={editForm.allow_custom_price}
              onChange={(e) => setEditForm((prev) => ({ ...prev, allow_custom_price: e.target.checked }))}
            />
            Custom price at POS (staff enters price during checkout)
          </label>
          <button className="col-span-2 rounded bg-blue-700 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={savingEdit}>
            {savingEdit ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Updating...</span> : "Update Service"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
