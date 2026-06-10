import { useState, useMemo } from 'react';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import {
  buildAgingReceivables, buildAgingPayables, buildTopDebtors,
  buildStockSummary, buildDeadStock, buildSalesReport, buildCollectionSummary,
} from './reportData';
import { buildWhatsAppUrl } from '@/lib/formatters';

// ─────────────────────────────────────────────────────────────
// Reports Page — READ ONLY
// No Firestore writes. All calculations client-side.
// Aging: MVP uses invoice date. Future: dueDate when credit terms added.
// ─────────────────────────────────────────────────────────────

type ReportTab =
  | 'aging_receivables'
  | 'top_debtors'
  | 'collection'
  | 'stock_summary'
  | 'aging_payables'
  | 'sales_report'
  | 'dead_stock';

const TABS: { id: ReportTab; label: string; icon: string }[] = [
  { id: 'aging_receivables', label: 'Aging Receivables', icon: 'ti-clock-dollar'   },
  { id: 'top_debtors',       label: 'Top Debtors',       icon: 'ti-users'          },
  { id: 'collection',        label: 'Collections',        icon: 'ti-cash'           },
  { id: 'stock_summary',     label: 'Stock Summary',      icon: 'ti-packages'       },
  { id: 'aging_payables',    label: 'Aging Payables',     icon: 'ti-clock'          },
  { id: 'sales_report',      label: 'Sales Report',       icon: 'ti-chart-bar'      },
  { id: 'dead_stock',        label: 'Dead Stock',         icon: 'ti-trending-down'  },
];

export default function ReportsPage() {
  const { currency, companyName, phone } = useBranding();
  const [activeTab, setActiveTab] = useState<ReportTab>('aging_receivables');
  const [dateFrom,  setDateFrom]  = useState('');
  const [dateTo,    setDateTo]    = useState('');

  const fromDate = dateFrom ? new Date(dateFrom) : null;
  const toDate   = dateTo   ? (() => { const d = new Date(dateTo); d.setHours(23,59,59); return d; })() : null;

  const agingReceivables = useMemo(() => buildAgingReceivables(),              []);
  const agingPayables    = useMemo(() => buildAgingPayables(),                 []);
  const topDebtors       = useMemo(() => buildTopDebtors(),                    []);
  const stockSummary     = useMemo(() => buildStockSummary(),                  []);
  const deadStock        = useMemo(() => buildDeadStock(60),                   []);
  const salesReport      = useMemo(() => buildSalesReport(fromDate, toDate),   [dateFrom, dateTo]);
  const collections      = useMemo(() => buildCollectionSummary(fromDate, toDate), [dateFrom, dateTo]);

  const agingTotals = (rows: typeof agingReceivables) => ({
    current: rows.reduce((s, r) => s + r.current,  0),
    d31_60:  rows.reduce((s, r) => s + r.d31_60,   0),
    d61_90:  rows.reduce((s, r) => s + r.d61_90,   0),
    d90plus: rows.reduce((s, r) => s + r.d90plus,  0),
    total:   rows.reduce((s, r) => s + r.total,    0),
  });

  const bucketColor = (bucket: string) => ({
    current: 'text-emerald-700 bg-emerald-50',
    '31-60': 'text-amber-700 bg-amber-50',
    '61-90': 'text-orange-700 bg-orange-50',
    '90+':   'text-red-700 bg-red-50',
  }[bucket] ?? '');

  return (
    <div className="p-3 md:p-5 max-w-screen-xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Reports</h1>
          <p className="text-xs text-gray-400 mt-0.5">Read-only · All amounts in {currency}</p>
        </div>
        <p className="text-xs text-gray-400">
          Aging: from invoice date · Future: due date when credit terms added
        </p>
      </div>

      {/* Tab bar — horizontal scroll on mobile */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeTab === tab.id
                ? 'bg-emerald-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-300'
            }`}>
            <i className={`ti ${tab.icon} text-sm`} aria-hidden="true" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date filters — shown for sales + collection reports */}
      {(activeTab === 'sales_report' || activeTab === 'collection') && (
        <div className="flex gap-2 items-center bg-white border border-gray-200 rounded-xl p-3">
          <p className="text-xs text-gray-500 mr-1">Period:</p>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
          <span className="text-gray-400 text-sm">to</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="h-9 px-3 rounded-lg border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }}
              className="text-xs text-emerald-600 hover:text-emerald-700 ml-1">Clear</button>
          )}
        </div>
      )}

      {/* ── Aging Receivables ─────────────────────────────── */}
      {activeTab === 'aging_receivables' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Current (0–30)', val: agingTotals(agingReceivables).current,  color: 'text-emerald-700' },
              { label: '31–60 days',     val: agingTotals(agingReceivables).d31_60,   color: 'text-amber-600'  },
              { label: '61–90 days',     val: agingTotals(agingReceivables).d61_90,   color: 'text-orange-600' },
              { label: '90+ days',       val: agingTotals(agingReceivables).d90plus,  color: 'text-red-700'    },
              { label: 'Total',          val: agingTotals(agingReceivables).total,    color: 'text-gray-900'   },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-base font-semibold ${s.color}`}>{formatCurrency(s.val, currency)}</p>
              </div>
            ))}
          </div>
          <AgingTable rows={agingReceivables} currency={currency} label="Customer"
            phone={phone} companyName={companyName} type="receivable" />
        </div>
      )}

      {/* ── Top Debtors ───────────────────────────────────── */}
      {activeTab === 'top_debtors' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Total outstanding</p>
              <p className="text-base font-semibold text-red-700">
                {formatCurrency(topDebtors.reduce((s, r) => s + r.outstanding, 0), currency)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Customers with balance</p>
              <p className="text-base font-semibold text-gray-900">{topDebtors.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Oldest debt</p>
              <p className="text-base font-semibold text-red-700">
                {topDebtors.length > 0 ? `${Math.max(...topDebtors.map(r => r.oldestInvoiceDays))} days` : '—'}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-3">Customer</div>
              <div className="col-span-2 text-right">Outstanding</div>
              <div className="col-span-2 text-right">Oldest debt</div>
              <div className="col-span-2">Last sale</div>
              <div className="col-span-2">Last receipt</div>
              <div className="col-span-1" />
            </div>
            <div className="divide-y divide-gray-100">
              {topDebtors.map((row, i) => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                  <div className="md:col-span-3 flex items-center gap-2">
                    <span className="text-xs text-gray-400 w-5 text-right flex-shrink-0">{i + 1}</span>
                    <p className="text-sm font-medium text-gray-900">{row.name}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm font-semibold text-red-700">{formatCurrency(row.outstanding, currency)}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      row.oldestInvoiceDays > 90 ? 'bg-red-100 text-red-700' :
                      row.oldestInvoiceDays > 60 ? 'bg-orange-100 text-orange-700' :
                      row.oldestInvoiceDays > 30 ? 'bg-amber-100 text-amber-700' :
                                                    'bg-emerald-100 text-emerald-700'
                    }`}>{row.oldestInvoiceDays}d</span>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center">
                    <p className="text-xs text-gray-500">{row.lastSaleDate ? formatDate(row.lastSaleDate) : '—'}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center">
                    <p className="text-xs text-gray-500">{row.lastReceiptDate ? formatDate(row.lastReceiptDate) : 'Never'}</p>
                  </div>
                  <div className="flex md:col-span-1 items-center justify-between md:justify-end gap-2">
                    <p className="text-sm font-semibold text-red-700 md:hidden">{formatCurrency(row.outstanding, currency)}</p>
                    <a href={buildWhatsAppUrl('', `Dear ${row.name},\n\nThis is a reminder from ${companyName} regarding your outstanding balance of ${formatCurrency(row.outstanding, currency)}.\n\nKindly arrange payment at your earliest convenience.\n\nThank you,\n${companyName}`)}
                      target="_blank" rel="noopener noreferrer"
                      className="w-7 h-7 rounded-lg bg-green-50 flex items-center justify-center text-green-700 hover:bg-green-100 flex-shrink-0"
                      title="Send reminder">
                      <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ))}
              {topDebtors.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">No outstanding balances.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Collection Summary ────────────────────────────── */}
      {activeTab === 'collection' && (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Total collected</p>
              <p className="text-base font-semibold text-emerald-700">
                {formatCurrency(collections.reduce((s, r) => s + r.totalCollected, 0), currency)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Receipt count</p>
              <p className="text-base font-semibold text-gray-900">
                {collections.reduce((s, r) => s + r.receiptCount, 0)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Customers paid</p>
              <p className="text-base font-semibold text-gray-900">{collections.length}</p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-4">Customer</div>
              <div className="col-span-2 text-right">Receipts</div>
              <div className="col-span-3 text-right">Total collected</div>
              <div className="col-span-3">Last receipt</div>
            </div>
            <div className="divide-y divide-gray-100">
              {collections.map(row => (
                <div key={row.customerId} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                  <div className="md:col-span-4 flex items-center">
                    <p className="text-sm font-medium text-gray-900">{row.customerName}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm text-gray-600">{row.receiptCount}</p>
                  </div>
                  <div className="flex md:col-span-3 items-center md:justify-end justify-between">
                    <p className="text-sm font-semibold text-emerald-700">{formatCurrency(row.totalCollected, currency)}</p>
                    <p className="text-xs text-gray-400 md:hidden">{row.receiptCount} receipts</p>
                  </div>
                  <div className="hidden md:flex md:col-span-3 items-center">
                    <p className="text-xs text-gray-500">{row.lastReceiptDate ? formatDate(row.lastReceiptDate) : '—'}</p>
                  </div>
                </div>
              ))}
              {collections.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">No receipts in selected period.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Stock Summary ─────────────────────────────────── */}
      {activeTab === 'stock_summary' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Total stock value</p>
              <p className="text-base font-semibold text-gray-900">
                {formatCurrency(stockSummary.reduce((s, r) => s + r.stockValue, 0), currency)}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Active products</p>
              <p className="text-base font-semibold text-gray-900">{stockSummary.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Low stock</p>
              <p className={`text-base font-semibold ${stockSummary.filter(r => r.isLow).length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
                {stockSummary.filter(r => r.isLow).length}
              </p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Out of stock</p>
              <p className={`text-base font-semibold ${stockSummary.filter(r => r.currentStock === 0).length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
                {stockSummary.filter(r => r.currentStock === 0).length}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">Code</div>
              <div className="col-span-4">Product</div>
              <div className="col-span-1 text-center">Unit</div>
              <div className="col-span-2 text-right">Stock</div>
              <div className="col-span-2 text-right">Unit cost</div>
              <div className="col-span-2 text-right">Value</div>
            </div>
            <div className="divide-y divide-gray-100">
              {stockSummary.map(row => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <p className="text-xs font-mono text-gray-400">{row.code}</p>
                  </div>
                  <div className="md:col-span-4 flex items-center gap-2">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-medium text-gray-900">{row.name}</p>
                        {row.isLow && row.currentStock > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">Low</span>
                        )}
                        {row.currentStock === 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">Out</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 md:hidden">{row.code}</p>
                    </div>
                  </div>
                  <div className="hidden md:flex md:col-span-1 items-center justify-center">
                    <p className="text-xs text-gray-500">{row.unit}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className={`text-sm font-semibold ${row.currentStock === 0 ? 'text-red-700' : row.isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                      {row.currentStock} {row.unit}
                    </p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm text-gray-600">{formatCurrency(row.unitCost, currency)}</p>
                  </div>
                  <div className="flex md:col-span-2 items-center md:justify-end justify-between">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.stockValue, currency)}</p>
                    <p className="text-xs text-gray-500 md:hidden">{row.currentStock} {row.unit}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Aging Payables ────────────────────────────────── */}
      {activeTab === 'aging_payables' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Current (0–30)', val: agingTotals(agingPayables).current, color: 'text-emerald-700' },
              { label: '31–60 days',     val: agingTotals(agingPayables).d31_60,  color: 'text-amber-600'  },
              { label: '61–90 days',     val: agingTotals(agingPayables).d61_90,  color: 'text-orange-600' },
              { label: '90+ days',       val: agingTotals(agingPayables).d90plus, color: 'text-red-700'    },
              { label: 'Total payable',  val: agingTotals(agingPayables).total,   color: 'text-gray-900'   },
            ].map(s => (
              <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{s.label}</p>
                <p className={`text-base font-semibold ${s.color}`}>{formatCurrency(s.val, currency)}</p>
              </div>
            ))}
          </div>
          <AgingTable rows={agingPayables} currency={currency} label="Supplier"
            phone={phone} companyName={companyName} type="payable" />
        </div>
      )}

      {/* ── Sales Report ──────────────────────────────────── */}
      {activeTab === 'sales_report' && (
        <div className="space-y-4">
          {/* By period */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">By month</h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <div className="col-span-2">Period</div>
                <div className="col-span-2 text-right">Sales</div>
                <div className="col-span-2 text-right">Revenue</div>
                <div className="col-span-2 text-right">Collected</div>
                <div className="col-span-2 text-right">Outstanding</div>
                <div className="col-span-2 text-right">Collection %</div>
              </div>
              <div className="divide-y divide-gray-100">
                {salesReport.byPeriod.map(row => (
                  <div key={row.period} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                    <div className="md:col-span-2 flex items-center">
                      <p className="text-sm font-medium text-gray-900">{row.period}</p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm text-gray-600">{row.salesCount}</p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.revenue, currency)}</p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm text-emerald-700">{formatCurrency(row.collected, currency)}</p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className={`text-sm ${row.outstanding > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                        {formatCurrency(row.outstanding, currency)}
                      </p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm text-gray-600">
                        {row.revenue > 0 ? `${((row.collected / row.revenue) * 100).toFixed(0)}%` : '—'}
                      </p>
                    </div>
                    <div className="flex md:hidden items-center justify-between">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.revenue, currency)}</p>
                      {row.outstanding > 0 && (
                        <p className="text-sm text-red-700">{formatCurrency(row.outstanding, currency)} due</p>
                      )}
                    </div>
                  </div>
                ))}
                {salesReport.byPeriod.length === 0 && (
                  <div className="p-8 text-center text-sm text-gray-400">No sales in selected period.</div>
                )}
              </div>
            </div>
          </div>

          {/* By customer */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">By customer</h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <div className="col-span-4">Customer</div>
                <div className="col-span-2 text-right">Sales</div>
                <div className="col-span-3 text-right">Revenue</div>
                <div className="col-span-3 text-right">Outstanding</div>
              </div>
              <div className="divide-y divide-gray-100">
                {salesReport.byCustomer.map(row => (
                  <div key={row.customerId} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                    <div className="md:col-span-4 flex items-center">
                      <p className="text-sm font-medium text-gray-900">{row.customerName}</p>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm text-gray-600">{row.salesCount}</p>
                    </div>
                    <div className="flex md:col-span-3 items-center md:justify-end justify-between">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.revenue, currency)}</p>
                      <p className="text-xs text-gray-400 md:hidden">{row.salesCount} sales</p>
                    </div>
                    <div className="hidden md:flex md:col-span-3 items-center justify-end">
                      <p className={`text-sm ${row.outstanding > 0 ? 'text-red-700 font-medium' : 'text-emerald-700'}`}>
                        {row.outstanding > 0 ? formatCurrency(row.outstanding, currency) : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* By product */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">By product</h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <div className="col-span-5">Product</div>
                <div className="col-span-2 text-right">Qty sold</div>
                <div className="col-span-3 text-right">Revenue</div>
                <div className="col-span-2" />
              </div>
              <div className="divide-y divide-gray-100">
                {salesReport.byProduct.map(row => (
                  <div key={row.productId} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                    <div className="md:col-span-5 flex items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{row.productName}</p>
                        <p className="text-xs text-gray-400">{row.productCode}</p>
                      </div>
                    </div>
                    <div className="hidden md:flex md:col-span-2 items-center justify-end">
                      <p className="text-sm text-gray-600">{row.totalQty} {row.unit}</p>
                    </div>
                    <div className="flex md:col-span-3 items-center md:justify-end justify-between">
                      <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.totalRevenue, currency)}</p>
                      <p className="text-xs text-gray-400 md:hidden">{row.totalQty} {row.unit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Dead Stock ────────────────────────────────────── */}
      {activeTab === 'dead_stock' && (
        <div className="space-y-3">
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
            <p className="text-sm text-amber-800">
              <strong>Dead stock</strong> — products with current stock but no movement in 60+ days.
              These represent tied-up capital.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Dead stock items</p>
              <p className="text-base font-semibold text-amber-600">{deadStock.length}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-1">Capital tied up</p>
              <p className="text-base font-semibold text-amber-600">
                {formatCurrency(deadStock.reduce((s, r) => s + r.stockValue, 0), currency)}
              </p>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">Code</div>
              <div className="col-span-3">Product</div>
              <div className="col-span-2 text-right">Stock</div>
              <div className="col-span-2 text-right">Value</div>
              <div className="col-span-2">Last movement</div>
              <div className="col-span-2 text-right">Days idle</div>
            </div>
            <div className="divide-y divide-gray-100">
              {deadStock.map(row => (
                <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <p className="text-xs font-mono text-gray-400">{row.code}</p>
                  </div>
                  <div className="md:col-span-3 flex items-center">
                    <p className="text-sm font-medium text-gray-900">{row.name}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm text-gray-700">{row.currentStock} {row.unit}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.stockValue, currency)}</p>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center">
                    <p className="text-xs text-gray-500">
                      {row.lastMovementDate ? formatDate(row.lastMovementDate) : 'Never'}
                    </p>
                  </div>
                  <div className="flex md:col-span-2 items-center md:justify-end justify-between">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      row.daysSinceMovement >= 90 ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                    }`}>{row.daysSinceMovement}d</span>
                    <p className="text-xs text-gray-500 md:hidden">{formatCurrency(row.stockValue, currency)}</p>
                  </div>
                </div>
              ))}
              {deadStock.length === 0 && (
                <div className="p-8 text-center text-sm text-gray-400">
                  No dead stock. All products moved in the last 60 days.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared AgingTable component ───────────────────────────────
function AgingTable({
  rows, currency, label, phone, companyName, type
}: {
  rows: ReturnType<typeof buildAgingReceivables>;
  currency: string;
  label: string;
  phone: string;
  companyName: string;
  type: 'receivable' | 'payable';
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
        <div className="col-span-3">{label}</div>
        <div className="col-span-2 text-right">Current</div>
        <div className="col-span-2 text-right">31–60</div>
        <div className="col-span-1 text-right">61–90</div>
        <div className="col-span-2 text-right">90+</div>
        <div className="col-span-2 text-right">Total</div>
      </div>
      <div className="divide-y divide-gray-100">
        {rows.map(row => (
          <div key={row.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50">
            <div className="md:col-span-3 flex items-center gap-2">
              <p className="text-sm font-medium text-gray-900">{row.name}</p>
            </div>
            <div className="hidden md:flex md:col-span-2 items-center justify-end">
              <p className="text-sm text-emerald-700">{row.current > 0 ? formatCurrency(row.current, currency) : '—'}</p>
            </div>
            <div className="hidden md:flex md:col-span-2 items-center justify-end">
              <p className={`text-sm ${row.d31_60 > 0 ? 'text-amber-700 font-medium' : 'text-gray-400'}`}>
                {row.d31_60 > 0 ? formatCurrency(row.d31_60, currency) : '—'}
              </p>
            </div>
            <div className="hidden md:flex md:col-span-1 items-center justify-end">
              <p className={`text-sm ${row.d61_90 > 0 ? 'text-orange-700 font-medium' : 'text-gray-400'}`}>
                {row.d61_90 > 0 ? formatCurrency(row.d61_90, currency) : '—'}
              </p>
            </div>
            <div className="hidden md:flex md:col-span-2 items-center justify-end">
              <p className={`text-sm ${row.d90plus > 0 ? 'text-red-700 font-bold' : 'text-gray-400'}`}>
                {row.d90plus > 0 ? formatCurrency(row.d90plus, currency) : '—'}
              </p>
            </div>
            <div className="flex md:col-span-2 items-center md:justify-end justify-between">
              <p className="text-sm font-semibold text-gray-900">{formatCurrency(row.total, currency)}</p>
              {/* Mobile: show buckets inline */}
              <div className="flex gap-1 md:hidden">
                {row.d90plus > 0 && <span className="text-xs px-1.5 py-0.5 rounded bg-red-100 text-red-700">90+</span>}
                {row.d61_90 > 0  && <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 text-orange-700">61–90</span>}
                {row.d31_60 > 0  && <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">31–60</span>}
              </div>
            </div>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="p-8 text-center text-sm text-gray-400">
            No {type === 'receivable' ? 'outstanding receivables' : 'outstanding payables'}.
          </div>
        )}
      </div>
      {/* Totals row */}
      {rows.length > 0 && (() => {
        const t = rows.reduce((acc, r) => ({
          current: acc.current + r.current, d31_60: acc.d31_60 + r.d31_60,
          d61_90:  acc.d61_90  + r.d61_90,  d90plus: acc.d90plus + r.d90plus,
          total:   acc.total   + r.total,
        }), { current: 0, d31_60: 0, d61_90: 0, d90plus: 0, total: 0 });
        return (
          <div className="grid grid-cols-12 gap-3 px-4 py-3 bg-gray-50 border-t border-gray-200">
            <div className="col-span-3 flex items-center">
              <p className="text-sm font-semibold text-gray-700">Total</p>
            </div>
            <div className="hidden md:flex col-span-2 items-center justify-end">
              <p className="text-sm font-semibold text-emerald-700">{formatCurrency(t.current, currency)}</p>
            </div>
            <div className="hidden md:flex col-span-2 items-center justify-end">
              <p className="text-sm font-semibold text-amber-700">{formatCurrency(t.d31_60, currency)}</p>
            </div>
            <div className="hidden md:flex col-span-1 items-center justify-end">
              <p className="text-sm font-semibold text-orange-700">{formatCurrency(t.d61_90, currency)}</p>
            </div>
            <div className="hidden md:flex col-span-2 items-center justify-end">
              <p className="text-sm font-semibold text-red-700">{formatCurrency(t.d90plus, currency)}</p>
            </div>
            <div className="col-span-2 md:col-span-2 flex items-center justify-end">
              <p className="text-sm font-bold text-gray-900">{formatCurrency(t.total, currency)}</p>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
