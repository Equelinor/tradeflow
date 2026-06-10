import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { samplePayments } from './paymentData';
import { sampleSuppliers } from '@/pages/suppliers/supplierData';
import type { PaymentMethod } from '@/pages/sales/saleData';

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash'             },
  { value: 'benefit',       label: 'Benefit / EFTPOS' },
  { value: 'bank_transfer', label: 'Bank Transfer'    },
  { value: 'cheque',        label: 'Cheque'           },
  { value: 'other',         label: 'Other'            },
];

const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank Transfer',
  cheque: 'Cheque', other: 'Other',
};

export default function PaymentsPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role, companyId, uid } = useAuth();

  const [showNew,  setShowNew]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'voided'>('all');

  // TODO: replace with usePayments(companyId) when Firebase ready
  const payments  = samplePayments;
  const suppliers = sampleSuppliers;

  const filtered = useMemo(() => {
    let list = [...payments];
    if (filter === 'voided') list = list.filter(p => p.isVoid);
    else list = list.filter(p => !p.isVoid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.paymentNumber.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q) ||
        (p.referenceNo ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [payments, filter, search]);

  const active     = payments.filter(p => !p.isVoid);
  const totalToday = active.filter(p => {
    const d = p.date.toDate(); const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }).reduce((s, p) => s + p.amount, 0);
  const totalMonth = active.filter(p => {
    const d = p.date.toDate(); const t = new Date();
    return d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Payments</h1>
          <p className="text-xs text-gray-400 mt-0.5">{active.length} payments to suppliers</p>
        </div>
        {can.manageSuppliers(role) && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">New Payment</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Paid today</p>
          <p className="text-base md:text-lg font-semibold text-emerald-700">{formatCurrency(totalToday, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">This month</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{formatCurrency(totalMonth, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total payments</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{active.length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search payment no, supplier, reference..."
            className="w-full h-10 pl-9 pr-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
        </div>
        <select value={filter} onChange={e => setFilter(e.target.value as any)}
          className="h-10 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none">
          <option value="all">Active</option>
          <option value="voided">Voided</option>
        </select>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <i className="ti ti-credit-card text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">No payments found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Number</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Supplier</div>
              <div className="col-span-2">Method</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1" />
            </div>
            {filtered.map(payment => (
              <div key={payment.id}
                className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 cursor-pointer transition-colors"
                onClick={() => navigate(`/payments/${payment.id}`)}>
                <div className="md:col-span-2 flex items-center">
                  <p className="text-xs font-mono font-medium text-gray-700">{payment.paymentNumber}</p>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-sm text-gray-600">{formatDate(payment.date)}</p>
                </div>
                <div className="md:col-span-3 flex items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{payment.supplierName}</p>
                    <p className="text-xs text-gray-400 md:hidden">{formatDate(payment.date)}</p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <div>
                    <p className="text-sm text-gray-600">{PAYMENT_LABELS[payment.paymentMethod]}</p>
                    {payment.referenceNo && <p className="text-xs text-gray-400">{payment.referenceNo}</p>}
                  </div>
                </div>
                <div className="flex md:col-span-2 items-center md:justify-end">
                  <p className={`text-sm font-semibold ${payment.isVoid ? 'text-gray-400 line-through' : 'text-emerald-700'}`}>
                    {formatCurrency(payment.amount, currency)}
                  </p>
                  {payment.isVoid && <span className="ml-2 text-xs text-red-600">Voided</span>}
                  {payment.overpaymentOverride?.overridden && !payment.isVoid && (
                    <span className="ml-2 text-xs text-amber-600" title="Overpayment approved">advance</span>
                  )}
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end">
                  <i className="ti ti-chevron-right text-gray-400 text-sm" aria-hidden="true" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showNew && (
        <NewPaymentModal
          suppliers={suppliers}
          currency={currency}
          companyId={companyId}
          uid={uid}
          role={role}
          onClose={() => setShowNew(false)}
          onSaved={() => setShowNew(false)}
        />
      )}
    </div>
  );
}

// ── New Payment Modal ─────────────────────────────────────────
interface NewPaymentModalProps {
  suppliers:  typeof sampleSuppliers;
  currency:   string;
  companyId:  string;
  uid:        string;
  role:       string;
  onClose:    () => void;
  onSaved:    () => void;
}

function NewPaymentModal({ suppliers, currency, companyId, uid, role, onClose, onSaved }: NewPaymentModalProps) {
  const [supplierId,     setSupplierId]     = useState('');
  const [amount,         setAmount]         = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('bank_transfer');
  const [referenceNo,    setReferenceNo]    = useState('');
  const [date,           setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [notes,          setNotes]          = useState('');
  const [overrideActive, setOverrideActive] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const supplier     = suppliers.find(s => s.id === supplierId);
  const amountNum    = parseFloat(amount) || 0;
  const payable      = supplier?.currentBalance ?? 0;
  const isOverpaying = supplier && amountNum > payable && payable > 0;
  const isOwnerAdmin = role === 'owner' || role === 'admin';

  async function handleSave() {
    if (!supplierId)              { setError('Please select a supplier.'); return; }
    if (!amount || amountNum <= 0){ setError('Please enter a valid amount.'); return; }
    if (!date)                    { setError('Please select a date.'); return; }

    // Overpayment gate
    if (isOverpaying) {
      if (!isOwnerAdmin) { setError('Payment exceeds supplier payable. Only owner or admin can approve this.'); return; }
      if (!overrideActive) { setError('Payment exceeds supplier payable. Please confirm override below.'); return; }
      if (!overrideReason.trim()) { setError('Override reason is required.'); return; }
    }

    setSaving(true); setError('');

    try {
      const firebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY &&
        import.meta.env.VITE_FIREBASE_API_KEY !== 'your-api-key-here';

      if (!firebaseConnected) {
        await new Promise(r => setTimeout(r, 600));
        onSaved();
        return;
      }

      const { createPayment } = await import('@/services/paymentService');
      await createPayment(companyId, uid, {
        supplierId,
        amount: amountNum,
        paymentMethod,
        referenceNo:  referenceNo.trim() || null,
        date:         new Date(date),
        notes:        notes.trim() || null,
        overpaymentOverride: isOverpaying && overrideActive ? {
          overridden:     true,
          reason:         overrideReason.trim(),
          by:             uid,
          currentPayable: payable,
          paymentAmount:  amountNum,
        } : null,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to save payment. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  void companyId; void uid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">New Payment to Supplier</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier *</label>
            <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none">
              <option value="">Select supplier...</option>
              {suppliers.filter(s => s.status === 'active').map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} — {formatCurrency(s.currentBalance, currency)} payable
                </option>
              ))}
            </select>
            {supplier && (
              <p className="text-xs text-gray-500 mt-1">
                Current payable: <span className={`font-medium ${payable > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                  {formatCurrency(payable, currency)}
                </span>
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount *</label>
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
              <input type="number" min="0" step="0.001" value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.000" inputMode="decimal"
                className={`w-full h-11 pl-12 pr-4 rounded-xl border text-sm outline-none transition-colors ${
                  isOverpaying
                    ? 'border-red-300 focus:border-red-400 focus:ring-2 focus:ring-red-400/20'
                    : 'border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`} />
            </div>

            {/* Overpayment warning + override */}
            {isOverpaying && (
              <div className="mt-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-start gap-2">
                  <i className="ti ti-alert-triangle text-red-600 text-sm flex-shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="flex-1">
                    <p className="text-xs font-medium text-red-700">
                      Payment exceeds supplier payable
                    </p>
                    <p className="text-xs text-red-600 mt-0.5">
                      Payable: {formatCurrency(payable, currency)} · Paying: {formatCurrency(amountNum, currency)} ·
                      Overpayment: {formatCurrency(amountNum - payable, currency)}
                    </p>
                    {isOwnerAdmin ? (
                      <div className="mt-2 space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="checkbox" checked={overrideActive}
                            onChange={e => setOverrideActive(e.target.checked)}
                            className="w-4 h-4 rounded border-gray-300 text-red-600" />
                          <span className="text-xs text-red-700 font-medium">
                            I approve this advance payment
                          </span>
                        </label>
                        {overrideActive && (
                          <input type="text" value={overrideReason}
                            onChange={e => setOverrideReason(e.target.value)}
                            placeholder="Reason for advance payment (required)..."
                            className="w-full h-9 px-3 rounded-lg border border-red-200 text-xs focus:border-red-400 outline-none bg-white" />
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-red-600 mt-1 font-medium">
                        Only owner or admin can approve advance payments.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment method</label>
              <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)}
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 outline-none">
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Reference no.</label>
              <input type="text" value={referenceNo} onChange={e => setReferenceNo(e.target.value)}
                placeholder="Optional"
                className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any notes about this payment..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none" />
          </div>

          <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
            Payment number assigned automatically. Supplier balance updated after confirmation.
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Confirm Payment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
