import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from "recharts";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import useFetch from "@/hooks/useFetch";

interface FinanceDashboardData {
  revenue_mtd: number;
  expenses_mtd: number;
  net_margin: number;
  margin_percent: number;
  revenue_by_customer: Array<{ customer: string; revenue: number }>;
  expenses_by_category: Array<{ category: string; amount: number }>;
  monthly_trend: Array<{ month: string; revenue: number; expenses: number }>;
  aging_report: {
    current: number;
    days_30: number;
    days_60: number;
    days_90_plus: number;
  };
  cash_flow_forecast: Array<{ month: string; cash_in: number; cash_out: number }>;
}

const EXPENSE_CATEGORY_COLORS: { [key: string]: string } = {
  FUEL: '#F59E0B',
  TOLLS: '#2563EB',
  MAINTENANCE: '#EF4444',
  DRIVER: '#10B981',
  INSURANCE: '#8B5CF6',
  OVERHEAD: '#64748B'
};

export default function FinanceReports() {
  const [dateRange, setDateRange] = useState("current_month");

  // Fetch finance dashboard data from API
  const { data: dashboardData, isLoading } = useFetch<FinanceDashboardData>(`/api/dashboard/finance/?range=${dateRange}`);

  const handleExportCSV = () => {
    console.log("Export CSV");
    // Implement CSV export logic
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading finance reports...</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-[#64748B] mb-4">No data available for the selected period.</p>
          <p className="text-sm text-[#94A3B8]">Create invoices and record expenses to generate reports.</p>
        </div>
      </div>
    );
  }

  // Prepare chart data - use mock data if API doesn't return the right structure
  const revenueByCustomer = dashboardData.revenue_by_customer || [];
  const expensesByCategory = dashboardData.expenses_by_category || [];
  const monthlyTrend = dashboardData.monthly_trend || [];
  const cashFlowForecast = dashboardData.cash_flow_forecast || [];

  // Aging report data for stacked bar chart
  const agingData = dashboardData.aging_report ? [
    { name: 'Aging', current: dashboardData.aging_report.current, days30: dashboardData.aging_report.days_30, days60: dashboardData.aging_report.days_60, days90: dashboardData.aging_report.days_90_plus }
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Finance Reports</h1>
          <p className="text-sm text-[#64748B] mt-1">Analytics and insights for your business</p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current_month">Current Month</SelectItem>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="last_6_months">Last 6 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Revenue Section */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Revenue</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Total Revenue</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.revenue_mtd} />
            </p>
          </div>
        </div>

        {/* Revenue by Customer Chart */}
        {revenueByCustomer.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Revenue by Customer</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueByCustomer} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                <XAxis type="number" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <YAxis dataKey="customer" type="category" stroke="#94A3B8" style={{ fontSize: '12px' }} width={120} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
                <Bar dataKey="revenue" fill="#2563EB" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Expense Section */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Expenses</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Total Expenses</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.expenses_mtd} />
            </p>
          </div>
        </div>

        {/* Expenses by Category Pie Chart */}
        {expensesByCategory.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Expenses by Category</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={expensesByCategory}
                  dataKey="amount"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(entry) => `${entry.category}: R${entry.amount.toLocaleString()}`}
                >
                  {expensesByCategory.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={EXPENSE_CATEGORY_COLORS[entry.category] || '#94A3B8'} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    fontSize: '12px'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Profitability Section */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Profitability</h2>
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Net Margin</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.net_margin} />
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide mb-2">Margin %</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              {dashboardData.margin_percent.toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Monthly Trend Chart */}
        {monthlyTrend.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#0F172A] mb-3">Margin % Trend</h3>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={monthlyTrend}>
                <defs>
                  <linearGradient id="colorMargin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
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
                  fill="url(#colorMargin)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Aging Report */}
      {agingData.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Aging Report</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={agingData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="name" stroke="#94A3B8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px'
                }}
              />
              <Bar dataKey="current" stackId="a" fill="#10B981" name="Current" />
              <Bar dataKey="days30" stackId="a" fill="#2563EB" name="1-30 days" />
              <Bar dataKey="days60" stackId="a" fill="#F59E0B" name="31-60 days" />
              <Bar dataKey="days90" stackId="a" fill="#EF4444" name="60+ days" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}

      {/* Cash Flow Forecast */}
      {cashFlowForecast.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Cash Flow Forecast (Next 90 Days)</h2>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashFlowForecast}>
              <defs>
                <linearGradient id="colorCashIn" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorCashOut" x1="0" y1="0" x2="0" y2="1">
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
                dataKey="cash_in"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCashIn)"
                name="Cash In"
              />
              <Area
                type="monotone"
                dataKey="cash_out"
                stroke="#EF4444"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCashOut)"
                name="Cash Out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
