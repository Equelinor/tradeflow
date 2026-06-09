import type { DashboardKpis } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { kpis: DashboardKpis; }

export default function DashboardHero({ kpis }: Props) {
  const branding = useBranding();

  return (
    <div
      className="rounded-xl p-4 md:p-5 flex flex-col md:flex-row md:items-center gap-4"
      style={{ background: 'linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%)' }}
    >
      {/* Left — greeting */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium mb-1" style={{ color: '#9FE1CB' }}>
          {branding.companyName} · {new Date().toLocaleDateString('en-GB', { weekday: 'long' })} snapshot
        </p>
        <p className="text-base md:text-lg font-semibold text-white">
          You collected {formatCurrency(kpis.collectedToday, branding.currency)} today
        </p>
        <p className="text-xs mt-1" style={{ color: '#9FE1CB' }}>
          {kpis.overdueCount} customers overdue
          {kpis.lowStockCount > 0 && ` · ${kpis.lowStockCount} products running low`}
        </p>
      </div>

      {/* Right — key numbers */}
      <div className="flex gap-4 md:gap-6 flex-shrink-0">
        <HeroStat label="Sales today" value={formatCurrency(kpis.salesToday, branding.currency)} />
        <div className="w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <HeroStat label="Owed to you" value={formatCurrency(kpis.totalOwedToUs, branding.currency)} />
        <div className="w-px hidden md:block" style={{ background: 'rgba(255,255,255,0.2)' }} />
        <HeroStat label="You owe" value={formatCurrency(kpis.totalWeOwe, branding.currency)} className="hidden md:block" />
      </div>
    </div>
  );
}

function HeroStat({ label, value, className = '' }: { label: string; value: string; className?: string }) {
  return (
    <div className={`text-center ${className}`}>
      <p className="text-base md:text-lg font-semibold text-white">{value}</p>
      <p className="text-xs mt-0.5" style={{ color: '#9FE1CB' }}>{label}</p>
    </div>
  );
}
