import { Card } from "@/components/ui/card";
import { ArrowUpRight, ArrowDownRight, TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import useFetch from "@/hooks/useFetch";

// Mock data - will be replaced with API calls
const cashFlowData = [
  { month: "Jan", value: 450000 },
  { month: "Feb", value: 520000 },
  { month: "Mar", value: 480000 },
  { month: "Apr", value: 550000 },
  { month: "May", value: 620000 },
  { month: "Jun", value: 580000 },
];

const customerProfitability = [
  { customer: "ABC Logistics", revenue: 850000, margin: 22.5, loads: 45 },
  { customer: "XYZ Transport", revenue: 620000, margin: 18.2, loads: 32 },
  { customer: "Global Freight", revenue: 480000, margin: 25.1, loads: 28 },
  { customer: "Swift Carriers", revenue: 320000, margin: 15.8, loads: 18 },
  { customer: "Metro Logistics", revenue: 280000, margin: 20.3, loads: 15 },
];

export default function FinanceHQ() {
  return (
    <div className="space-y-8">
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Revenue */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Revenue (MTD)</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 2.8M</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#10B981] font-medium">8.2%</span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Margin */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Net Margin</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">18.7%</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
              <span className="text-[#EF4444] font-medium">1.3%</span>
              <span className="text-[#64748B]">below target</span>
            </div>
          </div>
        </Card>

        {/* Costs */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Costs</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 2.3M</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#EF4444]" />
              <span className="text-[#EF4444] font-medium">2.1%</span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Forecast */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">30d Forecast</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 3.1M</p>
            <div className="flex items-center gap-1 text-sm">
              <TrendingUp className="w-4 h-4 text-[#2563EB]" />
              <span className="text-[#64748B]">Projected closing</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart */}
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

      {/* Customer Profitability Table */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Customer Profitability</h2>
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
                {customerProfitability.map((customer, index) => (
                  <tr
                    key={index}
                    className="border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-[#0F172A]">{customer.customer}</td>
                    <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">R {(customer.revenue / 1000).toFixed(0)}K</td>
                    <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">{customer.margin}%</td>
                    <td className="py-3 px-4 text-sm font-mono text-[#64748B] text-right">{customer.loads}</td>
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