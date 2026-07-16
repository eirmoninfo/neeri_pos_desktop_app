import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Modal from "../components/Modal";
import Pagination from "../components/Pagination";
import { timeSlotsApi } from "../api/timeSlotsApi";
import type { TimeSlotItem } from "../types";

export default function TimeSlotsPage() {
  const [rows, setRows] = useState<TimeSlotItem[]>([]);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ day: "", start_time: "", end_time: "" });
  const [editForm, setEditForm] = useState({ day: "", start_time: "", end_time: "" });
  const [savingSlot, setSavingSlot] = useState(false);
  const [savingEditSlot, setSavingEditSlot] = useState(false);

  const load = async () => {
    const result = await timeSlotsApi.list({ page, per_page: perPage });
    setRows(result.items);
    setTotal(result.meta.total);
    setLastPage(result.meta.lastPage);
  };

  useEffect(() => {
    void load().catch(() => toast.error("Unable to load time slots"));
  }, [page, perPage]);

  const openEdit = (row: TimeSlotItem) => {
    setEditingId(row.id);
    setEditForm({
      day: row.day ?? "",
      start_time: row.start_time ?? "",
      end_time: row.end_time ?? ""
    });
    setEditOpen(true);
  };

  return (
    <div className="panel space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="panel-title">Time Slots</h2>
        <button className="btn-primary" onClick={() => setOpen(true)}>
          + Add Slot
        </button>
      </div>
      <div className="flex justify-end">
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
              <th className="p-2">Day</th>
              <th className="p-2">Start</th>
              <th className="p-2">End</th>
              <th className="p-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b">
                <td className="p-2">{row.day ?? "-"}</td>
                <td className="p-2">{row.start_time ?? "-"}</td>
                <td className="p-2">{row.end_time ?? "-"}</td>
                <td className="p-2">
                  <div className="flex gap-2">
                    <button className="rounded border border-blue-300 px-2 py-1 text-xs text-blue-600" onClick={() => openEdit(row)}>
                      Edit
                    </button>
                    <button className="rounded border border-rose-300 px-2 py-1 text-xs text-rose-600" onClick={() => void timeSlotsApi.remove(row.id).then(load)}>
                      Delete
                    </button>
                  </div>
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
      <Modal title="Create Time Slot" open={open} onClose={() => setOpen(false)}>
        <form
          className="grid grid-cols-3 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setSavingSlot(true);
            void timeSlotsApi
              .create(form)
              .then(async () => {
                toast.success("Time slot created");
                setOpen(false);
                await load();
              })
              .catch(() => toast.error("Unable to create time slot"))
              .finally(() => setSavingSlot(false));
          }}
        >
          <div>
            <label className="field-label">Day</label>
            <select className="field" value={form.day} onChange={(e) => setForm((prev) => ({ ...prev, day: e.target.value }))}>
              <option value="">Select day</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label className="field-label">Start Time</label>
            <input className="field" type="time" value={form.start_time} onChange={(e) => setForm((prev) => ({ ...prev, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">End Time</label>
            <input className="field" type="time" value={form.end_time} onChange={(e) => setForm((prev) => ({ ...prev, end_time: e.target.value }))} />
          </div>
          <button className="btn-primary col-span-3 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingSlot}>
            {savingSlot ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Saving...</span> : "Save Slot"}
          </button>
        </form>
      </Modal>
      <Modal title="Edit Time Slot" open={editOpen} onClose={() => setEditOpen(false)}>
        <form
          className="grid grid-cols-3 gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!editingId) return;
            setSavingEditSlot(true);
            void timeSlotsApi
              .update(editingId, editForm)
              .then(async () => {
                toast.success("Time slot updated");
                setEditOpen(false);
                setEditingId(null);
                await load();
              })
              .catch(() => toast.error("Unable to update time slot"))
              .finally(() => setSavingEditSlot(false));
          }}
        >
          <div>
            <label className="field-label">Day</label>
            <select className="field" value={editForm.day} onChange={(e) => setEditForm((prev) => ({ ...prev, day: e.target.value }))}>
              <option value="">Select day</option>
              <option value="Monday">Monday</option>
              <option value="Tuesday">Tuesday</option>
              <option value="Wednesday">Wednesday</option>
              <option value="Thursday">Thursday</option>
              <option value="Friday">Friday</option>
              <option value="Saturday">Saturday</option>
              <option value="Sunday">Sunday</option>
            </select>
          </div>
          <div>
            <label className="field-label">Start Time</label>
            <input className="field" type="time" value={editForm.start_time} onChange={(e) => setEditForm((prev) => ({ ...prev, start_time: e.target.value }))} />
          </div>
          <div>
            <label className="field-label">End Time</label>
            <input className="field" type="time" value={editForm.end_time} onChange={(e) => setEditForm((prev) => ({ ...prev, end_time: e.target.value }))} />
          </div>
          <button className="btn-primary col-span-3 disabled:cursor-not-allowed disabled:opacity-60" disabled={savingEditSlot}>
            {savingEditSlot ? <span className="inline-flex items-center gap-2"><span className="btn-spinner" /> Updating...</span> : "Update Slot"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
