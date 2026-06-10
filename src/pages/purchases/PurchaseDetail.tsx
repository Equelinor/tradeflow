import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { can } from '@/lib/permissions';
import { samplePurchases } from './purchaseData';

export default function PurchaseDetail() {
  const { id }       = useParams<{ id: string }>();
  const navigate     = useNavigate();
  const branding     = useBranding();
  const { role, uid: _uid } = useAuth();
  const purchase = samplePurchases.find(p => p.id === id) ?? samplePurchases[0];

  const [showVoid,   setShowVoid]   = useState(false);
  const [voidReason, setVoidReason] = useState('');
  const [voiding,    setVoiding]    = useState(false);
  const [voidError,  setVoidError]  = useState('');

  async function handleVoid() {
    if (!voidReason.trim()) { setVoidError('Void reason is required.'); return; }
    setVoiding(true); setVoidError('');
    try {
      // TODO: await voidPurchase(purchase.companyId, purchase.id, _uid, voidReason.trim());
      await new Promise(r => setTimeout(r, 800));
      setShowVoid(false);
      navigate('/purchases');
    } catch {
      setVoidError('Failed to void purchase. Please try again.');
    } finally {
      setVoiding(false);
    }
  }

  if (!purchase) return <div className="p-6 text-center text-gray-400">Purchase not found.</div>;

  const PAYMENT_LABELS: Record<string, string> = {
    cash: 'Cash', benefit: 'Benefit', bank_transfer: 'Bank Transfer',
    cheque: 'Cheque', other: 'Other',
  };

  return (
    <div className="p-3 md:p-5 max-w-screen-lg mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('/purchases')}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
          <i className="ti ti-arrow-left" aria-hidden="true" /> Purchases
        </button>
        {!purchase.isVoid && can.voidSale(role) && (
          <button onClick={() => setShowVoid(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-50 text-red-700 border border-red-200 text-sm font-medium rounded-xl hover:bg-red-100 transition-colors">
            <i className="ti ti-ban" aria-hidden="true" />
            <span className="hidden md:inline">Void</span>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-start gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-semibold text-gray-900 font-mono">{purchase.purchaseNumber}</h2>
              {purchase.isVoid && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">VOIDED</span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${
                purchase.paymentType === 'cash'   ? 'bg-emerald-100 text-emerald-700' :
                purchase.paymentType === 'credit' ? 'bg-blue-100 text-blue-700' :
                                                     'bg-amber-100 text-amber-700'
              }`}>{purchase.paymentType}</span>
            </div>
            <p className="text-sm text-gray-500 mt-1">{purchase.supplierName} · {formatDate(purchase.date)}</p>
            {purchase.supplierInvoiceNo && (
              <p className="text-xs text-gray-400 mt-0.5">Supplier inv: {purchase.supplierInvoiceNo}</p>
            )}
            {purchase.notes && <p className="text-xs text-gray-400 mt-1">{purchase.notes}</p>}
          </div>
          <div className="flex gap-3">
            <div className="text-center px-4 py-2 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-400 mb-0.5">Total</p>
              <p className={`text-base font-bold ${purchase.isVoid ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                {formatCurrency(purchase.grandTotal, branding.currency)}
              </p>
            </div>
            {purchase.amountDue > 0 && !purchase.isVoid && (
              <div className="text-center px-4 py-2 bg-red-50 rounded-xl">
                <p className="text-xs text-gray-400 mb-0.5">Payable</p>
                <p className="text-base font-bold text-red-700">{formatCurrency(purchase.amountDue, branding.currency)}</p>
              </div>
            )}
          </div>
        </div>
        {purchase.isVoid && purchase.voidReason && (
          <div className="mt-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            <p className="text-xs font-medium text-red-700">Void reason</p>
            <p className="text-sm text-red-600 mt-0.5">{purchase.voidReason}</p>
          </div>
        )}
      </div>

      {/* Line items */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700">Items purchased</h3>
        </div>
        <div className="divide-y divide-gray-100">
          {purchase.items.map((item, i) => (
            <div key={i} className="px-4 py-3 grid grid-cols-12 gap-3 items-center">
              <div className="col-span-6 md:col-span-5">
                <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                <p className="text-xs text-gray-400">{item.productCode} · {item.unit}</p>
              </div>
              <div className="hidden md:block col-span-2 text-center">
                <p className="text-sm text-gray-700">{item.qty} {item.unit}</p>
              </div>
              <div className="hidden md:block col-span-2 text-right">
                <p className="text-sm text-gray-600">{formatCurrency(item.unitCost, branding.currency)}</p>
                {item.discount > 0 && (
                  <p className="text-xs text-emerald-600">− {formatCurrency(item.discount, branding.currency)}</p>
                )}
              </div>
              <div className="col-span-6 md:col-span-3 text-right">
                <p className="text-sm font-semibold text-gray-900">{formatCurrency(item.lineTotal, branding.currency)}</p>
                <p className="text-xs text-gray-400 md:hidden">× {item.qty}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-gray-200 px-4 py-3 space-y-1.5 bg-gray-50">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Subtotal</span><span>{formatCurrency(purchase.subtotal, branding.currency)}</span>
          </div>
          {purchase.discountTotal > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Discount</span><span>− {formatCurrency(purchase.discountTotal, branding.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-200">
            <span>Grand total</span><span>{formatCurrency(purchase.grandTotal, branding.currency)}</span>
          </div>
          {purchase.amountPaid > 0 && (
            <div className="flex justify-between text-sm text-emerald-700">
              <span>Paid {purchase.paymentMethod ? `(${PAYMENT_LABELS[purchase.paymentMethod]})` : ''}{purchase.referenceNo ? ` · ${purchase.referenceNo}` : ''}</span>
              <span>− {formatCurrency(purchase.amountPaid, branding.currency)}</span>
            </div>
          )}
          {purchase.amountDue > 0 && (
            <div className="flex justify-between text-sm font-semibold text-red-700">
              <span>Added to payable</span><span>{formatCurrency(purchase.amountDue, branding.currency)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Void modal */}
      {showVoid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <div className="text-center mb-5">
              <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <i className="ti ti-ban text-2xl text-red-600" aria-hidden="true" />
              </div>
              <h3 className="text-base font-semibold text-gray-900">Void this purchase?</h3>
              <p className="text-sm text-gray-500 mt-1">Stock and supplier balance will be reversed. Cannot be undone.</p>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Void reason <span className="text-red-500">*</span>
              </label>
              <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} rows={3}
                placeholder="Why is this purchase being voided?"
                className="w-full px-3 py-2.5 rounded-xl border border-gray-200 text-sm focus:border-red-400 focus:ring-2 focus:ring-red-400/20 outline-none resize-none" />
              {voidError && <p className="text-xs text-red-600 mt-1">{voidError}</p>}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
              <p className="text-xs text-amber-700">
                <strong>Stock will be restored</strong> and supplier payable will be reversed by the system.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowVoid(false); setVoidReason(''); setVoidError(''); }} disabled={voiding}
                className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleVoid} disabled={voiding || !voidReason.trim()}
                className="flex-1 h-11 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 transition-colors">
                {voiding ? 'Voiding...' : 'Void Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
