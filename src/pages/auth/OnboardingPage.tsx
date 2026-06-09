import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '@/firebase';

const currencies = ['BHD', 'USD', 'AED', 'SAR', 'KWD', 'OMR', 'QAR'];

export default function OnboardingPage() {
  const navigate  = useNavigate();
  const user      = auth.currentUser!;
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const [form, setForm] = useState({
    name:      '',
    address:   '',
    phone:     '',
    email:     user.email ?? '',
    currency:  'BHD',
    crNumber:  '',
    vatNumber: '',
  });

  function update(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { setError('Company name is required.'); return; }
    setLoading(true); setError('');

    try {
      const companyId = user.uid;  // owner's uid IS the companyId
      const now = serverTimestamp();

      // 1. Create company document
      await setDoc(doc(db, `companies/${companyId}`), {
        companyId,
        ownerUid:       user.uid,
        name:           form.name.trim(),
        address:        form.address.trim(),
        phone:          form.phone.trim(),
        email:          form.email.trim(),
        currency:       form.currency,
        crNumber:       form.crNumber.trim()  || null,
        vatNumber:      form.vatNumber.trim() || null,
        logoUrl:        null,
        themeColor:     null,
        plan:           'basic',
        status:         'trial',
        trialStartDate: now,
        createdAt:      now,
        updatedAt:      now,
      });

      // 2. Create owner user document inside company
      await setDoc(doc(db, `companies/${companyId}/users/${user.uid}`), {
        companyId,
        uid:       user.uid,
        name:      form.name.trim(),
        phone:     user.phoneNumber ?? form.phone.trim(),
        email:     form.email.trim(),
        role:      'owner',
        status:    'active',
        fcmToken:  null,
        createdAt: now,
        updatedAt: now,
        createdBy: user.uid,
      });

      // 3. Write userCompany index — THIS is what multi-user depends on
      // Every user (owner + staff) must have this document
      // Staff get theirs written when owner adds them in Settings → Users
      await setDoc(doc(db, `userCompany/${user.uid}`), {
        uid:       user.uid,
        companyId,
        createdAt: now,
      });

      navigate('/dashboard');
    } catch (err) {
      console.error('[Onboarding]', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-emerald-600 flex items-center justify-center mx-auto mb-4">
            <span className="text-white text-xl font-bold">TF</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900">Set up your business</h1>
          <p className="text-sm text-gray-500 mt-1">This takes less than a minute</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Company name <span className="text-red-500">*</span>
              </label>
              <input
                type="text" required value={form.name}
                onChange={e => update('name', e.target.value)}
                placeholder="Al Noor Trading Co."
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Business phone</label>
              <input
                type="tel" value={form.phone}
                onChange={e => update('phone', e.target.value)}
                placeholder="+973 1700 0000"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Business email</label>
              <input
                type="email" value={form.email}
                onChange={e => update('email', e.target.value)}
                placeholder="info@company.com"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
              <input
                type="text" value={form.address}
                onChange={e => update('address', e.target.value)}
                placeholder="Building 123, Road 456, Manama, Bahrain"
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
              <select
                value={form.currency} onChange={e => update('currency', e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-colors bg-white"
              >
                {currencies.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">CR Number</label>
                <input
                  type="text" value={form.crNumber}
                  onChange={e => update('crNumber', e.target.value)}
                  placeholder="Optional"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">VAT Number</label>
                <input
                  type="text" value={form.vatNumber}
                  onChange={e => update('vatNumber', e.target.value)}
                  placeholder="Optional"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 focus:border-emerald-500 outline-none transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
            )}

            <div className="bg-emerald-50 rounded-xl px-4 py-3 flex gap-2.5">
              <i className="ti ti-gift text-emerald-600 text-lg flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-sm text-emerald-700">
                <strong>30-day free trial</strong> on Basic plan. No payment required.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !form.name.trim()}
              className="w-full h-12 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Setting up...' : 'Start using TradeFlow →'}
            </button>
          </form>
        </div>

        <button
          onClick={() => signOut(auth)}
          className="w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
        >
          Sign out and use a different account
        </button>
      </div>
    </div>
  );
}
