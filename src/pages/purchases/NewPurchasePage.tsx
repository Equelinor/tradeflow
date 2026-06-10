import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { sampleSuppliers } from '@/pages/suppliers/supplierData';
import { sampleProducts } from '@/pages/products/productData';
import type { PurchasePaymentType, NewPurchaseLineItem } from './purchaseData';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ─────────────────────────────────────────────────────────────
// New Purchase Page
//
// UI creates the purchase document only (status: pending).
// Cloud Function (purchaseEngine.ts) owns ALL side effects:
//   - purchase number generation (atomic counter)
//   - stock increase per line item
//   - supplier balance update (amountDue only)
//   - payment record for cash/partial
//   - audit log entry
//
// Business rules enforced:
//   - Cash: no payable impact (amountDue = 0)
//   - Credit: full amount to payable
//   - Partial: only unpaid portion to payable
//   - No edit after confirm — void + recreate only
// ─────────────────────────────────────────────────────────────

const EMPTY_LINE = (): NewPurchaseLineItem => ({
  productId: '', productName: '', productCode: '',
  unit: '', qty: '1', unitCost: '', discount: '0',
});

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash'             },
  { value: 'benefit',       label: 'Benefit / EFTPOS' },
  { value: 'bank_transfer', label: 'Bank Transfer'    },
  { value: 'cheque',        label: 'Cheque'           },
  { value: 'other',         label: 'Other'            },
];

export default function NewPurchasePage() {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const { currency } = useBranding();
  const { companyId, uid } = useAuth();

  const preselectedSupplier = params.get('supplierId') ?? '';

  const [supplierId,    setSupplierId]    = useState(preselectedSupplier);
  const [date,          setDate]          = useState(new Date().toISOString().split('T')[0]);
  const [supplierInvNo, setSupplierInvNo] = useState('');
  const [items,         setItems]         = useState<NewPurchaseLineItem[]>([EMPTY_LINE()]);
  const [paymentType,   setPaymentType]   = useState<PurchasePaymentType>('credit');
  const [amountPaid,    setAmountPaid]    = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bank_transfer');
  const [referenceNo,   setReferenceNo]   = useState('');
  const [notes,         setNotes]         = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [error,         setError]         = useState('');

  // TODO: replace with useSuppliers(companyId) and useProducts(companyId)
  const suppliers = sampleSuppliers.filter(s => s.status === 'active');
  const products  = sampleProducts.filter(p => p.status === 'active');
  const supplier  = suppliers.find(s => s.id === supplierId);

  // ── Line calculations ─────────────────────────────────────
  const lineCalcs = useMemo(() => items.map(item => {
    const qty      = parseFloat(item.qty)      || 0;
    const unitCost = parseFloat(item.unitCost) || 0;
    const discount = parseFloat(item.discount) || 0;
    return {
      qty, unitCost, discount,
      lineTotal: Math.max(0, (qty * unitCost) - discount),
    };
  }), [items]);

  const subtotal      = lineCalcs.reduce((s, l) => s + (l.qty * l.unitCost), 0);
  const discountTotal = lineCalcs.reduce((s, l) => s + l.discount, 0);
  const grandTotal    = Math.max(0, subtotal - discountTotal);

  const paid = paymentType === 'cash'   ? grandTotal
             : paymentType === 'credit' ? 0
             : parseFloat(amountPaid) || 0;

  const amountDue   = Math.max(0, grandTotal - paid);
  const prevBalance = supplier?.currentBalance ?? 0;
  const newBalance  = prevBalance + amountDue;

  // ── Line item handlers ────────────────────────────────────
  function selectProduct(index: number, productId: string) {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setItems(prev => prev.map((item, i) =>
      i === index ? {
        ...item,
        productId:   product.id,
        productName: product.name,
        productCode: product.code,
        unit:        product.unit,
        unitCost:    product.purchasePrice.toString(),
      } : item
    ));
  }

  function updateLine(index: number, field: keyof NewPurchaseLineItem, value: string) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function addLine()             { setItems(prev => [...prev, EMPTY_LINE()]); }
  function removeLine(i: number) { if (items.length > 1) setItems(prev => prev.filter((_, idx) => idx !== i)); }

  // ── Validation ────────────────────────────────────────────
  function validate(): string | null {
    if (!supplierId)                                return 'Please select a supplier.';
    if (!date)                                      return 'Please select a purchase date.';
    if (items.some(i => !i.productId))              return 'Please select a product for each line.';
    if (items.some(i => parseFloat(i.qty) <= 0))    return 'All quantities must be greater than zero.';
    if (items.some(i => parseFloat(i.unitCost) <= 0)) return 'All unit costs must be greater than zero.';
    if (grandTotal <= 0)                            return 'Purchase total must be greater than zero.';
    if (paymentType === 'partial') {
      const amt = parseFloat(amountPaid);
      if (!amt || amt <= 0)     return 'Please enter amount paid for partial payment.';
      if (amt >= grandTotal)    return 'Partial amount must be less than grand total. Use Cash instead.';
    }
    return null;
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleConfirm() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');

    try {
      const firebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY &&
        import.meta.env.VITE_FIREBASE_API_KEY !== 'your-api-key-here';

      if (!firebaseConnected) {
        await new Promise(r => setTimeout(r, 800));
        navigate('/purchases');
        return;
      }

      const { createPurchase } = await import('@/services/purchaseService');
      const purchaseId = await createPurchase(companyId, uid, {
        supplierId,
        supplierInvoiceNo: supplierInvNo.trim() || null,
        date:  new Date(date),
        items: items.map((item, i) => ({
          productId:   item.productId,
          productName: item.productName,
          productCode: item.productCode,
          unit:        item.unit,
          qty:         lineCalcs[i].qty,
          unitCost:    lineCalcs[i].unitCost,
          discount:    lineCalcs[i].discount,
          lineTotal:   lineCalcs[i].lineTotal,
        })),
        subtotal,
        discountTotal,
        grandTotal,
        paymentType,
        amountPaid: paid,
        amountDue,
        paymentMethod: paymentType !== 'credit' ? paymentMethod : null,
        referenceNo:   referenceNo.trim() || null,
        notes:         notes.trim() || null,
      });
      navigate(`/purchases/${purchaseId}`);
    } catch (err) {
      console.error(err);
      setError('Failed to save purchase. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  void companyId; void uid;
  const canConfirm = !!supplierId && items.every(i => i.productId) && grandTotal > 0;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/purchases')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">New Purchase</h1>
        </div>
        <p className="text-xs text-gray-400">
          <i className="ti ti-file-invoice mr-1" aria-hidden="true" />
          Purchase number assigned on confirmation
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left — form */}
        <div className="lg:col-span-2 space-y-4">

          {/* Supplier + date */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Purchase details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Supplier *</label>
                <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none">
                  <option value="">Select supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name}{s.currentBalance > 0 ? ` (${formatCurrency(s.currentBalance, currency)} due)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Purchase date *</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs text-gray-500 mb-1.5">
                  Supplier invoice number
                  <span className="text-gray-400 ml-1">(optional but recommended)</span>
                </label>
                <input type="text" value={supplierInvNo}
                  onChange={e => setSupplierInvNo(e.target.value)}
                  placeholder="e.g. GIC-2026-1234"
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
              </div>
            </div>
          </div>

          {/* Line items */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">Items</h2>
              <button onClick={addLine}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                <i className="ti ti-plus" aria-hidden="true" /> Add line
              </button>
            </div>

            <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-gray-400 uppercase tracking-wide mb-2 px-1">
              <div className="col-span-4">Product</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit cost</div>
              <div className="col-span-2 text-right">Discount</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-12 md:col-span-4">
                    <select value={item.productId} onChange={e => selectProduct(index, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none">
                      <option value="">Select product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-4 md:col-span-1">
                    <input type="number" min="1" step="1" value={item.qty}
                      onChange={e => updateLine(index, 'qty', e.target.value)}
                      placeholder="Qty"
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm text-center focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-3 text-xs text-gray-400">{currency}</span>
                      <input type="number" min="0" step="0.001" value={item.unitCost}
                        onChange={e => updateLine(index, 'unitCost', e.target.value)}
                        placeholder="0.000"
                        className="w-full h-10 pl-9 pr-2 rounded-xl border border-gray-200 text-sm text-right focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                    </div>
                  </div>
                  <div className="col-span-4 md:col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-3 text-xs text-gray-400">{currency}</span>
                      <input type="number" min="0" step="0.001" value={item.discount}
                        onChange={e => updateLine(index, 'discount', e.target.value)}
                        placeholder="0.000"
                        className="w-full h-10 pl-9 pr-2 rounded-xl border border-gray-200 text-sm text-right focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                    </div>
                  </div>
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(lineCalcs[index]?.lineTotal ?? 0, currency)}
                    </p>
                  </div>
                  <div className="hidden md:flex md:col-span-1 items-center justify-end">
                    {items.length > 1 && (
                      <button onClick={() => removeLine(index)}
                        className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors">
                        <i className="ti ti-x text-sm" aria-hidden="true" />
                      </button>
                    )}
                  </div>
                  <div className="col-span-12 md:hidden flex items-center justify-between px-1 pb-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400">Line total</p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium">{formatCurrency(lineCalcs[index]?.lineTotal ?? 0, currency)}</p>
                      {items.length > 1 && (
                        <button onClick={() => removeLine(index)} className="text-xs text-red-500">Remove</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Payment */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Payment</h2>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['cash', 'credit', 'partial'] as PurchasePaymentType[]).map(type => (
                <button key={type} onClick={() => setPaymentType(type)}
                  className={`py-3 px-2 rounded-xl border text-sm font-medium transition-colors ${
                    paymentType === type
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  {type === 'cash' ? '💵 Cash' : type === 'credit' ? '📋 Credit' : '💳 Partial'}
                </button>
              ))}
            </div>

            <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
              paymentType === 'cash'   ? 'bg-emerald-50 text-emerald-700' :
              paymentType === 'credit' ? 'bg-blue-50 text-blue-700' :
                                         'bg-amber-50 text-amber-700'
            }`}>
              {paymentType === 'cash'    && 'Paid in full now. No payable impact.'}
              {paymentType === 'credit'  && `Full ${formatCurrency(grandTotal, currency)} added to supplier payable.`}
              {paymentType === 'partial' && 'Pay part now. Remainder added to supplier payable.'}
            </div>

            {(paymentType === 'cash' || paymentType === 'partial') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {paymentType === 'partial' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">Amount paid now *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
                      <input type="number" min="0" step="0.001" value={amountPaid}
                        onChange={e => setAmountPaid(e.target.value)}
                        placeholder="0.000"
                        className="w-full h-11 pl-12 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none" />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Payment method</label>
                  <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none">
                    {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Reference number</label>
                  <input type="text" value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                    placeholder="Cheque no. / transfer ref."
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
                </div>
              </div>
            )}

            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1.5">Notes (optional)</label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Any notes about this purchase..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none" />
            </div>
          </div>
        </div>

        {/* Right — summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-200 rounded-xl p-4 sticky top-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Summary</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatCurrency(subtotal, currency)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Discount</span>
                  <span className="text-emerald-600">− {formatCurrency(discountTotal, currency)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-semibold pt-2 border-t border-gray-100">
                <span>Grand total</span>
                <span>{formatCurrency(grandTotal, currency)}</span>
              </div>
              {paymentType !== 'credit' && grandTotal > 0 && (
                <div className="flex justify-between text-sm text-emerald-700">
                  <span>Paid now</span>
                  <span>{formatCurrency(paid, currency)}</span>
                </div>
              )}
              {amountDue > 0 && (
                <div className="flex justify-between text-sm text-red-700 font-medium">
                  <span>To payable</span>
                  <span>{formatCurrency(amountDue, currency)}</span>
                </div>
              )}
            </div>

            {/* Supplier balance impact */}
            {supplier && grandTotal > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Balance impact</p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Previous payable</span>
                  <span className={prevBalance > 0 ? 'text-red-600' : 'text-gray-700'}>
                    {formatCurrency(prevBalance, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">This purchase (due)</span>
                  <span className="text-red-600">+ {formatCurrency(amountDue, currency)}</span>
                </div>
                <div className="flex justify-between text-sm font-semibold pt-1.5 border-t border-gray-100 text-red-700">
                  <span>New payable</span>
                  <span>{formatCurrency(newBalance, currency)}</span>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            <button
              onClick={() => { const err = validate(); if (err) { setError(err); return; } setError(''); setShowConfirm(true); }}
              disabled={!canConfirm || saving}
              className="w-full mt-4 h-12 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors">
              Review & Confirm Purchase →
            </button>
            <p className="text-xs text-gray-400 text-center mt-2">Purchase number assigned on confirmation</p>
          </div>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && supplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <i className="ti ti-check text-2xl text-emerald-600" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Confirm purchase</h3>
              <p className="text-sm text-gray-500 mt-1">This cannot be edited after confirmation.</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
              {[
                { label: 'Supplier', value: supplier.name },
                { label: 'Items',    value: `${items.filter(i => i.productId).length} product(s)` },
                { label: 'Total',    value: formatCurrency(grandTotal, currency), bold: true },
                { label: 'Payment',  value: paymentType === 'cash' ? 'Cash — paid in full' : paymentType === 'credit' ? 'Credit — full amount to payable' : `Partial — ${formatCurrency(paid, currency)} paid now` },
              ].map(row => (
                <div key={row.label} className="flex justify-between text-sm">
                  <span className="text-gray-500">{row.label}</span>
                  <span className={row.bold ? 'font-semibold text-gray-900' : 'text-gray-900'}>{row.value}</span>
                </div>
              ))}
              {amountDue > 0 && (
                <div className="flex justify-between text-sm text-red-700 font-medium">
                  <span>Added to payable</span>
                  <span>{formatCurrency(amountDue, currency)}</span>
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowConfirm(false)} disabled={saving}
                className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
                Go back
              </button>
              <button onClick={handleConfirm} disabled={saving}
                className="flex-1 h-11 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {saving ? 'Confirming...' : 'Confirm Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
