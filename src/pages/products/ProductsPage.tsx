import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleProducts } from './productData';

type StockFilter = 'all' | 'low' | 'out' | 'ok';
type StatusFilter = 'active' | 'inactive' | 'all';

export default function ProductsPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role }     = useAuth();

  const [search,      setSearch]      = useState('');
  const [stockFilter, setStockFilter] = useState<StockFilter>('all');
  const [statusFilter,setStatusFilter]= useState<StatusFilter>('active');
  const [category,    setCategory]    = useState('all');

  // TODO: replace with useProducts(companyId) when Firebase ready
  const products = sampleProducts;

  const categories = useMemo(() => {
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))] as string[];
    return cats.sort();
  }, [products]);

  const filtered = useMemo(() => {
    let list = [...products];
    if (statusFilter !== 'all') list = list.filter(p => p.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        (p.category ?? '').toLowerCase().includes(q)
      );
    }
    if (stockFilter === 'low') list = list.filter(p => p.currentStock > 0 && p.currentStock < p.minStockLevel);
    if (stockFilter === 'out') list = list.filter(p => p.currentStock === 0);
    if (stockFilter === 'ok')  list = list.filter(p => p.currentStock >= p.minStockLevel);
    if (category !== 'all')    list = list.filter(p => p.category === category);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [products, search, stockFilter, statusFilter, category]);

  // Summary stats
  const active       = products.filter(p => p.status === 'active');
  const lowStock     = active.filter(p => p.currentStock > 0 && p.currentStock < p.minStockLevel);
  const outOfStock   = active.filter(p => p.currentStock === 0);
  const totalValue   = active.reduce((s, p) => s + (p.currentStock * p.purchasePrice), 0);

  function stockBadge(p: typeof products[0]) {
    if (p.currentStock === 0)                        return { label: 'Out of stock', cls: 'bg-red-100 text-red-700' };
    if (p.currentStock < p.minStockLevel)             return { label: 'Low stock',    cls: 'bg-amber-100 text-amber-700' };
    return                                                    { label: 'In stock',     cls: 'bg-emerald-100 text-emerald-700' };
  }

  function stockBarColor(p: typeof products[0]) {
    const pct = p.minStockLevel > 0 ? p.currentStock / p.minStockLevel : 1;
    if (pct === 0)   return 'bg-red-500';
    if (pct < 1)     return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  return (
    <div className="p-3 md:p-5 max-w-screen-xl mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Products</h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {active.length} active · {lowStock.length} low · {outOfStock.length} out of stock
          </p>
        </div>
        {can.manageProducts(role) && (
          <button
            onClick={() => navigate('/products/new')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">Add Product</span>
          </button>
        )}
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Stock value</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">
            {formatCurrency(totalValue, currency)}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Active products</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{active.length}</p>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 cursor-pointer hover:border-amber-300 transition-colors"
          onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
        >
          <p className="text-xs text-gray-400 mb-1">Low stock</p>
          <p className={`text-base md:text-lg font-semibold ${lowStock.length > 0 ? 'text-amber-600' : 'text-gray-900'}`}>
            {lowStock.length}
          </p>
        </div>
        <div
          className="bg-white border border-gray-200 rounded-xl p-3 md:p-4 cursor-pointer hover:border-red-300 transition-colors"
          onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')}
        >
          <p className="text-xs text-gray-400 mb-1">Out of stock</p>
          <p className={`text-base md:text-lg font-semibold ${outOfStock.length > 0 ? 'text-red-700' : 'text-gray-900'}`}>
            {outOfStock.length}
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
            placeholder="Search by name or code..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          />
        </div>
        <select
          value={stockFilter}
          onChange={e => setStockFilter(e.target.value as StockFilter)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="all">All stock levels</option>
          <option value="low">Low stock</option>
          <option value="out">Out of stock</option>
          <option value="ok">In stock</option>
        </select>
        <select
          value={category}
          onChange={e => setCategory(e.target.value)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as StatusFilter)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
        >
          <option value="active">Active only</option>
          <option value="inactive">Inactive</option>
          <option value="all">All</option>
        </select>
      </div>

      {/* Product list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-packages text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">
              {search ? 'No products match your search.' : 'No products yet.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-1">Code</div>
              <div className="col-span-3">Product</div>
              <div className="col-span-2">Category</div>
              <div className="col-span-1 text-right">Buy</div>
              <div className="col-span-1 text-right">Sell</div>
              <div className="col-span-1 text-right">Margin</div>
              <div className="col-span-2 text-right">Stock</div>
              <div className="col-span-1 text-right">Actions</div>
            </div>

            {filtered.map(product => {
              const badge    = stockBadge(product);
              const barColor = stockBarColor(product);
              const margin   = product.purchasePrice > 0
                ? ((product.sellingPrice - product.purchasePrice) / product.purchasePrice * 100)
                : 0;
              const stockPct = product.minStockLevel > 0
                ? Math.min((product.currentStock / product.minStockLevel) * 100, 150)
                : 100;

              return (
                <div
                  key={product.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/products/${product.id}`)}
                >
                  {/* Code */}
                  <div className="hidden md:flex md:col-span-1 items-center">
                    <p className="text-xs font-mono text-gray-500">{product.code}</p>
                  </div>

                  {/* Name + badge */}
                  <div className="md:col-span-3 flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                      product.currentStock === 0   ? 'bg-red-50 text-red-500' :
                      product.currentStock < product.minStockLevel ? 'bg-amber-50 text-amber-600' :
                      'bg-emerald-50 text-emerald-600'
                    }`}>
                      <i className="ti ti-package" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-medium text-gray-900">{product.name}</p>
                        {product.status === 'inactive' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 md:hidden">{product.code} · {product.unit}</p>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="hidden md:flex md:col-span-2 items-center">
                    <p className="text-sm text-gray-600">{product.category ?? '—'}</p>
                  </div>

                  {/* Buy price */}
                  <div className="hidden md:flex md:col-span-1 items-center justify-end">
                    <p className="text-sm text-gray-700">{formatCurrency(product.purchasePrice, currency)}</p>
                  </div>

                  {/* Sell price */}
                  <div className="hidden md:flex md:col-span-1 items-center justify-end">
                    <p className="text-sm font-medium text-gray-900">{formatCurrency(product.sellingPrice, currency)}</p>
                  </div>

                  {/* Margin */}
                  <div className="hidden md:flex md:col-span-1 items-center justify-end">
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                      margin >= 20 ? 'bg-emerald-100 text-emerald-700' :
                      margin >= 10 ? 'bg-blue-100 text-blue-700' :
                                     'bg-gray-100 text-gray-600'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </div>

                  {/* Stock level */}
                  <div className="flex md:col-span-2 items-center justify-between md:justify-end gap-3">
                    <div className="flex items-center gap-2 md:flex-col md:items-end md:gap-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${badge.cls}`}>
                          {badge.label}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {product.currentStock} {product.unit}
                        </span>
                      </div>
                      <div className="hidden md:block w-20 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${barColor}`}
                          style={{ width: `${Math.min(stockPct, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="hidden md:flex md:col-span-1 items-center justify-end gap-1"
                    onClick={e => e.stopPropagation()}
                  >
                    {can.manageProducts(role) && (
                      <button
                        onClick={() => navigate(`/products/${product.id}/edit`)}
                        className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                        title="Edit"
                      >
                        <i className="ti ti-edit text-sm" aria-hidden="true" />
                      </button>
                    )}
                    <button
                      onClick={() => navigate(`/products/${product.id}`)}
                      className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                      title="View history"
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
