import type { DashboardKpis } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { kpis: DashboardKpis; }

export default function KpiRow({ kpis }: Props) {
  const { currency } = useBranding();

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
      <KpiCard
        icon="ti-trending-up"
        label="Sales today"
        value={formatCurrency(kpis.salesToday, currency)}
        sub="+12% vs yesterday"
        subType="up"
      />
      <KpiCard
        icon="ti-coin"
        label="Collected today"
        value={formatCurrency(kpis.collectedToday, currency)}
        sub={`${kpis.receiptsToday} receipt${kpis.receiptsToday !== 1 ? 's' : ''} posted`}
        subType="up"
      />
      <KpiCard
        icon="ti-alert-circle"
        label="Overdue customers"
        value={String(kpis.overdueCount)}
        valueDanger
        sub={`${formatCurrency(kpis.overdueAmount, currency)} pending`}
        subType="down"
      />
      <KpiCard
        icon="ti-box"
        label="Stock value"
        value={formatCurrency(kpis.stockValue, currency)}
        sub={kpis.lowStockCount > 0 ? `${kpis.lowStockCount} items low` : 'All levels ok'}
        subType={kpis.lowStockCount > 0 ? 'down' : 'up'}
      />
    </div>
  );
}

interface KpiCardProps {
  icon:        string;
  label:       string;
  value:       string;
  valueDanger?: boolean;
  sub:         string;
  subType:     'up' | 'down' | 'neutral';
}

function KpiCard({ icon, label, value, valueDanger, sub, subType }: KpiCardProps) {
  const subColor = subType === 'up' ? 'text-emerald-600' : subType === 'down' ? 'text-red-700' : 'text-gray-400';

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <p className="text-xs text-gray-400 flex items-center gap-1 mb-1.5">
        <i className={`ti ${icon} text-sm`} aria-hidden="true" />
        {label}
      </p>
      <p className={`text-lg md:text-xl font-medium ${valueDanger ? 'text-red-700' : 'text-gray-900'}`}>
        {value}
      </p>
      <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>
    </div>
  );
}
