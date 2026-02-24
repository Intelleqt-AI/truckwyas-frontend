import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { DashboardLayout } from "./components/layout/DashboardLayout";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Page imports
import Overview from "./pages/Overview";
import { QuotesList } from "./pages/QuotesList";
import NewQuote from "./pages/NewQuote";
import { BookingsList } from "./pages/BookingsList";
import Bookings from "./pages/Bookings";
import Vehicles from "./pages/Vehicles";
import VehicleDigitalTwin from "./pages/VehicleDigitalTwin";
import Drivers from "./pages/Drivers";
import DriverProfile from "./pages/DriverProfile";
import FleetDashboard from "./pages/FleetDashboard";
import FinanceHQ from "./pages/FinanceHQ";
import Invoices from "./pages/Invoices";
import InvoiceDetail from "./pages/InvoiceDetail";
import CreateInvoice from "./pages/CreateInvoice";
import Expenses from "./pages/Expenses";
import FinanceReports from "./pages/FinanceReports";
import Capital from "./pages/Capital";
import AdvanceRequest from "./pages/AdvanceRequest";
import AdvanceDetail from "./pages/AdvanceDetail";
import Insights from "./pages/Insights";
import Settings from "./pages/Settings";
import XeroIntegration from "./pages/settings/XeroIntegration";
import FleetImport from "./pages/settings/FleetImport";
import NotFound from "./pages/NotFound";

// Auth
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ProtectedRoute from "./components/ProtectedRoute";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      throwOnError: false,
      refetchOnWindowFocus: false,
    },
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
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={
              <DashboardLayout>
                <Overview />
              </DashboardLayout>
            } />
            <Route path="/bookings" element={
              <DashboardLayout>
                <Bookings />
              </DashboardLayout>
            } />
            <Route path="/bookings/:id" element={
              <DashboardLayout>
                <Bookings />
              </DashboardLayout>
            } />
            <Route path="/bookings/list" element={
              <DashboardLayout>
                <BookingsList />
              </DashboardLayout>
            } />
            <Route path="/bookings/pipeline" element={
              <DashboardLayout>
                <QuotesList />
              </DashboardLayout>
            } />
            <Route path="/bookings/pipeline/:id" element={
              <DashboardLayout>
                <NewQuote />
              </DashboardLayout>
            } />
            <Route path="/quotes/new" element={
              <DashboardLayout>
                <NewQuote />
              </DashboardLayout>
            } />
            <Route path="/fleet" element={
              <DashboardLayout>
                <FleetDashboard />
              </DashboardLayout>
            } />
            <Route path="/fleet/vehicles" element={
              <DashboardLayout>
                <Vehicles />
              </DashboardLayout>
            } />
            <Route path="/fleet/vehicles/:id" element={
              <DashboardLayout>
                <VehicleDigitalTwin />
              </DashboardLayout>
            } />
            <Route path="/fleet/drivers" element={
              <DashboardLayout>
                <Drivers />
              </DashboardLayout>
            } />
            <Route path="/fleet/drivers/:driverId" element={
              <DashboardLayout>
                <DriverProfile />
              </DashboardLayout>
            } />
            <Route path="/finance-hq" element={
              <DashboardLayout>
                <FinanceHQ />
              </DashboardLayout>
            } />
            <Route path="/finance/invoices" element={
              <DashboardLayout>
                <Invoices />
              </DashboardLayout>
            } />
            <Route path="/finance/invoices/new" element={
              <DashboardLayout>
                <CreateInvoice />
              </DashboardLayout>
            } />
            <Route path="/finance/invoices/:id" element={
              <DashboardLayout>
                <InvoiceDetail />
              </DashboardLayout>
            } />
            <Route path="/finance/expenses" element={
              <DashboardLayout>
                <Expenses />
              </DashboardLayout>
            } />
            <Route path="/finance/reports" element={
              <DashboardLayout>
                <FinanceReports />
              </DashboardLayout>
            } />
            <Route path="/capital" element={
              <DashboardLayout>
                <Capital />
              </DashboardLayout>
            } />
            <Route path="/capital/request" element={
              <DashboardLayout>
                <AdvanceRequest />
              </DashboardLayout>
            } />
            <Route path="/capital/advances/:id" element={
              <DashboardLayout>
                <AdvanceDetail />
              </DashboardLayout>
            } />
            <Route path="/insights" element={
              <DashboardLayout>
                <Insights />
              </DashboardLayout>
            } />
            <Route path="/settings/:section?" element={
              <DashboardLayout>
                <Settings />
              </DashboardLayout>
            } />
            <Route path="/settings/integrations/xero" element={
              <DashboardLayout>
                <XeroIntegration />
              </DashboardLayout>
            } />
            <Route path="/settings/integrations/fleet" element={
              <DashboardLayout>
                <FleetImport />
              </DashboardLayout>
            } />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
      </ErrorBoundary>
    </QueryClientProvider>
  </BrowserRouter >
);

export default App;
