import { useNavigate } from 'react-router-dom';

// Components
import DashboardHero        from '@/components/dashboard/DashboardHero';
import KpiRow               from '@/components/dashboard/KpiRow';
import RecentTransactions   from '@/components/dashboard/RecentTransactions';
import TopDebtors           from '@/components/dashboard/TopDebtors';
import LowStock             from '@/components/dashboard/LowStock';
import SalesSparkline       from '@/components/dashboard/SalesSparkline';
import BusinessSnapshotCard from '@/components/dashboard/BusinessSnapshot';

// ─────────────────────────────────────────────────────────────
// Sample data — swap these imports for real Firestore hooks
// when Firebase is connected. Component structure stays the same.
// ─────────────────────────────────────────────────────────────
import {
  sampleKpis,
  sampleTransactions,
  sampleDebtors,
  sampleLowStock,
  sampleWeeklySales,
  sampleSnapshot,
} from './dashboardData';

export default function DashboardPage() {
  const navigate = useNavigate();
  // const { plan } = useAuth(); // used when pro features added

  // When Firebase is ready, replace with real hooks:
  // const kpis         = useDashboardKpis(companyId);
  // const transactions = useRecentTransactions(companyId, 5);
  // const debtors      = useTopDebtors(companyId, 5);
  // const lowStock     = useLowStockItems(companyId, 5);
  // const weeklySales  = useWeeklySales(companyId);
  // const snapshot     = useBusinessSnapshot(companyId);
  const kpis         = sampleKpis;
  const transactions = sampleTransactions;
  const debtors      = sampleDebtors;
  const lowStock     = sampleLowStock;
  const weeklySales  = sampleWeeklySales;
  const snapshot     = sampleSnapshot;

  return (
    <div className="p-3 md:p-5 space-y-3 md:space-y-4 max-w-screen-xl mx-auto">

      {/* Hero banner */}
      <DashboardHero kpis={kpis} />

      {/* Quick actions — mobile only */}
      <div className="flex gap-2 md:hidden">
        <button
          onClick={() => navigate('/sales/new')}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-emerald-600 text-white text-sm font-medium rounded-xl"
        >
          <i className="ti ti-plus" aria-hidden="true" /> New Sale
        </button>
        <button
          onClick={() => navigate('/purchases/new')}
          className="flex-1 flex items-center justify-center gap-1.5 h-10 bg-white border border-gray-200 text-gray-700 text-sm font-medium rounded-xl"
        >
          <i className="ti ti-shopping-cart" aria-hidden="true" /> Purchase
        </button>
      </div>

      {/* KPI row */}
      <KpiRow kpis={kpis} />

      {/* 3-column grid — stacks on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <RecentTransactions transactions={transactions} />
        <TopDebtors         debtors={debtors} />
        <LowStock           items={lowStock} />
      </div>

      {/* Bottom row — sparkline + snapshot */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4">
        <div className="md:col-span-3">
          <SalesSparkline data={weeklySales} />
        </div>
        <div className="md:col-span-2">
          <BusinessSnapshotCard snapshot={snapshot} />
        </div>
      </div>

    </div>
  );
}
