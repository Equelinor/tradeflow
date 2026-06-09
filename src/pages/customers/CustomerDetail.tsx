import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate, buildWhatsAppUrl } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { sampleCustomers, sampleLedgerEntries } from './customerData';
import type { LedgerFilter } from './customerData';

// PDF generation — branded-documents skill
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function CustomerDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const branding     = useBranding();
  const { role }     = useAuth();
  const [activeTab, setActiveTab] = useState<'ledger' | 'info'>('ledger');

  // TODO: replace with useCustomer(companyId, id) when Firebase ready
  const customer = sampleCustomers.find(c => c.id === id) ?? sampleCustomers[0];
  const allEntries = sampleLedgerEntries;

  // ── Ledger filters ────────────────────────────────────────
  const [filters, setFilters] = useState<LedgerFilter>({
    dateFrom: '', dateTo: '',
    type: 'all', status: 'all',
  });

  function updateFilter(key: keyof LedgerFilter, val: string) {
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
    if (filters.type !== 'all') {
      list = list.filter(e => e.type === filters.type);
    }
    if (filters.status === 'paid')   list = list.filter(e => e.paymentType === 'cash');
    if (filters.status === 'unpaid') list = list.filter(e => e.paymentType === 'credit');
    return list.sort((a, b) => a.date.toDate().getTime() - b.date.toDate().getTime());
  }, [allEntries, filters]);

  const hasActiveFilters = filters.dateFrom || filters.dateTo ||
    filters.type !== 'all' || filters.status !== 'all';

  // ── Credit limit status ───────────────────────────────────
  const isOverLimit = customer.creditLimit != null &&
    customer.currentBalance > customer.creditLimit;
  const creditUsedPct = customer.creditLimit
    ? Math.min((customer.currentBalance / customer.creditLimit) * 100, 100)
    : 0;

  // ── WhatsApp reminder ─────────────────────────────────────
  function sendReminder() {
    const msg = `Dear ${customer.name},\n\nThis is a friendly reminder from ${branding.companyName} that your outstanding balance is ${formatCurrency(customer.currentBalance, branding.currency)}.\n\nKindly arrange payment at your earliest convenience.\n\nThank you,\n${branding.companyName}\n${branding.phone}`;
    window.open(buildWhatsAppUrl(customer.whatsapp ?? customer.phone, msg), '_blank');
  }

  // ── Statement PDF — branded-documents skill ───────────────
  async function generateStatement() {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pageW  = 210;
    const margin = 14;

    // Header — company branding
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(30, 30, 30);
    doc.text(branding.companyName, margin, 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(90, 90, 90);
    doc.text(branding.address,           pageW - margin, 14, { align: 'right' });
    doc.text(`Tel: ${branding.phone}`,   pageW - margin, 19, { align: 'right' });
    doc.text(branding.email,             pageW - margin, 24, { align: 'right' });
    if (branding.crNumber)  doc.text(`CR: ${branding.crNumber}`,   pageW - margin, 29, { align: 'right' });
    if (branding.vatNumber) doc.text(`VAT: ${branding.vatNumber}`, pageW - margin, 34, { align: 'right' });

    // Divider
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(margin, 38, pageW - margin, 38);

    // Statement title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text('CUSTOMER STATEMENT', margin, 48);

    // Customer info
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 60, 60);
    doc.text(`Customer: ${customer.name}`, margin, 56);
    doc.text(`Phone: ${customer.phone}`,   margin, 61);
    if (customer.crNumber) doc.text(`CR: ${customer.crNumber}`, margin, 66);
    doc.text(`Date: ${new Date().toLocaleDateString('en-GB')}`, pageW - margin, 56, { align: 'right' });

    // Ledger table
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
        0: { cellWidth: 22 },
        1: { cellWidth: 60 },
        2: { cellWidth: 28 },
        3: { cellWidth: 26, halign: 'right' },
        4: { cellWidth: 26, halign: 'right' },
        5: { cellWidth: 26, halign: 'right' },
      },
      margin: { left: margin, right: margin },
    });

    // Closing balance
    const finalY = (doc as any).lastAutoTable.finalY + 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(30, 30, 30);
    doc.text('Closing Balance:', pageW - margin - 50, finalY);
    doc.setTextColor(customer.currentBalance > 0 ? 153 : 15, customer.currentBalance > 0 ? 60 : 110, customer.currentBalance > 0 ? 29 : 86);
    doc.text(formatCurrency(customer.currentBalance, branding.currency), pageW - margin, finalY, { align: 'right' });

    // Page numbers
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(150);
      doc.text(`Page ${i} of ${pageCount}`, pageW - margin, 290, { align: 'right' });
      doc.text(branding.companyName, margin, 290);
    }

    const filename = `Statement_${customer.name.replace(/\s+/g, '-')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(filename);
  }

  // ── Share statement via WhatsApp ──────────────────────────
  async function shareStatementWhatsApp() {
    // Generate PDF first, then share link with message
    // Full WhatsApp document sharing requires WhatsApp Business API (Pro feature)
    // For MVP: generate PDF download + open WhatsApp with message
    await generateStatement();
    const msg = `Dear ${customer.name},\n\nPlease find your account statement from ${branding.companyName} attached.\n\nOutstanding balance: ${formatCurrency(customer.currentBalance, branding.currency)}\n\nThank you,\n${branding.companyName}`;
    setTimeout(() => {
      window.open(buildWhatsAppUrl(customer.whatsapp ?? customer.phone, msg), '_blank');
    }, 500);
  }

  // ── Type badge helper ─────────────────────────────────────
  function typeBadge(type: string) {
    const map: Record<string, { bg: string; text: string; icon: string; label: string }> = {
      sale:        { bg: 'bg-blue-50',    text: 'text-blue-700',   icon: 'ti-receipt',   label: 'Sale'        },
      receipt:     { bg: 'bg-emerald-50', text: 'text-emerald-700',icon: 'ti-cash',      label: 'Receipt'     },
      credit_note: { bg: 'bg-amber-50',   text: 'text-amber-700',  icon: 'ti-file-minus',label: 'Credit Note' },
      opening:     { bg: 'bg-gray-50',    text: 'text-gray-600',   icon: 'ti-flag',      label: 'Opening'     },
    };
    return map[type] ?? map.opening;
  }

  if (!customer) {
    return (
      <div className="p-6 text-center text-gray-400">Customer not found.</div>
    );
  }

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Back */}
      <button
        onClick={() => navigate('/customers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> Customers
      </button>

      {/* Customer header card */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">

          {/* Avatar + name */}
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 ${
              isOverLimit ? 'bg-red-100 text-red-700' :
              customer.currentBalance > 0 ? 'bg-amber-100 text-amber-700' :
              'bg-emerald-100 text-emerald-700'
            }`}>
              {customer.name.substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">{customer.name}</h2>
                {isOverLimit && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    Over credit limit
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{customer.phone}</p>
            </div>
          </div>

          {/* Balance card */}
          <div className="flex gap-3 md:gap-4 flex-wrap">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Outstanding</p>
              <p className={`text-base font-bold ${customer.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                {formatCurrency(customer.currentBalance, branding.currency)}
              </p>
            </div>
            {customer.creditLimit != null && (
              <div className="text-center px-4 py-2 bg-gray-50 rounded-xl min-w-24">
                <p className="text-xs text-gray-400 mb-0.5">Credit limit</p>
                <p className="text-base font-bold text-gray-900">
                  {formatCurrency(customer.creditLimit, branding.currency)}
                </p>
                <div className="w-full h-1 bg-gray-200 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${creditUsedPct >= 100 ? 'bg-red-500' : creditUsedPct >= 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${creditUsedPct}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            {customer.currentBalance > 0 && (
              <button
                onClick={sendReminder}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-50 text-green-700 border border-green-200 text-sm font-medium rounded-xl hover:bg-green-100 transition-colors"
              >
                <i className="ti ti-brand-whatsapp" aria-hidden="true" />
                <span className="hidden md:inline">Remind</span>
              </button>
            )}
            <button
              onClick={shareStatementWhatsApp}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-50 text-blue-700 border border-blue-200 text-sm font-medium rounded-xl hover:bg-blue-100 transition-colors"
            >
              <i className="ti ti-file-text" aria-hidden="true" />
              <span className="hidden md:inline">Statement</span>
            </button>
            {can.createSale(role) && (
              <button
                onClick={() => navigate(`/sales/new?customerId=${customer.id}`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
              >
                <i className="ti ti-plus" aria-hidden="true" />
                <span className="hidden md:inline">New Sale</span>
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
              activeTab === tab
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
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
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={e => updateFilter('dateFrom', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={e => updateFilter('dateTo', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={e => updateFilter('type', e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
                >
                  <option value="all">All types</option>
                  <option value="sale">Sales</option>
                  <option value="receipt">Receipts</option>
                  <option value="credit_note">Credit notes</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={e => updateFilter('status', e.target.value)}
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
            {/* Desktop header */}
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
                    <div
                      key={entry.id}
                      className="grid grid-cols-1 md:grid-cols-12 gap-1 md:gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                    >
                      {/* Date + type — mobile combined row */}
                      <div className="md:col-span-2 flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${badge.bg}`}>
                          <i className={`ti ${badge.icon} text-xs ${badge.text}`} aria-hidden="true" />
                        </div>
                        <div className="md:hidden">
                          <p className="text-xs font-medium text-gray-900">{badge.label}</p>
                          <p className="text-xs text-gray-400">{formatDate(entry.date)}</p>
                        </div>
                        <p className="hidden md:block text-xs text-gray-600">
                          {formatDate(entry.date)}
                        </p>
                      </div>

                      {/* Description */}
                      <div className="md:col-span-4 flex items-center md:pl-0">
                        <div>
                          <p className="text-sm text-gray-900">{entry.description}</p>
                          <span className={`hidden md:inline text-xs font-medium px-1.5 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                            {badge.label}
                          </span>
                        </div>
                      </div>

                      {/* Reference */}
                      <div className="hidden md:flex md:col-span-2 items-center">
                        <p className="text-xs text-gray-500 font-mono">{entry.refNumber ?? '—'}</p>
                      </div>

                      {/* Debit */}
                      <div className="hidden md:flex md:col-span-1 items-center justify-end">
                        <p className="text-sm text-red-700 font-medium">
                          {entry.debit > 0 ? formatCurrency(entry.debit, branding.currency) : '—'}
                        </p>
                      </div>

                      {/* Credit */}
                      <div className="hidden md:flex md:col-span-1 items-center justify-end">
                        <p className="text-sm text-emerald-700 font-medium">
                          {entry.credit > 0 ? formatCurrency(entry.credit, branding.currency) : '—'}
                        </p>
                      </div>

                      {/* Balance + mobile amounts */}
                      <div className="flex md:col-span-2 items-center justify-between md:justify-end">
                        {/* Mobile: show debit/credit */}
                        <div className="flex gap-3 md:hidden">
                          {entry.debit > 0 && (
                            <p className="text-sm text-red-700 font-medium">
                              +{formatCurrency(entry.debit, branding.currency)}
                            </p>
                          )}
                          {entry.credit > 0 && (
                            <p className="text-sm text-emerald-700 font-medium">
                              -{formatCurrency(entry.credit, branding.currency)}
                            </p>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-gray-900 md:text-right">
                          {formatCurrency(entry.balance, branding.currency)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Closing balance row */}
            {filteredEntries.length > 0 && (
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-200">
                <p className="text-sm font-medium text-gray-700">Closing balance</p>
                <p className={`text-sm font-bold ${customer.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {formatCurrency(customer.currentBalance, branding.currency)}
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
            { label: 'Full name',       value: customer.name },
            { label: 'Phone',           value: customer.phone },
            { label: 'WhatsApp',        value: customer.whatsapp ?? 'Same as phone' },
            { label: 'Address',         value: customer.address ?? '—' },
            { label: 'CR Number',       value: customer.crNumber ?? '—' },
            { label: 'Opening balance', value: formatCurrency(customer.openingBalance, branding.currency) },
            { label: 'Credit limit',    value: customer.creditLimit != null ? formatCurrency(customer.creditLimit, branding.currency) : 'No limit' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-gray-500">{row.label}</p>
              <p className="text-sm font-medium text-gray-900">{row.value}</p>
            </div>
          ))}
          {can.manageCustomers(role) && (
            <div className="px-4 py-3">
              <button
                onClick={() => navigate(`/customers/${customer.id}/edit`)}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <i className="ti ti-edit" aria-hidden="true" />
                Edit customer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
