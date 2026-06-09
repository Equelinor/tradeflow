import { Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import type { UserRole } from '@/types';
import PageSkeleton from '@/components/ui/PageSkeleton';

interface ProtectedRouteProps {
  children:     React.ReactNode;
  roles?:       UserRole[];       // if set, only these roles can access
  requirePro?:  boolean;          // if true, Pro plan required
}

// ─────────────────────────────────────────────────────────────
// P1 fix: proper loading state guard prevents any flicker of
// protected content before auth is resolved. Auth state is never
// "assumed" — it's always verified from Firestore on load.
// ─────────────────────────────────────────────────────────────
export default function ProtectedRoute({
  children,
  roles,
  requirePro = false,
}: ProtectedRouteProps) {
  const auth = useAuth();

  // Still resolving auth — show skeleton, never redirect prematurely
  if (auth.loading) {
    return <PageSkeleton />;
  }

  // Not logged in → login page
  if (!auth.uid) {
    return <Navigate to="/login" replace />;
  }

  // Logged in but no company → onboarding
  if (!auth.companyId) {
    return <Navigate to="/onboarding" replace />;
  }

  // Plan check — Pro feature accessed on Basic plan
  if (requirePro && auth.plan !== 'pro') {
    return <UpgradePrompt />;
  }

  // Role check — insufficient permissions
  if (roles && !roles.includes(auth.role)) {
    return <AccessDenied />;
  }

  return <>{children}</>;
}

// ── Upgrade prompt for Pro-gated routes ──────────────────────
function UpgradePrompt() {
  return (
    <div className="p-4 md:p-6 flex items-center justify-center min-h-96">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-amber-100 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-crown text-2xl text-amber-600" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Pro feature</h2>
        <p className="text-sm text-gray-500 mb-5">
          This feature is available on the Pro plan. Upgrade to unlock shipment tracking,
          WhatsApp reminders, profit reports, and more.
        </p>
        <a
          href="https://wa.me/SUPPORT_NUMBER?text=I%20would%20like%20to%20upgrade%20to%20TradeFlow%20Pro"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <i className="ti ti-brand-whatsapp" aria-hidden="true" />
          Upgrade to Pro
        </a>
      </div>
    </div>
  );
}

// ── Access denied for wrong role ─────────────────────────────
function AccessDenied() {
  return (
    <div className="p-4 md:p-6 flex items-center justify-center min-h-96">
      <div className="text-center max-w-sm">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-4">
          <i className="ti ti-shield-off text-2xl text-red-500" aria-hidden="true" />
        </div>
        <h2 className="text-base font-semibold text-gray-900 mb-2">Access restricted</h2>
        <p className="text-sm text-gray-500">
          You don't have permission to access this page.
          Contact your account owner if you think this is a mistake.
        </p>
      </div>
    </div>
  );
}
