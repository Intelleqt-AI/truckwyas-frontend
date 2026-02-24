/**
 * TruckWys V3 - Overview/Command Center
 *
 * NOT a generic dashboard. A COMMAND CENTER for fleet operators managing cash flow.
 * Shows: Cash position strip, AI signal cards, portfolio health, cash flow forecast, activity feed
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  FileText,
  ArrowRight,
  Activity,
} from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import { getPortfolioSummary, allInvoices, operators, currentMacroData } from '@/mocks/risk-mock-data';
import { formatCurrency } from '@/lib/formatters';

// ==========================
// TYPES
// ==========================

interface Signal {
  id: string;
  severity: 'critical' | 'warning' | 'opportunity' | 'info';
  category: 'Cash' | 'Risk' | 'Opportunity' | 'Network';
  title: string;
  description: string;
  amount?: number;
  actionLabel?: string;
  actionPath?: string;
}

interface CashFlowDataPoint {
  date: string;
  confirmed: number;
  predicted: number;
  expenses: number;
  net: number;
}

interface ActivityItem {
  id: string;
  timestamp: Date;
  type: 'invoice_generated' | 'advance_requested' | 'payment_received' | 'alert_triggered';
  description: string;
  amount?: number;
  status?: 'success' | 'pending' | 'warning';
}

// ==========================
// MOCK DATA GENERATORS
// ==========================

function generateCashFlowForecast(): CashFlowDataPoint[] {
  const data: CashFlowDataPoint[] = [];
  const startDate = new Date();

  for (let i = 0; i < 90; i += 7) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const confirmed = 250000 + Math.random() * 150000;
    const predicted = 180000 + Math.random() * 120000;
    const expenses = 200000 + Math.random() * 80000;
    const net = confirmed + predicted - expenses;

    data.push({
      date: date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }),
      confirmed,
      predicted,
      expenses,
      net,
    });
  }

  return data;
}

function generateSignals(): Signal[] {
  const portfolio = getPortfolioSummary();
  const eligibleInvoices = allInvoices.filter((inv) => inv.riskScore.isEligible);
  const overdueInvoices = allInvoices.filter(
    (inv) => inv.invoice.daysUntilDue < 0 && inv.riskScore.isEligible
  );

  const totalEligibleAmount = eligibleInvoices.reduce((sum, inv) => sum + inv.invoice.amount, 0);
  const avgFee =
    eligibleInvoices.reduce((sum, inv) => sum + inv.riskScore.finalFeePercent, 0) / eligibleInvoices.length;

  const signals: Signal[] = [];

  // Overdue invoices signal
  if (overdueInvoices.length > 0) {
    const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.invoice.amount, 0);
    signals.push({
      id: 'overdue',
      severity: 'critical',
      category: 'Cash',
      title: `${overdueInvoices.length} invoices overdue`,
      description: `R ${(overdueAmount / 1000).toFixed(0)}k at risk — prioritize collections`,
      amount: overdueAmount,
      actionLabel: 'View overdue',
      actionPath: '/finance/invoices?filter=overdue',
    });
  }

  // Fast pay opportunity
  if (eligibleInvoices.length >= 5) {
    signals.push({
      id: 'fast_pay',
      severity: 'opportunity',
      category: 'Opportunity',
      title: `R ${(totalEligibleAmount / 1000).toFixed(0)}k eligible for early pay`,
      description: `${eligibleInvoices.length} invoices at ${avgFee.toFixed(1)}% average fee`,
      amount: totalEligibleAmount,
      actionLabel: 'Request advances',
      actionPath: '/capital',
    });
  }

  // Fuel price warning
  if (currentMacroData.fuelPriceTrend3Mo === 'rising') {
    signals.push({
      id: 'fuel_prices',
      severity: 'warning',
      category: 'Risk',
      title: 'Fuel prices rising — margin impact',
      description: '3-month upward trend affecting 12 active trips',
      actionLabel: 'View routes',
      actionPath: '/fleet',
    });
  }

  // Cross-platform intelligence
  const latePayingCustomers = allInvoices.filter(
    (inv) => inv.customer.debtorCredit.hasCrossOperatorLatePaymentFlag
  );
  if (latePayingCustomers.length > 0) {
    const uniqueCustomers = new Set(latePayingCustomers.map((inv) => inv.customer.customerName));
    signals.push({
      id: 'cross_platform',
      severity: 'warning',
      category: 'Network',
      title: `${uniqueCustomers.size} customers flagged on network`,
      description: 'Late payments to other operators — monitor closely',
      actionLabel: 'View customers',
      actionPath: '/finance/reports?tab=customer',
    });
  }

  return signals.slice(0, 4); // Max 4 signals
}

function generateRecentActivity(): ActivityItem[] {
  const now = new Date();
  const activities: ActivityItem[] = [];

  // Recent invoices
  const recentInvoices = [...allInvoices]
    .sort((a, b) => a.invoice.ageInDays - b.invoice.ageInDays)
    .slice(0, 5);

  recentInvoices.forEach((inv, idx) => {
    const timestamp = new Date(now);
    timestamp.setHours(timestamp.getHours() - (idx + 1) * 2);

    activities.push({
      id: `inv-${inv.invoice.invoiceId}`,
      timestamp,
      type: 'invoice_generated',
      description: `Invoice ${inv.invoice.invoiceId} generated for ${inv.customer.customerName}`,
      amount: inv.invoice.amount,
      status: 'success',
    });
  });

  return activities.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, 10);
}

// ==========================
// HELPER FUNCTIONS
// ==========================

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

// ==========================
// MAIN COMPONENT
// ==========================

export default function Overview() {
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState('Good morning');
  const [user] = useState({ username: 'Dennis' }); // Mock user

  const portfolio = getPortfolioSummary();
  const cashFlowData = generateCashFlowForecast();
  const signals = generateSignals();
  const recentActivity = generateRecentActivity();

  // Mock cash position calculations
  const currentOperator = operators[0]; // TransNamib
  const cashAvailable = 1250000;
  const expectedIn7d = 420000;
  const expectedIn30d = 1850000;
  const expectedOut30d = 1200000;
  const advanceAvailable = currentOperator.facilityLimit * (1 - currentOperator.clientFinancial.advanceUtilizationRate / 100);

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 18) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const currentDate = new Date().toLocaleDateString('en-ZA', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });


  const getSeverityIcon = (severity: Signal['severity']) => {
    switch (severity) {
      case 'critical':
        return <AlertCircle className="w-5 h-5 text-[#EF4444]" />;
      case 'warning':
        return <Clock className="w-5 h-5 text-[#F59E0B]" />;
      case 'opportunity':
        return <TrendingUp className="w-5 h-5 text-[#10B981]" />;
      case 'info':
        return <CheckCircle className="w-5 h-5 text-[#2563EB]" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-[#0F172A]">
          {greeting}, {user.username}
        </h1>
        <p className="text-sm text-[#475569]">{currentDate}</p>
      </div>

      {/* Cash Position Strip */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Cash Available Now</p>
            <p className="text-2xl font-semibold text-[#0F172A] mt-1 font-mono tabular-nums">
              {formatCurrency(cashAvailable)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">Bank balance</p>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Expected In (7d)</p>
            <p className="text-2xl font-semibold text-[#10B981] mt-1 font-mono tabular-nums">
              {formatCurrency(expectedIn7d)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">Predicted inflow</p>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Expected In (30d)</p>
            <p className="text-2xl font-semibold text-[#10B981] mt-1 font-mono tabular-nums">
              {formatCurrency(expectedIn30d)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">30-day forecast</p>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Expected Out (30d)</p>
            <p className="text-2xl font-semibold text-[#EF4444] mt-1 font-mono tabular-nums">
              {formatCurrency(expectedOut30d)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">Scheduled expenses</p>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">Advance Available</p>
            <p className="text-2xl font-semibold text-[#2563EB] mt-1 font-mono tabular-nums">
              {formatCurrency(advanceAvailable)}
            </p>
            <p className="text-xs text-[#64748B] mt-1">
              {currentOperator.clientFinancial.advanceUtilizationRate.toFixed(0)}% facility used
            </p>
          </div>
        </Card>
      </div>

      {/* AI Signal Cards */}
      {signals.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F172A]">AI Signals</h2>
            <Badge variant="outline" className="text-xs bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]">
              AI
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {signals.map((signal) => (
              <Card
                key={signal.id}
                className="border-[#E2E8F0] bg-white rounded-md cursor-pointer hover:bg-[#F8FAFC] transition-colors"
                onClick={() => signal.actionPath && navigate(signal.actionPath)}
              >
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {getSeverityIcon(signal.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] font-semibold bg-white border-[#E2E8F0]"
                        >
                          {signal.category}
                        </Badge>
                      </div>
                      <h3 className="text-sm font-semibold text-[#0F172A] mb-1">{signal.title}</h3>
                      <p className="text-xs text-[#475569]">{signal.description}</p>
                      {signal.actionLabel && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="mt-2 h-7 px-2 text-xs hover:bg-[#F1F5F9]"
                          onClick={(e) => {
                            e.stopPropagation();
                            signal.actionPath && navigate(signal.actionPath);
                          }}
                        >
                          {signal.actionLabel}
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Portfolio Health */}
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F172A]">Portfolio Health Score</h2>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#10B981]" />
              <span className="text-sm font-medium text-[#10B981]">Improving</span>
            </div>
          </div>
          <div className="flex items-end gap-3">
            <p className="text-5xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {portfolio.avgRiskScore}
            </p>
            <p className="text-sm text-[#64748B] mb-2">/ 100</p>
          </div>
          <div className="grid grid-cols-5 gap-2">
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8] mb-1">PRIME</p>
              <p className="text-lg font-semibold text-[#10B981] tabular-nums">
                {portfolio.tierDistribution.prime}
              </p>
              <p className="text-xs text-[#64748B]">
                {((portfolio.tierDistribution.prime / portfolio.totalInvoices) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8] mb-1">STANDARD</p>
              <p className="text-lg font-semibold text-[#2563EB] tabular-nums">
                {portfolio.tierDistribution.standard}
              </p>
              <p className="text-xs text-[#64748B]">
                {((portfolio.tierDistribution.standard / portfolio.totalInvoices) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8] mb-1">ELEVATED</p>
              <p className="text-lg font-semibold text-[#F59E0B] tabular-nums">
                {portfolio.tierDistribution.elevated}
              </p>
              <p className="text-xs text-[#64748B]">
                {((portfolio.tierDistribution.elevated / portfolio.totalInvoices) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8] mb-1">HIGH</p>
              <p className="text-lg font-semibold text-[#EF4444] tabular-nums">
                {portfolio.tierDistribution.high}
              </p>
              <p className="text-xs text-[#64748B]">
                {((portfolio.tierDistribution.high / portfolio.totalInvoices) * 100).toFixed(0)}%
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8] mb-1">INELIGIBLE</p>
              <p className="text-lg font-semibold text-[#64748B] tabular-nums">
                {portfolio.tierDistribution.ineligible}
              </p>
              <p className="text-xs text-[#64748B]">
                {((portfolio.tierDistribution.ineligible / portfolio.totalInvoices) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>
      </Card>

      {/* Cash Flow Forecast Chart */}
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#0F172A]">90-Day Cash Flow Forecast</h2>
            <Badge variant="outline" className="text-xs bg-[#EFF6FF] text-[#2563EB] border-[#2563EB]">
              AI Predicted
            </Badge>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cashFlowData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorConfirmed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10B981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorPredicted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563EB" stopOpacity={0.1} />
                  <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="date" stroke="#94A3B8" style={{ fontSize: '12px' }} />
              <YAxis stroke="#94A3B8" style={{ fontSize: '12px' }} tickFormatter={(val) => formatCurrency(val)} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
                formatter={(value: number) => formatZAR(value)}
              />
              <ReferenceLine y={0} stroke="#94A3B8" strokeDasharray="3 3" />
              <Area
                type="monotone"
                dataKey="confirmed"
                stroke="#10B981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorConfirmed)"
                name="Confirmed"
              />
              <Area
                type="monotone"
                dataKey="predicted"
                stroke="#2563EB"
                strokeWidth={2}
                strokeDasharray="5 5"
                fillOpacity={1}
                fill="url(#colorPredicted)"
                name="Predicted"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Recent Activity + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Recent Activity (2/3 width) */}
        <Card className="border-[#E2E8F0] bg-white rounded-md md:col-span-2">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Recent Activity</h2>
            <div className="space-y-3">
              {recentActivity.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Activity className="h-12 w-12 text-[#CBD5E1] mb-4" />
                  <h3 className="text-lg font-medium text-[#0F172A]">No activity yet</h3>
                  <p className="text-sm text-[#64748B] mt-1 text-center max-w-sm">
                    Activity will appear here as you use the platform
                  </p>
                </div>
              ) : (
                recentActivity.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 pb-3 border-b border-[#F1F5F9] last:border-0 last:pb-0"
                  >
                    <div className="w-2 h-2 rounded-full bg-[#2563EB] mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#0F172A]">{item.description}</p>
                      {item.amount && (
                        <p className="text-sm font-mono tabular-nums text-[#475569] mt-0.5">
                          {formatCurrency(item.amount)}
                        </p>
                      )}
                      <p className="text-xs text-[#94A3B8] mt-1">{getRelativeTime(item.timestamp)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </Card>

        {/* Quick Actions (1/3 width) */}
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-6 space-y-4">
            <h2 className="text-lg font-semibold text-[#0F172A]">Quick Actions</h2>
            <div className="space-y-2">
              <Button
                variant="outline"
                className="w-full justify-start border-[#E2E8F0] hover:bg-[#F8FAFC]"
                onClick={() => navigate('/capital')}
              >
                <DollarSign className="w-4 h-4 mr-2 text-[#10B981]" />
                Request Early Pay
                <Badge variant="secondary" className="ml-auto bg-[#D1FAE5] text-[#10B981]">
                  {portfolio.eligibleCount}
                </Badge>
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-[#E2E8F0] hover:bg-[#F8FAFC]"
                onClick={() => navigate('/finance/invoices')}
              >
                <FileText className="w-4 h-4 mr-2 text-[#2563EB]" />
                View Invoices
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start border-[#E2E8F0] hover:bg-[#F8FAFC]"
                onClick={() => navigate('/finance/reports')}
              >
                <TrendingUp className="w-4 h-4 mr-2 text-[#F59E0B]" />
                View Reports
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
