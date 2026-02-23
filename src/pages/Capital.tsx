import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useFetch from "@/hooks/useFetch";

// Mock advance history data - will be replaced with API calls
const advanceHistory = [
  { id: "ADV-024", invoiceId: "INV-751", customer: "Tiger Brands", amount: 22400, status: "Settled", date: "2025-10-12" },
  { id: "ADV-023", invoiceId: "INV-748", customer: "Woolworths", amount: 16800, status: "Active", date: "2025-10-10" },
  { id: "ADV-022", invoiceId: "INV-745", customer: "Shoprite", amount: 19200, status: "Active", date: "2025-10-08" },
  { id: "ADV-021", invoiceId: "INV-742", customer: "Pick n Pay", amount: 15600, status: "Settled", date: "2025-10-05" },
  { id: "ADV-020", invoiceId: "INV-739", customer: "SPAR Group", amount: 18900, status: "Settled", date: "2025-10-03" },
];

export default function Capital() {
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active': return 'bg-blue-50 text-[#2563EB]';
      case 'Pending': return 'bg-amber-50 text-[#F59E0B]';
      case 'Settled': return 'bg-green-50 text-[#10B981]';
      default: return 'bg-slate-50 text-[#64748B]';
    }
  };

  return (
    <div className="space-y-8">
      {/* Eligible Invoices CTA */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-white border border-[#2563EB]/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <h3 className="text-lg font-semibold text-[#0F172A]">
              8 invoices ready for instant payment
            </h3>
            <p className="text-sm text-[#64748B]">
              Total value: R 458,000 • 2.5% transparent fee
            </p>
          </div>
          <Button
            onClick={() => navigate('/finance/invoices')}
            className="gap-2 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8]"
          >
            View Invoices
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </Card>

      {/* Facility Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Credit Limit</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 500K</p>
            <p className="text-sm text-[#64748B]">Total facility available</p>
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Outstanding</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 156K</p>
            <p className="text-sm text-[#64748B]">Across 12 active advances</p>
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Utilization</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">31.2%</p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div className="bg-[#2563EB] h-2 rounded-full" style={{ width: '31.2%' }} />
            </div>
          </div>
        </Card>
      </div>

      {/* Advance History Table */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Advance History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Advance ID</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Invoice</th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Amount</th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Status</th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Date</th>
                </tr>
              </thead>
              <tbody>
                {advanceHistory.map((advance) => (
                  <tr
                    key={advance.id}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm font-mono text-[#0F172A]">{advance.id}</td>
                    <td className="py-3 px-4 text-sm font-mono text-[#2563EB] cursor-pointer hover:text-[#1D4ED8]">
                      {advance.invoiceId}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#0F172A]">{advance.customer}</td>
                    <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">R {(advance.amount / 1000).toFixed(1)}K</td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium ${getStatusColor(advance.status)}`}>
                        {advance.status === 'Settled' && <CheckCircle2 className="w-3 h-3" />}
                        {advance.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-[#64748B] text-right">{new Date(advance.date).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}