import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import {
  Download,
  TrendingUp,
  TrendingDown,
  BarChart3,
  DollarSign,
  Users,
  Activity,
  Truck
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line
} from "recharts";
import { formatZAR } from "@/lib/constants";

// Mock data for institutional-grade reports
const mockPortfolioRiskData = {
  riskDistribution: [
    { tier: "PRIME", count: 45, value: 3250000, color: "#10B981" },
    { tier: "STANDARD", count: 78, value: 4890000, color: "#2563EB" },
    { tier: "ELEVATED", count: 34, value: 1820000, color: "#F59E0B" },
    { tier: "HIGH", count: 12, value: 450000, color: "#EF4444" },
  ],
  concentration: [
    { customer: "Shoprite Logistics", exposure: 2450000, percentage: 23.5 },
    { customer: "Tiger Brands", exposure: 1890000, percentage: 18.1 },
    { customer: "PepsiCo SA", exposure: 1420000, percentage: 13.6 },
    { customer: "Bidvest Freight", exposure: 1150000, percentage: 11.0 },
    { customer: "Massmart", exposure: 980000, percentage: 9.4 },
    { customer: "Others", exposure: 2520000, percentage: 24.4 },
  ],
  vintageAnalysis: [
    { cohort: "Jan 2024", default_rate: 1.2, volume: 890000 },
    { cohort: "Feb 2024", default_rate: 0.8, volume: 1120000 },
    { cohort: "Mar 2024", default_rate: 1.5, volume: 980000 },
    { cohort: "Apr 2024", default_rate: 0.6, volume: 1340000 },
    { cohort: "May 2024", default_rate: 0.9, volume: 1180000 },
    { cohort: "Jun 2024", default_rate: 0.4, volume: 1450000 },
  ]
};

const mockCashFlowData = {
  actualVsPredicted: [
    { month: "Jan", actual: 1250000, predicted: 1180000 },
    { month: "Feb", actual: 1420000, predicted: 1390000 },
    { month: "Mar", actual: 1180000, predicted: 1220000 },
    { month: "Apr", actual: 1580000, predicted: 1540000 },
    { month: "May", actual: 1690000, predicted: 1650000 },
    { month: "Jun", actual: 1520000, predicted: 1590000 },
  ],
  dsoTrend: [
    { month: "Jan", dso: 42 },
    { month: "Feb", dso: 38 },
    { month: "Mar", dso: 41 },
    { month: "Apr", dso: 35 },
    { month: "May", dso: 34 },
    { month: "Jun", dso: 32 },
  ],
  collectionEfficiency: 94.3,
  avgDSO: 37,
  avgDSOChange: -12.5,
};

const mockCustomerData = {
  customerRanking: [
    { customer: "Shoprite Logistics", risk_score: 88, avg_days: 28, exposure: 2450000, payment_trend: "improving" },
    { customer: "Tiger Brands", risk_score: 82, avg_days: 32, exposure: 1890000, payment_trend: "stable" },
    { customer: "PepsiCo SA", risk_score: 79, avg_days: 35, exposure: 1420000, payment_trend: "stable" },
    { customer: "Bidvest Freight", risk_score: 71, avg_days: 42, exposure: 1150000, payment_trend: "declining" },
    { customer: "Massmart", risk_score: 85, avg_days: 30, exposure: 980000, payment_trend: "improving" },
  ],
  paymentHeatmap: [
    { customer: "Shoprite", week1: 95, week2: 90, week3: 88, week4: 92 },
    { customer: "Tiger Brands", week1: 85, week2: 82, week3: 85, week4: 80 },
    { customer: "PepsiCo", week1: 80, week2: 78, week3: 82, week4: 75 },
    { customer: "Bidvest", week1: 70, week2: 72, week3: 68, week4: 70 },
  ]
};

const mockAdvanceData = {
  volumeByMonth: [
    { month: "Jan", volume: 890000, count: 45, avg_fee: 2.3 },
    { month: "Feb", volume: 1120000, count: 58, avg_fee: 2.2 },
    { month: "Mar", volume: 980000, count: 51, avg_fee: 2.4 },
    { month: "Apr", volume: 1340000, count: 67, avg_fee: 2.1 },
    { month: "May", volume: 1180000, count: 62, avg_fee: 2.2 },
    { month: "Jun", volume: 1450000, count: 72, avg_fee: 2.0 },
  ],
  feeIncome: 142500,
  defaultRate: 0.8,
  avgDaysToSettlement: 28,
};

const mockOperationalData = {
  revenuePerKm: [
    { corridor: "JHB-DBN", revenue_km: 18.5, volume: 2340000, margin: 22.3 },
    { corridor: "JHB-CPT", revenue_km: 22.3, volume: 3120000, margin: 18.7 },
    { corridor: "DBN-CPT", revenue_km: 20.1, volume: 1890000, margin: 20.1 },
    { corridor: "JHB-PE", revenue_km: 19.8, volume: 1450000, margin: 21.5 },
    { corridor: "Gauteng Local", revenue_km: 15.2, volume: 980000, margin: 25.8 },
  ],
  marginsByCustomer: [
    { customer: "Shoprite", margin: 21.2 },
    { customer: "Tiger Brands", margin: 19.5 },
    { customer: "PepsiCo", margin: 22.8 },
    { customer: "Bidvest", margin: 17.3 },
    { customer: "Massmart", margin: 20.1 },
  ]
};

export default function FinanceReports() {
  const [dateRange, setDateRange] = useState("last_3_months");
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");

  const handleExportCSV = () => {
    // CSV export stub
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#0F172A]">Reports</h1>
          <p className="text-sm text-[#475569] mt-1">
            Institutional-grade analytics for your portfolio
          </p>
        </div>
        <div className="flex gap-3">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Date Range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="last_month">Last Month</SelectItem>
              <SelectItem value="last_3_months">Last 3 Months</SelectItem>
              <SelectItem value="last_6_months">Last 6 Months</SelectItem>
              <SelectItem value="ytd">Year to Date</SelectItem>
              <SelectItem value="last_year">Last Year</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Report Tabs */}
      <Tabs defaultValue="portfolio" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="portfolio">Portfolio Risk</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="customer">Customer/Debtor</TabsTrigger>
          <TabsTrigger value="advance">Advance Performance</TabsTrigger>
          <TabsTrigger value="operational">Operational</TabsTrigger>
        </TabsList>

        {/* Portfolio Risk Report */}
        <TabsContent value="portfolio" className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Total Portfolio
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {formatZAR(10410000)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">8.2%</span>
                  <span className="text-xs text-[#94A3B8]">vs last period</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Avg Risk Score
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  78
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">3.5pts</span>
                  <span className="text-xs text-[#94A3B8]">improving</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Default Rate
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  0.9%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">0.3%</span>
                  <span className="text-xs text-[#94A3B8]">improvement</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Active Invoices
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  169
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#2563EB]" size={14} />
                  <span className="text-xs font-medium text-[#475569]">12</span>
                  <span className="text-xs text-[#94A3B8]">new this week</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Risk Distribution Chart */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#0F172A]">Risk Distribution</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
                >
                  {viewMode === "chart" ? "View Table" : "View Chart"}
                </Button>
              </div>

              {viewMode === "chart" ? (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mockPortfolioRiskData.riskDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="tier" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                    <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'white',
                        border: '1px solid #E2E8F0',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar dataKey="count" name="Count">
                      {mockPortfolioRiskData.riskDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-[#F8FAFC]">
                        <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-left py-3 px-4">Tier</th>
                        <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Count</th>
                        <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Value</th>
                        <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mockPortfolioRiskData.riskDistribution.map((row, idx) => (
                        <tr key={idx} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                          <td className="py-3.5 px-4 text-sm">
                            <span className="inline-flex items-center gap-2">
                              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: row.color }}></span>
                              {row.tier}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">{row.count}</td>
                          <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">{formatZAR(row.value)}</td>
                          <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">
                            {((row.value / 10410000) * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </Card>

          {/* Concentration Analysis */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Customer Concentration</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={mockPortfolioRiskData.concentration}
                    dataKey="exposure"
                    nameKey="customer"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={(entry) => `${entry.percentage}%`}
                  >
                    {mockPortfolioRiskData.concentration.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={["#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#64748B"][index % 6]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => formatZAR(value)}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Vintage Analysis */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Vintage Analysis</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockPortfolioRiskData.vintageAnalysis}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="cohort" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                  />
                  <Line type="monotone" dataKey="default_rate" stroke="#EF4444" strokeWidth={2} name="Default Rate %" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Cash Flow Report */}
        <TabsContent value="cashflow" className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  DSO (Days)
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {mockCashFlowData.avgDSO}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">{Math.abs(mockCashFlowData.avgDSOChange)}%</span>
                  <span className="text-xs text-[#94A3B8]">improvement</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Collection Efficiency
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {mockCashFlowData.collectionEfficiency}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">2.1%</span>
                  <span className="text-xs text-[#94A3B8]">vs target</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Prediction Accuracy
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  96.3%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-[#94A3B8]">±3.2 days avg</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Total Collected
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {formatZAR(8640000)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">15.2%</span>
                  <span className="text-xs text-[#94A3B8]">vs last period</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Actual vs Predicted */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Actual vs Predicted Cash Flow</h3>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={mockCashFlowData.actualVsPredicted}>
                  <defs>
                    <linearGradient id="colorActual" x1="0" y1="0" x2="0" y2="1">
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
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => formatZAR(value)}
                  />
                  <Area type="monotone" dataKey="predicted" stroke="#2563EB" fillOpacity={1} fill="url(#colorActual)" name="Predicted" />
                  <Line type="monotone" dataKey="actual" stroke="#10B981" strokeWidth={2} name="Actual" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* DSO Trend */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">DSO Trend</h3>
              <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={mockCashFlowData.dsoTrend}>
                  <defs>
                    <linearGradient id="colorDSO" x1="0" y1="0" x2="0" y2="1">
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
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="dso" stroke="#2563EB" strokeWidth={2} fillOpacity={1} fill="url(#colorDSO)" name="DSO (days)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Customer/Debtor Report */}
        <TabsContent value="customer" className="space-y-6">
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Customer Risk Ranking</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-left py-3 px-4">Customer</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Risk Score</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Avg Days</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Exposure</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-center py-3 px-4">Trend</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockCustomerData.customerRanking.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                        <td className="py-3.5 px-4 text-sm">{row.customer}</td>
                        <td className="py-3.5 px-4 text-sm text-right">
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                            row.risk_score >= 85 ? 'bg-[#D1FAE5] text-[#10B981]' :
                            row.risk_score >= 70 ? 'bg-[#DBEAFE] text-[#2563EB]' :
                            'bg-[#FEF3C7] text-[#F59E0B]'
                          }`}>
                            {row.risk_score}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">{row.avg_days}</td>
                        <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">{formatZAR(row.exposure)}</td>
                        <td className="py-3.5 px-4 text-sm text-center">
                          {row.payment_trend === "improving" && <TrendingUp className="inline text-[#10B981]" size={16} />}
                          {row.payment_trend === "declining" && <TrendingDown className="inline text-[#EF4444]" size={16} />}
                          {row.payment_trend === "stable" && <Activity className="inline text-[#64748B]" size={16} />}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Advance Performance Report */}
        <TabsContent value="advance" className="space-y-6">
          {/* KPI Strip */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Total Advanced
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {formatZAR(6360000)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingUp className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">18.3%</span>
                  <span className="text-xs text-[#94A3B8]">vs last period</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Fee Income
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {formatZAR(mockAdvanceData.feeIncome)}
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-[#94A3B8]">2.24% avg rate</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Default Rate
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {mockAdvanceData.defaultRate}%
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <TrendingDown className="text-[#10B981]" size={14} />
                  <span className="text-xs font-medium text-[#10B981]">0.2%</span>
                  <span className="text-xs text-[#94A3B8]">improvement</span>
                </div>
              </div>
            </Card>

            <Card className="border border-[#E2E8F0] shadow-none">
              <div className="p-5">
                <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
                  Avg Settlement
                </p>
                <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
                  {mockAdvanceData.avgDaysToSettlement}d
                </p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-xs text-[#94A3B8]">vs 30d terms</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Volume by Month */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Advance Volume & Fee Income</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockAdvanceData.volumeByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis dataKey="month" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                  <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                    formatter={(value: any) => formatZAR(value)}
                  />
                  <Bar dataKey="volume" fill="#2563EB" name="Volume" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>

        {/* Operational Report */}
        <TabsContent value="operational" className="space-y-6">
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Revenue per KM by Corridor</h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8FAFC]">
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-left py-3 px-4">Corridor</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Revenue/km</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Total Volume</th>
                      <th className="text-xs uppercase tracking-wider text-[#94A3B8] font-medium text-right py-3 px-4">Margin %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mockOperationalData.revenuePerKm.map((row, idx) => (
                      <tr key={idx} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC] transition">
                        <td className="py-3.5 px-4 text-sm">{row.corridor}</td>
                        <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">
                          {formatZAR(row.revenue_km, false)}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">
                          {formatZAR(row.volume)}
                        </td>
                        <td className="py-3.5 px-4 text-sm text-right font-mono tabular-nums">
                          {row.margin.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Card>

          {/* Margins by Customer */}
          <Card className="border border-[#E2E8F0] shadow-none">
            <div className="p-6">
              <h3 className="text-lg font-semibold text-[#0F172A] mb-4">Margin Analysis by Customer</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={mockOperationalData.marginsByCustomer} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                  <XAxis type="number" stroke="#94A3B8" style={{ fontSize: '12px' }} />
                  <YAxis dataKey="customer" type="category" stroke="#94A3B8" style={{ fontSize: '12px' }} width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'white',
                      border: '1px solid #E2E8F0',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar dataKey="margin" fill="#10B981" name="Margin %" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
