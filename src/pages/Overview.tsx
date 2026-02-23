import { TrendingUp, DollarSign, Package, Truck, ArrowUpRight, ArrowDownRight, Activity, Lightbulb, ArrowRight, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { CurrencyDisplay } from "@/components/finance/CurrencyDisplay";
import useFetch from "@/hooks/useFetch";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface DashboardData {
  total_revenue: number;
  outstanding_invoices: {
    count: number;
    total_amount: number;
    overdue_count: number;
  };
  cash_position: number;
  active_loads: number;
  revenue_change_percent: number;
  cash_position_change_percent: number;
  cash_flow_data: Array<{ month: string; value: number }>;
  recent_activity: Array<{
    id: number;
    type: string;
    description: string;
    amount?: string;
    customer?: string;
    time: string;
  }>;
}

interface Insight {
  id: number;
  category: "Margin" | "Cash" | "Customer" | "Fleet" | "Pricing";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  suggested_action: string;
}

interface MiniCashFlow {
  week: string;
  net: number;
}

export default function Overview() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState("Good morning");
  const [user, setUser] = useState<any>(null);

  const { data: dashboardData, isLoading } = useFetch<DashboardData>("/api/dashboard/");

  // Fetch top 3 insights
  const { data: insights } = useFetch<Insight[]>("/api/v1/dashboard/insights/");

  // Fetch mini cash flow for sparkline
  const { data: miniCashFlow } = useFetch<MiniCashFlow[]>("/api/v1/dashboard/cashflow/mini/");

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-[#64748B]">Loading dashboard...</p>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-[#64748B]">No data available. Start by creating your first booking or invoice.</p>
        </div>
      </div>
    );
  }

  const cashFlowData = dashboardData.cash_flow_data || [];
  const recentActivity = dashboardData.recent_activity || [];

  // Get top 3 insights sorted by severity
  const topInsights = insights
    ? [...insights]
        .sort((a, b) => {
          const severityOrder = { high: 0, medium: 1, low: 2 };
          return severityOrder[a.severity] - severityOrder[b.severity];
        })
        .slice(0, 3)
    : [];

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

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
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.total_revenue} />
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

        {/* Outstanding Invoices */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Outstanding Invoices</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.outstanding_invoices.total_amount} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {dashboardData.outstanding_invoices.overdue_count > 0 ? (
                <>
                  <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
                  <span className="text-[#EF4444] font-medium">
                    {dashboardData.outstanding_invoices.overdue_count} overdue
                  </span>
                </>
              ) : (
                <span className="text-[#64748B]">
                  {dashboardData.outstanding_invoices.count} invoices
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Cash Position */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Cash Position</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">
              <CurrencyDisplay amount={dashboardData.cash_position} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {dashboardData.cash_position_change_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-[#10B981]" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-[#EF4444]" />
              )}
              <span className={dashboardData.cash_position_change_percent >= 0 ? "text-[#10B981] font-medium" : "text-[#EF4444] font-medium"}>
                {Math.abs(dashboardData.cash_position_change_percent).toFixed(1)}%
              </span>
              <span className="text-[#64748B]">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Active Loads */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_6px_rgba(0,0,0,0.07)] transition-shadow">
          <div className="space-y-3">
            <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">Active Loads</p>
            <p className="text-3xl font-mono font-medium text-[#0F172A]">{dashboardData.active_loads}</p>
            <div className="flex items-center gap-1 text-sm">
              <Activity className="w-4 h-4 text-[#2563EB]" />
              <span className="text-[#64748B]">in progress or pending</span>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Insights */}
      {topInsights.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-[#EFF6FF] to-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#2563EB]" />
                <h2 className="text-lg font-semibold text-[#0F172A]">AI Insights</h2>
              </div>
              <button
                onClick={() => navigate("/insights")}
                className="text-sm text-[#2563EB] hover:text-[#1D4ED8] font-medium flex items-center gap-1"
              >
                View all
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {topInsights.map((insight) => (
                <div
                  key={insight.id}
                  onClick={() => navigate("/insights")}
                  className="bg-white rounded-lg p-4 border border-[#E2E8F0] hover:shadow-md transition-shadow cursor-pointer"
                >
                  <div className="flex gap-3">
                    <span className="text-xl flex-shrink-0">
                      {getSeverityIcon(insight.severity)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-xs bg-white"
                        >
                          {insight.category}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A] mb-1">
                        {insight.title}
                      </h3>
                      <p className="text-xs text-[#64748B] line-clamp-2">
                        {insight.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Cash Flow Chart */}
      {cashFlowData.length > 0 && (
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-[#0F172A]">Cash Flow</h2>
              {miniCashFlow && miniCashFlow.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-[#64748B]">30-day trend</p>
                  </div>
                  <div className="w-24 h-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={miniCashFlow}>
                        <defs>
                          <linearGradient id="miniSparkline" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563EB" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#2563EB" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="net"
                          stroke="#2563EB"
                          strokeWidth={1.5}
                          fillOpacity={1}
                          fill="url(#miniSparkline)"
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
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

      {/* Recent Activity */}
      <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <h2 className="text-lg font-semibold text-[#0F172A] mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-[#64748B] text-center py-8">No recent activity</p>
          ) : (
            recentActivity.map((item) => (
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
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
