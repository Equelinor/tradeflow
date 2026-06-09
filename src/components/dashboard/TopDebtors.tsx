import type { TopDebtor } from '@/pages/dashboard/dashboardData';
import { formatCurrency } from '@/lib/formatters';
import { buildWhatsAppUrl } from '@/lib/formatters';
import { useBranding } from '@/context/BrandingContext';

interface Props { debtors: TopDebtor[]; }

export default function TopDebtors({ debtors }: Props) {
  const branding = useBranding();

  function sendReminder(debtor: TopDebtor) {
    const message = `Dear ${debtor.name},\n\nThis is a friendly reminder from ${branding.companyName} that your outstanding balance is ${formatCurrency(debtor.amount, branding.currency)}.\n\nKindly arrange payment at your earliest convenience.\n\nThank you,\n${branding.companyName}\n${branding.phone}`;
    window.open(buildWhatsAppUrl(debtor.phone, message), '_blank');
  }

  function sendAll() {
    // Opens first debtor — in production, queue all reminders
    if (debtors.length > 0) sendReminder(debtors[0]);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 md:p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-900">Top debtors</h3>
        <button
          onClick={sendAll}
          className="text-xs text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
        >
          <i className="ti ti-brand-whatsapp text-sm" aria-hidden="true" />
          Remind all
        </button>
      </div>

      <div className="space-y-0">
        {debtors.map((debtor, i) => (
          <div
            key={debtor.id}
            className={`flex items-center gap-2.5 py-2 ${i < debtors.length - 1 ? 'border-b border-gray-100' : ''}`}
          >
            {/* Avatar */}
            <div className="w-7 h-7 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-red-700">{debtor.initials}</span>
            </div>

            {/* Name + days */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">{debtor.name}</p>
              <p className="text-xs text-gray-400">{debtor.daysOverdue} days overdue</p>
            </div>

            {/* Amount + WhatsApp */}
            <div className="flex flex-col items-end gap-1">
              <p className="text-xs font-semibold text-red-700 whitespace-nowrap">
                {formatCurrency(debtor.amount, branding.currency)}
              </p>
              <button
                onClick={() => sendReminder(debtor)}
                className="flex items-center gap-1 text-xs px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors whitespace-nowrap"
                aria-label={`Send WhatsApp reminder to ${debtor.name}`}
              >
                <i className="ti ti-brand-whatsapp text-xs" aria-hidden="true" />
                Remind
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
