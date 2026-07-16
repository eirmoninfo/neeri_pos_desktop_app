import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { invoicesApi } from "../api/invoicesApi";
import type { InvoiceItem } from "../types";
import { SkeletonRows } from "../components/Skeleton";

export default function InvoicesPage() {
  const navigate = useNavigate();
  const [rows, setRows] = useState<InvoiceItem[]>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [savingInvoice, setSavingInvoice] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    subtotal: "0",
    total: "0",
    discount_type: "flat",
    discount_value: "0",
    items_json: '[{"services":"Hair","sub_category":"Cut","price":50}]'
  });

  const load = async () => {
    setLoading(true);
    const result = await invoicesApi.list({ search, page, per_page: perPage });
    setRows(result.items);
    setTotal(result.meta.total);
    setLastPage(result.meta.lastPage);
    setLoading(false);
  };

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load invoices"));
  }, [search, page, perPage]);

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Invoices</h2>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add Invoice
        </button>
      </div>
      <div className="flex gap-3">
        <input className="field" placeholder="Search invoice" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="field max-w-28" value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
      {loading ? (
        <SkeletonRows rows={7} />
      ) : (
        <div className="table-wrap">
          <table className="w-full text-sm">
            <thead>
              <tr className="table-head">
                <th className="p-2">Customer</th>
                <th className="p-2">Subtotal</th>
                <th className="p-2">Total</th>
                <th className="p-2 w-48">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="p-2">{row.customer_name}</td>
                  <td className="p-2">${row.subtotal}</td>
                  <td className="p-2">${row.total}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        onClick={() => navigate(`/invoice/${row.id}/print`)}
                      >
                        Print
                      </button>
                      {/* <button
                        type="button"
                        className="rounded border px-2 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-60"
                        disabled={downloadingId === row.id}
                        onClick={() => {
                          setDownloadingId(row.id);
                          void invoicesApi
                            .download(row.id)
                            .catch(() => toast.error("Unable to download PDF"))
                            .finally(() => setDownloadingId(null));
                        }}
                      >
                        {downloadingId === row.id ? "Downloading..." : "PDF"}
                      </button> */}
                      <button type="button" className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void invoicesApi.remove(row.id).then(load)}>
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Showing {(page - 1) * perPage + 1}-{Math.min(page * perPage, total || rows.length)} of {total || rows.length}
        </p>
        <Pagination page={page} totalPages={Math.max(1, lastPage)} onPageChange={setPage} />
      </div>
      <Modal title="Create Invoice" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-2 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            let parsedItems: Array<{ services: string; sub_category?: string; price: number }> = [];
            try {
              parsedItems = JSON.parse(form.items_json);
            } catch {
              toast.error("Items JSON is invalid");
              return;
            }
            if (!form.customer_name.trim()) {
              toast.error("Customer name is required");
              return;
            }
            if (!Array.isArray(parsedItems) || parsedItems.length === 0) {
              toast.error("At least one invoice item is required");
              return;
            }
            setSavingInvoice(true);
            void invoicesApi
              .create({
                customer_name: form.customer_name,
                subtotal: Number(form.subtotal),
                total: Number(form.total),
                discount_type: form.discount_type as "flat" | "percentage",
                discount_value: Number(form.discount_value),
                items: parsedItems
              })
              .then(async () => {
                toast.success("Invoice created");
                setOpen(false);
                await load();
              })
              .catch(() => toast.error("Unable to create invoice"))
              .finally(() => setSavingInvoice(false));
          }}
        >
          <div><label className="field-label">Customer Name</label><input className="field" value={form.customer_name} onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))} /></div>
          <div><label className="field-label">Subtotal</label><input className="field" value={form.subtotal} onChange={(e) => setForm((prev) => ({ ...prev, subtotal: e.target.value }))} /></div>
          <div><label className="field-label">Total</label><input className="field" value={form.total} onChange={(e) => setForm((prev) => ({ ...prev, total: e.target.value }))} /></div>
          <div>
            <label className="field-label">Discount Type</label>
            <select className="field" value={form.discount_type} onChange={(e) => setForm((prev) => ({ ...prev, discount_type: e.target.value }))}>
              <option value="flat">Flat</option>
              <option value="percentage">Percentage</option>
            </select>
          </div>
          <div><label className="field-label">Discount Value</label><input className="field" value={form.discount_value} onChange={(e) => setForm((prev) => ({ ...prev, discount_value: e.target.value }))} /></div>
          <div className="col-span-2">
            <label className="field-label">Items JSON</label>
            <textarea className="field min-h-24" placeholder='[{"services":"Hair","price":50}]' value={form.items_json} onChange={(e) => setForm((prev) => ({ ...prev, items_json: e.target.value }))} />
          </div>
          <button type="submit" className="btn-primary col-span-2 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingInvoice}>
            {savingInvoice ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Invoice"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
