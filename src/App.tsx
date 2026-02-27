import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { OSLayout } from "./components/os/OSLayout";
import { loginUser } from "./lib/Api";

// Auto-login so API calls work without login page
async function ensureAuth() {
  if (!localStorage.getItem('access')) {
    try {
      const data = await loginUser({ username: 'admin', password: 'admin123' });
      if (data.token) localStorage.setItem('access', data.token);
    } catch {}
  }
}
ensureAuth();

// Pages
import Overview from "./pages/Overview";
import { QuotesList } from "./pages/QuotesList";
import NewQuote from "./pages/NewQuote";
import { BookingsList } from "./pages/BookingsList";
import Bookings from "./pages/Bookings";
import LoadsList from "./pages/LoadsList";
import Vehicles from "./pages/Vehicles";
import VehicleDigitalTwin from "./pages/VehicleDigitalTwin";
import Drivers from "./pages/Drivers";
import DriverProfile from "./pages/DriverProfile";
import FleetDashboard from "./pages/FleetDashboard";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import CreateInvoice from "./pages/CreateInvoice";
import Expenses from "./pages/Expenses";
import FinanceReports from "./pages/FinanceReports";
import Capital from "./pages/Capital";
import AdvanceRequest from "./pages/AdvanceRequest";
import AdvanceDetail from "./pages/AdvanceDetail";
import Insights from "./pages/Insights";
import PartnerDashboard from "./pages/PartnerDashboard";
import Settings from "./pages/Settings";
import XeroIntegration from "./pages/settings/XeroIntegration";
import FleetImport from "./pages/settings/FleetImport";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, throwOnError: false, refetchOnWindowFocus: false },
  },
});

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <ErrorBoundary>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <Routes>
            {/* Homepage — has its own full OS layout with agent sidebar */}
            <Route path="/" element={<Overview />} />

            {/* All other pages — wrapped in OSLayout (header + nav + content) */}
            <Route path="/quotes" element={<OSLayout><QuotesList /></OSLayout>} />
            <Route path="/quotes/new" element={<OSLayout><NewQuote /></OSLayout>} />
            <Route path="/bookings" element={<OSLayout><LoadsList /></OSLayout>} />
            <Route path="/bookings/:id" element={<OSLayout><Bookings /></OSLayout>} />
            <Route path="/bookings/list" element={<OSLayout><BookingsList /></OSLayout>} />
            <Route path="/bookings/pipeline" element={<OSLayout><QuotesList /></OSLayout>} />
            <Route path="/bookings/pipeline/:id" element={<OSLayout><NewQuote /></OSLayout>} />
            <Route path="/fleet" element={<OSLayout><FleetDashboard /></OSLayout>} />
            <Route path="/fleet/vehicles" element={<OSLayout><Vehicles /></OSLayout>} />
            <Route path="/fleet/vehicles/:id" element={<OSLayout><VehicleDigitalTwin /></OSLayout>} />
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
            <Route path="*" element={<OSLayout><NotFound /></OSLayout>} />
          </Routes>
        </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
