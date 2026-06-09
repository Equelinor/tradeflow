import { useState, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { sampleCustomers } from '@/pages/customers/customerData';
import { sampleProducts } from '@/pages/products/productData';
import type { SalePaymentType, PaymentMethod, NewSaleLineItem } from './saleData';

// ─────────────────────────────────────────────────────────────
// New Sale Page
//
// UI creates the sale document only.
// Cloud Function (saleEngine.ts) owns:
//   - stock decrease
//   - customer balance update
//   - receipt creation for cash/partial
//   - audit log entry
//   - invoice number generation (atomic counter)
//
// Business rules enforced here (UI layer — first gate):
//   - Credit limit warning before confirm
//   - Stock availability warning before confirm
//   - Negative stock blocked (unless company setting allows)
//   - Cash sale: amountDue = 0, no receivable impact
//   - Credit sale: full amount to receivable
//   - Partial: only unpaid portion to receivable
// ─────────────────────────────────────────────────────────────

const EMPTY_LINE = (): NewSaleLineItem => ({
  productId: '', productName: '', productCode: '',
  unit: '', stock: 0, qty: '1', unitPrice: '', discount: '0',
});

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash'          },
  { value: 'benefit',       label: 'Benefit / EFTPOS' },
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'cheque',        label: 'Cheque'        },
  { value: 'other',         label: 'Other'         },
];

export default function NewSalePage() {
  const navigate       = useNavigate();
  const [params]       = useSearchParams();
  const { currency }   = useBranding();
  const { companyId, uid, role } = useAuth();

  const preselectedCustomer = params.get('customerId') ?? '';

  // ── Form state ────────────────────────────────────────────
  const [customerId,     setCustomerId]     = useState(preselectedCustomer);
  const [date,           setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [items,          setItems]          = useState<NewSaleLineItem[]>([EMPTY_LINE()]);
  const [paymentType,    setPaymentType]    = useState<SalePaymentType>('credit');
  const [amountReceived, setAmountReceived] = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('cash');
  const [notes,          setNotes]          = useState('');

  // ── Confirmation state ────────────────────────────────────
  const [showConfirm,       setShowConfirm]       = useState(false);
  const [creditOverride,    setCreditOverride]     = useState(false);
  const [overrideReason,    setOverrideReason]     = useState('');
  const [saving,            setSaving]             = useState(false);
  const [error,             setError]              = useState('');

  // ── Lookup data ───────────────────────────────────────────
  // TODO: replace with useCustomers(companyId) and useProducts(companyId)
  const customers = sampleCustomers;
  const products  = sampleProducts.filter(p => p.status === 'active');

  const customer = customers.find(c => c.id === customerId);

  // ── Line item calculations ────────────────────────────────
  const lineCalcs = useMemo(() => items.map(item => {
    const qty       = parseFloat(item.qty)       || 0;
    const unitPrice = parseFloat(item.unitPrice) || 0;
    const discount  = parseFloat(item.discount)  || 0;
    const lineTotal = Math.max(0, (qty * unitPrice) - discount);
    return { qty, unitPrice, discount, lineTotal };
  }), [items]);

  const subtotal      = lineCalcs.reduce((s, l) => s + (l.qty * l.unitPrice), 0);
  const discountTotal = lineCalcs.reduce((s, l) => s + l.discount, 0);
  const grandTotal    = Math.max(0, subtotal - discountTotal);

  const received = paymentType === 'cash'   ? grandTotal
                 : paymentType === 'credit' ? 0
                 : parseFloat(amountReceived) || 0;

  const amountDue       = Math.max(0, grandTotal - received);
  const prevBalance     = customer?.currentBalance ?? 0;
  const newBalance      = prevBalance + amountDue;
  const creditLimit     = customer?.creditLimit ?? null;
  const isOverLimit     = creditLimit !== null && newBalance > creditLimit;
  const isOwnerAdmin    = role === 'owner' || role === 'admin';

  // ── Stock warnings ────────────────────────────────────────
  const stockWarnings = useMemo(() => {
    return items
      .map((item, i) => {
        if (!item.productId) return null;
        const qty = parseFloat(item.qty) || 0;
        if (qty > item.stock) {
          return `${item.productName}: need ${qty} ${item.unit}, only ${item.stock} in stock`;
        }
        return null;
      })
      .filter(Boolean) as string[];
  }, [items]);

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
        stock:       product.currentStock,
        unitPrice:   product.sellingPrice.toString(),
      } : item
    ));
  }

  function updateLine(index: number, field: keyof NewSaleLineItem, value: string) {
    setItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ));
  }

  function addLine() {
    setItems(prev => [...prev, EMPTY_LINE()]);
  }

  function removeLine(index: number) {
    if (items.length === 1) return;
    setItems(prev => prev.filter((_, i) => i !== index));
  }

  // ── Validation ────────────────────────────────────────────
  function validate(): string | null {
    if (!customerId)                          return 'Please select a customer.';
    if (!date)                                return 'Please select a sale date.';
    if (items.some(i => !i.productId))        return 'Please select a product for each line.';
    if (items.some(i => parseFloat(i.qty) <= 0))
                                              return 'All quantities must be greater than zero.';
    if (items.some(i => parseFloat(i.unitPrice) <= 0))
                                              return 'All unit prices must be greater than zero.';
    if (grandTotal <= 0)                      return 'Sale total must be greater than zero.';
    if (paymentType === 'partial') {
      const amt = parseFloat(amountReceived);
      if (!amt || amt <= 0)                   return 'Please enter amount received for partial payment.';
      if (amt >= grandTotal)                  return 'Partial amount must be less than grand total. Use Cash Sale instead.';
    }
    // Stock check
    for (const w of stockWarnings) {
      if (w) return `Insufficient stock: ${w}`;
    }
    // Credit limit check — block sales staff, warn owner/admin
    if (isOverLimit && !isOwnerAdmin)         return 'Sale exceeds customer credit limit. Contact your manager.';
    if (isOverLimit && !creditOverride)       return 'Credit limit exceeded. Please confirm override reason below.';
    if (isOverLimit && !overrideReason.trim())return 'Please enter a reason for overriding the credit limit.';
    return null;
  }

  // ── Submit ────────────────────────────────────────────────
  async function handleConfirm() {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');

    try {
      // UI creates the sale document only.
      // Invoice number is generated by Cloud Function atomically.
      // CF then handles: stock decrease, balance update, receipt, audit log.

      // TODO: when Firebase connected, replace with:
      // const saleId = await createSale(companyId, uid, {
      //   customerId,
      //   date: new Date(date),
      //   items: items.map((item, i) => ({
      //     productId:   item.productId,
      //     productName: item.productName,
      //     productCode: item.productCode,
      //     unit:        item.unit,
      //     qty:         lineCalcs[i].qty,
      //     unitPrice:   lineCalcs[i].unitPrice,
      //     discount:    lineCalcs[i].discount,
      //     lineTotal:   lineCalcs[i].lineTotal,
      //   })),
      //   subtotal,
      //   discountTotal,
      //   grandTotal,
      //   paymentType,
      //   amountReceived: received,
      //   amountDue,
      //   paymentMethod:  paymentType !== 'credit' ? paymentMethod : null,
      //   notes:          notes.trim() || null,
      //   creditOverride: isOverLimit ? {
      //     overridden:       true,
      //     reason:           overrideReason,
      //     by:               uid,
      //     oldBalance:       prevBalance,        // customer balance before this sale
      //     saleAmount:       amountDue,           // amount being added to balance
      //     projectedBalance: newBalance,          // prevBalance + amountDue
      //     creditLimit:      creditLimit!,        // the limit that was exceeded
      //   } : null,
      // });
      // navigate(`/sales/${saleId}`);

      await new Promise(r => setTimeout(r, 800));
      navigate('/sales');
    } catch (err) {
      console.error(err);
      setError('Failed to save sale. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // Suppress unused variable warnings until Firebase connected
  void companyId; void uid;

  const canConfirm = !!customerId && items.every(i => i.productId) && grandTotal > 0;

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/sales')}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
          >
            <i className="ti ti-arrow-left" aria-hidden="true" />
          </button>
          <h1 className="text-base font-semibold text-gray-900">New Sale</h1>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <i className="ti ti-file-invoice" aria-hidden="true" />
          Invoice number assigned on confirmation
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

        {/* Left — main form */}
        <div className="lg:col-span-2 space-y-4">

          {/* Customer + date */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Sale details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Customer *</label>
                <select
                  value={customerId}
                  onChange={e => setCustomerId(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                >
                  <option value="">Select customer...</option>
                  {customers.filter(c => c.status === 'active').map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}{c.currentBalance > 0 ? ` (${formatCurrency(c.currentBalance, currency)} due)` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">Sale date *</label>
                <input
                  type="date" value={date}
                  onChange={e => setDate(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                />
              </div>
            </div>

            {/* Credit limit warning banner */}
            {customer && isOverLimit && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <i className="ti ti-alert-triangle text-red-600 text-base flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700">Credit limit exceeded</p>
                    <p className="text-xs text-red-600 mt-0.5">
                      {customer.name}'s new balance would be {formatCurrency(newBalance, currency)},
                      exceeding their {formatCurrency(creditLimit!, currency)} limit
                      by {formatCurrency(newBalance - creditLimit!, currency)}.
                    </p>
                    {isOwnerAdmin && (
                      <div className="mt-2 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={creditOverride}
                            onChange={e => setCreditOverride(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-red-600"
                          />
                          <span className="text-xs text-red-700 font-medium">
                            I approve this sale despite exceeding credit limit
                          </span>
                        </label>
                        {creditOverride && (
                          <input
                            type="text"
                            value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            placeholder="Reason for override (required)..."
                            className="w-full h-9 px-3 rounded-lg border border-red-200 text-xs focus:border-red-400 outline-none bg-white"
                          />
                        )}
                      </div>
                    )}
                    {!isOwnerAdmin && (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        Only owner or admin can override credit limit.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Line items */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-medium text-gray-700">Items</h2>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium"
              >
                <i className="ti ti-plus" aria-hidden="true" /> Add line
              </button>
            </div>

            {/* Desktop header */}
            <div className="hidden md:grid grid-cols-12 gap-2 text-xs text-gray-400 uppercase tracking-wide mb-2 px-1">
              <div className="col-span-4">Product</div>
              <div className="col-span-1 text-center">Qty</div>
              <div className="col-span-2 text-right">Unit price</div>
              <div className="col-span-2 text-right">Discount</div>
              <div className="col-span-2 text-right">Total</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center">
                  {/* Product select */}
                  <div className="col-span-12 md:col-span-4">
                    <select
                      value={item.productId}
                      onChange={e => selectProduct(index, e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
                    >
                      <option value="">Select product...</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id} disabled={p.currentStock === 0}>
                          {p.name} ({p.currentStock} {p.unit})
                          {p.currentStock === 0 ? ' — OUT OF STOCK' : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Qty */}
                  <div className="col-span-4 md:col-span-1">
                    <input
                      type="number" min="1" step="1"
                      value={item.qty}
                      onChange={e => updateLine(index, 'qty', e.target.value)}
                      placeholder="Qty"
                      className={`w-full h-10 px-3 rounded-xl border text-sm text-center outline-none focus:ring-2 focus:ring-emerald-500/20 ${
                        item.productId && parseFloat(item.qty) > item.stock
                          ? 'border-red-300 bg-red-50 focus:border-red-400'
                          : 'border-gray-200 focus:border-emerald-500'
                      }`}
                    />
                  </div>

                  {/* Unit price */}
                  <div className="col-span-4 md:col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-3 text-xs text-gray-400">{currency}</span>
                      <input
                        type="number" min="0" step="0.001"
                        value={item.unitPrice}
                        onChange={e => updateLine(index, 'unitPrice', e.target.value)}
                        placeholder="0.000"
                        className="w-full h-10 pl-9 pr-2 rounded-xl border border-gray-200 text-sm text-right focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Discount */}
                  <div className="col-span-4 md:col-span-2">
                    <div className="relative">
                      <span className="absolute left-2 top-3 text-xs text-gray-400">{currency}</span>
                      <input
                        type="number" min="0" step="0.001"
                        value={item.discount}
                        onChange={e => updateLine(index, 'discount', e.target.value)}
                        placeholder="0.000"
                        className="w-full h-10 pl-9 pr-2 rounded-xl border border-gray-200 text-sm text-right focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                    </div>
                  </div>

                  {/* Line total */}
                  <div className="hidden md:flex md:col-span-2 items-center justify-end">
                    <p className="text-sm font-medium text-gray-900">
                      {formatCurrency(lineCalcs[index]?.lineTotal ?? 0, currency)}
                    </p>
                  </div>

                  {/* Remove */}
                  <div className="hidden md:flex md:col-span-1 items-center justify-end">
                    {items.length > 1 && (
                      <button
                        onClick={() => removeLine(index)}
                        className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 flex items-center justify-center transition-colors"
                      >
                        <i className="ti ti-x text-sm" aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  {/* Mobile total + remove */}
                  <div className="col-span-12 md:hidden flex items-center justify-between px-1 pb-2 border-b border-gray-100">
                    <p className="text-xs text-gray-400">Line total</p>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-medium text-gray-900">
                        {formatCurrency(lineCalcs[index]?.lineTotal ?? 0, currency)}
                      </p>
                      {items.length > 1 && (
                        <button onClick={() => removeLine(index)}
                          className="text-gray-400 hover:text-red-500 text-xs">
                          Remove
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stock warnings */}
            {stockWarnings.length > 0 && (
              <div className="mt-3 bg-amber-50 border border-amber-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <i className="ti ti-alert-triangle text-amber-600 text-sm flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">Insufficient stock</p>
                    {stockWarnings.map((w, i) => (
                      <p key={i} className="text-xs text-amber-600">{w}</p>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Payment type */}
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-700 mb-3">Payment</h2>

            <div className="grid grid-cols-3 gap-2 mb-4">
              {(['cash', 'credit', 'partial'] as SalePaymentType[]).map(type => (
                <button
                  key={type}
                  onClick={() => setPaymentType(type)}
                  className={`py-3 px-2 rounded-xl border text-sm font-medium transition-colors ${
                    paymentType === type
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {type === 'cash'    ? '💵 Cash Sale' :
                   type === 'credit'  ? '📋 Credit Sale' :
                                        '💳 Partial'}
                </button>
              ))}
            </div>

            {/* Payment type explanation */}
            <div className={`text-xs px-3 py-2 rounded-lg mb-3 ${
              paymentType === 'cash'    ? 'bg-emerald-50 text-emerald-700' :
              paymentType === 'credit'  ? 'bg-blue-50 text-blue-700' :
                                          'bg-amber-50 text-amber-700'
            }`}>
              {paymentType === 'cash' &&
                'Full amount collected now. No receivable impact. Customer balance unchanged.'}
              {paymentType === 'credit' &&
                `Full ${formatCurrency(grandTotal, currency)} added to customer balance.`}
              {paymentType === 'partial' &&
                'Collect partial payment now. Remainder added to customer balance.'}
            </div>

            {/* Cash/Partial — payment method */}
            {(paymentType === 'cash' || paymentType === 'partial') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {paymentType === 'partial' && (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1.5">
                      Amount received now *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
                      <input
                        type="number" min="0" step="0.001"
                        value={amountReceived}
                        onChange={e => setAmountReceived(e.target.value)}
                        placeholder="0.000"
                        className="w-full h-11 pl-12 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
                      />
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-gray-500 mb-1.5">Payment method</label>
                  <select
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none"
                  >
                    {PAYMENT_METHODS.map(m => (
                      <option key={m.value} value={m.value}>{m.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mt-3">
              <label className="block text-xs text-gray-500 mb-1.5">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={2}
                placeholder="Any notes about this sale..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
              />
            </div>
          </div>
        </div>

        {/* Right — summary panel */}
        <div className="lg:col-span-1 space-y-3">

          {/* Order summary */}
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
                  <span>Received now</span>
                  <span>{formatCurrency(received, currency)}</span>
                </div>
              )}

              {amountDue > 0 && (
                <div className="flex justify-between text-sm text-red-700 font-medium">
                  <span>Amount due</span>
                  <span>{formatCurrency(amountDue, currency)}</span>
                </div>
              )}
            </div>

            {/* Balance impact */}
            {customer && grandTotal > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-100 space-y-1.5">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                  Balance impact
                </p>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">Previous balance</span>
                  <span className={prevBalance > 0 ? 'text-red-600' : 'text-gray-700'}>
                    {formatCurrency(prevBalance, currency)}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">This sale (due)</span>
                  <span className="text-red-600">+ {formatCurrency(amountDue, currency)}</span>
                </div>
                <div className={`flex justify-between text-sm font-semibold pt-1.5 border-t border-gray-100 ${
                  isOverLimit ? 'text-red-700' : newBalance > 0 ? 'text-red-600' : 'text-emerald-700'
                }`}>
                  <span>New balance</span>
                  <span>{formatCurrency(newBalance, currency)}</span>
                </div>
                {creditLimit !== null && (
                  <div className="flex justify-between text-xs text-gray-400">
                    <span>Credit limit</span>
                    <span>{formatCurrency(creditLimit, currency)}</span>
                  </div>
                )}
                {isOverLimit && (
                  <p className="text-xs text-red-600 font-medium">
                    ⚠ Exceeds limit by {formatCurrency(newBalance - creditLimit!, currency)}
                  </p>
                )}
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-600">{error}</p>
              </div>
            )}

            {/* Confirm button */}
            <button
              onClick={() => {
                const err = validate();
                if (err) { setError(err); return; }
                setError('');
                setShowConfirm(true);
              }}
              disabled={!canConfirm || saving}
              className="w-full mt-4 h-12 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 transition-colors"
            >
              Review & Confirm Sale →
            </button>

            <p className="text-xs text-gray-400 text-center mt-2">
              Invoice number assigned on confirmation
            </p>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <ConfirmSaleModal
          customer={customer!}
          grandTotal={grandTotal}
          amountDue={amountDue}
          received={received}
          paymentType={paymentType}
          paymentMethod={paymentMethod}
          itemCount={items.filter(i => i.productId).length}
          currency={currency}
          isOverLimit={isOverLimit}
          overrideReason={overrideReason}
          saving={saving}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}

// ── Confirmation modal ────────────────────────────────────────
interface ConfirmProps {
  customer:      typeof sampleCustomers[0];
  grandTotal:    number;
  amountDue:     number;
  received:      number;
  paymentType:   SalePaymentType;
  paymentMethod: PaymentMethod;
  itemCount:     number;
  currency:      string;
  isOverLimit:   boolean;
  overrideReason:string;
  saving:        boolean;
  onConfirm:     () => void;
  onCancel:      () => void;
}

function ConfirmSaleModal({
  customer, grandTotal, amountDue, received,
  paymentType, paymentMethod, itemCount, currency,
  isOverLimit, overrideReason, saving, onConfirm, onCancel,
}: ConfirmProps) {
  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', other: 'Other',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
            <i className="ti ti-check text-2xl text-emerald-600" aria-hidden="true" />
          </div>
          <h3 className="text-base font-semibold text-gray-900">Confirm sale</h3>
          <p className="text-sm text-gray-500 mt-1">This cannot be edited after confirmation.</p>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-2 mb-4">
          <Row label="Customer"   value={customer.name} />
          <Row label="Items"      value={`${itemCount} product${itemCount !== 1 ? 's' : ''}`} />
          <Row label="Total"      value={formatCurrency(grandTotal, currency)} bold />
          <Row label="Payment"    value={
            paymentType === 'cash'    ? `Cash — ${PAYMENT_LABELS[paymentMethod]}` :
            paymentType === 'credit'  ? 'Credit sale — full amount on account' :
            `Partial — ${formatCurrency(received, currency)} received`
          } />
          {amountDue > 0 && (
            <Row label="To account" value={formatCurrency(amountDue, currency)} red />
          )}
        </div>

        {isOverLimit && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 mb-4">
            <p className="text-xs font-medium text-red-700">Credit limit override</p>
            <p className="text-xs text-red-600 mt-0.5">{overrideReason}</p>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            disabled={saving}
            className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Go back
          </button>
          <button
            onClick={onConfirm}
            disabled={saving}
            className="flex-1 h-11 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Confirming...' : 'Confirm Sale'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Row({
  label, value, bold, red
}: {
  label: string; value: string; bold?: boolean; red?: boolean
}) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? 'font-semibold text-gray-900' : ''} ${red ? 'text-red-700 font-medium' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}
