import type { BusinessSnapshot } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { snapshot: BusinessSnapshot; }

export default function BusinessSnapshotCard({ snapshot }: Props) {
  const { currency } = useBranding();

  const rows = [
    {
      icon:  'ti-users',
      label: 'Active customers',
      value: String(snapshot.activeCustomers),
      color: 'text-emerald-700',
      iconColor: 'text-emerald-600',
    },
    {
      icon:  'ti-building-store',
      label: 'Active suppliers',
      value: String(snapshot.activeSuppliers),
      color: 'text-gray-900',
      iconColor: 'text-blue-600',
    },
    {
      icon:  'ti-packages',
      label: 'Total products',
      value: String(snapshot.totalProducts),
      color: 'text-gray-900',
      iconColor: 'text-amber-600',
    },
    {
      icon:  'ti-clock',
      label: 'Pending collections',
      value: formatCurrency(snapshot.pendingCollections, currency),
      color: 'text-red-700',
      iconColor: 'text-red-500',
    },
    {
      icon:  'ti-alert-triangle',
      label: 'Low stock items',
      value: `${snapshot.lowStockItems} items`,
      color: snapshot.lowStockItems > 0 ? 'text-amber-700' : 'text-emerald-700',
      iconColor: 'text-amber-500',
    },
    {
      icon:  'ti-calendar-due',
      label: 'Supplier payments due',
      value: `${snapshot.supplierPaymentsDue} this week`,
      color: snapshot.supplierPaymentsDue > 0 ? 'text-red-700' : 'text-gray-900',
      iconColor: 'text-red-500',
    },
  ];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <h3 className="text-sm font-medium text-gray-900 mb-3">Business snapshot</h3>
      <div className="space-y-0">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between py-2 ${i < rows.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            <div className="flex items-center gap-2">
              <i className={`ti ${row.icon} text-sm ${row.iconColor}`} aria-hidden="true" />
              <span className="text-xs text-gray-600">{row.label}</span>
            </div>
            <span className={`text-xs font-medium ${row.color}`}>{row.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
