import { NavLink } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useBranding } from '@/context/BrandingContext';

interface NavItem {
  icon:  string;
  label: string;
  path:  string;
  pro?:  boolean;
}

const navItems: NavItem[] = [
  { icon: 'ti-layout-dashboard', label: 'Dashboard',  path: '/dashboard' },
  { icon: 'ti-users',            label: 'Customers',  path: '/customers' },
  { icon: 'ti-building-store',   label: 'Suppliers',  path: '/suppliers' },
  { icon: 'ti-packages',         label: 'Products',   path: '/products'  },
];

const txItems: NavItem[] = [
  { icon: 'ti-receipt',       label: 'Sales',     path: '/sales'     },
  { icon: 'ti-shopping-cart', label: 'Purchases', path: '/purchases' },
  { icon: 'ti-cash',          label: 'Receipts',  path: '/receipts'  },
  { icon: 'ti-credit-card',   label: 'Payments',  path: '/payments'  },
];

const reportItems: NavItem[] = [
  { icon: 'ti-chart-bar', label: 'Reports',   path: '/reports'            },
  { icon: 'ti-ship',      label: 'Shipments', path: '/shipments', pro: true },
  { icon: 'ti-settings',  label: 'Settings',  path: '/settings'           },
];

function NavGroup({ label, items }: { label: string; items: NavItem[] }) {
  const { plan } = useAuth();

  return (
    <div className="mb-2">
      <p className="px-3 py-1.5 text-[10px] font-medium text-gray-400 uppercase tracking-wider">
        {label}
      </p>
      {items.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) =>
            `flex items-center gap-2.5 mx-1 px-3 py-2 rounded-lg text-sm transition-colors mb-0.5 ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 font-medium'
                : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
            }`
          }
        >
          <i className={`ti ${item.icon} text-base`} aria-hidden="true" />
          <span className="flex-1">{item.label}</span>
          {item.pro && plan !== 'pro' && (
            <span className="text-[10px] font-medium bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">
              Pro
            </span>
          )}
        </NavLink>
      ))}
    </div>
  );
}

export default function Sidebar() {
  const { name, role } = useAuth();
  const branding = useBranding();

  return (
    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
      {/* Brand */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          {branding.logoUrl ? (
            <img src={branding.logoUrl} alt="Logo" className="w-8 h-8 rounded-lg object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-semibold">
                {branding.companyName.substring(0, 2).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{branding.companyName}</p>
            <p className="text-[11px] text-gray-400">Business Command Center</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Powered by TradeFlow</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-1">
        <NavGroup label="Overview"     items={navItems}    />
        <NavGroup label="Transactions" items={txItems}     />
        <NavGroup label="Insights"     items={reportItems} />
      </nav>

      {/* User */}
      <div className="p-3 border-t border-gray-100">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <div className="w-7 h-7 rounded-full bg-emerald-50 flex items-center justify-center flex-shrink-0">
            <span className="text-emerald-700 text-[11px] font-medium">
              {name?.substring(0, 2).toUpperCase() || 'U'}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-700 truncate">{name}</p>
            <p className="text-[10px] text-gray-400 capitalize">{role}</p>
          </div>
          <NavLink to="/settings">
            <i className="ti ti-settings text-gray-400 hover:text-gray-600 text-base" aria-hidden="true" />
          </NavLink>
        </div>
      </div>
    </div>
  );
}
