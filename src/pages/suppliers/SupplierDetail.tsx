import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate, buildWhatsAppUrl } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleSuppliers, sampleSupplierLedger } from './supplierData';
import type { SupplierLedgerFilter } from './supplierData';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SupplierDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const branding     = useBranding();
  const { role }     = useAuth();
  const [activeTab, setActiveTab] = useState<'ledger' | 'info'>('ledger');

  const supplier = sampleSuppliers.find(s => s.id === id) ?? sampleSuppliers[0];
  const allEntries = sampleSupplierLedger;

  const [filters, setFilters] = useState<SupplierLedgerFilter>({
    dateFrom: '', dateTo: '', type: 'all', status: 'all',
  });

  function updateFilter(key: keyof SupplierLedgerFilter, val: string) {
    setFilters(f => ({ ...f, [key]: val }));
  }

  const filteredEntries = useMemo(() => {
    let list = allEntries.filter(e => !e.isVoid);
    if (filters.dateFrom) {
      const from = new Date(filters.dateFrom);
      list = list.filter(e => e.date.toDate() >= from);
    }
    if (filters.dateTo) {
      const to = new Date(filters.dateTo);
      to.setHours(23, 59, 59);
      list = list.filter(e => e.date.toDate() <= to);
    }
    if (filters.type !== 'all') list = list.filter(e => e.type === filters.type);
    if (filters.status === 'paid')   list = list.filter(e => e.paymentType === 'cash');
    if (filters.status === 'unpaid') list = list.filter(e => e.paymentType === 'credit');
    return list.sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  }, [allEntries, filters]);

  const hasActiveFilters = filters.dateFrom || filters.dateTo ||
    filters.type !== 'all' || filters.status !== 'all';

  function typeBadge(type: string) {
    const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      purchase:   { bg: 'bg-red-50',     text: 'text-red-700',    icon: 'ti-shopping-cart', label: 'Purchase'   },
      payment:    { bg: 'bg-emerald-50', text: 'text-emerald-700',icon: 'ti-cash',          label: 'Payment'    },
      purchase_return: { bg: 'bg-amber-50',  text: 'text-amber-700',  icon: 'ti-file-minus',   label: 'Purchase Return' },
      supplier_debit:  { bg: 'bg-purple-50', text: 'text-purple-700', icon: 'ti-file-plus',    label: 'Supplier Debit' },
      opening:    { bg: 'bg-gray-50',    text: 'text-gray-600',   icon: 'ti-flag',          label: 'Opening'    },
    };
    return map[type] ?? map.opening;
  }

  // ── WhatsApp payment reminder ─────────────────────────────
  function sendReminder() {
    const msg = `Dear ${supplier.name},\n\nThis is a reminder from ${branding.companyName} regarding our outstanding balance of ${formatCurrency(supplier.currentBalance, branding.currency)}.\n\nKindly confirm payment arrangements at your earliest.\n\nThank you,\n${branding.companyName}`;
    window.open(buildWhatsAppUrl(supplier.whatsapp ?? supplier.phone, msg), '_blank');
  }

  // ── Statement PDF ─────────────────────────────────────────
  async function generateStatement() {
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 14;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(branding.companyName, margin, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(branding.address,         pageW - margin, 14, { align: 'right' });
    doc.text(`Tel: ${branding.phone}`, pageW - margin, 19, { align: 'right' });

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, 38, pageW - margin, 38);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text('SUPPLIER STATEMENT', margin, 48);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Supplier: ${supplier.name}`,     margin, 56);
    doc.text(`Phone: ${supplier.phone}`,        margin, 61);
    if (supplier.contactPerson) doc.text(`Contact: ${supplier.contactPerson}`, margin, 66);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageW - margin, 56, { align: 'right' });

    autoTable(doc, {
      startY: 75,
      head: [['Date', 'Description', 'Reference', 'Debit', 'Credit', 'Balance']],
      body: filteredEntries.map(e => [
        formatDate(e.date),
        e.description,
        e.refNumber ?? '—',
        e.debit  > 0 ? formatCurrency(e.debit,  branding.currency) : '—',
        e.credit > 0 ? formatCurrency(e.credit, branding.currency) : '—',
        formatCurrency(e.balance, branding.currency),
      ]),
      styles: { fontSize: 8.5, cellPadding: 3 },
      headStyles: { fillColor: [15, 110, 86], textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: 22 }, 1: { cellWidth: 60 }, 2: { cellWidth: 28 },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.text('Closing Balance (We Owe):', pageW - margin - 60, finalY);
    doc.setTextColor(supplier.currentBalance > 0 ? 153 : 15, supplier.currentBalance > 0 ? 60 : 110, 29);
    doc.text(formatCurrency(supplier.currentBalance, branding.currency), pageW - margin, finalY, { align: 'right' });

    doc.save(`SupplierStatement_${supplier.name.replace(/\s+/g, '-')}_${new Date().toISOString().split('T')[0]}.pdf`);
  }

  async function shareStatementWhatsApp() {
    await generateStatement();
    const msg = `Dear ${supplier.name},\n\nPlease find our account statement attached.\n\nOur outstanding balance to you: ${formatCurrency(supplier.currentBalance, branding.currency)}\n\nThank you,\n${branding.companyName}`;
    setTimeout(() => window.open(buildWhatsAppUrl(supplier.whatsapp ?? supplier.phone, msg), '_blank'), 500);
  }

  if (!supplier) return <div className="p-6 text-center text-gray-400">Supplier not found.</div>;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      <button
        onClick={() => navigate('/suppliers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> Suppliers
      </button>

      {/* Supplier header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">

          <div className="flex items-center gap-3 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${
              supplier.currentBalance > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
            }`}>
              {supplier.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">{supplier.name}</h2>
              {supplier.contactPerson && (
                <p className="text-sm text-gray-500">{supplier.contactPerson} · {supplier.phone}</p>
              )}
              {!supplier.contactPerson && (
                <p className="text-sm text-gray-500">{supplier.phone}</p>
              )}
            </div>
          </div>

          {/* Balance */}
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">We owe</p>
              <p className={`text-base font-bold ${supplier.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {formatCurrency(supplier.currentBalance, branding.currency)}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            {supplier.whatsapp && supplier.currentBalance > 0 && (
              <button
                onClick={sendReminder}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors"
              >
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                <span className="hidden md:inline">Message</span>
              </button>
            )}
            <button
              onClick={shareStatementWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors"
            >
              <i className="ti ti-file-text" aria-hidden="true" />
              <span className="hidden md:inline">Statement</span>
            </button>
            {can.manageSuppliers(role) && (
              <button
                onClick={() => navigate(`/purchases/new?supplierId=${supplier.id}`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                <i className="ti ti-plus" aria-hidden="true" />
                <span className="hidden md:inline">New Purchase</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['ledger', 'info'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'ledger' ? 'Ledger' : 'Info'}
          </button>
        ))}
      </div>

      {/* Ledger tab */}
      {activeTab === 'ledger' && (
        <div className="space-y-3">
          {/* Filters */}
          <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From date</label>
                <input type="date" value={filters.dateFrom}
                  onChange={e => updateFilter('dateFrom', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To date</label>
                <input type="date" value={filters.dateTo}
                  onChange={e => updateFilter('dateTo', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select value={filters.type} onChange={e => updateFilter('type', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
                >
                  <option value="all">All types</option>
                  <option value="purchase">Purchases</option>
                  <option value="payment">Payments</option>
                  <option value="purchase_return">Purchase returns</option>
                  <option value="supplier_debit">Supplier debits</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select value={filters.status} onChange={e => updateFilter('status', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
                >
                  <option value="all">All</option>
                  <option value="paid">Paid (cash)</option>
                  <option value="unpaid">Unpaid (credit)</option>
                </select>
              </div>
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters({ dateFrom: '', dateTo: '', type: 'all', status: 'all' })}
                className="mt-2 text-xs text-emerald-600 hover:text-emerald-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* Ledger entries */}
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-2 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <div className="col-span-2">Date</div>
              <div className="col-span-4">Description</div>
              <div className="col-span-2">Reference</div>
              <div className="col-span-1 text-right">Debit</div>
              <div className="col-span-1 text-right">Credit</div>
              <div className="col-span-2 text-right">Balance</div>
            </div>

            {filteredEntries.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">
                No transactions match the selected filters.
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filteredEntries.map(entry => {
                  const badge = typeBadge(entry.type);
                  return (
                    <div key={entry.id} className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 px-4 py-3 hover:bg-gray-50 transition-colors">
                      <div className="md:col-span-2 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${badge.bg}`}>
                          <i className={`ti ${badge.icon} text-xs ${badge.text}`} aria-hidden="true" />
                        </div>
                        <div className="md:hidden">
                          <p className="text-xs font-medium text-gray-900">{badge.label}</p>
                          <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                        </div>
                        <p className="hidden md:block text-xs text-gray-600">{formatDate(entry.date)}</p>
                      </div>
                      <div className="md:col-span-4 flex items-center">
                        <div>
                          <p className="text-sm text-gray-900">{entry.description}</p>
                          <span className={`hidden md:inline text-xs font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>
                      <div className="hidden md:flex md:col-span-2 items-center">
                        <p className="text-xs text-gray-500 font-mono">{entry.refNumber ?? '—'}</p>
                      </div>
                      <div className="hidden md:flex md:col-span-1 items-center justify-end">
                        <p className="text-sm text-emerald-700 font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit, branding.currency) : '—'}
                        </p>
                      </div>
                      <div className="hidden md:flex md:col-span-1 items-center justify-end">
                        <p className="text-sm text-red-700 font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit, branding.currency) : '—'}
                        </p>
                      </div>
                      <div className="flex md:col-span-2 items-center justify-between md:justify-end">
                        <div className="flex gap-3 md:hidden">
                          {entry.debit  > 0 && <p className="text-sm text-emerald-700 font-medium">-{formatCurrency(entry.debit,  branding.currency)}</p>}
                          {entry.credit > 0 && <p className="text-sm text-red-700 font-medium">+{formatCurrency(entry.credit, branding.currency)}</p>}
                        </div>
                        <p className="text-sm font-semibold text-gray-900">{formatCurrency(entry.balance, branding.currency)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {filteredEntries.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700">Closing balance (we owe)</p>
                <p className={`text-sm font-bold ${supplier.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {formatCurrency(supplier.currentBalance, branding.currency)}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info tab */}
      {activeTab === 'info' && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {[
            { label: 'Supplier code',   value: supplier.code },
            { label: 'Contact person',  value: supplier.contactPerson ?? '—' },
            { label: 'Phone',           value: supplier.phone },
            { label: 'WhatsApp',        value: supplier.whatsapp ?? 'Same as phone' },
            { label: 'Email',           value: supplier.email ?? '—' },
            { label: 'Address',         value: supplier.address ?? '—' },
            { label: 'CR Number',       value: supplier.crNumber ?? '—' },
            { label: 'Opening balance', value: formatCurrency(supplier.openingBalance, branding.currency) },
            { label: 'Current balance', value: formatCurrency(supplier.currentBalance, branding.currency) },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-gray-500">{row.label}</p>
              <p className="text-sm font-medium text-gray-900">{row.value}</p>
            </div>
          ))}
          {can.manageSuppliers(role) && (
            <div className="px-4 py-3">
              <button
                onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <i className="ti ti-edit" aria-hidden="true" /> Edit supplier
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
