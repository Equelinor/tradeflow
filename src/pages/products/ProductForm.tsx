import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { sampleProducts, PRODUCT_UNITS, PRODUCT_CATEGORIES } from './productData';

export default function ProductForm() {
  const { id }         = useParams<{ id?: string }>();
  const navigate       = useNavigate();
  const { currency }   = useBranding();
  const { companyId: _companyId, uid: _uid } = useAuth();
  const isEdit = !!id;

  const existing = isEdit ? sampleProducts.find(p => p.id === id) : null;

  const [form, setForm] = useState({
    code:          existing?.code          ?? '',
    name:          existing?.name          ?? '',
    category:      existing?.category      ?? '',
    unit:          existing?.unit          ?? 'PCS',
    purchasePrice: existing?.purchasePrice ?? '',
    sellingPrice:  existing?.sellingPrice  ?? '',
    minStockLevel: existing?.minStockLevel ?? 0,
    openingStock:  existing?.currentStock  ?? 0,
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Live margin calculation
  const margin = form.purchasePrice && form.sellingPrice
    ? ((Number(form.sellingPrice) - Number(form.purchasePrice)) / Number(form.purchasePrice) * 100)
    : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())  { setError('Product name is required.'); return; }
    if (!form.code.trim())  { setError('Product code is required.'); return; }
    if (!form.purchasePrice){ setError('Purchase price is required.'); return; }
    if (!form.sellingPrice) { setError('Selling price is required.'); return; }
    setLoading(true); setError('');

    try {
      // TODO: when Firebase connected replace with:
      // const data = {
      //   companyId:     _companyId,
      //   code:          form.code.trim().toUpperCase(),
      //   name:          form.name.trim(),
      //   category:      form.category || null,
      //   unit:          form.unit,
      //   purchasePrice: Number(form.purchasePrice),
      //   sellingPrice:  Number(form.sellingPrice),
      //   currentStock:  isEdit ? existing!.currentStock : Number(form.openingStock),
      //   minStockLevel: Number(form.minStockLevel),
      //   status:        'active',
      //   createdAt:     serverTimestamp(),
      //   updatedAt:     serverTimestamp(),
      //   createdBy:     _uid,
      // };
      // if (isEdit) {
      //   await updateDoc(doc(db, SUB(_companyId).products, id!), data);
      // } else {
      //   const ref = await addDoc(collection(db, SUB(_companyId).products), data);
      //   // Write opening stock movement
      //   if (Number(form.openingStock) > 0) {
      //     await addDoc(collection(db, SUB(_companyId).stockMovements), {
      //       companyId: _companyId, productId: ref.id,
      //       productName: form.name.trim(),
      //       type: 'OPENING', qty: Number(form.openingStock),
      //       refId: null, refType: null, notes: 'Opening stock',
      //       createdAt: serverTimestamp(), createdBy: _uid,
      //     });
      //   }
      // }
      await new Promise(r => setTimeout(r, 500));
      navigate('/products');
    } catch (err) {
      console.error(err);
      setError('Failed to save product. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 md:p-5 max-w-lg mx-auto space-y-4">

      <button
        onClick={() => navigate(isEdit ? `/products/${id}` : '/products')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
        {isEdit ? 'Back to product' : 'Products'}
      </button>

      <h1 className="text-base font-semibold text-gray-900">
        {isEdit ? 'Edit product' : 'Add product'}
      </h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <Field label="Product code *">
              <input
                type="text" required value={form.code}
                onChange={e => update('code', e.target.value.toUpperCase())}
                placeholder="PRD-001"
                className={inputClass}
              />
            </Field>
            <Field label="Unit *">
              <select
                value={form.unit}
                onChange={e => update('unit', e.target.value)}
                className={selectClass}
              >
                {PRODUCT_UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Product name *">
            <input
              type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Rice 25kg Bag"
              className={inputClass}
            />
          </Field>

          <Field label="Category">
            <select
              value={form.category}
              onChange={e => update('category', e.target.value)}
              className={selectClass}
            >
              <option value="">Select category</option>
              {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Purchase price *">
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
                <input
                  type="number" required min="0" step="0.001"
                  value={form.purchasePrice}
                  onChange={e => update('purchasePrice', e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className={`${inputClass} pl-12`}
                />
              </div>
            </Field>
            <Field label="Selling price *">
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
                <input
                  type="number" required min="0" step="0.001"
                  value={form.sellingPrice}
                  onChange={e => update('sellingPrice', e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className={`${inputClass} pl-12`}
                />
              </div>
            </Field>
          </div>

          {/* Live margin indicator */}
          {margin !== null && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
              margin >= 20 ? 'bg-emerald-50 text-emerald-700' :
              margin >= 10 ? 'bg-blue-50 text-blue-700' :
              margin >= 0  ? 'bg-amber-50 text-amber-700' :
                             'bg-red-50 text-red-700'
            }`}>
              <i className={`ti ${margin >= 0 ? 'ti-trending-up' : 'ti-trending-down'} text-base`} aria-hidden="true" />
              <span>
                Profit margin: <strong>{margin.toFixed(1)}%</strong>
                {margin < 0 && ' — selling below cost price!'}
                {margin >= 0 && margin < 10 && ' — low margin'}
                {margin >= 20 && ' — good margin'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum stock level" hint="Alert when stock falls below this">
              <input
                type="number" min="0" step="1"
                value={form.minStockLevel}
                onChange={e => update('minStockLevel', e.target.value)}
                placeholder="10"
                inputMode="numeric"
                className={inputClass}
              />
            </Field>

            {/* Opening stock — only for new products */}
            {!isEdit && (
              <Field label="Opening stock" hint="Current stock on hand">
                <input
                  type="number" min="0" step="1"
                  value={form.openingStock}
                  onChange={e => update('openingStock', e.target.value)}
                  placeholder="0"
                  inputMode="numeric"
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/products/${id}` : '/products')}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass  = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors';
const selectClass = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none';

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
