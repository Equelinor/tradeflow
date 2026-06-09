import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleProducts, sampleStockMovements } from './productData';
import type { StockMovement } from './productData';

export default function ProductDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();

  const [activeTab, setActiveTab] = useState<'movements' | 'info'>('movements');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  // TODO: replace with useProduct(companyId, id) when Firebase ready
  const product   = sampleProducts.find(p => p.id === id) ?? sampleProducts[0];
  const movements = sampleStockMovements.filter(m => m.productId === product.id);

  const filtered = useMemo(() => {
    let list = [...movements];
    if (typeFilter !== 'all') list = list.filter(m => m.type === typeFilter);
    return list.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime());
  }, [movements, typeFilter]);

  const margin = product.purchasePrice > 0
    ? ((product.sellingPrice - product.purchasePrice) / product.purchasePrice * 100)
    : 0;

  const isLow    = product.currentStock > 0 && product.currentStock < product.minStockLevel;
  const isOut    = product.currentStock === 0;

  function movementIcon(type: StockMovement['type']) {
    const map: Record<string, { icon: string; bg: string; color: string; label: string; sign: string }> = {
      OPENING:       { icon: 'ti-flag',         bg: 'bg-gray-50',    color: 'text-gray-600',   label: 'Opening',       sign: '+' },
      SALE:          { icon: 'ti-receipt',       bg: 'bg-red-50',     color: 'text-red-600',    label: 'Sale',          sign: '−' },
      SALE_VOID:     { icon: 'ti-receipt-off',   bg: 'bg-gray-50',    color: 'text-gray-500',   label: 'Sale void',     sign: '+' },
      PURCHASE:      { icon: 'ti-shopping-cart', bg: 'bg-emerald-50', color: 'text-emerald-600',label: 'Purchase',      sign: '+' },
      PURCHASE_VOID: { icon: 'ti-x',             bg: 'bg-gray-50',    color: 'text-gray-500',   label: 'Purchase void', sign: '−' },
      CREDIT_NOTE:   { icon: 'ti-file-minus',    bg: 'bg-amber-50',   color: 'text-amber-600',  label: 'Return in',     sign: '+' },
      DEBIT_NOTE:    { icon: 'ti-file-plus',     bg: 'bg-purple-50',  color: 'text-purple-600', label: 'Return out',    sign: '−' },
      ADJUSTMENT_IN: { icon: 'ti-plus',          bg: 'bg-blue-50',    color: 'text-blue-600',   label: 'Adj. in',       sign: '+' },
      ADJUSTMENT_OUT:{ icon: 'ti-minus',         bg: 'bg-orange-50',  color: 'text-orange-600', label: 'Adj. out',      sign: '−' },
    };
    return map[type] ?? map.OPENING;
  }

  if (!product) return <div className="p-6 text-center text-gray-400">Product not found.</div>;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Back */}
      <button
        onClick={() => navigate('/products')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" /> Products
      </button>

      {/* Product header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">

          {/* Icon + name */}
          <div className="flex items-center gap-3 flex-1">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              isOut ? 'bg-red-100' : isLow ? 'bg-amber-100' : 'bg-emerald-100'
            }`}>
              <i className={`ti ti-package text-xl ${
                isOut ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-emerald-600'
              }`} aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold text-gray-900">{product.name}</h2>
                {product.status === 'inactive' && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>
                )}
                {isOut && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">Out of stock</span>
                )}
                {isLow && !isOut && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Low stock</span>
                )}
              </div>
              <p className="text-sm text-gray-500 mt-0.5">{product.code} · {product.category} · {product.unit}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 md:flex gap-3 md:gap-4">
            <div className="text-center px-3 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Stock</p>
              <p className={`text-base font-bold ${isOut ? 'text-red-700' : isLow ? 'text-amber-600' : 'text-gray-900'}`}>
                {product.currentStock}
              </p>
              <p className="text-xs text-gray-400">{product.unit}</p>
            </div>
            <div className="text-center px-3 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Buy price</p>
              <p className="text-base font-bold text-gray-900">{formatCurrency(product.purchasePrice, currency)}</p>
            </div>
            <div className="text-center px-3 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Sell price</p>
              <p className="text-base font-bold text-emerald-700">{formatCurrency(product.sellingPrice, currency)}</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <div className="text-center px-3 py-2 bg-emerald-50 rounded-xl border border-emerald-200">
              <p className="text-xs text-emerald-600 mb-0.5">Margin</p>
              <p className="text-base font-bold text-emerald-700">{margin.toFixed(1)}%</p>
            </div>
            {can.manageProducts(role) && (
              <button
                onClick={() => navigate(`/products/${product.id}/edit`)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors self-start"
              >
                <i className="ti ti-edit" aria-hidden="true" />
                <span className="hidden md:inline">Edit</span>
              </button>
            )}
          </div>
        </div>

        {/* Stock level bar */}
        {product.minStockLevel > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
              <span>Stock level</span>
              <span>{product.currentStock} / {product.minStockLevel} minimum</span>
            </div>
            <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  isOut ? 'bg-red-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min((product.currentStock / product.minStockLevel) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {(['movements', 'info'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'movements' ? 'Stock history' : 'Product info'}
          </button>
        ))}
      </div>

      {/* Stock movements tab */}
      {activeTab === 'movements' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="h-9 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
            >
              <option value="all">All movements</option>
              <option value="PURCHASE">Purchases</option>
              <option value="SALE">Sales</option>
              <option value="CREDIT_NOTE">Returns in</option>
              <option value="DEBIT_NOTE">Returns out</option>
              <option value="ADJUSTMENT_IN">Adjustments in</option>
              <option value="ADJUSTMENT_OUT">Adjustments out</option>
            </select>
            <p className="text-xs text-gray-400">{filtered.length} movements</p>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide border-b border-gray-100">
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Type</div>
              <div className="col-span-4">Reference</div>
              <div className="col-span-2 text-right">Qty</div>
              <div className="col-span-1 text-right">Balance</div>
            </div>

            {filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No stock movements found.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {/* Calculate running balance */}
                {(() => {
                  let balance = 0;
                  const withBalance = [...filtered].reverse().map(m => {
                    balance += m.qty;
                    return { ...m, runningBalance: balance };
                  }).reverse();

                  return withBalance.map(m => {
                    const style = movementIcon(m.type);
                    const isIn  = m.qty > 0;

                    return (
                      <div key={m.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
                        <div className="md:col-span-2 flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                            <i className={`ti ${style.icon} text-xs ${style.color}`} aria-hidden="true" />
                          </div>
                          <p className="text-xs text-gray-500 hidden md:block">{formatDate(m.createdAt)}</p>
                          <div className="md:hidden">
                            <p className="text-xs font-medium text-gray-700">{style.label}</p>
                            <p className="text-xs text-gray-400">{formatDate(m.createdAt)}</p>
                          </div>
                        </div>
                        <div className="hidden md:flex md:col-span-3 items-center">
                          <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${style.bg} ${style.color}`}>
                            {style.label}
                          </span>
                        </div>
                        <div className="hidden md:flex md:col-span-4 items-center">
                          <p className="text-xs text-gray-500 font-mono">{m.refId ?? m.notes ?? '—'}</p>
                        </div>
                        <div className="flex md:col-span-2 items-center justify-between md:justify-end">
                          <p className={`text-sm font-semibold ${isIn ? 'text-emerald-700' : 'text-red-700'}`}>
                            {isIn ? '+' : ''}{m.qty} {product.unit}
                          </p>
                        </div>
                        <div className="hidden md:flex md:col-span-1 items-center justify-end">
                          <p className="text-sm font-medium text-gray-900">{m.runningBalance}</p>
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Product info tab */}
      {activeTab === 'info' && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {[
            { label: 'Product code',    value: product.code },
            { label: 'Category',        value: product.category ?? '—' },
            { label: 'Unit',            value: product.unit },
            { label: 'Purchase price',  value: formatCurrency(product.purchasePrice, currency) },
            { label: 'Selling price',   value: formatCurrency(product.sellingPrice, currency) },
            { label: 'Profit margin',   value: `${margin.toFixed(1)}%` },
            { label: 'Current stock',   value: `${product.currentStock} ${product.unit}` },
            { label: 'Minimum stock',   value: `${product.minStockLevel} ${product.unit}` },
            { label: 'Stock value',     value: formatCurrency(product.currentStock * product.purchasePrice, currency) },
            { label: 'Status',          value: product.status },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between px-4 py-3">
              <p className="text-sm text-gray-500">{row.label}</p>
              <p className="text-sm font-medium text-gray-900 capitalize">{row.value}</p>
            </div>
          ))}
          {can.manageProducts(role) && (
            <div className="px-4 py-3 flex gap-3">
              <button
                onClick={() => navigate(`/products/${product.id}/edit`)}
                className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700"
              >
                <i className="ti ti-edit" aria-hidden="true" /> Edit product
              </button>
              <button
                onClick={() => navigate(`/products/${product.id}/adjust`)}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
              >
                <i className="ti ti-adjustments" aria-hidden="true" /> Adjust stock
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
