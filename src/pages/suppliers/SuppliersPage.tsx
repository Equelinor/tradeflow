import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleSuppliers } from './supplierData';

export default function SuppliersPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'outstanding' | 'inactive'>('all');

  // TODO: replace with useSuppliers(companyId) when Firebase ready
  const suppliers = sampleSuppliers;

  const filtered = useMemo(() => {
    let list = [...suppliers];
    if (filter === 'outstanding') list = list.filter(s => s.currentBalance > 0);
    else if (filter === 'inactive') list = list.filter(s => s.status === 'inactive');
    else list = list.filter(s => s.status === 'active');
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.phone.includes(q) ||
        (s.contactPerson ?? '').toLowerCase().includes(q) ||
        (s.crNumber ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [suppliers, search, filter]);

  const active       = suppliers.filter(s => s.status === 'active');
  const totalPayable = active.reduce((s, sup) => s + sup.currentBalance, 0);
  const withBalance  = active.filter(s => s.currentBalance > 0).length;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Suppliers</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {active.length} suppliers · {withBalance} with outstanding payable
          </p>
        </div>
        {can.manageSuppliers(role) && (
          <button
            onClick={() => navigate('/suppliers/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">Add Supplier</span>
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total payable</p>
          <p className="text-base md:text-lg font-semibold text-red-700">
            {formatCurrency(totalPayable, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">With balance</p>
          <p className={`text-base md:text-lg font-semibold ${withBalance > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {withBalance}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Active suppliers</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{active.length}</p>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input
            type="text" value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, phone, contact..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
          />
        </div>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="all">Active</option>
          <option value="outstanding">With balance</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* List */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-building-store text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">
              {search ? 'No suppliers match your search.' : 'No suppliers yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">Code</div>
              <div className="col-span-4">Supplier</div>
              <div className="col-span-2">Phone</div>
              <div className="col-span-2 text-right">We owe</div>
              <div className="col-span-3 text-right">Actions</div>
            </div>

            {filtered.map(supplier => (
              <div
                key={supplier.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/suppliers/${supplier.id}`)}
              >
                <div className="hidden md:flex md:col-span-1 items-center">
                  <p className="text-xs font-mono text-gray-400">{supplier.code}</p>
                </div>

                <div className="md:col-span-4 flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-semibold ${
                    supplier.status === 'inactive' ? 'bg-gray-100 text-gray-400' :
                    supplier.currentBalance > 0    ? 'bg-red-100 text-red-700'   :
                                                     'bg-emerald-100 text-emerald-700'
                  }`}>
                    {supplier.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{supplier.name}</p>
                      {supplier.status === 'inactive' && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Inactive</span>
                      )}
                    </div>
                    {supplier.contactPerson && (
                      <p className="text-xs text-gray-400">{supplier.contactPerson}</p>
                    )}
                  </div>
                </div>

                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-sm text-gray-600">{supplier.phone}</p>
                </div>

                <div className="flex md:col-span-2 items-center md:justify-end">
                  <p className={`text-sm font-semibold ${
                    supplier.currentBalance > 0 ? 'text-red-700' : 'text-emerald-700'
                  }`}>
                    {formatCurrency(supplier.currentBalance, currency)}
                  </p>
                  <p className="text-xs text-gray-400 ml-2 md:hidden">{supplier.phone}</p>
                </div>

                <div
                  className="hidden md:flex md:col-span-3 items-center justify-end gap-2"
                  onClick={e => e.stopPropagation()}
                >
                  {supplier.whatsapp && (
                    <a
                      href={`https://wa.me/${supplier.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-green-700 hover:bg-green-100 transition-colors"
                      title="WhatsApp"
                    >
                      <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
                    </a>
                  )}
                  {can.manageSuppliers(role) && (
                    <button
                      onClick={() => navigate(`/suppliers/${supplier.id}/edit`)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                      title="Edit"
                    >
                      <i className="ti ti-edit text-sm" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                    title="View ledger"
                  >
                    <i className="ti ti-chevron-right text-sm" aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
