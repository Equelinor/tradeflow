import { NavLink } from 'react-router-dom';

const tabs = [
  { icon: 'ti-layout-dashboard', label: 'Home',      path: '/dashboard' },
  { icon: 'ti-users',            label: 'Customers', path: '/customers' },
  { icon: 'ti-receipt',          label: 'Sales',     path: '/sales/new' },
  { icon: 'ti-packages',         label: 'Stock',     path: '/products'  },
  { icon: 'ti-dots',             label: 'More',      path: '/reports'   },
];

export default function BottomNav() {
  return (
    <div className="bg-white border-t border-gray-200 bottom-nav">
      <div className="flex items-center justify-around px-2 pt-2">
        {tabs.map((tab) => (
          <NavLink
            key={tab.path}
            to={tab.path}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-[52px] ${
                isActive ? 'text-brand' : 'text-gray-400'
              }`
            }
          >
            <i className={`ti ${tab.icon} text-xl`} aria-hidden="true" />
            <span className="text-[10px] font-medium">{tab.label}</span>
          </NavLink>
        ))}
      </div>
    </div>
  );
}
