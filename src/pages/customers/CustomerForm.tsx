import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { sampleCustomers } from './customerData';

// TODO: replace with Firestore write when Firebase is connected
// import { collection, addDoc, updateDoc, doc, serverTimestamp } from 'firebase/firestore';
// import { db } from '@/firebase';
// import { SUB } from '@/config';

export default function CustomerForm() {
  const { id }       = useParams<{ id?: string }>();
  const navigate     = useNavigate();
  const branding     = useBranding();
  const { companyId: _companyId, uid: _uid } = useAuth(); // used when Firebase connected
  const isEdit = !!id;

  const existing = isEdit
    ? sampleCustomers.find(c => c.id === id)
    : null;

  const [form, setForm] = useState({
    name:           existing?.name           ?? '',
    phone:          existing?.phone          ?? '',
    whatsapp:       existing?.whatsapp       ?? '',
    address:        existing?.address        ?? '',
    crNumber:       existing?.crNumber       ?? '',
    openingBalance: existing?.openingBalance ?? 0,
    creditLimit:    existing?.creditLimit    ?? '',
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Customer name is required.'); return; }
    if (!form.phone.trim()) { setError('Phone number is required.'); return; }
    setLoading(true); setError('');

    try {
      // TODO: when Firebase is connected, replace with:
      // const data = {
      //   companyId,
      //   name:           form.name.trim(),
      //   phone:          form.phone.trim(),
      //   whatsapp:       form.whatsapp.trim() || form.phone.trim(),
      //   address:        form.address.trim() || null,
      //   crNumber:       form.crNumber.trim() || null,
      //   openingBalance: Number(form.openingBalance),
      //   currentBalance: Number(form.openingBalance),  // starts equal to opening
      //   creditLimit:    form.creditLimit !== '' ? Number(form.creditLimit) : null,
      //   status:         'active',
      //   createdAt:      serverTimestamp(),
      //   updatedAt:      serverTimestamp(),
      //   createdBy:      uid,
      // };
      // if (isEdit) {
      //   await updateDoc(doc(db, `${SUB(companyId).customers}/${id}`), { ...data, createdAt: existing.createdAt });
      // } else {
      //   await addDoc(collection(db, SUB(companyId).customers), data);
      // }

      // For now: simulate save
      await new Promise(r => setTimeout(r, 600));
      navigate('/customers');
    } catch (err) {
      console.error(err);
      setError('Failed to save customer. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-3 md:p-5 max-w-lg mx-auto space-y-4">

      {/* Back */}
      <button
        onClick={() => navigate(isEdit ? `/customers/${id}` : '/customers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
        {isEdit ? 'Back to customer' : 'Customers'}
      </button>

      <h1 className="text-base font-semibold text-gray-900">
        {isEdit ? 'Edit customer' : 'Add customer'}
      </h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">

          <Field label="Full name *">
            <input
              type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Gulf Foods Co."
              className={inputClass}
            />
          </Field>

          <Field label="Phone *">
            <input
              type="tel" required value={form.phone}
              onChange={e => update('phone', e.target.value)}
              placeholder="+973 3300 0000"
              inputMode="tel"
              className={inputClass}
            />
          </Field>

          <Field label="WhatsApp number" hint="Leave blank to use phone number">
            <input
              type="tel" value={form.whatsapp}
              onChange={e => update('whatsapp', e.target.value)}
              placeholder="Same as phone"
              inputMode="tel"
              className={inputClass}
            />
          </Field>

          <Field label="Address">
            <input
              type="text" value={form.address}
              onChange={e => update('address', e.target.value)}
              placeholder="Building, Road, Area, City"
              className={inputClass}
            />
          </Field>

          <Field label="CR / Trade license number">
            <input
              type="text" value={form.crNumber}
              onChange={e => update('crNumber', e.target.value)}
              placeholder="Optional"
              className={inputClass}
            />
          </Field>

          {/* Opening balance — only for new customers */}
          {!isEdit && (
            <Field
              label="Opening balance"
              hint="Enter if this customer had a balance before you started using TradeFlow"
            >
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-gray-400">{branding.currency}</span>
                <input
                  type="number" min="0" step="0.001"
                  value={form.openingBalance}
                  onChange={e => update('openingBalance', e.target.value)}
                  placeholder="0.000"
                  inputMode="decimal"
                  className={`${inputClass} pl-12`}
                />
              </div>
            </Field>
          )}

          <Field
            label="Credit limit"
            hint="Maximum credit you will extend to this customer. Leave blank for no limit."
          >
            <div className="relative">
              <span className="absolute left-3 top-3 text-sm text-gray-400">{branding.currency}</span>
              <input
                type="number" min="0" step="0.001"
                value={form.creditLimit}
                onChange={e => update('creditLimit', e.target.value)}
                placeholder="No limit"
                inputMode="decimal"
                className={`${inputClass} pl-12`}
              />
            </div>
          </Field>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(isEdit ? `/customers/${id}` : '/customers')}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors';

function Field({
  label, hint, children
}: {
  label: string; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}
