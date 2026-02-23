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

  const { data: dashboardData, isLoading, error: dashboardError } = useFetch<DashboardData>("api/dashboard/finance/");

  // Fetch top 3 insights
  const { data: insights } = useFetch<Insight[]>("api/dashboard/insights/");

  // Fetch mini cash flow for sparkline
  const { data: miniCashFlow } = useFetch<MiniCashFlow[]>("api/dashboard/cashflow/");

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

  // Don't block rendering — show page with defaults if API is slow/failing

  // Create empty state data if API returns nothing
  const safeData: DashboardData = dashboardData || {
    total_revenue: 0,
    outstanding_invoices: {
      count: 0,
      total_amount: 0,
      overdue_count: 0,
    },
    cash_position: 0,
    active_loads: 0,
    revenue_change_percent: 0,
    cash_position_change_percent: 0,
    cash_flow_data: [],
    recent_activity: [],
  };

  const cashFlowData = safeData.cash_flow_data || [];
  const recentActivity = safeData.recent_activity || [];

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
        <h1 className="text-2xl font-semibold text-slate-900">
          {greeting}, {user?.username || "User"}
        </h1>
        <p className="text-sm text-slate-500">{currentDate}</p>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Revenue (MTD) */}
        <Card className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-0">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Revenue (MTD)</p>
            <p className="text-3xl font-mono font-semibold text-slate-900">
              <CurrencyDisplay amount={safeData.total_revenue} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {safeData.revenue_change_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              )}
              <span className={safeData.revenue_change_percent >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {Math.abs(safeData.revenue_change_percent).toFixed(1)}%
              </span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Outstanding Invoices */}
        <Card className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-0">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Outstanding Invoices</p>
            <p className="text-3xl font-mono font-semibold text-slate-900">
              <CurrencyDisplay amount={safeData.outstanding_invoices.total_amount} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {safeData.outstanding_invoices.overdue_count > 0 ? (
                <>
                  <ArrowDownRight className="w-4 h-4 text-red-600" />
                  <span className="text-red-600 font-medium">
                    {safeData.outstanding_invoices.overdue_count} overdue
                  </span>
                </>
              ) : (
                <span className="text-slate-500">
                  {safeData.outstanding_invoices.count} invoices
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* Cash Position */}
        <Card className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-0">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cash Position</p>
            <p className="text-3xl font-mono font-semibold text-slate-900">
              <CurrencyDisplay amount={safeData.cash_position} />
            </p>
            <div className="flex items-center gap-1 text-sm">
              {safeData.cash_position_change_percent >= 0 ? (
                <ArrowUpRight className="w-4 h-4 text-green-600" />
              ) : (
                <ArrowDownRight className="w-4 h-4 text-red-600" />
              )}
              <span className={safeData.cash_position_change_percent >= 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                {Math.abs(safeData.cash_position_change_percent).toFixed(1)}%
              </span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>
        </Card>

        {/* Active Loads */}
        <Card className="p-6 bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow border-0">
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Loads</p>
            <p className="text-3xl font-mono font-semibold text-slate-900">{safeData.active_loads}</p>
            <div className="flex items-center gap-1 text-sm">
              <Activity className="w-4 h-4 text-blue-600" />
              <span className="text-slate-500">in progress or pending</span>
            </div>
          </div>
        </Card>
      </div>

      {/* AI Insights */}
      {topInsights.length > 0 && (
        <Card className="p-6 bg-gradient-to-br from-blue-50 to-white rounded-xl shadow-sm border-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-semibold text-slate-900">AI Insights</h2>
              </div>
              <button
                onClick={() => navigate("/insights")}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"
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
                  className="bg-white rounded-lg p-4 border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
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
                      <h3 className="text-sm font-semibold text-slate-900 mb-1">
                        {insight.title}
                      </h3>
                      <p className="text-xs text-slate-500 line-clamp-2">
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
        <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Cash Flow</h2>
              {miniCashFlow && miniCashFlow.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-xs text-slate-500">30-day trend</p>
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
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
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
      <Card className="p-6 bg-white rounded-xl shadow-sm border-0">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Recent Activity</h2>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="w-12 h-12 text-slate-300 mb-4" />
              <p className="text-lg font-medium text-slate-700">No activity yet</p>
              <p className="text-sm text-slate-500 mt-1">Activity will appear here as you use the platform</p>
            </div>
          ) : (
            recentActivity.map((item) => (
              <div key={item.id} className="flex items-start gap-3 pb-4 border-b border-slate-50 last:border-0 last:pb-0">
                <div className="w-2 h-2 rounded-full bg-blue-600 mt-2 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900">{item.description}</p>
                  {item.amount && (
                    <p className="text-sm font-mono text-slate-500 mt-0.5">{item.amount}</p>
                  )}
                  {item.customer && (
                    <p className="text-sm text-slate-500 mt-0.5">{item.customer}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{item.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
