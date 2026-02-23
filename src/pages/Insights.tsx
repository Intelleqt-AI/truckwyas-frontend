import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  DollarSign,
  Users,
  Truck,
  Target,
  ArrowRight,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { formatZAR } from "@/lib/constants";

interface Insight {
  id: number;
  category: "Margin" | "Cash" | "Customer" | "Fleet" | "Pricing";
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  suggested_action: string;
  created_at: string;
}

interface CashFlowDataPoint {
  week: string;
  cash_in: number;
  cash_out: number;
  net: number;
}

interface CashFlowForecast {
  data: CashFlowDataPoint[];
  total_cash_in: number;
  total_cash_out: number;
  net_position: number;
}

export default function Insights() {
  const queryClient = useQueryClient();

  // Fetch insights
  const { data: insights, isLoading: insightsLoading } = useFetch<Insight[]>(
    "/api/v1/dashboard/insights/"
  );

  // Fetch cash flow forecast
  const { data: cashFlow, isLoading: cashFlowLoading } =
    useFetch<CashFlowForecast>("/api/v1/dashboard/cashflow/");

  // Refresh insights
  const { mutate: refreshInsights, isPending: isRefreshing } = usePost({
    onSuccess: () => {
      toast.success("Insights refreshed successfully");
      queryClient.invalidateQueries({
        queryKey: ["/api/v1/dashboard/insights/"],
      });
    },
    onError: () => {
      toast.error("Failed to refresh insights");
    },
  });

  const handleRefresh = () => {
    refreshInsights({
      url: "/api/v1/dashboard/insights/refresh/",
      data: {},
    });
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "high":
        return "text-[#EF4444]";
      case "medium":
        return "text-[#F59E0B]";
      case "low":
        return "text-[#10B981]";
      default:
        return "text-[#64748B]";
    }
  };

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

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Margin":
        return <TrendingUp className="w-5 h-5" />;
      case "Cash":
        return <DollarSign className="w-5 h-5" />;
      case "Customer":
        return <Users className="w-5 h-5" />;
      case "Fleet":
        return <Truck className="w-5 h-5" />;
      case "Pricing":
        return <Target className="w-5 h-5" />;
      default:
        return <AlertCircle className="w-5 h-5" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "Margin":
        return "bg-[#10B981] text-white";
      case "Cash":
        return "bg-[#2563EB] text-white";
      case "Customer":
        return "bg-[#8B5CF6] text-white";
      case "Fleet":
        return "bg-[#F59E0B] text-white";
      case "Pricing":
        return "bg-[#EF4444] text-white";
      default:
        return "bg-[#64748B] text-white";
    }
  };

  // Sort insights by severity (high -> medium -> low)
  const sortedInsights = insights
    ? [...insights].sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      })
    : [];

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white border border-[#E2E8F0] rounded-lg shadow-lg p-3">
          <p className="text-xs font-medium text-[#0F172A] mb-2">
            {payload[0].payload.week}
          </p>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#64748B]">Cash In:</span>
              <span className="text-xs font-medium text-[#10B981]">
                {formatZAR(payload[0].value)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-xs text-[#64748B]">Cash Out:</span>
              <span className="text-xs font-medium text-[#EF4444]">
                {formatZAR(payload[1].value)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4 pt-1 border-t">
              <span className="text-xs font-medium text-[#0F172A]">Net:</span>
              <span
                className={`text-xs font-medium ${
                  payload[0].payload.net >= 0
                    ? "text-[#10B981]"
                    : "text-[#EF4444]"
                }`}
              >
                {formatZAR(payload[0].payload.net)}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">
            AI Insights & Forecasts
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            AI-powered recommendations and cash flow forecasts for your business
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          disabled={isRefreshing}
          variant="outline"
          className="border-[#E2E8F0]"
        >
          <RefreshCw
            className={`w-4 h-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {/* Cash Flow Forecast */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Cash Flow Forecast (90 Days)</CardTitle>
            {cashFlow && (
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <p className="text-xs text-[#64748B]">Net Position</p>
                  <p
                    className={`text-lg font-mono font-medium ${
                      cashFlow.net_position >= 0
                        ? "text-[#10B981]"
                        : "text-[#EF4444]"
                    }`}
                  >
                    {formatZAR(cashFlow.net_position)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {cashFlowLoading ? (
            <div className="h-80 flex items-center justify-center text-[#64748B]">
              Loading forecast...
            </div>
          ) : cashFlow && cashFlow.data && cashFlow.data.length > 0 ? (
            <div className="space-y-4">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#F0FDF4] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#15803D] font-medium mb-1">
                        Total Cash In
                      </p>
                      <p className="text-xl font-mono font-medium text-[#15803D]">
                        {formatZAR(cashFlow.total_cash_in)}
                      </p>
                    </div>
                    <TrendingUp className="w-8 h-8 text-[#10B981] opacity-50" />
                  </div>
                </div>
                <div className="bg-[#FEF2F2] rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs text-[#B91C1C] font-medium mb-1">
                        Total Cash Out
                      </p>
                      <p className="text-xl font-mono font-medium text-[#B91C1C]">
                        {formatZAR(cashFlow.total_cash_out)}
                      </p>
                    </div>
                    <TrendingDown className="w-8 h-8 text-[#EF4444] opacity-50" />
                  </div>
                </div>
                <div
                  className={`${
                    cashFlow.net_position >= 0 ? "bg-[#EFF6FF]" : "bg-[#FEF2F2]"
                  } rounded-lg p-4`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p
                        className={`text-xs ${
                          cashFlow.net_position >= 0
                            ? "text-[#1E40AF]"
                            : "text-[#B91C1C]"
                        } font-medium mb-1`}
                      >
                        Net Position
                      </p>
                      <p
                        className={`text-xl font-mono font-medium ${
                          cashFlow.net_position >= 0
                            ? "text-[#1E40AF]"
                            : "text-[#B91C1C]"
                        }`}
                      >
                        {formatZAR(cashFlow.net_position)}
                      </p>
                    </div>
                    <DollarSign
                      className={`w-8 h-8 ${
                        cashFlow.net_position >= 0
                          ? "text-[#2563EB]"
                          : "text-[#EF4444]"
                      } opacity-50`}
                    />
                  </div>
                </div>
              </div>

              {/* Chart */}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cashFlow.data}>
                    <defs>
                      <linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis
                      dataKey="week"
                      stroke="#94A3B8"
                      style={{ fontSize: "12px" }}
                    />
                    <YAxis
                      stroke="#94A3B8"
                      style={{ fontSize: "12px" }}
                      tickFormatter={(value) => `R ${(value / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: "12px" }}
                      iconType="circle"
                    />
                    <Area
                      type="monotone"
                      dataKey="cash_in"
                      stroke="#10B981"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorIn)"
                      name="Cash In"
                    />
                    <Area
                      type="monotone"
                      dataKey="cash_out"
                      stroke="#EF4444"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#colorOut)"
                      name="Cash Out"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-80 flex items-center justify-center text-[#64748B]">
              No forecast data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* AI Recommendations */}
      <Card className="border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <CardHeader>
          <CardTitle className="text-lg">AI Recommendations</CardTitle>
        </CardHeader>
        <CardContent>
          {insightsLoading ? (
            <div className="text-[#64748B]">Loading insights...</div>
          ) : sortedInsights && sortedInsights.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {sortedInsights.map((insight) => (
                <Card
                  key={insight.id}
                  className="border border-[#E2E8F0] hover:shadow-md transition-shadow"
                >
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      {/* Severity Indicator */}
                      <div className="flex-shrink-0 pt-1">
                        <span className="text-2xl">
                          {getSeverityIcon(insight.severity)}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge
                              className={`${getCategoryColor(
                                insight.category
                              )} hover:${getCategoryColor(insight.category)}`}
                            >
                              {getCategoryIcon(insight.category)}
                              <span className="ml-1">{insight.category}</span>
                            </Badge>
                            <Badge
                              variant="outline"
                              className={`${getSeverityColor(
                                insight.severity
                              )} border-current`}
                            >
                              {insight.severity.toUpperCase()}
                            </Badge>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-base font-semibold text-[#0F172A] mb-1">
                            {insight.title}
                          </h3>
                          <p className="text-sm text-[#64748B]">
                            {insight.description}
                          </p>
                        </div>

                        <div className="flex items-start gap-2 bg-[#F8FAFC] rounded-lg p-3">
                          <CheckCircle className="w-4 h-4 text-[#2563EB] flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-medium text-[#0F172A] mb-1">
                              Suggested Action:
                            </p>
                            <p className="text-sm text-[#64748B]">
                              {insight.suggested_action}
                            </p>
                          </div>
                        </div>

                        <div className="flex justify-end pt-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-[#2563EB] hover:text-[#1D4ED8] hover:bg-[#EFF6FF]"
                          >
                            View Details
                            <ArrowRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-[#2563EB]" />
              </div>
              <p className="text-sm font-medium text-[#0F172A] mb-1">
                All caught up!
              </p>
              <p className="text-sm text-[#64748B]">
                No new insights at the moment. Check back later for AI-powered
                recommendations.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
