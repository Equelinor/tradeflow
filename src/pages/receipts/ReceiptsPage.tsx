import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { sampleReceipts } from './receiptData';
import { sampleCustomers } from '@/pages/customers/customerData';
import type { PaymentMethod } from '@/pages/sales/saleData';

// ─────────────────────────────────────────────────────────────
// New Receipt Modal — embedded in ReceiptsPage for speed
// Simple form: customer, amount, method, ref, date, notes
// ─────────────────────────────────────────────────────────────

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash',          label: 'Cash'             },
  { value: 'benefit',       label: 'Benefit / EFTPOS' },
  { value: 'bank_transfer', label: 'Bank Transfer'    },
  { value: 'cheque',        label: 'Cheque'           },
  { value: 'other',         label: 'Other'            },
];

export default function ReceiptsPage() {
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { role, companyId, uid } = useAuth();

  const [showNew,  setShowNew]  = useState(false);
  const [search,   setSearch]   = useState('');
  const [filter,   setFilter]   = useState<'all' | 'voided'>('all');

  // TODO: replace with useReceipts(companyId) when Firebase ready
  const receipts  = sampleReceipts;
  const customers = sampleCustomers;

  const filtered = useMemo(() => {
    let list = [...receipts];
    if (filter === 'voided') list = list.filter(r => r.isVoid);
    else list = list.filter(r => !r.isVoid);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(r =>
        r.receiptNumber.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.referenceNo ?? '').toLowerCase().includes(q)
      );
    }
    return list.sort((a, b) => b.date.toDate().getTime() - a.date.toDate().getTime());
  }, [receipts, filter, search]);

  const active      = receipts.filter(r => !r.isVoid);
  const totalToday  = active.filter(r => {
    const d = r.date.toDate(); const t = new Date();
    return d.getDate()===t.getDate() && d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }).reduce((s, r) => s + r.amount, 0);
  const totalMonth  = active.filter(r => {
    const d = r.date.toDate(); const t = new Date();
    return d.getMonth()===t.getMonth() && d.getFullYear()===t.getFullYear();
  }).reduce((s, r) => s + r.amount, 0);

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', other: 'Other',
  };

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-gray-900">Receipts</h1>
          <p className="text-xs text-gray-400 mt-0.5">{active.length} receipts</p>
        </div>
        {can.createSale(role) && (
          <button onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors">
            <i className="ti ti-plus" aria-hidden="true" />
            <span className="hidden md:inline">New Receipt</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Collected today</p>
          <p className="text-base md:text-lg font-semibold text-emerald-700">{formatCurrency(totalToday, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">This month</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{formatCurrency(totalMonth, currency)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
          <p className="text-xs text-gray-400 mb-1">Total receipts</p>
          <p className="text-base md:text-lg font-semibold text-gray-900">{active.length}</p>
        </div>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <i className="ti ti-search absolute left-3 top-3 text-gray-400 text-sm" aria-hidden="true" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search receipt no, customer, reference..."
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
            <i className="ti ti-cash text-3xl text-gray-300 block mb-2" aria-hidden="true" />
            <p className="text-sm text-gray-400">No receipts found.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            <div className="hidden md:grid grid-cols-12 gap-3 px-4 py-2.5 bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
              <div className="col-span-2">Number</div>
              <div className="col-span-2">Date</div>
              <div className="col-span-3">Customer</div>
              <div className="col-span-2">Method</div>
              <div className="col-span-2 text-right">Amount</div>
              <div className="col-span-1" />
            </div>
            {filtered.map(receipt => (
              <div key={receipt.id} className="grid grid-cols-1 md:grid-cols-12 gap-2 md:gap-3 px-4 py-3.5 hover:bg-gray-50 transition-colors">
                <div className="md:col-span-2 flex items-center">
                  <p className="text-xs font-mono font-medium text-gray-700">{receipt.receiptNumber}</p>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <p className="text-sm text-gray-600">{formatDate(receipt.date)}</p>
                </div>
                <div className="md:col-span-3 flex items-center">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{receipt.customerName}</p>
                    <p className="text-xs text-gray-400 md:hidden">{formatDate(receipt.date)}</p>
                  </div>
                </div>
                <div className="hidden md:flex md:col-span-2 items-center">
                  <div>
                    <p className="text-sm text-gray-600">{PAYMENT_LABELS[receipt.paymentMethod]}</p>
                    {receipt.referenceNo && <p className="text-xs text-gray-400">{receipt.referenceNo}</p>}
                  </div>
                </div>
                <div className="flex md:col-span-2 items-center md:justify-end">
                  <p className={`text-sm font-semibold ${receipt.isVoid ? 'text-gray-400 line-through' : 'text-emerald-700'}`}>
                    {formatCurrency(receipt.amount, currency)}
                  </p>
                  {receipt.isVoid && <span className="ml-2 text-xs text-red-600">Voided</span>}
                </div>
                <div className="hidden md:flex md:col-span-1 items-center justify-end">
                  {receipt.source === 'system' && (
                    <span className="text-xs text-gray-400" title="Auto-created from sale">auto</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* New Receipt Modal */}
      {showNew && (
        <NewReceiptModal
          customers={customers}
          currency={currency}
          companyId={companyId}
          uid={uid}
          onClose={() => setShowNew(false)}
          onSaved={() => { setShowNew(false); }}
        />
      )}
    </div>
  );
}

// ── New Receipt Modal ─────────────────────────────────────────
interface NewReceiptModalProps {
  customers:  typeof sampleCustomers;
  currency:   string;
  companyId:  string;
  uid:        string;
  onClose:    () => void;
  onSaved:    () => void;
}

function NewReceiptModal({ customers, currency, companyId, uid, onClose, onSaved }: NewReceiptModalProps) {
  const [customerId,     setCustomerId]     = useState('');
  const [amount,         setAmount]         = useState('');
  const [paymentMethod,  setPaymentMethod]  = useState<PaymentMethod>('cash');
  const [referenceNo,    setReferenceNo]    = useState('');
  const [date,           setDate]           = useState(new Date().toISOString().split('T')[0]);
  const [notes,          setNotes]          = useState('');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const customer      = customers.find(c => c.id === customerId);
  const amountNum     = parseFloat(amount) || 0;
  const wouldExceed   = customer && amountNum > customer.currentBalance;

  async function handleSave() {
    if (!customerId)     { setError('Please select a customer.'); return; }
    if (!amount || amountNum <= 0) { setError('Please enter a valid amount.'); return; }
    if (!date)           { setError('Please select a date.'); return; }
    setSaving(true); setError('');

    try {
      const firebaseConnected = !!import.meta.env.VITE_FIREBASE_API_KEY &&
        import.meta.env.VITE_FIREBASE_API_KEY !== 'your-api-key-here';

      if (!firebaseConnected) {
        await new Promise(r => setTimeout(r, 600));
        onSaved();
        return;
      }

      const { createReceipt } = await import('@/services/receiptService');
      await createReceipt(companyId, uid, {
        customerId,
        amount: amountNum,
        paymentMethod,
        referenceNo: referenceNo.trim() || null,
        date:        new Date(date),
        notes:       notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      setError('Failed to save receipt. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  void companyId; void uid;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-gray-900">New Receipt</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Customer *</label>
            <select value={customerId} onChange={e => setCustomerId(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none">
              <option value="">Select customer...</option>
              {customers.filter(c => c.status === 'active').map(c => (
                <option key={c.id} value={c.id}>
                  {c.name} — {formatCurrency(c.currentBalance, currency)} due
                </option>
              ))}
            </select>
            {customer && (
              <p className="text-xs text-gray-500 mt-1">
                Outstanding balance: <span className="font-medium text-red-600">{formatCurrency(customer.currentBalance, currency)}</span>
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
                className={`w-full h-11 pl-12 pr-4 rounded-xl border text-sm focus:ring-2 outline-none transition-colors ${
                  wouldExceed
                    ? 'border-amber-300 focus:border-amber-400 focus:ring-amber-400/20'
                    : 'border-gray-200 focus:border-emerald-500 focus:ring-emerald-500/20'
                }`} />
            </div>
            {wouldExceed && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠ Amount exceeds outstanding balance. Confirm with owner/admin.
              </p>
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
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Date *</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Any notes..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 outline-none resize-none" />
          </div>

          <div className="bg-blue-50 rounded-xl px-3 py-2 text-xs text-blue-700">
            Receipt number will be assigned automatically. Balance updates after confirmation.
          </div>

          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button onClick={onClose} disabled={saving}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors">
              {saving ? 'Saving...' : 'Confirm Receipt'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
