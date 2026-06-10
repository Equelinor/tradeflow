import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { samplePurchases } from './purchaseData';

export default function PurchasesPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();
  const [search,   setSearch]  = useState('');
  const [filter,   setFilter]  = useState<'all' | 'cash' | 'credit' | 'partial' | 'voided'>('all');
  const [dateFrom, setDateFrom]= useState('');
  const [dateTo,   setDateTo]  = useState('');

  // TODO: replace with usePurchases(companyId) when Firebase ready
  const purchases = samplePurchases;

  const filtered = useMemo(() => {
    let list = [...purchases];
    if (filter === 'voided') list = list.filter(p => p.isVoid);
    else if (filter !== 'all') list = list.filter(p => !p.isVoid && p.paymentType === filter);
    else list = list.filter(p => !p.isVoid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.purchaseNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.supplierInvoiceNo ?? '').toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter(p => p.date.toDate() >= new Date(dateFrom));
    if (dateTo) { const to = new Date(dateTo); to.setHours(23,59,59); list = list.filter(p => p.date.toDate() <= to); }
    return list.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [purchases, filter, search, dateFrom, dateTo]);

  const active       = purchases.filter(p => !p.isVoid);
  const totalSpend   = active.reduce((s, p) => s + p.grandTotal, 0);
  const totalDue     = active.reduce((s, p) => s + p.amountDue, 0);
  const todayPurchases = active.filter(p => {
    const d = p.date.toDate(); const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  });

  return (
    <div className="p-3 md:p-5 max-w-screen-xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Purchases</h1>
          <p className="text-xs text-gray-400 mt-0.5">{active.length} purchases · {todayPurchases.length} today</p>
        </div>
        {can.manageSuppliers(role) && (
          <button onClick={() => navigate('/purchases/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">New Purchase</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total spend</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{formatCurrency(totalSpend, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Outstanding payable</p>
          <p className={`text-base md:text-lg font-semibold ${totalDue > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {formatCurrency(totalDue, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Today</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">
            {formatCurrency(todayPurchases.reduce((s,p) => s + p.grandTotal, 0), currency)}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search purchase no, supplier, inv. no..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        <select value={filter} onChange={e => setFilter(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none">
          <option value="all">All active</option>
          <option value="cash">Cash</option>
          <option value="credit">Credit</option>
          <option value="partial">Partial</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-shopping-cart text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">No purchases found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Number</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Supplier</div>
              <div className="col-span-2">Supplier Inv.</div>
              <div className="col-span-1 text-right">Total</div>
              <div className="col-span-2 text-right">Type / Due</div>
            </div>
            {filtered.map(purchase => (
              <div key={purchase.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/purchases/${purchase.id}`)}>
                <div className="md:col-span-2 flex items-center">
                  <p className="text-xs font-mono font-medium text-gray-700">{purchase.purchaseNumber}</p>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-sm text-gray-600">{formatDate(purchase.date)}</p>
                </div>
                <div className="md:col-span-3 flex items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{purchase.supplierName}</p>
                    <p className="text-xs text-gray-400 md:hidden">{formatDate(purchase.date)}</p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-xs text-gray-500 font-mono">{purchase.supplierInvoiceNo ?? '—'}</p>
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end">
                  <p className={`text-sm font-semibold ${purchase.isVoid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {formatCurrency(purchase.grandTotal, currency)}
                  </p>
                </div>
                <div className="flex md:col-span-2 items-center justify-between md:justify-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                      purchase.isVoid ? 'bg-gray-100 text-gray-500' :
                      purchase.paymentType === 'cash'    ? 'bg-emerald-100 text-emerald-700' :
                      purchase.paymentType === 'credit'  ? 'bg-blue-100 text-blue-700' :
                                                            'bg-amber-100 text-amber-700'
                    }`}>{purchase.isVoid ? 'Voided' : purchase.paymentType}</span>
                    {purchase.amountDue > 0 && !purchase.isVoid && (
                      <span className="text-xs text-red-700 font-medium">{formatCurrency(purchase.amountDue, currency)}</span>
                    )}
                  </div>
                  <i className="ti ti-chevron-right text-gray-400 text-sm" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
