import { useNavigate } from 'react-router-dom';
import type { RecentTransaction } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { transactions: RecentTransaction[]; }

const iconMap = {
  sale:     { icon: 'ti-receipt',       bg: 'bg-emerald-50', color: 'text-emerald-700' },
  purchase: { icon: 'ti-shopping-cart', bg: 'bg-blue-50',    color: 'text-blue-700'    },
  receipt:  { icon: 'ti-cash',          bg: 'bg-amber-50',   color: 'text-amber-700'   },
  payment:  { icon: 'ti-credit-card',   bg: 'bg-purple-50',  color: 'text-purple-700'  },
};

export default function RecentTransactions({ transactions }: Props) {
  const navigate   = useNavigate();
  const { currency } = useBranding();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Recent activity</h3>
        <button
          onClick={() => navigate('/sales')}
          className="text-xs text-emerald-600 hover:text-emerald-700"
        >
          All →
        </button>
      </div>

      <div className="space-y-0">
        {transactions.map((txn, i) => {
          const style = iconMap[txn.type as keyof typeof iconMap];
          const isCredit = txn.type === 'sale' || txn.type === 'receipt';

          return (
            <div
              key={txn.id}
              className={`flex items-center gap-2.5 py-2 ${i < transactions.length - 1 ? 'border-b border-gray-100' : ''}`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${style.bg}`}>
                <i className={`ti ${style.icon} text-sm ${style.color}`} aria-hidden="true" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{txn.party}</p>
                <p className="text-xs text-gray-400 capitalize">{txn.type} · {txn.time}</p>
              </div>
              <p className={`text-xs font-medium whitespace-nowrap ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                {isCredit ? '+' : '−'}{formatCurrency(txn.amount, currency)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
