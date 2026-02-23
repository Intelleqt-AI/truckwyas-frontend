import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import useFetch from "@/hooks/useFetch";

interface FinanceDashboardData {
  revenue_mtd: number;
  expenses_mtd: number;
  net_margin: number;
  margin_percent: number;
  dso: number;
  revenue_change_percent: number;
  expenses_change_percent: number;
  cash_flow_data: Array<{ month: string; value: number }>;
  top_customers: Array<{ customer: string; revenue: number; margin: number; loads: number }>;
  monthly_trend: Array<{ month: string; revenue: number; expenses: number; margin: number }>;
}

export default function FinanceHQ() {
  const { data: dashboardData, isLoading, error } = useFetch<FinanceDashboardData>("/api/dashboard/finance/");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading finance dashboard...</p>
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-[#64748B] mb-4">No data yet. Create your first invoice to get started.</p>
        </div>
      </div>
    );
  }

  const cashFlowData = dashboardData.cash_flow_data || [];
  const topCustomers = dashboardData.top_customers || [];
  const monthlyTrend = dashboardData.monthly_trend || [];

  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Revenue (MTD)</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.revenue_mtd} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {dashboardData.revenue_change_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
              )}
              <span className={dashboardData.revenue_change_percent >= 0 ? "text-[#10B981] font-medium" : "text-[#EF4444] font-medium"}>
                {Math.abs(dashboardData.revenue_change_percent).toFixed(1)}%
              </span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Net Margin */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Net Margin</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              {dashboardData.margin_percent.toFixed(1)}%
            </p>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-[#64748B]">
                <CurrencyDisplay amount={dashboardData.net_margin} />
              </span>
            </div>
          </div>
        </Card>

        {/* Total Costs */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Costs</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.expenses_mtd} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {dashboardData.expenses_change_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#EF4444]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#10B981]" />
              )}
              <span className={dashboardData.expenses_change_percent >= 0 ? "text-[#EF4444] font-medium" : "text-[#10B981] font-medium"}>
                {Math.abs(dashboardData.expenses_change_percent).toFixed(1)}%
              </span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* DSO */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">DSO</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              {Math.round(dashboardData.dso)} days
            </p>
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              <span className="text-[#64748B]">Days Sales Outstanding</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      {cashFlowData.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Cash Flow Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#2563EB"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Customer Profitability Table */}
      {topCustomers.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Top Customers</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#F1F5F9]">
                    <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Customer</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Revenue</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Margin %</th>
                    <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">Loads</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((customer, index) => (
                    <tr
                      key={index}
                      className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                    >
                      <td className="py-3 px-4 text-sm text-[#0F172A]">{customer.customer}</td>
                      <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">
                        <CurrencyDisplay amount={customer.revenue} />
                      </td>
                      <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">{customer.margin.toFixed(1)}%</td>
                      <td className="py-3 px-4 text-sm font-mono text-[#64748B] text-right">{customer.loads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>
      )}

      {/* Monthly Trend Chart */}
      {monthlyTrend.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Monthly Trend (Last 6 Months)</h2>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis dataKey="month" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="#10B981"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  name="Revenue"
                />
                <Area
                  type="monotone"
                  dataKey="expenses"
                  stroke="#EF4444"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorExpenses)"
                  name="Expenses"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
