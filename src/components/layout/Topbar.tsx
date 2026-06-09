import { useLocation, useNavigate } from 'react-router-dom';
import { useBranding } from '@/context/BrandingContext';

const pageTitles: Record<string, string> = {
  '/dashboard':    'Dashboard',
  '/customers':    'Customers',
  '/suppliers':    'Suppliers',
  '/products':     'Products',
  '/sales':        'Sales',
  '/sales/new':    'New Sale',
  '/purchases':    'Purchases',
  '/purchases/new':'New Purchase',
  '/receipts':     'Receipts',
  '/payments':     'Payments',
  '/reports':      'Reports',
  '/shipments':    'Shipments',
  '/settings':     'Settings',
};

export default function Topbar() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const branding  = useBranding();
  const isDashboard = location.pathname === '/dashboard';

  const title = pageTitles[location.pathname] ?? 'TradeFlow';
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric',
  });

  const hour      = new Date().getHours();
  const greeting  = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <header className="bg-white border-b border-gray-200 px-4 md:px-5 py-2.5 flex items-center gap-2 md:gap-3">

      {/* Mobile: logo + page title */}
      <div className="md:hidden flex items-center gap-2 flex-1 min-w-0">
        {branding.logoUrl ? (
          <img src={branding.logoUrl} alt="Logo" className="w-7 h-7 rounded-lg object-contain flex-shrink-0" />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-semibold">
              {branding.companyName.substring(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
      </div>

      {/* Desktop: greeting or page title */}
      <div className="hidden md:block flex-1">
        {isDashboard ? (
          <p className="text-sm font-medium text-gray-900">{greeting} 👋</p>
        ) : (
          <h1 className="text-sm font-medium text-gray-900">{title}</h1>
        )}
      </div>

      {/* Date chip — desktop only */}
      <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200 whitespace-nowrap">
        <i className="ti ti-calendar text-sm" aria-hidden="true" />
        {today}
      </div>

      {/* Dashboard quick actions — desktop only */}
      {isDashboard && (
        <>
          <button
            onClick={() => navigate('/sales/new')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap"
          >
            <i className="ti ti-camera text-sm" aria-hidden="true" />
            Scan Invoice
          </button>
          <button
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 border border-green-200 rounded-lg hover:bg-green-100 transition-colors whitespace-nowrap"
          >
            <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
            Send Reminders
          </button>
          <button
            onClick={() => navigate('/sales/new')}
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors whitespace-nowrap"
          >
            <i className="ti ti-plus text-sm" aria-hidden="true" />
            New Sale
          </button>
        </>
      )}
    </header>
  );
}
