import { useNavigate } from 'react-router-dom';
import type { LowStockItem } from '@/pages/dashboard/dashboardData';

interface Props { items: LowStockItem[]; }

export default function LowStock({ items }: Props) {
  const navigate = useNavigate();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Low stock</h3>
        <button
          onClick={() => navigate('/products')}
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          Manage →
        </button>
      </div>

      <div className="space-y-0">
        {items.map((item, i) => {
          const pct     = Math.round((item.currentStock / item.minStock) * 100);
          const isLow   = item.currentStock < item.minStock;
          const barColor = pct < 40 ? '#E24B4A' : pct < 70 ? '#BA7517' : '#1D9E75';
          const textColor = isLow ? 'text-red-700' : 'text-emerald-700';

          return (
            <div
              key={item.id}
              className={`flex items-center gap-2.5 py-2 ${i < items.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{item.name}</p>
                <p className={`text-xs ${textColor}`}>
                  {item.currentStock} {item.unit} left
                  {isLow && ` · min ${item.minStock}`}
                </p>
              </div>
              {/* Stock bar */}
              <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden flex-shrink-0">
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.min(pct, 100)}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
