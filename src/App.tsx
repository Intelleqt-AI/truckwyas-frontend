import { lazy, Suspense } from 'react';
import 'react-toastify/dist/ReactToastify.css';
import { Toaster } from '@/components/ui/toaster';
import { Toaster as ToastProvider } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OSLayout } from './components/os/OSLayout';
// Eager load — Overview for fast first load
import Overview from './pages/Overview';

// Auth guard — redirects to /login if no token
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Role sets mirror OSLayout's NAV_ACCESS so nav visibility and route access agree.
const FINANCE_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER'];
const INSIGHTS_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER', 'VIEWER'];

// Persistent layout route. OSLayout is mounted ONCE here and stays mounted across
// child navigations — only <Outlet/> content swaps. This is what stops the whole
// chrome (header/nav/LiveEvents/NotificationBell) from remounting (and refetching)
// on every navigation, and removes the visible reload flicker.
function ProtectedLayout() {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (!token) return <Navigate to="/login" replace />;
  return (
    <OSLayout>
      <Outlet />
    </OSLayout>
  );
}

// Role-gated layout — reads role from AuthContext so it reacts to role changes.
function RoleRoute({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  const role = user?.role ?? null;
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <Outlet />;
}

// Public route — redirects to / if already logged in
function PublicOnly({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}
// Lazy load all other pages for code splitting
const NewQuote = lazy(() => import('./pages/NewQuote'));
const AIQuoteChat = lazy(() => import('./pages/AIQuoteChat'));
const QuoteDetail = lazy(() => import('./pages/QuoteDetail'));
const Bookings = lazy(() => import('./pages/Bookings'));
const LoadsList = lazy(() => import('./pages/LoadsList'));
const Vehicles = lazy(() => import('./pages/Vehicles'));
const Drivers = lazy(() => import('./pages/Drivers'));
const DriverProfile = lazy(() => import('./pages/DriverProfile'));
const FleetDashboard = lazy(() => import('./pages/FleetDashboard'));
const Customers = lazy(() => import('./pages/Customers'));
const CustomerDetail = lazy(() => import('./pages/CustomerDetail'));
const Invoices = lazy(() => import('./pages/Invoices'));
const InvoiceDetail = lazy(() => import('./pages/InvoiceDetail'));
const CreateInvoice = lazy(() => import('./pages/CreateInvoice'));
const Expenses = lazy(() => import('./pages/Expenses'));
const FinanceReports = lazy(() => import('./pages/FinanceReports'));
const Capital = lazy(() => import('./pages/Capital'));
const AdvanceRequest = lazy(() => import('./pages/AdvanceRequest'));
const AdvanceDetail = lazy(() => import('./pages/AdvanceDetail'));
const Insights = lazy(() => import('./pages/Insights'));
const Copilot = lazy(() => import('./pages/Copilot'));
// PartnerDashboard removed — moved to standalone partner portal
const Settings = lazy(() => import('./pages/Settings'));
const XeroIntegration = lazy(() => import('./pages/settings/XeroIntegration'));
const FleetImport = lazy(() => import('./pages/settings/FleetImport'));
const Login = lazy(() => import('./pages/Login'));
const LoginOtp = lazy(() => import('./pages/LoginOtp').then(m => ({ default: m.LoginOtp })));
const Signup = lazy(() => import('./pages/Signup'));
const NotFound = lazy(() => import('./pages/NotFound'));
const PasswordReset = lazy(() => import('./pages/PasswordReset'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword').then(m => ({ default: m.ForgotPassword })));
const InviteAccept = lazy(() => import('./pages/InviteAccept').then(m => ({ default: m.InviteAccept })));
const EmailVerification = lazy(() =>
  import('./pages/EmailVerification').then(m => ({
    default: m.EmailVerification,
  })),
);
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));
const VehicleFinancialProfile = lazy(() => import('./pages/VehicleFinancialProfile'));
const RiskScoreView = lazy(() => import('./pages/RiskScoreView'));
const FleetHeatmap = lazy(() => import('./pages/FleetHeatmap'));
const ClientQuoteView = lazy(() => import('./pages/ClientQuoteView'));
const PublicInvoice = lazy(() => import('./pages/PublicInvoice'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't retry auth errors — retry everything else up to 4×.
      // Delays: 3s, 6s, 9s, 12s — enough for a Render free-tier cold start (~20-30s).
      retry: (failureCount, error: unknown) => {
        const status = (error as { status?: number })?.status;
        if (status === 401 || status === 403) return false;
        return failureCount < 4;
      },
      retryDelay: (attempt) => Math.min(3000 * (attempt + 1), 12000),
      throwOnError: false,
      staleTime: 5 * 60 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});

// Loading fallback for code splitting
const LoadingFallback = () => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      background: 'var(--bg-deep)',
      color: 'var(--text-tertiary)',
      fontSize: 14,
    }}
  >
    Loading...
  </div>
);

// Legacy /loads/:id deep-links redirect to the bookings detail page.
function LoadsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/bookings/${id}`} replace />;
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ErrorBoundary>
          <TooltipProvider>
            <Toaster />
            <ToastProvider />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
              {/* Public routes — no auth required */}
              <Route
                path="/login"
                element={
                  <PublicOnly>
                    <Login />
                  </PublicOnly>
                }
              />
              <Route
                path="/login/verify-otp"
                element={
                  <PublicOnly>
                    <LoginOtp />
                  </PublicOnly>
                }
              />
              <Route
                path="/signup"
                element={
                  <PublicOnly>
                    <Signup />
                  </PublicOnly>
                }
              />
              <Route path="/password-reset" element={<PasswordReset />} />
              <Route
                path="/forgot-password"
                element={
                  <PublicOnly>
                    <ForgotPassword />
                  </PublicOnly>
                }
              />
              <Route path="/reset-password" element={<Navigate to="/password-reset" replace />} />
              <Route
                path="/invite/:token"
                element={
                  <PublicOnly>
                    <InviteAccept />
                  </PublicOnly>
                }
              />
              <Route
                path="/verify-email"
                element={
                  <PublicOnly>
                    <EmailVerification />
                  </PublicOnly>
                }
              />
              <Route path="/quotes/view/:quoteId/:token" element={<ClientQuoteView />} />
              <Route path="/invoice/view/:id/:token" element={<PublicInvoice />} />
              <Route path="/invoice/view/:id" element={<PublicInvoice />} />
              <Route
                path="/onboarding"
                element={
                  <RequireAuth>
                    <Onboarding />
                  </RequireAuth>
                }
              />

              {/* Pure redirects — no layout needed, avoids a chrome flash before redirecting */}
              <Route path="/loads/:id" element={<LoadsRedirect />} />
              <Route path="/bookings/list" element={<Navigate to="/bookings/orders" replace />} />
              <Route path="/quotes" element={<Navigate to="/bookings/quotes" replace />} />
              <Route path="/quotes/new" element={<Navigate to="/bookings/quotes/new" replace />} />
              <Route path="/quotes/ai-chat" element={<Navigate to="/bookings/quotes/ai-chat" replace />} />
              <Route path="/bookings" element={<Navigate to="/bookings/orders" replace />} />
              <Route path="/cash" element={<Navigate to="/insights" replace />} />
              <Route path="/control" element={<Navigate to="/insights" replace />} />
              <Route path="/overview" element={<Navigate to="/" replace />} />
              <Route path="/expenses" element={<Navigate to="/finance/expenses" replace />} />
              <Route path="/finance-reports" element={<Navigate to="/finance/reports" replace />} />

              {/* Protected routes — OSLayout mounted ONCE and persists across navigations */}
              <Route element={<ProtectedLayout />}>
                <Route path="/" element={<Overview />} />

                {/* Bookings */}
                <Route path="/bookings/orders" element={<LoadsList />} />
                <Route path="/bookings/history" element={<LoadsList />} />
                <Route path="/bookings/quotes" element={<LoadsList />} />
                <Route path="/bookings/quotes/new" element={<NewQuote />} />
                <Route path="/bookings/quotes/ai-chat" element={<AIQuoteChat />} />
                <Route path="/bookings/quotes/:id/edit" element={<NewQuote />} />
                <Route path="/bookings/quotes/:id" element={<QuoteDetail />} />
                <Route path="/bookings/:id" element={<Bookings />} />

                {/* Fleet */}
                <Route path="/fleet" element={<Vehicles />} />
                <Route path="/fleet/overview" element={<FleetDashboard />} />
                <Route path="/fleet/vehicles" element={<Vehicles />} />
                <Route path="/fleet/vehicles/:id" element={<VehicleFinancialProfile />} />
                <Route path="/fleet/drivers" element={<Drivers />} />
                <Route path="/fleet/drivers/:driverId" element={<DriverProfile />} />
                <Route path="/fleet/drivers/:driverId/financial" element={<DriverProfile />} />
                <Route path="/fleet/heatmap" element={<FleetHeatmap />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/drivers" element={<Drivers />} />

                {/* Finance */}
                <Route path="/invoices" element={<Invoices />} />
                <Route path="/finance/invoices" element={<Invoices />} />
                <Route path="/finance/invoices/new" element={<CreateInvoice />} />
                <Route path="/finance/invoices/:id" element={<InvoiceDetail />} />
                <Route path="/finance/expenses" element={<Expenses />} />
                <Route path="/finance/reports" element={<FinanceReports />} />

                {/* Customers */}
                <Route path="/customers" element={<Customers />} />
                <Route path="/customers/new" element={<Customers />} />
                <Route path="/customers/:id" element={<CustomerDetail />} />

                {/* Finance-role gated */}
                <Route element={<RoleRoute roles={FINANCE_ROLES} />}>
                  <Route path="/capital" element={<Capital />} />
                  <Route path="/capital/request" element={<AdvanceRequest />} />
                  <Route path="/capital/advances/:id" element={<AdvanceDetail />} />
                  <Route path="/capital/risk-scores" element={<RiskScoreView />} />
                  <Route path="/settings/integrations/xero" element={<XeroIntegration />} />
                  <Route path="/settings/integrations/fleet" element={<FleetImport />} />
                  <Route path="/settings/:section?" element={<Settings />} />
                  <Route path="/fleet/vehicles/:id/financial" element={<VehicleFinancialProfile />} />
                </Route>

                {/* Insights-role gated */}
                <Route element={<RoleRoute roles={INSIGHTS_ROLES} />}>
                  <Route path="/insights" element={<Insights />} />
                  <Route path="/copilot" element={<Copilot />} />
                </Route>

                {/* Catch-all */}
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </Suspense>
        </TooltipProvider>
        </ErrorBoundary>
      </QueryClientProvider>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
