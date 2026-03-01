import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OSLayout } from "./components/os/OSLayout";
// Eager load — Overview for fast first load
import Overview from "./pages/Overview";
// Lazy load all other pages for code splitting
const QuotesList = lazy(() => import("./pages/QuotesList").then(m => ({ default: m.QuotesList })));
const NewQuote = lazy(() => import("./pages/NewQuote"));
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
const PartnerDashboard = lazy(() => import("./pages/PartnerDashboard"));
const Settings = lazy(() => import("./pages/Settings"));
const XeroIntegration = lazy(() => import("./pages/settings/XeroIntegration"));
const FleetImport = lazy(() => import("./pages/settings/FleetImport"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PasswordReset = lazy(() => import("./pages/PasswordReset"));
const VehicleFinancialProfile = lazy(() => import("./pages/VehicleFinancialProfile"));
const RiskScoreView = lazy(() => import("./pages/RiskScoreView"));
const FleetHeatmap = lazy(() => import("./pages/FleetHeatmap"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, throwOnError: false, refetchOnWindowFocus: false, staleTime: 0 },
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

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Suspense fallback={<LoadingFallback />}>
            <Routes>
            {/* Homepage — has its own full OS layout with agent sidebar */}
            <Route path="/" element={<OSLayout><Overview /></OSLayout>} />

            {/* All other pages — wrapped in OSLayout (header + nav + content) */}
            <Route path="/quotes" element={<OSLayout><QuotesList /></OSLayout>} />
            <Route path="/quotes/new" element={<OSLayout><NewQuote /></OSLayout>} />
            <Route path="/quotes/:id" element={<OSLayout><QuoteDetail /></OSLayout>} />
            <Route path="/bookings" element={<OSLayout><LoadsList /></OSLayout>} />
            <Route path="/bookings/:id" element={<OSLayout><Bookings /></OSLayout>} />
            <Route path="/bookings/list" element={<OSLayout><BookingsList /></OSLayout>} />
            <Route path="/bookings/pipeline" element={<OSLayout><QuotesList /></OSLayout>} />
            <Route path="/bookings/pipeline/:id" element={<OSLayout><NewQuote /></OSLayout>} />
            <Route path="/fleet" element={<OSLayout><Vehicles /></OSLayout>} />
            <Route path="/fleet/overview" element={<OSLayout><FleetDashboard /></OSLayout>} />
            <Route path="/fleet/vehicles" element={<OSLayout><Vehicles /></OSLayout>} />
            <Route path="/fleet/vehicles/:id" element={<OSLayout><VehicleFinancialProfile /></OSLayout>} />
            <Route path="/fleet/drivers" element={<OSLayout><Drivers /></OSLayout>} />
            <Route path="/fleet/drivers/:driverId" element={<OSLayout><DriverProfile /></OSLayout>} />
            <Route path="/vehicles" element={<OSLayout><Vehicles /></OSLayout>} />
            <Route path="/drivers" element={<OSLayout><Drivers /></OSLayout>} />
            <Route path="/invoices" element={<OSLayout><Invoices /></OSLayout>} />
            <Route path="/finance/invoices" element={<OSLayout><Invoices /></OSLayout>} />
            <Route path="/finance/invoices/new" element={<OSLayout><CreateInvoice /></OSLayout>} />
            <Route path="/finance/invoices/:id" element={<OSLayout><InvoiceDetail /></OSLayout>} />
            <Route path="/finance/expenses" element={<OSLayout><Expenses /></OSLayout>} />
            <Route path="/finance/reports" element={<OSLayout><FinanceReports /></OSLayout>} />
            <Route path="/capital" element={<OSLayout><Capital /></OSLayout>} />
            <Route path="/capital/request" element={<OSLayout><AdvanceRequest /></OSLayout>} />
            <Route path="/capital/advances/:id" element={<OSLayout><AdvanceDetail /></OSLayout>} />
            <Route path="/insights" element={<OSLayout><Insights /></OSLayout>} />
            <Route path="/partner-dashboard" element={<OSLayout><PartnerDashboard /></OSLayout>} />
            <Route path="/settings/:section?" element={<OSLayout><Settings /></OSLayout>} />
            <Route path="/settings/integrations/xero" element={<OSLayout><XeroIntegration /></OSLayout>} />
            <Route path="/settings/integrations/fleet" element={<OSLayout><FleetImport /></OSLayout>} />
            {/* New Sprint 5+6 pages */}
            <Route path="/password-reset" element={<PasswordReset />} />
            <Route path="/fleet/vehicles/:id/financial" element={<OSLayout><VehicleFinancialProfile /></OSLayout>} />
            <Route path="/capital/risk-scores" element={<OSLayout><RiskScoreView /></OSLayout>} />
            <Route path="/fleet/heatmap" element={<OSLayout><FleetHeatmap /></OSLayout>} />
            {/* Route aliases */}
            <Route path="/overview" element={<Navigate to="/" replace />} />
            <Route path="/expenses" element={<Navigate to="/finance/expenses" replace />} />
            <Route path="/finance-reports" element={<Navigate to="/finance/reports" replace />} />
            <Route path="/partner" element={<Navigate to="/partner-dashboard" replace />} />
            <Route path="*" element={<OSLayout><NotFound /></OSLayout>} />
          </Routes>
          </Suspense>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
