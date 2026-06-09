import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleSales } from './saleData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SaleDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const branding     = useBranding();
  const { role, uid: _uid } = useAuth();

  const sale = sampleSales.find(s => s.id === id) ?? sampleSales[0];

  const [showVoidModal, setShowVoidModal] = useState(false);
  const [voidReason,    setVoidReason]    = useState('');
  const [voiding,       setVoiding]       = useState(false);
  const [voidError,     setVoidError]     = useState('');

  // ── Void handler ──────────────────────────────────────────
  // Rule: void requires reason + owner notified
  // CF handles: reverse stock, reverse balance, audit log
  async function handleVoid() {
    if (!voidReason.trim()) { setVoidError('Void reason is required.'); return; }
    setVoiding(true); setVoidError('');
    try {
      // TODO: when Firebase connected:
      // await voidSale(sale.companyId, sale.id, _uid, voidReason.trim());
      // CF fires on update, reverses stock + balance, notifies owner, writes audit log
      await new Promise(r => setTimeout(r, 800));
      setShowVoidModal(false);
      navigate('/sales');
    } catch (err) {
      setVoidError('Failed to void sale. Please try again.');
    } finally {
      setVoiding(false);
    }
  }

  // ── Print invoice PDF ─────────────────────────────────────
  async function printInvoice() {
    const doc    = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW  = 210;
    const margin = 14;

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(branding.companyName, margin, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(branding.address,         pageW - margin, 14, { align: 'right' });
    doc.text(`Tel: ${branding.phone}`, pageW - margin, 19, { align: 'right' });
    doc.text(branding.email,           pageW - margin, 24, { align: 'right' });
    if (branding.crNumber)  doc.text(`CR: ${branding.crNumber}`,   pageW - margin, 29, { align: 'right' });
    if (branding.vatNumber) doc.text(`VAT: ${branding.vatNumber}`, pageW - margin, 34, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, 38, pageW - margin, 38);

    // Invoice title + number
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text('INVOICE', margin, 48);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(sale.invoiceNumber, margin, 54);

    // Customer info
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`To: ${sale.customerName}`,                         margin, 64);
    doc.text(`Date: ${formatDate(sale.date)}`,                   pageW - margin, 54, { align: 'right' });
    doc.text(`Payment: ${sale.paymentType.toUpperCase()}`,       pageW - margin, 60, { align: 'right' });

    // Line items table
    autoTable(doc, {
      startY: 72,
      head: [['Product', 'Unit', 'Qty', 'Unit Price', 'Discount', 'Total']],
      body: sale.items.map(item => [
        `${item.productName} (${item.productCode})`,
        item.unit,
        item.qty.toString(),
        formatCurrency(item.unitPrice, branding.currency),
        item.discount > 0 ? formatCurrency(item.discount, branding.currency) : '—',
        formatCurrency(item.lineTotal, branding.currency),
      ]),
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [15, 110, 86], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 60 },
        1: { cellWidth: 15 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 28, halign: 'right' },
        4: { cellWidth: 28, halign: 'right' },
        5: { cellWidth: 28, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;

    // Totals
    const totalsX = pageW - margin - 60;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text('Subtotal:',      totalsX, finalY);
    doc.text(formatCurrency(sale.subtotal, branding.currency), pageW - margin, finalY, { align: 'right' });

    if (sale.discountTotal > 0) {
      doc.text('Discount:', totalsX, finalY + 6);
      doc.setTextColor(15, 110, 86);
      doc.text(`− ${formatCurrency(sale.discountTotal, branding.currency)}`, pageW - margin, finalY + 6, { align: 'right' });
      doc.setTextColor(60, 60, 60);
    }

    const grandY = finalY + (sale.discountTotal > 0 ? 14 : 8);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(30, 30, 30);
    doc.text('TOTAL:', totalsX, grandY);
    doc.text(formatCurrency(sale.grandTotal, branding.currency), pageW - margin, grandY, { align: 'right' });

    if (sale.amountDue > 0) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(153, 60, 29);
      doc.text(`Amount Due: ${formatCurrency(sale.amountDue, branding.currency)}`, pageW - margin, grandY + 7, { align: 'right' });
    }

    if (sale.notes) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Notes: ${sale.notes}`, margin, grandY + 14);
    }

    // Footer
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(branding.companyName, margin, 290);
    doc.text('Thank you for your business', pageW / 2, 290, { align: 'center' });

    doc.save(`${sale.invoiceNumber}.pdf`);
  }

  if (!sale) return <div className="p-6 text-center text-gray-400">Sale not found.</div>;

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', other: 'Other', credit: 'Credit',
  };

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/sales')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <i className="ti ti-arrow-left" aria-hidden="true" /> Sales
        </button>
        <div className="flex gap-2">
          <button
            onClick={printInvoice}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors"
          >
            <i className="ti ti-printer" aria-hidden="true" />
            <span className="hidden md:inline">Print Invoice</span>
          </button>
          {!sale.isVoid && can.voidSale(role) && (
            <button
              onClick={() => setShowVoidModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors"
            >
              <i className="ti ti-ban" aria-hidden="true" />
              <span className="hidden md:inline">Void</span>
            </button>
          )}
        </div>
      </div>

      {/* Sale header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900 font-mono">
                {sale.invoiceNumber}
              </h2>
              {sale.isVoid && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  VOIDED
                </span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                sale.paymentType === 'cash'    ? 'bg-emerald-100 text-emerald-700' :
                sale.paymentType === 'credit'  ? 'bg-blue-100 text-blue-700' :
                                                  'bg-amber-100 text-amber-700'
              }`}>
                {sale.paymentType}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {sale.customerName} · {formatDate(sale.date)}
            </p>
            {sale.notes && (
              <p className="text-xs text-gray-400 mt-1">{sale.notes}</p>
            )}
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Total</p>
              <p className={`text-base font-bold ${sale.isVoid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {formatCurrency(sale.grandTotal, branding.currency)}
              </p>
            </div>
            {sale.amountDue > 0 && !sale.isVoid && (
              <div className="text-center px-4 py-2 bg-red-50 rounded-xl">
                <p className="text-xs text-gray-400 mb-0.5">Due</p>
                <p className="text-base font-bold text-red-700">
                  {formatCurrency(sale.amountDue, branding.currency)}
                </p>
              </div>
            )}
          </div>
        </div>

        {sale.isVoid && sale.voidReason && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-red-700">Void reason</p>
            <p className="text-sm text-red-600 mt-0.5">{sale.voidReason}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">Items</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {sale.items.map((item, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-6 md:col-span-5">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.productCode} · {item.unit}</p>
              </div>
              <div className="hidden md:block col-span-2 text-center">
                <p className="text-sm text-gray-700">{item.qty} {item.unit}</p>
              </div>
              <div className="hidden md:block col-span-2 text-right">
                <p className="text-sm text-gray-600">{formatCurrency(item.unitPrice, branding.currency)}</p>
                {item.discount > 0 && (
                  <p className="text-xs text-emerald-600">− {formatCurrency(item.discount, branding.currency)}</p>
                )}
              </div>
              <div className="col-span-6 md:col-span-3 text-right">
                <p className="text-sm font-semibold text-gray-900">
                  {formatCurrency(item.lineTotal, branding.currency)}
                </p>
                <p className="text-xs text-gray-400 md:hidden">× {item.qty}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="border-t border-gray-200 px-4 py-3 space-y-1.5 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span>
            <span>{formatCurrency(sale.subtotal, branding.currency)}</span>
          </div>
          {sale.discountTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Discount</span>
              <span>− {formatCurrency(sale.discountTotal, branding.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Grand total</span>
            <span>{formatCurrency(sale.grandTotal, branding.currency)}</span>
          </div>
          {sale.amountReceived > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Received ({sale.paymentMethod ? PAYMENT_LABELS[sale.paymentMethod] : ''})</span>
              <span>− {formatCurrency(sale.amountReceived, branding.currency)}</span>
            </div>
          )}
          {sale.amountDue > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-700">
              <span>Amount due</span>
              <span>{formatCurrency(sale.amountDue, branding.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Void modal */}
      {showVoidModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)' }}
        >
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <i className="ti ti-ban text-2xl text-red-600" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Void this sale?</h3>
              <p className="text-sm text-gray-500 mt-1">
                This will reverse all stock and balance impacts.
                This action cannot be undone.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Void reason <span className="text-red-500">*</span>
              </label>
              <textarea
                value={voidReason}
                onChange={e => setVoidReason(e.target.value)}
                rows={3}
                placeholder="Why is this sale being voided? e.g. Wrong customer, duplicate entry, customer cancelled..."
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none"
              />
              {voidError && (
                <p className="text-xs text-red-600 mt-1">{voidError}</p>
              )}
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              <p className="text-xs text-amber-700">
                <strong>Owner will be notified.</strong> Stock will be restored and customer
                balance will be reversed by the system.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowVoidModal(false); setVoidReason(''); setVoidError(''); }}
                disabled={voiding}
                className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleVoid}
                disabled={voiding || !voidReason.trim()}
                className="flex-1 h-11 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {voiding ? 'Voiding...' : 'Void Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
