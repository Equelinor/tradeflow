import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { can } from '@/lib/permissions';
import { useAuth } from '@/context/AuthContext';
import { sampleCustomers } from './customerData';

export default function CustomersPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'overlimit'>('all');

  // TODO: replace with useCustomers(companyId) when Firebase is connected
  const customers = sampleCustomers;

  const filtered = useMemo(() => {
    let list = [...customers];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.crNumber ?? '').toLowerCase().includes(q)
      );
    }
    if (filter === 'overdue')   list = list.filter(c => c.currentBalance > 0);
    if (filter === 'overlimit') list = list.filter(c =>
      c.creditLimit != null && c.currentBalance > c.creditLimit
    );
    return list;
  }, [customers, search, filter]);

  const totalReceivable = customers.reduce((s, c) => s + c.currentBalance, 0);
  const overdueCount    = customers.filter(c => c.currentBalance > 0).length;
  const overLimitCount  = customers.filter(c =>
    c.creditLimit != null && c.currentBalance > c.creditLimit
  ).length;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Customers</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {customers.length} customers · {overdueCount} with outstanding balance
          </p>
        </div>
        {can.manageCustomers(role) && (
          <button
            onClick={() => navigate('/customers/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">Add Customer</span>
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total receivable</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">
            {formatCurrency(totalReceivable, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">With balance</p>
          <p className="text-base md:text-lg font-semibold text-red-700">{overdueCount}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Over limit</p>
          <p className={`text-base md:text-lg font-semibold ${overLimitCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {overLimitCount}
          </p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, phone, CR number..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="all">All customers</option>
          <option value="overdue">With balance</option>
          <option value="overlimit">Over credit limit</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-users text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">
              {search ? 'No customers match your search.' : 'No customers yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Desktop column header */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-4">Customer</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2 text-right">Balance</div>
              <div className="col-span-2 text-right">Credit limit</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filtered.map(customer => {
              const isOverLimit = customer.creditLimit != null &&
                customer.currentBalance > customer.creditLimit;
              const limitPct = customer.creditLimit
                ? Math.min((customer.currentBalance / customer.creditLimit) * 100, 100)
                : 0;

              return (
                <div
                  key={customer.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/customers/${customer.id}`)}
                >
                  {/* Name + badge */}
                  <div className="md:col-span-4 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                      isOverLimit            ? 'bg-red-100 text-red-700'     :
                      customer.currentBalance > 0 ? 'bg-amber-100 text-amber-700' :
                                               'bg-emerald-100 text-emerald-700'
                    }`}>
                      {customer.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{customer.name}</p>
                        {isOverLimit && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                            Over limit
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 md:hidden">{customer.phone}</p>
                    </div>
                  </div>

                  {/* Phone — desktop only */}
                  <div className="hidden md:flex md:col-span-2 items-center">
                    <p className="text-sm text-gray-600">{customer.phone}</p>
                  </div>

                  {/* Balance */}
                  <div className="flex md:col-span-2 md:justify-end items-center">
                    <p className={`text-sm font-semibold ${
                      customer.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'
                    }`}>
                      {formatCurrency(customer.currentBalance, currency)}
                    </p>
                  </div>

                  {/* Credit limit + bar */}
                  <div className="hidden md:flex md:col-span-2 flex-col justify-center items-end gap-1">
                    {customer.creditLimit != null ? (
                      <>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(customer.creditLimit, currency)}
                        </p>
                        <div className="w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              limitPct >= 100 ? 'bg-red-500' :
                              limitPct >= 80  ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${limitPct}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-gray-400">No limit set</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div
                    className="hidden md:flex md:col-span-2 items-center justify-end gap-2"
                    onClick={e => e.stopPropagation()}
                  >
                    {customer.whatsapp && (
                      <a
                        href={`https://wa.me/${customer.whatsapp}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors"
                        title="Open WhatsApp"
                      >
                        <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
                      </a>
                    )}
                    <button
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                      title="View details"
                    >
                      <i className="ti ti-chevron-right text-sm" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
