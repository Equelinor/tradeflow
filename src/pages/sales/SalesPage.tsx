import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleSales } from './saleData';

type FilterType = 'all' | 'cash' | 'credit' | 'partial' | 'voided';

export default function SalesPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();
  const [search, setSearch]   = useState('');
  const [filter, setFilter]   = useState<FilterType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');

  // TODO: replace with useSales(companyId) when Firebase ready
  const sales = sampleSales;

  const filtered = useMemo(() => {
    let list = [...sales];
    if (filter === 'voided')  list = list.filter(s => s.isVoid);
    else if (filter !== 'all') {
      list = list.filter(s => !s.isVoid && s.paymentType === filter);
    } else {
      list = list.filter(s => !s.isVoid);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.invoiceNumber.toLowerCase().includes(q) ||
        s.customerName.toLowerCase().includes(q)
      );
    }
    if (dateFrom) list = list.filter(s => s.date.toDate() >= new Date(dateFrom));
    if (dateTo) {
      const to = new Date(dateTo); to.setHours(23,59,59);
      list = list.filter(s => s.date.toDate() <= to);
    }
    return list.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [sales, filter, search, dateFrom, dateTo]);

  const activeSales  = sales.filter(s => !s.isVoid);
  const totalRevenue = activeSales.reduce((s, sale) => s + sale.grandTotal, 0);
  const totalDue     = activeSales.reduce((s, sale) => s + sale.amountDue, 0);
  const todaySales   = activeSales.filter(s => {
    const d = s.date.toDate();
    const today = new Date();
    return d.getDate() === today.getDate() &&
           d.getMonth() === today.getMonth() &&
           d.getFullYear() === today.getFullYear();
  });

  const paymentBadge = (type: string, isVoid: boolean) => {
    if (isVoid) return 'bg-gray-100 text-gray-500';
    if (type === 'cash')    return 'bg-emerald-100 text-emerald-700';
    if (type === 'credit')  return 'bg-blue-100 text-blue-700';
    if (type === 'partial') return 'bg-amber-100 text-amber-700';
    return 'bg-gray-100 text-gray-500';
  };

  return (
    <div className="p-3 md:p-5 max-w-screen-xl mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Sales</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {activeSales.length} sales · {todaySales.length} today
          </p>
        </div>
        {can.createSale(role) && (
          <button
            onClick={() => navigate('/sales/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">New Sale</span>
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total revenue</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">
            {formatCurrency(totalRevenue, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Outstanding</p>
          <p className={`text-base md:text-lg font-semibold ${totalDue > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {formatCurrency(totalDue, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Today</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">
            {formatCurrency(todaySales.reduce((s, sale) => s + sale.grandTotal, 0), currency)}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-48">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search invoice or customer..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none"
          />
        </div>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        <select value={filter} onChange={e => setFilter(e.target.value as FilterType)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="all">All active</option>
          <option value="cash">Cash sales</option>
          <option value="credit">Credit sales</option>
          <option value="partial">Partial</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-receipt text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">No sales found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Invoice</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1 text-right">Due</div>
              <div className="col-span-2 text-right">Type</div>
            </div>

            {filtered.map(sale => (
              <div
                key={sale.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/sales/${sale.id}`)}
              >
                <div className="md:col-span-2 flex items-center">
                  <p className="text-xs font-mono text-gray-700 font-medium">{sale.invoiceNumber}</p>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-sm text-gray-600">{formatDate(sale.date)}</p>
                </div>
                <div className="md:col-span-3 flex items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{sale.customerName}</p>
                    <p className="text-xs text-gray-400 md:hidden">{formatDate(sale.date)}</p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center justify-end">
                  <p className={`text-sm font-semibold ${sale.isVoid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {formatCurrency(sale.grandTotal, currency)}
                  </p>
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end">
                  <p className={`text-sm ${sale.amountDue > 0 ? 'text-red-700 font-medium' : 'text-emerald-700'}`}>
                    {sale.amountDue > 0 ? formatCurrency(sale.amountDue, currency) : '—'}
                  </p>
                </div>
                <div className="flex md:col-span-2 items-center justify-between md:justify-end gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${paymentBadge(sale.paymentType, sale.isVoid)}`}>
                      {sale.isVoid ? 'Voided' : sale.paymentType}
                    </span>
                    <p className="text-sm font-semibold md:hidden">
                      {formatCurrency(sale.grandTotal, currency)}
                    </p>
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
