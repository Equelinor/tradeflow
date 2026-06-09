import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import SettingsUsersPage from './SettingsUsersPage';

type Tab = 'users' | 'company' | 'branding';

export default function SettingsPage() {
  const { role } = useAuth();
  const [tab, setTab] = useState<Tab>('users');

  const tabs: { id: Tab; label: string; icon: string; ownerOnly?: boolean }[] = [
    { id: 'users',    label: 'Team',     icon: 'ti-users'        },
    { id: 'company',  label: 'Company',  icon: 'ti-building',    ownerOnly: true },
    { id: 'branding', label: 'Branding', icon: 'ti-palette',     ownerOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.ownerOnly || role === 'owner');

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      {/* Tab bar */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 w-fit">
        {visibleTabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <i className={`ti ${t.icon} text-base`} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'users'    && <SettingsUsersPage />}
      {tab === 'company'  && <CompanySettingsPlaceholder />}
      {tab === 'branding' && <BrandingSettingsPlaceholder />}
    </div>
  );
}

function CompanySettingsPlaceholder() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <i className="ti ti-building text-3xl text-gray-300 mb-3 block" aria-hidden="true" />
      <p className="text-sm text-gray-400">Company settings — coming soon</p>
    </div>
  );
}

function BrandingSettingsPlaceholder() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-8 text-center">
      <i className="ti ti-palette text-3xl text-gray-300 mb-3 block" aria-hidden="true" />
      <p className="text-sm text-gray-400">Branding & logo upload — coming soon</p>
    </div>
  );
}
