import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useFetch from "@/hooks/useFetch";
import { formatZAR } from "@/lib/constants";

interface CapitalDashboard {
  facility_limit: number;
  available_capital: number;
  outstanding_advances: number;
  outstanding_count: number;
  utilization_percent: number;
  eligible_invoices_count: number;
  eligible_invoices_total: number;
  risk_distribution: {
    excellent: number;
    good: number;
    fair: number;
    elevated: number;
  };
  recent_advances: Array<{
    id: string;
    invoice_number: string;
    customer_name: string;
    gross_amount: number;
    fee_percent: number;
    net_amount: number;
    status: string;
    created_at: string;
  }>;
}

const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case 'ELIGIBLE':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'REQUESTED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'APPROVED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'DISBURSED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SETTLED':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    case 'DENIED':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

const getUtilizationColor = (percent: number) => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 75) return 'bg-amber-500';
  return 'bg-[#2563EB]';
};

export default function Capital() {
  const navigate = useNavigate();

  const { data, isLoading, error } = useFetch<CapitalDashboard>(
    '/api/v1/dashboard/capital/'
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#64748B]">Loading capital dashboard...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">Error loading capital dashboard</div>
        </div>
      </div>
    );
  }

  const utilizationPercent = data.utilization_percent || 0;
  const hasEligibleInvoices = data.eligible_invoices_count > 0;

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div>
        <h1 className="text-3xl font-bold text-[#0F172A]">Capital</h1>
        <p className="text-[#64748B] mt-1">Manage your working capital and advance requests</p>
      </div>

      {/* Facility Overview - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
              Available Capital
            </p>
            <p className={`text-3xl font-mono font-medium ${
              utilizationPercent < 50 ? 'text-green-600' : 'text-[#0F172A]'
            }`}>
              {formatZAR(data.available_capital)}
            </p>
            <p className="text-sm text-[#64748B]">
              of {formatZAR(data.facility_limit)} limit
            </p>
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
              Outstanding Advances
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-mono font-medium text-[#0F172A]">
                {formatZAR(data.outstanding_advances)}
              </p>
              <Badge className="bg-blue-50 text-blue-700 border-blue-200 border">
                {data.outstanding_count}
              </Badge>
            </div>
            <p className="text-sm text-[#64748B]">Active advances</p>
          </div>
        </Card>

        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
              Utilization
            </p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              {utilizationPercent.toFixed(1)}%
            </p>
            <div className="w-full bg-slate-200 rounded-full h-2 mt-2">
              <div
                className={`h-2 rounded-full transition-all ${getUtilizationColor(utilizationPercent)}`}
                style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Eligible Invoices CTA */}
      {hasEligibleInvoices && (
        <Card className="p-6 bg-gradient-to-r from-blue-50 via-blue-50/50 to-white border border-[#2563EB]/20 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2 flex-1">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[#2563EB]" />
                <h3 className="text-lg font-semibold text-[#0F172A]">
                  {data.eligible_invoices_count} invoice{data.eligible_invoices_count !== 1 ? 's' : ''} eligible for early payment
                </h3>
              </div>
              <p className="text-sm text-[#64748B]">
                Total value: {formatZAR(data.eligible_invoices_total)} available
              </p>
            </div>
            <Button
              onClick={() => navigate('/capital/request')}
              className="gap-2 shrink-0 bg-[#2563EB] hover:bg-[#1D4ED8]"
            >
              Get Paid Early
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* Risk Distribution Chart */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Risk Distribution</h2>
          <div className="space-y-3">
            {/* Excellent */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#10B981] font-medium">Excellent</span>
                <span className="text-[#0F172A] font-mono">
                  {data.risk_distribution.excellent} invoices
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#10B981] h-2 rounded-full"
                  style={{
                    width: `${(data.risk_distribution.excellent / Math.max(
                      data.risk_distribution.excellent +
                      data.risk_distribution.good +
                      data.risk_distribution.fair +
                      data.risk_distribution.elevated, 1
                    )) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Good */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#2563EB] font-medium">Good</span>
                <span className="text-[#0F172A] font-mono">
                  {data.risk_distribution.good} invoices
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#2563EB] h-2 rounded-full"
                  style={{
                    width: `${(data.risk_distribution.good / Math.max(
                      data.risk_distribution.excellent +
                      data.risk_distribution.good +
                      data.risk_distribution.fair +
                      data.risk_distribution.elevated, 1
                    )) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Fair */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#F59E0B] font-medium">Fair</span>
                <span className="text-[#0F172A] font-mono">
                  {data.risk_distribution.fair} invoices
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#F59E0B] h-2 rounded-full"
                  style={{
                    width: `${(data.risk_distribution.fair / Math.max(
                      data.risk_distribution.excellent +
                      data.risk_distribution.good +
                      data.risk_distribution.fair +
                      data.risk_distribution.elevated, 1
                    )) * 100}%`
                  }}
                />
              </div>
            </div>

            {/* Elevated */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#EF4444] font-medium">Elevated</span>
                <span className="text-[#0F172A] font-mono">
                  {data.risk_distribution.elevated} invoices
                </span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-[#EF4444] h-2 rounded-full"
                  style={{
                    width: `${(data.risk_distribution.elevated / Math.max(
                      data.risk_distribution.excellent +
                      data.risk_distribution.good +
                      data.risk_distribution.fair +
                      data.risk_distribution.elevated, 1
                    )) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Advance History Table */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Advance History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Fee
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Net Amount
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent_advances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#64748B]">
                      No advances yet. Request your first advance to get started.
                    </td>
                  </tr>
                ) : (
                  data.recent_advances.map((advance) => (
                    <tr
                      key={advance.id}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => navigate(`/capital/advances/${advance.id}`)}
                    >
                      <td className="py-3 px-4 text-sm text-[#64748B]">
                        {new Date(advance.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#2563EB]">
                        {advance.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#0F172A]">
                        {advance.customer_name}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">
                        {formatZAR(advance.gross_amount)}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#64748B] text-right">
                        {advance.fee_percent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right font-medium">
                        {formatZAR(advance.net_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${getStatusColor(advance.status)} border font-medium`}>
                          {advance.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#2563EB] hover:text-[#1D4ED8] hover:bg-blue-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/capital/advances/${advance.id}`);
                          }}
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </div>
  );
}
