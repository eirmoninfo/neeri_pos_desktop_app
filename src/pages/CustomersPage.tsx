import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { useLocation, useNavigate } from "react-router-dom";
import { customersApi, getCustomerApiError } from "../api/customersApi";
import { useAuthStore } from "../store/authStore";
import type { CustomerItem } from "../types";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { SkeletonRows } from "../components/Skeleton";

interface CustomerFormState {
  name: string;
  phone: string;
  email: string;
  suburb: string;
  date_of_birth: string;
  notes: string;
}

const defaultForm: CustomerFormState = {
  name: "",
  phone: "",
  email: "",
  suburb: "",
  date_of_birth: "",
  notes: ""
};

export default function CustomersPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const canAdd = user?.role === "admin" || user?.role === "manager" || user?.role === "branch_manager";
  const canEditDelete = canAdd;
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<CustomerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [popupOpen, setPopupOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<CustomerFormState>(defaultForm);
  const [savingCustomer, setSavingCustomer] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, per_page: perPage };
      const result = search.trim()
        ? await customersApi.search({ ...params, search: search.trim() })
        : await customersApi.list(params);
      setRows(result.items);
      setTotal(result.meta.total);
      setLastPage(result.meta.lastPage);
    } catch (error) {
      toast.error(getCustomerApiError(error, "Unable to load customers"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, perPage]);

  useEffect(() => {
    void load();
  }, [search, page, perPage]);

  useEffect(() => {
    if (location.state && (location.state as { openAddCustomer?: boolean }).openAddCustomer) {
      openCreate();
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const openCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setPopupOpen(true);
  };

  const openEdit = (row: CustomerItem) => {
    setEditingId(row.id);
    setPopupOpen(true);
    void customersApi
      .show(row.id)
      .then((customer) => {
        setForm({
          name: customer.name ?? "",
          phone: customer.phone ?? "",
          email: customer.email ?? "",
          suburb: customer.suburb ?? "",
          date_of_birth: customer.date_of_birth ?? "",
          notes: customer.notes ?? ""
        });
      })
      .catch((error) => {
        toast.error(getCustomerApiError(error, "Unable to load customer"));
        setForm({
          name: row.name ?? "",
          phone: row.phone ?? "",
          email: row.email ?? "",
          suburb: row.suburb ?? "",
          date_of_birth: row.date_of_birth ?? "",
          notes: row.notes ?? ""
        });
      });
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    phone: form.phone.trim() || undefined,
    email: form.email.trim() || undefined,
    suburb: form.suburb.trim() || undefined,
    date_of_birth: form.date_of_birth.trim() || undefined,
    notes: form.notes.trim() || undefined
  });

  const saveCustomer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSavingCustomer(true);
    const payload = buildPayload();
    if (editingId) {
      try {
        await customersApi.update(editingId, payload);
        toast.success("Customer updated");
      } catch (error) {
        toast.error(getCustomerApiError(error, "Unable to update customer"));
        setSavingCustomer(false);
        return;
      }
    } else {
      try {
        await customersApi.create(payload);
        toast.success("Customer created");
      } catch (error) {
        toast.error(getCustomerApiError(error, "Unable to create customer"));
        setSavingCustomer(false);
        return;
      }
    }
    setPopupOpen(false);
    await load();
    setSavingCustomer(false);
  };

  const remove = async (id: number) => {
    try {
      await customersApi.remove(id);
      toast.success("Customer deleted");
      await load();
    } catch (error) {
      toast.error(getCustomerApiError(error, "Unable to delete customer"));
    }
  };

  return (
    <div className="panel space-y-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Clients</h2>
        {canAdd && (
          <button className="btn-primary" onClick={openCreate}>
            + Add Customer
          </button>
        )}
      </div>
      <div className="flex items-center justify-between gap-3">
        <input
          className="field"
          placeholder="Search customer"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
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
        <div className="table-wrap h-[330px] overflow-y-scroll">
          <table className="w-full text-sm overflow-y-scroll">
            <thead>
              <tr className="table-head">
                <th className="p-2">Name</th>
                <th className="p-2">Phone</th>
                <th className="p-2">Email</th>
                <th className="p-2">Suburb</th>
                <th className="p-2">DOB</th>
                <th className="p-2">Notes</th>
                {canEditDelete && <th className="w-36 p-2">Action</th>}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.name}</td>
                  <td className="p-2">{row.phone}</td>
                  <td className="p-2">{row.email}</td>
                  <td className="p-2">{row.suburb ?? "-"}</td>
                  <td className="p-2">{row.date_of_birth ?? "-"}</td>
                  <td className="p-2">
                    <p className="cell-truncate" title={row.notes ?? "-"}>
                      {row.notes ?? "-"}
                    </p>
                  </td>
                  {canEditDelete && (
                    <td className="w-36 p-2">
                      <div className="flex gap-2">
                        <button className="rounded border px-2 py-1 text-xs" onClick={() => openEdit(row)}>
                          Edit
                        </button>
                        <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void remove(row.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded border p-4 text-sm text-slate-500">No customers found.</div>
      )}
      {!loading && (total > 0 || rows.length > 0) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total || rows.length)} of {total || rows.length}
          </p>
          <Pagination page={page} totalPages={Math.max(1, lastPage)} onPageChange={setPage} />
        </div>
      )}

      <Modal
        title={editingId ? "Edit Customer" : "Add Customer"}
        open={popupOpen}
        onClose={() => setPopupOpen(false)}
      >
        <form className="grid grid-cols-2 gap-3" onSubmit={saveCustomer}>
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
            <label className="field-label">Suburb</label>
            <input
              className="field"
              maxLength={255}
              value={form.suburb}
              onChange={(e) => setForm((prev) => ({ ...prev, suburb: e.target.value }))}
            />
          </div>
          <div>
            <label className="field-label">Date Of Birth</label>
            <input className="field" type="date" value={form.date_of_birth} onChange={(e) => setForm((prev) => ({ ...prev, date_of_birth: e.target.value }))} />
          </div>
          <div className="col-span-2">
            <label className="field-label">Notes</label>
            <textarea className="field min-h-24" rows={3} value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} />
          </div>
          <button className="col-span-2 rounded bg-slate-900 px-3 py-2 text-white disabled:cursor-not-allowed disabled:opacity-60" disabled={savingCustomer}>
            {savingCustomer ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : editingId ? "Update Customer" : "Create Customer"}
          </button>
        </form>
      </Modal>
    </div>
  );
}