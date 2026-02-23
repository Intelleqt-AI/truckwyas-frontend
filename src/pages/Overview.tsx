import { TrendingUp, DollarSign, Package, Truck, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import useFetch from "@/hooks/useFetch";
import { useEffect, useState } from "react";

// Mock data - will be replaced with API calls
const cashFlowData = [
  { month: "Jan", value: 450000 },
  { month: "Feb", value: 520000 },
  { month: "Mar", value: 480000 },
  { month: "Apr", value: 550000 },
  { month: "May", value: 620000 },
  { month: "Jun", value: 580000 },
];

const recentActivity = [
  { id: 1, type: "invoice", description: "Invoice #INV-2345 paid", amount: "R 45,000", time: "2 hours ago" },
  { id: 2, type: "booking", description: "New booking created", customer: "ABC Logistics", time: "3 hours ago" },
  { id: 3, type: "expense", description: "Fuel expense recorded", amount: "R 12,500", time: "5 hours ago" },
  { id: 4, type: "payment", description: "Payment received", amount: "R 88,000", time: "1 day ago" },
];

const aiInsights = [
  { id: 1, severity: "high", message: "5 invoices overdue by more than 30 days", action: "Review now" },
  { id: 2, severity: "medium", message: "Fleet utilization down 12% this week", action: "Optimize routes" },
  { id: 3, severity: "low", message: "Fuel costs trending 8% higher than forecast", action: "View details" },
];

export default function Overview() {
  const [greeting, setGreeting] = useState("Good morning");
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting("Good morning");
    else if (hour < 18) setGreeting("Good afternoon");
    else setGreeting("Good evening");

    const userStr = localStorage.getItem("user");
    if (userStr) {
      setUser(JSON.parse(userStr));
    }
  }, []);

  const currentDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#0F172A]">
          {greeting}, {user?.username || "User"}
        </h1>
        <p className="text-sm text-[#64748B]">{currentDate}</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue (MTD) */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Total Revenue (MTD)</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 2.4M</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#10B981] font-medium">12.5%</span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Outstanding Invoices */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Outstanding Invoices</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 458K</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
              <span className="text-[#EF4444] font-medium">8 overdue</span>
              <span className="text-[#64748B]">require attention</span>
            </div>
          </div>
        </Card>

        {/* Cash Position */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Cash Position</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">R 1.2M</p>
            <div className="flex items-center gap-1 text-sm">
              <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              <span className="text-[#10B981] font-medium">18.2%</span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Active Loads */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Active Loads</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">24</p>
            <div className="flex items-center gap-1 text-sm">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span className="text-[#64748B]">12 in transit, 12 pending</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Cash Flow Chart */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-[#0F172A]">Cash Flow</h2>
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

      {/* Two Column Layout - Activity & Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Recent Activity</h2>
          <div className="space-y-4">
            {recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 pb-4 border-b border-[#F1F5F9] last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{item.description}</p>
                  {item.amount && (
                    <p className="text-sm font-mono text-[#64748B] mt-0.5">{item.amount}</p>
                  )}
                  {item.customer && (
                    <p className="text-sm text-[#64748B] mt-0.5">{item.customer}</p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-1">{item.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* AI Insights */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <h2 className="text-lg font-semibold text-[#0F172A] mb-4">AI Insights</h2>
          <div className="space-y-3">
            {aiInsights.map((insight) => (
              <div
                key={insight.id}
                className={`p-4 rounded-lg border-l-4 ${
                  insight.severity === 'high'
                    ? 'bg-red-50 border-[#EF4444]'
                    : insight.severity === 'medium'
                    ? 'bg-amber-50 border-[#F59E0B]'
                    : 'bg-blue-50 border-[#2563EB]'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm text-[#0F172A] flex-1">{insight.message}</p>
                  <button className="text-xs font-medium text-[#2563EB] hover:text-[#1D4ED8] whitespace-nowrap">
                    {insight.action} →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}