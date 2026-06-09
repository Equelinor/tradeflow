import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useBranding } from '@/context/BrandingContext';
import { useAuth } from '@/context/AuthContext';
import { sampleSuppliers } from './supplierData';
// TODO: import { createSupplier, updateSupplier } from './supplierService';

export default function SupplierForm() {
  const { id }       = useParams<{ id?: string }>();
  const navigate     = useNavigate();
  const { currency } = useBranding();
  const { companyId, uid } = useAuth();
  const isEdit = !!id;

  const existing = isEdit ? sampleSuppliers.find(s => s.id === id) : null;

  const [form, setForm] = useState({
    code:           existing?.code          ?? '',
    name:           existing?.name          ?? '',
    contactPerson:  existing?.contactPerson ?? '',
    phone:          existing?.phone         ?? '',
    whatsapp:       existing?.whatsapp      ?? '',
    email:          existing?.email         ?? '',
    address:        existing?.address       ?? '',
    crNumber:       existing?.crNumber      ?? '',
    openingBalance: existing?.openingBalance ?? 0,
    // currentBalance is NEVER in this form — not a field, not a state
    // It is owned exclusively by Cloud Function onSupplierTransaction
  });
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  function update(field: string, value: string | number) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim())  { setError('Supplier name is required.'); return; }
    if (!form.phone.trim()) { setError('Phone number is required.'); return; }
    if (!form.code.trim())  { setError('Supplier code is required.'); return; }
    setLoading(true); setError('');

    try {
      if (isEdit) {
        // UPDATE: profile fields only — currentBalance and openingBalance excluded
        // await updateSupplier(companyId, id!, {
        //   code:          form.code,
        //   name:          form.name,
        //   contactPerson: form.contactPerson || null,
        //   phone:         form.phone,
        //   whatsapp:      form.whatsapp || null,
        //   email:         form.email || null,
        //   address:       form.address || null,
        //   crNumber:      form.crNumber || null,
        // });
      } else {
        // CREATE: openingBalance set once here.
        // currentBalance is initialised equal to openingBalance in the service.
        // After creation, ONLY Cloud Function writes currentBalance.
        // await createSupplier(companyId, uid, {
        //   code:           form.code,
        //   name:           form.name,
        //   contactPerson:  form.contactPerson || null,
        //   phone:          form.phone,
        //   whatsapp:       form.whatsapp || null,
        //   email:          form.email || null,
        //   address:        form.address || null,
        //   crNumber:       form.crNumber || null,
        //   openingBalance: Number(form.openingBalance),
        // });
      }
      await new Promise(r => setTimeout(r, 500)); // remove when Firebase connected
      navigate('/suppliers');
    } catch (err) {
      console.error(err);
      setError('Failed to save supplier. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Suppress unused variable warnings until Firebase connected
  void companyId; void uid;

  return (
    <div className="p-3 md:p-5 max-w-lg mx-auto space-y-4">
      <button
        onClick={() => navigate(isEdit ? `/suppliers/${id}` : '/suppliers')}
        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
      >
        <i className="ti ti-arrow-left" aria-hidden="true" />
        {isEdit ? 'Back to supplier' : 'Suppliers'}
      </button>

      <h1 className="text-base font-semibold text-gray-900">
        {isEdit ? 'Edit supplier' : 'Add supplier'}
      </h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier code *">
              <input type="text" required value={form.code}
                onChange={e => update('code', e.target.value.toUpperCase())}
                placeholder="SUP-001" className={inputClass}
              />
            </Field>
            <Field label="Phone *">
              <input type="tel" required value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+973 1700 0000" className={inputClass}
              />
            </Field>
          </div>

          <Field label="Supplier name *">
            <input type="text" required value={form.name}
              onChange={e => update('name', e.target.value)}
              placeholder="Gulf Imports Co." className={inputClass}
            />
          </Field>

          <Field label="Contact person">
            <input type="text" value={form.contactPerson}
              onChange={e => update('contactPerson', e.target.value)}
              placeholder="Mohammed Al Rashid" className={inputClass}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="WhatsApp" hint="Leave blank to use phone">
              <input type="tel" value={form.whatsapp}
                onChange={e => update('whatsapp', e.target.value)}
                placeholder="Same as phone" className={inputClass}
              />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="Optional" className={inputClass}
              />
            </Field>
          </div>

          <Field label="Address">
            <input type="text" value={form.address}
              onChange={e => update('address', e.target.value)}
              placeholder="Building, Area, City" className={inputClass}
            />
          </Field>

          <Field label="CR / Trade license number">
            <input type="text" value={form.crNumber}
              onChange={e => update('crNumber', e.target.value)}
              placeholder="Optional" className={inputClass}
            />
          </Field>

          {/* Opening balance — only shown for NEW suppliers, locked forever after */}
          {!isEdit && (
            <Field
              label="Opening balance"
              hint="Amount you owed this supplier before using TradeFlow. Cannot be changed after saving."
            >
              <div className="relative">
                <span className="absolute left-3 top-3 text-sm text-gray-400">{currency}</span>
                <input type="number" min="0" step="0.001"
                  value={form.openingBalance}
                  onChange={e => update('openingBalance', e.target.value)}
                  placeholder="0.000" inputMode="decimal"
                  className={`${inputClass} pl-12`}
                />
              </div>
            </Field>
          )}

          {/* Show locked opening balance on edit — read only */}
          {isEdit && existing && existing.openingBalance > 0 && (
            <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-700">Opening balance</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Locked — cannot be changed after creation
                </p>
              </div>
              <p className="text-sm font-semibold text-gray-900">
                {currency} {existing.openingBalance.toFixed(3)}
              </p>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button type="button"
              onClick={() => navigate(isEdit ? `/suppliers/${id}` : '/suppliers')}
              className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 h-11 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : isEdit ? 'Save changes' : 'Add supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const inputClass = 'w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors';

function Field({ label, hint, children }: {
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
