import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ArrowRight, TrendingUp, Zap, Info } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useFetch from "@/hooks/useFetch";
import { formatCurrency } from "@/lib/formatters";
import { calculateRiskScore, getRiskTier } from "@/lib/risk-engine";
import { MOCK_INVOICES, FACILITY_DATA, getCustomerById } from "@/lib/mock-capital-data";

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
      return 'bg-[#E2E8F0] text-[#64748B] border-0';
    case 'REQUESTED':
      return 'bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20';
    case 'APPROVED':
      return 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/20';
    case 'DISBURSED':
      return 'bg-[#10B981]/5 text-[#10B981] border-[#10B981]/20';
    case 'SETTLED':
      return 'bg-[#E2E8F0] text-[#64748B] border-0';
    case 'DENIED':
      return 'bg-[#EF4444]/5 text-[#EF4444] border-[#EF4444]/20';
    default:
      return 'bg-[#E2E8F0] text-[#64748B] border-0';
  }
};

const getUtilizationColor = (percent: number) => {
  if (percent >= 90) return 'bg-[#EF4444]';
  if (percent >= 75) return 'bg-[#F59E0B]';
  return 'bg-[#2563EB]';
};

export default function Capital() {
  const navigate = useNavigate();

  const { data: apiData, isLoading, error } = useFetch<CapitalDashboard>(
    '/api/dashboard/capital/',
    { retry: false }
  );

  // Generate mock capital dashboard from mock data
  const mockData = useMemo((): CapitalDashboard => {
    const riskScores = MOCK_INVOICES.map(mockInv => {
      const customer = getCustomerById(mockInv.customerId);
      if (!customer) return null;

      try {
        return calculateRiskScore(
          {
            invoiceId: mockInv.id,
            customerId: mockInv.customerId,
            customerName: mockInv.customerName,
            amount: mockInv.amount,
            createdDate: mockInv.createdDate,
            dueDate: mockInv.dueDate,
            status: mockInv.status as any,
            ageInDays: mockInv.ageInDays
          },
          {
            totalInvoices: customer.totalInvoices,
            onTimeCount: customer.onTimeCount,
            avgDaysLate: customer.avgDaysLate,
            hasActiveDispute: customer.hasActiveDispute
          },
          {
            method: mockInv.podMethod,
            allFieldsComplete: mockInv.podComplete,
            hasQualityIssues: mockInv.podQualityIssues
          },
          {
            rating: customer.creditRating,
            hasBankruptcy: customer.hasBankruptcy
          },
          {
            firstTransactionDate: customer.firstTransactionDate,
            transactionCount: customer.totalInvoices
          },
          {
            facilityLimit: FACILITY_DATA.facilityLimit,
            currentOutstanding: FACILITY_DATA.currentOutstanding,
            invoiceAmount: mockInv.amount
          }
        );
      } catch {
        return null;
      }
    }).filter((r): r is NonNullable<typeof r> => r !== null && r.isEligible);

    // Calculate risk distribution
    const distribution = {
      excellent: riskScores.filter(r => r.riskTier === 'excellent').length,
      good: riskScores.filter(r => r.riskTier === 'good').length,
      fair: riskScores.filter(r => r.riskTier === 'fair').length,
      elevated: riskScores.filter(r => r.riskTier === 'elevated').length
    };

    const eligibleTotal = riskScores.reduce((sum, r) => sum + r.netAmount, 0);

    return {
      facility_limit: FACILITY_DATA.facilityLimit,
      available_capital: FACILITY_DATA.facilityLimit - FACILITY_DATA.currentOutstanding,
      outstanding_advances: FACILITY_DATA.currentOutstanding,
      outstanding_count: 5, // Mock
      utilization_percent: FACILITY_DATA.utilizationPercent,
      eligible_invoices_count: riskScores.length,
      eligible_invoices_total: eligibleTotal,
      risk_distribution: distribution,
      recent_advances: [] // Mock empty for now
    };
  }, []);

  const useMockData = error || !apiData;
  const data = useMockData ? mockData : apiData!;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="space-y-4 text-center">
            <div className="animate-spin w-8 h-8 border-2 border-[#2563EB] border-t-transparent rounded-full mx-auto" />
            <p className="text-sm text-[#64748B]">Loading capital dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  const utilizationPercent = data.utilization_percent || 0;
  const hasEligibleInvoices = data.eligible_invoices_count > 0;

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-semibold text-[#0F172A]">Capital</h1>
        <div className="flex items-center gap-2 mt-1">
          <p className="text-sm text-[#64748B]">Manage your working capital and advance requests</p>
          {useMockData && (
            <span className="text-xs bg-[#FEF3C7] text-[#92400E] px-2 py-0.5 rounded-full font-medium">
              Demo Mode
            </span>
          )}
        </div>
      </div>

      {/* Facility Overview - 3 Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Available Capital</div>
            <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {formatCurrency(data.available_capital)}
            </div>
            <div className="text-sm text-[#64748B] mt-1">
              of {formatCurrency(data.facility_limit)} limit
            </div>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Outstanding Advances</div>
            <div className="flex items-baseline gap-2">
              <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
                {formatCurrency(data.outstanding_advances)}
              </div>
              <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">
                {data.outstanding_count}
              </Badge>
            </div>
            <div className="text-sm text-[#64748B] mt-1">Active advances</div>
          </div>
        </Card>

        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-4">
            <div className="text-xs text-[#94A3B8] mb-1">Utilization</div>
            <div className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums">
              {utilizationPercent.toFixed(1)}%
            </div>
            <div className="w-full bg-[#E2E8F0] rounded-full h-2 mt-2">
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
        <Card className="border-[#E2E8F0] bg-white rounded-md">
          <div className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3 flex-1">
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-[#10B981]" />
                  <h3 className="text-lg font-semibold text-[#0F172A]">
                    {data.eligible_invoices_count} invoice{data.eligible_invoices_count !== 1 ? 's' : ''} ready for Fast Pay
                  </h3>
                </div>
                <p className="text-sm text-[#475569]">
                  Get paid today: <span className="font-mono font-semibold text-[#0F172A] tabular-nums">{formatCurrency(data.eligible_invoices_total)}</span> available
                </p>
                <div className="flex items-center gap-4 text-sm text-[#64748B]">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4" />
                    <span>1-2 hour deposit</span>
                  </div>
                  <div>•</div>
                  <div>Verified deliveries</div>
                  <div>•</div>
                  <div>Grow faster</div>
                </div>
              </div>
              <Button
                onClick={() => navigate('/finance/invoices')}
                className="gap-2 shrink-0"
              >
                View Eligible Invoices
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Risk Distribution Chart */}
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-medium text-[#0F172A]">Risk Distribution</h2>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 text-[#2563EB] hover:text-[#1D4ED8]"
                  >
                    <Info className="w-4 h-4" />
                    How it works
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="text-xl font-semibold text-[#0F172A]">
                      How Risk Scores Work
                    </DialogTitle>
                    <DialogDescription className="text-sm text-[#64748B]">
                      Understanding our 6-factor weighted scoring methodology
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-6 mt-4">
                    {/* Overview */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium text-[#0F172A]">Overview</h3>
                      <p className="text-sm text-[#64748B]">
                        Every invoice is evaluated using 6 weighted factors to produce a risk score (0-100).
                        This score determines eligibility, tier classification, and the fee percentage for Fast Pay advances.
                      </p>
                    </div>

                    {/* 6 Factors */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-medium text-[#0F172A]">Scoring Factors</h3>

                      <div className="space-y-3">
                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">1. Customer Payment History</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">35% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            Based on historical on-time payment rate, average days late, and active disputes.
                            Excellent payers (95%+ on-time) score highest. Active disputes result in significant penalties.
                          </p>
                        </div>

                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">2. Invoice Age</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">20% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            Fresh invoices (≤7 days) score highest. Scores decrease as invoices age.
                            Invoices older than 91 days are automatically ineligible.
                          </p>
                        </div>

                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">3. POD Verification Quality</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">15% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            E-signatures with complete fields score best, followed by photo timestamps,
                            driver signatures, and photos. Manual entries score low. No POD = ineligible.
                          </p>
                        </div>

                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">4. Customer Credit Score</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">15% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            D&B PAYDEX or similar credit bureau ratings. A-rated customers score highest.
                            Bankruptcy history = automatic ineligibility. Falls back to payment history if unavailable.
                          </p>
                        </div>

                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">5. Relationship Length</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">10% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            Time since first transaction. Relationships 24+ months score highest.
                            Adjusted for transaction frequency (high volume = bonus, infrequent = penalty).
                          </p>
                        </div>

                        <div className="p-4 bg-[#F8FAFC] rounded-md space-y-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-[#0F172A]">6. Invoice/Facility Ratio</h4>
                            <Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">5% weight</Badge>
                          </div>
                          <p className="text-sm text-[#64748B]">
                            Concentration risk. Invoices representing ≤5% of facility limit score best.
                            Large concentrations (50%+) score lower.
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Tier Thresholds */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">Risk Tiers & Fees</h3>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 border border-[#10B981]/20 rounded-md bg-[#10B981]/5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-[#10B981]" />
                            <h4 className="text-sm font-medium text-[#10B981]">Excellent</h4>
                          </div>
                          <p className="text-sm text-[#0F172A] font-mono tabular-nums mb-1">Score: 85-100</p>
                          <p className="text-xs text-[#64748B]">Fee: 2.0-2.5%</p>
                        </div>

                        <div className="p-4 border border-[#2563EB]/20 rounded-md bg-[#2563EB]/5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-[#2563EB]" />
                            <h4 className="text-sm font-medium text-[#2563EB]">Good</h4>
                          </div>
                          <p className="text-sm text-[#0F172A] font-mono tabular-nums mb-1">Score: 70-84</p>
                          <p className="text-xs text-[#64748B]">Fee: 2.5-3.0%</p>
                        </div>

                        <div className="p-4 border border-[#F59E0B]/20 rounded-md bg-[#F59E0B]/5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                            <h4 className="text-sm font-medium text-[#F59E0B]">Fair</h4>
                          </div>
                          <p className="text-sm text-[#0F172A] font-mono tabular-nums mb-1">Score: 55-69</p>
                          <p className="text-xs text-[#64748B]">Fee: 3.0-3.5%</p>
                        </div>

                        <div className="p-4 border border-[#EF4444]/20 rounded-md bg-[#EF4444]/5">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
                            <h4 className="text-sm font-medium text-[#EF4444]">Elevated</h4>
                          </div>
                          <p className="text-sm text-[#0F172A] font-mono tabular-nums mb-1">Score: 40-54</p>
                          <p className="text-xs text-[#64748B]">Fee: 3.5-4.0%</p>
                        </div>
                      </div>
                    </div>

                    {/* Fee Adjustments */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">Fee Adjustments</h3>
                      <p className="text-sm text-[#64748B]">
                        Base tier fees are adjusted based on specific conditions:
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-[#10B981] font-medium">-0.25%</span>
                          <span className="text-[#64748B]">Fresh invoice (&lt;7 days old)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#10B981] font-medium">-0.25%</span>
                          <span className="text-[#64748B]">Low facility utilization (&lt;25%)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#EF4444] font-medium">+0.25%</span>
                          <span className="text-[#64748B]">Aging invoice (31-45 days)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#EF4444] font-medium">+0.50%</span>
                          <span className="text-[#64748B]">First-time customer (&lt;3 transactions) or aged (46-60 days)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#EF4444] font-medium">+0.75%</span>
                          <span className="text-[#64748B]">Significantly aged invoice (60+ days)</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-[#EF4444] font-medium">+1.0%</span>
                          <span className="text-[#64748B]">Active payment dispute</span>
                        </div>
                      </div>
                      <p className="text-xs text-[#94A3B8] mt-3">
                        Final fees are capped between 0.75% (minimum) and 4.0% (maximum).
                      </p>
                    </div>

                    {/* Ineligibility Rules */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-[#0F172A]">Ineligibility Criteria</h3>
                      <p className="text-sm text-[#64748B]">
                        Invoices are automatically ineligible if ANY of these conditions are met:
                      </p>
                      <ul className="space-y-1 text-sm text-[#64748B]">
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          Risk score below 40
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          Invoice age exceeds 91 days
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          Customer has bankruptcy history
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          Active payment dispute on invoice
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          No Proof of Delivery verified
                        </li>
                        <li className="flex items-start gap-2">
                          <span className="text-[#EF4444]">•</span>
                          Advance would exceed facility limit
                        </li>
                      </ul>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="text-sm text-[#64748B]">
              {data.risk_distribution.excellent + data.risk_distribution.good + data.risk_distribution.fair + data.risk_distribution.elevated} eligible invoices
            </div>
          </div>
          <div className="space-y-3">
            {/* Excellent */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#10B981]" />
                  <span className="text-[#10B981] font-medium">Excellent (2.0-2.5%)</span>
                </div>
                <span className="text-[#0F172A] font-mono tabular-nums">
                  {data.risk_distribution.excellent} invoices
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2">
                <div
                  className="bg-[#10B981] h-2 rounded-full transition-all"
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
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#2563EB]" />
                  <span className="text-[#2563EB] font-medium">Good (2.5-3.0%)</span>
                </div>
                <span className="text-[#0F172A] font-mono tabular-nums">
                  {data.risk_distribution.good} invoices
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2">
                <div
                  className="bg-[#2563EB] h-2 rounded-full transition-all"
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
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
                  <span className="text-[#F59E0B] font-medium">Fair (3.0-3.5%)</span>
                </div>
                <span className="text-[#0F172A] font-mono tabular-nums">
                  {data.risk_distribution.fair} invoices
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2">
                <div
                  className="bg-[#F59E0B] h-2 rounded-full transition-all"
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
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                  <span className="text-[#EF4444] font-medium">Elevated (3.5-4.0%)</span>
                </div>
                <span className="text-[#0F172A] font-mono tabular-nums">
                  {data.risk_distribution.elevated} invoices
                </span>
              </div>
              <div className="w-full bg-[#E2E8F0] rounded-full h-2">
                <div
                  className="bg-[#EF4444] h-2 rounded-full transition-all"
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
      <Card className="border-[#E2E8F0] bg-white rounded-md">
        <div className="p-4">
          <h2 className="text-sm font-medium text-[#0F172A] mb-4">Advance History</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-left py-3 px-4 text-xs text-[#94A3B8]">
                    Date
                  </th>
                  <th className="text-left py-3 px-4 text-xs text-[#94A3B8]">
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-4 text-xs text-[#94A3B8]">
                    Customer
                  </th>
                  <th className="text-right py-3 px-4 text-xs text-[#94A3B8]">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs text-[#94A3B8]">
                    Fee
                  </th>
                  <th className="text-right py-3 px-4 text-xs text-[#94A3B8]">
                    Net Amount
                  </th>
                  <th className="text-center py-3 px-4 text-xs text-[#94A3B8]">
                    Status
                  </th>
                  <th className="text-center py-3 px-4 text-xs text-[#94A3B8]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent_advances.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center">
                      <div className="space-y-2">
                        <p className="text-sm text-[#64748B]">No advances yet</p>
                        <p className="text-sm text-[#94A3B8]">
                          {hasEligibleInvoices
                            ? 'Request your first advance to get started'
                            : 'Complete deliveries with POD to unlock Fast Pay'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  data.recent_advances.map((advance) => (
                    <tr
                      key={advance.id}
                      className="border-b border-[#E2E8F0] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                      onClick={() => navigate(`/capital/advances/${advance.id}`)}
                    >
                      <td className="py-3 px-4 text-sm text-[#64748B]">
                        {new Date(advance.created_at).toLocaleDateString('en-ZA')}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono tabular-nums text-[#2563EB]">
                        {advance.invoice_number}
                      </td>
                      <td className="py-3 px-4 text-sm text-[#0F172A]">
                        {advance.customer_name}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono tabular-nums text-[#0F172A] text-right">
                        {formatCurrency(advance.gross_amount)}
                      </td>
                      <td className="py-3 px-4 text-sm font-mono tabular-nums text-[#64748B] text-right">
                        {advance.fee_percent.toFixed(2)}%
                      </td>
                      <td className="py-3 px-4 text-sm font-medium font-mono tabular-nums text-[#0F172A] text-right">
                        {formatCurrency(advance.net_amount)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={`${getStatusColor(advance.status)} border`}>
                          {advance.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-[#2563EB] hover:text-[#1D4ED8]"
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
