import type { WeeklySale } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { data: WeeklySale[]; }

export default function SalesSparkline({ data }: Props) {
  const { currency } = useBranding();

  const W = 300;
  const H = 72;
  const pad = { left: 4, right: 4, top: 12, bottom: 20 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const max    = Math.max(...data.map(d => d.amount));
  const total  = data.reduce((s, d) => s + d.amount, 0);
  const latest = data[data.length - 1];

  function x(i: number) { return pad.left + (i / (data.length - 1)) * chartW; }
  function y(v: number) { return pad.top + chartH - (v / max) * chartH; }

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.amount)}`).join(' ');
  const areaPath = `${linePath} L${x(data.length - 1)},${H - pad.bottom} L${x(0)},${H - pad.bottom} Z`;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-gray-900">Sales — last 7 days</h3>
        <span className="text-xs text-gray-400">{formatCurrency(total, currency)} total</span>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full overflow-visible"
        style={{ height: '72px' }}
        role="img"
        aria-label="7-day sales trend sparkline"
      >
        <defs>
          <linearGradient id="spark-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1D9E75" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#1D9E75" stopOpacity="0"    />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#spark-gradient)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="#1D9E75"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* End dot */}
        <circle cx={x(data.length - 1)} cy={y(latest.amount)} r="3.5" fill="#1D9E75" />

        {/* End label */}
        <text
          x={x(data.length - 1) - 2}
          y={y(latest.amount) - 6}
          fontSize="9"
          fill="#0F6E56"
          textAnchor="end"
          fontWeight="500"
        >
          {formatCurrency(latest.amount, currency)}
        </text>

        {/* Day labels */}
        {data.map((d, i) => (
          <text
            key={d.day}
            x={x(i)}
            y={H - 4}
            fontSize="9"
            fill={i === data.length - 1 ? '#1D9E75' : '#9ca3af'}
            textAnchor={i === 0 ? 'start' : i === data.length - 1 ? 'end' : 'middle'}
            fontWeight={i === data.length - 1 ? '500' : '400'}
          >
            {d.day}
          </text>
        ))}
      </svg>
    </div>
  );
}
