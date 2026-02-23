import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Check, Clock, TrendingUp, FileText } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import useFetch from "@/hooks/useFetch";
import { formatZAR } from "@/lib/constants";
import { RiskScoreCard } from "@/components/capital/RiskScoreCard";

interface AdvanceDetail {
  id: string;
  invoice_id: string;
  invoice_number: string;
  customer_name: string;
  gross_amount: number;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  status: string;
  created_at: string;
  scored_at: string | null;
  approved_at: string | null;
  disbursed_at: string | null;
  settled_at: string | null;
  risk_score: {
    score: number;
    tier: string;
    factors: Array<{
      name: string;
      score: number;
      max: number;
    }>;
  };
  invoice_details: {
    invoice_date: string;
    due_date: string;
    total_amount: number;
  };
  facility_impact: {
    utilization_before: number;
    utilization_after: number;
  };
  fee_breakdown: {
    base_fee: number;
    adjustments: Array<{
      name: string;
      amount: number;
    }>;
    final_fee: number;
  };
}

const getStatusColor = (status: string) => {
  switch (status.toUpperCase()) {
    case 'ELIGIBLE':
      return 'bg-slate-50 text-slate-700 border-slate-200';
    case 'REQUESTED':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'APPROVED':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'DISBURSED':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'SETTLED':
      return 'bg-slate-50 text-slate-600 border-slate-200';
    case 'DENIED':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-slate-50 text-slate-700 border-slate-200';
  }
};

export default function AdvanceDetail() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useFetch<AdvanceDetail>(
    `/api/v1/advances/${id}/`
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-[#64748B]">Loading advance details...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-red-600">Error loading advance details</div>
        </div>
      </div>
    );
  }

  const timelineSteps = [
    {
      label: 'Requested',
      date: data.created_at,
      completed: !!data.created_at,
      icon: FileText,
    },
    {
      label: 'Scored',
      date: data.scored_at,
      completed: !!data.scored_at,
      icon: TrendingUp,
    },
    {
      label: 'Approved',
      date: data.approved_at,
      completed: !!data.approved_at,
      icon: Check,
    },
    {
      label: 'Disbursed',
      date: data.disbursed_at,
      completed: !!data.disbursed_at,
      icon: Check,
    },
    {
      label: 'Settled',
      date: data.settled_at,
      completed: !!data.settled_at,
      icon: Check,
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate('/capital')}
          className="gap-2 mb-4 -ml-3 text-[#64748B] hover:text-[#0F172A]"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Capital
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0F172A]">
              Advance #{data.id}
            </h1>
            <p className="text-[#64748B] mt-1">
              Created {new Date(data.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(data.status)} border font-medium text-base px-4 py-2`}>
              {data.status}
            </Badge>
            <div className="text-right">
              <p className="text-sm text-[#64748B]">Net Amount</p>
              <p className="text-2xl font-mono font-bold text-[#2563EB]">
                {formatZAR(data.net_amount)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 space-y-6">
          {/* Risk Score Card */}
          <RiskScoreCard
            score={data.risk_score.score}
            tier={data.risk_score.tier}
            factors={data.risk_score.factors}
          />

          {/* Invoice Details */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Invoice Number
                </p>
                <p className="text-sm font-mono text-[#0F172A] mt-1">
                  {data.invoice_number}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Customer
                </p>
                <p className="text-sm text-[#0F172A] mt-1">
                  {data.customer_name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Invoice Date
                </p>
                <p className="text-sm text-[#0F172A] mt-1">
                  {new Date(data.invoice_details.invoice_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Due Date
                </p>
                <p className="text-sm text-[#0F172A] mt-1">
                  {new Date(data.invoice_details.due_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium text-[#64748B] uppercase tracking-wide">
                  Invoice Amount
                </p>
                <p className="text-sm font-mono text-[#0F172A] mt-1">
                  {formatZAR(data.invoice_details.total_amount)}
                </p>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-6">
              Timeline
            </h3>
            <div className="space-y-6">
              {timelineSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="relative">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          step.completed
                            ? 'bg-[#2563EB] text-white'
                            : 'bg-slate-200 text-slate-400'
                        }`}
                      >
                        {step.completed ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      {index < timelineSteps.length - 1 && (
                        <div
                          className={`absolute left-5 top-10 w-0.5 h-8 ${
                            step.completed ? 'bg-[#2563EB]' : 'bg-slate-200'
                          }`}
                        />
                      )}
                    </div>
                    <div className="flex-1 pt-2">
                      <p className={`font-medium ${
                        step.completed ? 'text-[#0F172A]' : 'text-[#64748B]'
                      }`}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-sm text-[#64748B] mt-1">
                          {new Date(step.date).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right Column (1/3) */}
        <div className="space-y-6">
          {/* Fee Breakdown */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">
              Fee Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Base Fee</span>
                <span className="text-[#0F172A] font-mono">
                  {data.fee_breakdown.base_fee.toFixed(2)}%
                </span>
              </div>
              {data.fee_breakdown.adjustments.map((adj, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span className="text-[#64748B]">{adj.name}</span>
                  <span className={`font-mono ${
                    adj.amount >= 0 ? 'text-red-600' : 'text-green-600'
                  }`}>
                    {adj.amount >= 0 ? '+' : ''}{adj.amount.toFixed(2)}%
                  </span>
                </div>
              ))}
              <div className="pt-3 border-t border-slate-200 flex justify-between">
                <span className="font-semibold text-[#0F172A]">Final Fee</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {data.fee_breakdown.final_fee.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>

          {/* Amount Summary */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">
              Amount Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Gross Amount</span>
                <span className="text-[#0F172A] font-mono">
                  {formatZAR(data.gross_amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Fee ({data.fee_percent.toFixed(2)}%)</span>
                <span className="text-red-600 font-mono">
                  -{formatZAR(data.fee_amount)}
                </span>
              </div>
              <div className="pt-3 border-t border-slate-200 flex justify-between">
                <span className="font-semibold text-[#0F172A]">Net Amount</span>
                <span className="font-mono font-bold text-[#2563EB] text-lg">
                  {formatZAR(data.net_amount)}
                </span>
              </div>
            </div>
          </Card>

          {/* Facility Impact */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold text-[#0F172A] mb-4">
              Facility Impact
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#64748B]">Before</span>
                  <span className="text-[#0F172A] font-mono">
                    {data.facility_impact.utilization_before.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className="bg-slate-400 h-2 rounded-full"
                    style={{ width: `${data.facility_impact.utilization_before}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[#64748B]">After</span>
                  <span className="text-[#0F172A] font-mono">
                    {data.facility_impact.utilization_after.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full bg-slate-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      data.facility_impact.utilization_after >= 90
                        ? 'bg-red-500'
                        : data.facility_impact.utilization_after >= 75
                        ? 'bg-amber-500'
                        : 'bg-[#2563EB]'
                    }`}
                    style={{ width: `${data.facility_impact.utilization_after}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
