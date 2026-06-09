import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { BrandingProvider } from '@/context/BrandingContext';
import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import AppShell from '@/components/layout/AppShell';
import PageSkeleton from '@/components/ui/PageSkeleton';
import ProtectedRoute from '@/components/ui/ProtectedRoute';
import IdleWarningBanner from '@/components/ui/IdleWarningBanner';

// Auth pages — eager loaded
import LoginPage      from '@/pages/auth/LoginPage';
import OnboardingPage from '@/pages/auth/OnboardingPage';

// App pages — lazy loaded for performance
const DashboardPage   = lazy(() => import('@/pages/dashboard/DashboardPage'));
const CustomersPage   = lazy(() => import('@/pages/customers/CustomersPage'));
const CustomerDetail  = lazy(() => import('@/pages/customers/CustomerDetail'));
const CustomerForm    = lazy(() => import('@/pages/customers/CustomerForm'));
const SuppliersPage   = lazy(() => import('@/pages/suppliers/SuppliersPage'));
const SupplierDetail  = lazy(() => import('@/pages/suppliers/SupplierDetail'));
const SupplierForm    = lazy(() => import('@/pages/suppliers/SupplierForm'));
const ProductsPage    = lazy(() => import('@/pages/products/ProductsPage'));
const ProductDetail   = lazy(() => import('@/pages/products/ProductDetail'));
const ProductForm     = lazy(() => import('@/pages/products/ProductForm'));
const SalesPage       = lazy(() => import('@/pages/sales/SalesPage'));
const NewSalePage     = lazy(() => import('@/pages/sales/NewSalePage'));
const SaleDetail      = lazy(() => import('@/pages/sales/SaleDetail'));
const PurchasesPage   = lazy(() => import('@/pages/purchases/PurchasesPage'));
const NewPurchasePage = lazy(() => import('@/pages/purchases/NewPurchasePage'));
const ReceiptsPage    = lazy(() => import('@/pages/receipts/ReceiptsPage'));
const PaymentsPage    = lazy(() => import('@/pages/payments/PaymentsPage'));
const ReportsPage     = lazy(() => import('@/pages/reports/ReportsPage'));
const ShipmentsPage   = lazy(() => import('@/pages/shipments/ShipmentsPage'));
const SettingsPage    = lazy(() => import('@/pages/settings/SettingsPage'));

// ── Protected app shell ───────────────────────────────────────
function ProtectedApp() {
  const auth = useAuth();

  // P2: idle timeout — active only when user is logged in
  const { showWarning, secondsLeft, stayLoggedIn, logoutNow } = useIdleTimeout(
    !!auth.uid && !!auth.companyId
  );

  return (
    <>
      {/* Idle session warning modal */}
      {showWarning && (
        <IdleWarningBanner
          secondsLeft={secondsLeft}
          onStay={stayLoggedIn}
          onLogout={logoutNow}
        />
      )}

      <AppShell>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* All roles */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            } />

            {/* Customers — owner, admin, sales */}
            <Route path="/customers" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <CustomersPage />
              </ProtectedRoute>
            } />
            <Route path="/customers/new" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <CustomerForm />
              </ProtectedRoute>
            } />
            <Route path="/customers/:id/edit" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <CustomerForm />
              </ProtectedRoute>
            } />
            <Route path="/customers/:id" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <CustomerDetail />
              </ProtectedRoute>
            } />

            {/* Suppliers — owner, admin */}
            <Route path="/suppliers/new" element={
              <ProtectedRoute roles={['owner','admin']}>
                <SupplierForm />
              </ProtectedRoute>
            } />
            <Route path="/suppliers/:id/edit" element={
              <ProtectedRoute roles={['owner','admin']}>
                <SupplierForm />
              </ProtectedRoute>
            } />
            <Route path="/suppliers/:id" element={
              <ProtectedRoute roles={['owner','admin']}>
                <SupplierDetail />
              </ProtectedRoute>
            } />
            <Route path="/suppliers" element={
              <ProtectedRoute roles={['owner','admin']}>
                <SuppliersPage />
              </ProtectedRoute>
            } />

            {/* Products — all roles can view */}
            <Route path="/products/new" element={
              <ProtectedRoute roles={['owner','admin']}>
                <ProductForm />
              </ProtectedRoute>
            } />
            <Route path="/products/:id/edit" element={
              <ProtectedRoute roles={['owner','admin']}>
                <ProductForm />
              </ProtectedRoute>
            } />
            <Route path="/products/:id" element={
              <ProtectedRoute>
                <ProductDetail />
              </ProtectedRoute>
            } />
            <Route path="/products" element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            } />

            {/* Sales — owner, admin, sales */}
            <Route path="/sales" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <SalesPage />
              </ProtectedRoute>
            } />
            <Route path="/sales/new" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <NewSalePage />
              </ProtectedRoute>
            } />
            <Route path="/sales/:id" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <SaleDetail />
              </ProtectedRoute>
            } />

            {/* Purchases — owner, admin */}
            <Route path="/purchases" element={
              <ProtectedRoute roles={['owner','admin']}>
                <PurchasesPage />
              </ProtectedRoute>
            } />
            <Route path="/purchases/new" element={
              <ProtectedRoute roles={['owner','admin']}>
                <NewPurchasePage />
              </ProtectedRoute>
            } />

            {/* Receipts — owner, admin, sales */}
            <Route path="/receipts" element={
              <ProtectedRoute roles={['owner','admin','sales']}>
                <ReceiptsPage />
              </ProtectedRoute>
            } />

            {/* Payments — owner, admin */}
            <Route path="/payments" element={
              <ProtectedRoute roles={['owner','admin']}>
                <PaymentsPage />
              </ProtectedRoute>
            } />

            {/* Reports — owner, admin, accountant */}
            <Route path="/reports" element={
              <ProtectedRoute roles={['owner','admin','accountant']}>
                <ReportsPage />
              </ProtectedRoute>
            } />

            {/* Shipments — Pro only */}
            <Route path="/shipments" element={
              <ProtectedRoute roles={['owner','admin']} requirePro>
                <ShipmentsPage />
              </ProtectedRoute>
            } />

            {/* Settings — owner only */}
            <Route path="/settings" element={
              <ProtectedRoute roles={['owner']}>
                <SettingsPage />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Suspense>
      </AppShell>
    </>
  );
}

// ── Root app ──────────────────────────────────────────────────
export default function App() {
  const auth = useAuth();

  // Full-screen loading while auth state resolves
  // P1 fix: never render protected content during loading
  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center">
            <span className="text-white font-semibold text-sm">TF</span>
          </div>
          <div className="flex gap-1">
            {[0,1,2].map(i => (
              <div
                key={i}
                className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!auth.uid) {
    return (
      <Routes>
        <Route path="/login"      element={<LoginPage />} />
        <Route path="*"           element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // Logged in but no company
  if (!auth.companyId) {
    return (
      <Routes>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="*"           element={<Navigate to="/onboarding" replace />} />
      </Routes>
    );
  }

  // P1: hard block suspended/cancelled companies before rendering app
  if (auth.companyStatus === 'suspended' || auth.companyStatus === 'cancelled') {
    return <SuspendedScreen status={auth.companyStatus} />;
  }

  // Fully authenticated
  return (
    <BrandingProvider companyId={auth.companyId}>
      <Routes>
        <Route path="/*" element={<ProtectedApp />} />
      </Routes>
    </BrandingProvider>
  );
}

// ── Suspended company screen ──────────────────────────────────
// P1 fix: hard block for suspended/cancelled companies
// Shows instead of the app — no features accessible
function SuspendedScreen({ status }: { status: string }) {
  const isCancelled = status === 'cancelled';
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 ${
          isCancelled ? 'bg-gray-100' : 'bg-red-100'
        }`}>
          <i className={`ti ${isCancelled ? 'ti-lock' : 'ti-alert-circle'} text-3xl ${
            isCancelled ? 'text-gray-500' : 'text-red-600'
          }`} aria-hidden="true" />
        </div>
        <h1 className="text-lg font-semibold text-gray-900 mb-2">
          {isCancelled ? 'Account cancelled' : 'Account suspended'}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isCancelled
            ? 'This TradeFlow account has been cancelled. Your data is retained for 90 days.'
            : 'Your TradeFlow account has been suspended. Please contact support to reactivate.'
          }
        </p>
        <a
          href="https://wa.me/SUPPORT_NUMBER?text=My%20TradeFlow%20account%20is%20suspended"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-700 transition-colors"
        >
          <i className="ti ti-brand-whatsapp" aria-hidden="true" />
          Contact support
        </a>
        <button
          onClick={() => import('firebase/auth').then(({ signOut }) =>
            import('@/firebase').then(({ auth: a }) => signOut(a))
          )}
          className="block w-full text-center text-xs text-gray-400 hover:text-gray-600 mt-4"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
