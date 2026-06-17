import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, useParams } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OSLayout } from "./components/os/OSLayout";
// Eager load — Overview for fast first load
import Overview from "./pages/Overview";

// Auth guard — redirects to /login if no token
function RequireAuth({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Role guard — redirects to / when the logged-in user's role isn't permitted.
// Server-side permissions remain the source of truth; this stops a VIEWER/DRIVER
// from deep-linking into financial pages they shouldn't see.
function RequireRole({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  let role: string | null = null;
  if (typeof window !== 'undefined') {
    try {
      role = JSON.parse(localStorage.getItem('user') || '{}')?.role ?? null;
    } catch {
      role = null;
    }
  }
  if (!role || !roles.includes(role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

// Role sets mirror OSLayout's NAV_ACCESS so nav visibility and route access agree.
const FINANCE_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER'];
const INSIGHTS_ROLES = ['ADMIN', 'MANAGER', 'OPERATOR', 'DISPATCHER', 'VIEWER'];

// Public route — redirects to / if already logged in
function PublicOnly({ children }: { children: React.ReactNode }) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('access') : null;
  if (token) return <Navigate to="/" replace />;
  return <>{children}</>;
}
// Lazy load all other pages for code splitting
const QuotesList = lazy(() => import("./pages/QuotesList").then(m => ({ default: m.QuotesList })));
const NewQuote = lazy(() => import("./pages/NewQuote"));
const AIQuoteChat = lazy(() => import("./pages/AIQuoteChat"));
const QuoteDetail = lazy(() => import("./pages/QuoteDetail"));
const BookingsList = lazy(() => import("./pages/BookingsList").then(m => ({ default: m.BookingsList })));
const Bookings = lazy(() => import("./pages/Bookings"));
const LoadsList = lazy(() => import("./pages/LoadsList"));
const Vehicles = lazy(() => import("./pages/Vehicles"));
const Drivers = lazy(() => import("./pages/Drivers"));
const DriverProfile = lazy(() => import("./pages/DriverProfile"));
const FleetDashboard = lazy(() => import("./pages/FleetDashboard"));
const Invoices = lazy(() => import("./pages/Invoices"));
const InvoiceDetail = lazy(() => import("./pages/InvoiceDetail"));
const CreateInvoice = lazy(() => import("./pages/CreateInvoice"));
const Expenses = lazy(() => import("./pages/Expenses"));
const FinanceReports = lazy(() => import("./pages/FinanceReports"));
const Capital = lazy(() => import("./pages/Capital"));
const AdvanceRequest = lazy(() => import("./pages/AdvanceRequest"));
const AdvanceDetail = lazy(() => import("./pages/AdvanceDetail"));
const Insights = lazy(() => import("./pages/Insights"));
const Copilot = lazy(() => import("./pages/Copilot"));
const CashCommand = lazy(() => import("./pages/CashCommand"));
// PartnerDashboard removed — moved to standalone partner portal
const Settings = lazy(() => import("./pages/Settings"));
const XeroIntegration = lazy(() => import("./pages/settings/XeroIntegration"));
const FleetImport = lazy(() => import("./pages/settings/FleetImport"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword").then(m => ({ default: m.ForgotPassword })));
const InviteAccept = lazy(() => import("./pages/InviteAccept").then(m => ({ default: m.InviteAccept })));
const EmailVerification = lazy(() => import("./pages/EmailVerification").then(m => ({ default: m.EmailVerification })));
const Onboarding = lazy(() => import("./pages/Onboarding").then(m => ({ default: m.Onboarding })));
const VehicleFinancialProfile = lazy(() => import("./pages/VehicleFinancialProfile"));
const RiskScoreView = lazy(() => import("./pages/RiskScoreView"));
const FleetHeatmap = lazy(() => import("./pages/FleetHeatmap"));
const ClientQuoteView = lazy(() => import("./pages/ClientQuoteView"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      throwOnError: false,
      staleTime: 15000,
      refetchOnWindowFocus: true,      // refresh when the operator returns to the tab
      refetchOnReconnect: true,
      refetchInterval: 30000,          // live polling for React-Query screens
      refetchIntervalInBackground: false, // …but not while the tab is hidden
    },
  },
});

// Loading fallback for code splitting
const LoadingFallback = () => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    background: 'var(--bg-deep)',
    color: 'var(--text-tertiary)',
    fontSize: 14
  }}>
    Loading...
  </div>
);

// Legacy /loads/:id deep-links redirect to the bookings detail page.
function LoadsRedirect() {
  const { id } = useParams();
  return <Navigate to={`/bookings/${id}`} replace />;
}

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            {/* Public routes — no auth required */}
            <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
            <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />
            <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/forgot-password" element={<PublicOnly><ForgotPassword /></PublicOnly>} />
            <Route path="/reset-password" element={<Navigate to="/password-reset" replace />} />
            <Route path="/invite/:token" element={<PublicOnly><InviteAccept /></PublicOnly>} />
            <Route path="/verify-email" element={<PublicOnly><EmailVerification /></PublicOnly>} />
            <Route path="/quotes/view/:quoteId/:token" element={<ClientQuoteView />} />
            <Route path="/onboarding" element={<RequireAuth><Onboarding /></RequireAuth>} />

            {/* Protected routes — require auth token */}
            <Route path="/" element={<RequireAuth><OSLayout><Overview /></OSLayout></RequireAuth>} />
            <Route path="/quotes" element={<RequireAuth><OSLayout><QuotesList /></OSLayout></RequireAuth>} />
            <Route path="/quotes/new" element={<RequireAuth><OSLayout><NewQuote /></OSLayout></RequireAuth>} />
            <Route path="/quotes/ai-chat" element={<RequireAuth><OSLayout><AIQuoteChat /></OSLayout></RequireAuth>} />
            <Route path="/quotes/:id/edit" element={<RequireAuth><OSLayout><NewQuote /></OSLayout></RequireAuth>} />
            <Route path="/quotes/:id" element={<RequireAuth><OSLayout><QuoteDetail /></OSLayout></RequireAuth>} />
            <Route path="/bookings" element={<RequireAuth><OSLayout><LoadsList /></OSLayout></RequireAuth>} />
            <Route path="/bookings/:id" element={<RequireAuth><OSLayout><Bookings /></OSLayout></RequireAuth>} />
            {/* Safety: legacy /loads/:id deep-links (e.g. old notifications) → bookings detail */}
            <Route path="/loads/:id" element={<LoadsRedirect />} />
            <Route path="/bookings/list" element={<RequireAuth><OSLayout><BookingsList /></OSLayout></RequireAuth>} />
            <Route path="/bookings/pipeline" element={<RequireAuth><OSLayout><QuotesList /></OSLayout></RequireAuth>} />
            <Route path="/bookings/pipeline/:id" element={<RequireAuth><OSLayout><NewQuote /></OSLayout></RequireAuth>} />
            <Route path="/fleet" element={<RequireAuth><OSLayout><Vehicles /></OSLayout></RequireAuth>} />
            <Route path="/fleet/overview" element={<RequireAuth><OSLayout><FleetDashboard /></OSLayout></RequireAuth>} />
            <Route path="/fleet/vehicles" element={<RequireAuth><OSLayout><Vehicles /></OSLayout></RequireAuth>} />
            <Route path="/fleet/vehicles/:id" element={<RequireAuth><OSLayout><VehicleFinancialProfile /></OSLayout></RequireAuth>} />
            <Route path="/fleet/drivers" element={<RequireAuth><OSLayout><Drivers /></OSLayout></RequireAuth>} />
            <Route path="/fleet/drivers/:driverId" element={<RequireAuth><OSLayout><DriverProfile /></OSLayout></RequireAuth>} />
            <Route path="/fleet/drivers/:driverId/financial" element={<RequireAuth><OSLayout><DriverProfile /></OSLayout></RequireAuth>} />
            <Route path="/vehicles" element={<RequireAuth><OSLayout><Vehicles /></OSLayout></RequireAuth>} />
            <Route path="/drivers" element={<RequireAuth><OSLayout><Drivers /></OSLayout></RequireAuth>} />
            <Route path="/invoices" element={<RequireAuth><OSLayout><Invoices /></OSLayout></RequireAuth>} />
            <Route path="/finance/invoices" element={<RequireAuth><OSLayout><Invoices /></OSLayout></RequireAuth>} />
            <Route path="/finance/invoices/new" element={<RequireAuth><OSLayout><CreateInvoice /></OSLayout></RequireAuth>} />
            <Route path="/finance/invoices/:id" element={<RequireAuth><OSLayout><InvoiceDetail /></OSLayout></RequireAuth>} />
            <Route path="/finance/expenses" element={<RequireAuth><OSLayout><Expenses /></OSLayout></RequireAuth>} />
            <Route path="/finance/reports" element={<RequireAuth><OSLayout><FinanceReports /></OSLayout></RequireAuth>} />
            <Route path="/capital" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><Capital /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/capital/request" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><AdvanceRequest /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/capital/advances/:id" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><AdvanceDetail /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/insights" element={<RequireAuth><RequireRole roles={INSIGHTS_ROLES}><OSLayout><Insights /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/copilot" element={<RequireAuth><RequireRole roles={INSIGHTS_ROLES}><OSLayout><Copilot /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/cash" element={<RequireAuth><OSLayout><CashCommand /></OSLayout></RequireAuth>} />
            <Route path="/control" element={<Navigate to="/cash" replace />} />
            {/* /partner-dashboard removed — standalone partner portal */}
            <Route path="/settings/:section?" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><Settings /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/settings/integrations/xero" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><XeroIntegration /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/settings/integrations/fleet" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><FleetImport /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/fleet/vehicles/:id/financial" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><VehicleFinancialProfile /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/capital/risk-scores" element={<RequireAuth><RequireRole roles={FINANCE_ROLES}><OSLayout><RiskScoreView /></OSLayout></RequireRole></RequireAuth>} />
            <Route path="/fleet/heatmap" element={<RequireAuth><OSLayout><FleetHeatmap /></OSLayout></RequireAuth>} />

            {/* Route aliases */}
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/expenses" element={<Navigate to="/finance/expenses" replace />} />
            <Route path="/finance-reports" element={<Navigate to="/finance/reports" replace />} />
            {/* /partner redirect removed */}
            <Route path="*" element={<OSLayout><NotFound /></OSLayout>} />
          </Routes>
          </Suspense>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
