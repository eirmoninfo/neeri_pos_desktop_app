import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { offersApi } from "../api/offersApi";
import type { OfferItem } from "../types";

export default function OffersPage() {
  const [rows, setRows] = useState<OfferItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", discount_type: "flat", discount_value: "0" });
  const [savingOffer, setSavingOffer] = useState(false);

  const load = async () => {
    const result = await offersApi.list({ search, page, per_page: perPage });
    setRows(result.items);
    setTotal(result.meta.total);
    setLastPage(result.meta.lastPage);
  };

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load offers"));
  }, [search, page, perPage]);

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Offers</h2>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add Offer
        </button>
      </div>
      <div className="flex gap-3">
        <input className="field" placeholder="Search offers" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <th className="p-2">Title</th>
              <th className="p-2">Type</th>
              <th className="p-2">Value</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.title}</td>
                <td className="p-2">{row.discount_type ?? "-"}</td>
                <td className="p-2">{row.discount_value ?? "-"}</td>
                <td className="p-2">
                  <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void offersApi.remove(row.id).then(load)}>
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
      <Modal title="Create Offer" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSavingOffer(true);
            void offersApi
              .create({
                title: form.title,
                description: form.description,
                discount_type: form.discount_type as "flat" | "percentage",
                discount_value: Number(form.discount_value),
                is_active: true
              })
              .then(async () => {
                toast.success("Offer created");
                setOpen(false);
                await load();
              })
              .catch(() => toast.error("Unable to create offer"))
              .finally(() => setSavingOffer(false));
          }}
        >
          <div><label className="field-label">Title</label><input className="field" value={form.title} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} /></div>
          <div>
            <label className="field-label">Discount Type</label>
            <select className="field" value={form.discount_type} onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value }))}>
              <option value="flat">Flat</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>
          <div><label className="field-label">Discount Value</label><input className="field" value={form.discount_value} onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))} /></div>
          <div><label className="field-label">Description</label><input className="field" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
          <button className="btn-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingOffer}>
            {savingOffer ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Offer"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
