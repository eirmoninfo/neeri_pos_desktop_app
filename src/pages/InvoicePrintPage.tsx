import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import { invoicesApi } from "../api/invoicesApi";
import type { InvoiceItem } from "../types";
import { invoiceLineLabel, invoiceLineTotal } from "../utils/invoiceLine";
import "./InvoicePrintPage.css";

const logoText = import.meta.env.VITE_INVOICE_SALON_LOGO ?? "Neeri Saloon POS";
const logoUrl = import.meta.env.VITE_INVOICE_LOGO_URL ?? "/assets/images/logo.png";
const addressLine1 =
  import.meta.env.VITE_INVOICE_ADDRESS_LINE1 ??
  "Shop 131, Watergardens Shopping Centre, 399 Melton Hwy, Taylors Lakes VIC 3038";
const addressLine2 = import.meta.env.VITE_INVOICE_ADDRESS_LINE2 ?? "(Near Nando's, Next to Blank Jeans)";
const poweredBy = import.meta.env.VITE_INVOICE_POWERED_BY ?? "Eirmon Solutions";

function formatMoney(n: number) {
  return Number(n).toFixed(2);
}

function formatDisplayDate(iso?: string) {
  if (!iso) return new Date().toISOString().slice(0, 10);
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function billNumber(inv: InvoiceItem) {
  return inv.invoice_number ?? inv.bill_no ?? inv.reference ?? `INV-${inv.id}`;
}

export default function InvoicePrintPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<InvoiceItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [logoFailed, setLogoFailed] = useState(false);
  const autoPrint = searchParams.get("autoprint") === "1";

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    setLogoFailed(false);
    void invoicesApi
      .show(Number(id))
      .then(setInvoice)
      .catch(() => {
        toast.error("Unable to load invoice");
        navigate("/invoice");
      })
      .finally(() => setLoading(false));
  }, [id, navigate]);

  useEffect(() => {
    if (!invoice || !autoPrint) return;
    const handle = window.setTimeout(() => {
      window.print();
    }, 250);
    return () => window.clearTimeout(handle);
  }, [invoice, autoPrint]);

  if (loading) {
    return (
      <div className="loading-wrap">
        <p>Loading invoice...</p>
      </div>
    );
  }

  if (!invoice) return null;

  const lines = invoice.items ?? [];
  const bill = billNumber(invoice);

  return (
    <div className="invoice-print-page">
      <div id="non-printable">
        <div className="invoice-toolbar">
          <button type="button" onClick={() => navigate("/pos")}>
            Back
          </button>
          <button type="button" className="print-btn" onClick={() => window.print()}>
            Print
          </button>
        </div>
      </div>

      <article className="invoice-shell">
        <header className="invoice-logo-wrap">
          {logoFailed ? (
            <p className="invoice-logo-fallback">{logoText}</p>
          ) : (
            <img
              src={logoUrl}
              alt={logoText}
              className="invoice-logo"
              onError={() => setLogoFailed(true)}
            />
          )}
          <p className="invoice-address">{addressLine1}</p>
          <p className="invoice-address">{addressLine2}</p>
        </header>

        <section className="invoice-section">
          <h4 className="invoice-title">Customer Details</h4>
          <table className="customer-table">
            <tbody>
              <tr><td>Name:</td><td>{invoice.customer_name || "-"}</td></tr>
              <tr><td>Email:</td><td>{invoice.customer_email || "-"}</td></tr>
              <tr><td>Mobile:</td><td>{invoice.customer_phone || "-"}</td></tr>
              <tr><td>Date:</td><td>{formatDisplayDate(invoice.created_at)}</td></tr>
            </tbody>
          </table>
        </section>

        <section className="invoice-section">
          <h4 className="invoice-title">Order Details - Bill No: {bill}</h4>
          <table className="items-table">
            <thead>
              <tr>
                <th>Service</th>
                <th className="text-right">Price</th>
              </tr>
            </thead>
            <tbody>
              {lines.length === 0 ? (
                <tr>
                  <td>-</td>
                  <td className="text-right">$0.00</td>
                </tr>
              ) : (
                lines.map((line, idx) => (
                  <tr key={idx}>
                    <td>{invoiceLineLabel(line)}</td>
                    <td className="text-right">${formatMoney(invoiceLineTotal(line))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          <table className="totals-table">
            <tbody>
              <tr>
                <td>Sub Total $</td>
                <td>${formatMoney(invoice.subtotal)}</td>
              </tr>
              <tr className="total-row">
                <td>Total $</td>
                <td>${formatMoney(invoice.total)}</td>
              </tr>
            </tbody>
          </table>
        </section>

        <footer className="footer">
          <p>Thanks, Visit Again</p>
          <p className="powered-by">Powered by {poweredBy}</p>
        </footer>
      </article>
    </div>
  );
}
