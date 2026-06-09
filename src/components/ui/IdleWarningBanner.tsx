interface Props {
  secondsLeft:   number;
  onStay:        () => void;
  onLogout:      () => void;
}

export default function IdleWarningBanner({ secondsLeft, onStay, onLogout }: Props) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = String(secondsLeft % 60).padStart(2, '0');
  const timeStr = mins > 0 ? `${mins}:${secs}` : `${secondsLeft}s`;

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Session expiring soon"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.5)' }}
    >
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-clock text-2xl text-amber-600" aria-hidden="true" />
        </div>

        <h2 className="text-base font-semibold text-gray-900 mb-2">
          Session expiring soon
        </h2>
        <p className="text-sm text-gray-500 mb-1">
          You've been inactive. For security, you'll be signed out in:
        </p>
        <p className="text-3xl font-bold text-amber-600 mb-5 font-mono">
          {timeStr}
        </p>

        <div className="flex gap-3">
          <button
            onClick={onLogout}
            className="flex-1 h-11 border border-gray-200 text-gray-600 text-sm font-medium rounded-xl hover:bg-gray-50 transition-colors"
          >
            Sign out now
          </button>
          <button
            onClick={onStay}
            className="flex-1 h-11 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
          >
            Stay signed in
          </button>
        </div>
      </div>
    </div>
  );
}
