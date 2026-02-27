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
    `/api/advances/${id}/`
  );

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div style={{ color: 'var(--text-secondary)' }}>Loading advance details...</div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-8">
        <div className="flex items-center justify-center h-64">
          <div style={{ color: 'var(--status-danger)' }}>Error loading advance details</div>
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
          className="gap-2 mb-4 -ml-3"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Capital
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>
              Advance #{data.id}
            </h1>
            <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
              Created {new Date(data.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge className={`${getStatusColor(data.status)} border font-medium text-base px-4 py-2`}>
              {data.status}
            </Badge>
            <div className="text-right">
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Net Amount</p>
              <p className="text-2xl font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
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
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Invoice Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Invoice Number
                </p>
                <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                  {data.invoice_number}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Customer
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {data.customer_name}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Invoice Date
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {new Date(data.invoice_details.invoice_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Due Date
                </p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-primary)' }}>
                  {new Date(data.invoice_details.due_date).toLocaleDateString()}
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                  Invoice Amount
                </p>
                <p className="text-sm font-mono mt-1" style={{ color: 'var(--text-primary)' }}>
                  {formatZAR(data.invoice_details.total_amount)}
                </p>
              </div>
            </div>
          </Card>

          {/* Timeline */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
              Timeline
            </h3>
            <div className="space-y-6">
              {timelineSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div key={index} className="flex items-start gap-4">
                    <div className="relative">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center"
                        style={{
                          background: step.completed ? 'var(--accent-primary)' : 'var(--border-subtle)',
                          color: step.completed ? 'white' : 'var(--text-tertiary)'
                        }}
                      >
                        {step.completed ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                      {index < timelineSteps.length - 1 && (
                        <div
                          className="absolute left-5 top-10 w-0.5 h-8"
                          style={{ background: step.completed ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
                        />
                      )}
                    </div>
                    <div className="flex-1 pt-2">
                      <p className="font-medium" style={{ color: step.completed ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
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
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Fee Breakdown
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Base Fee</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {data.fee_breakdown.base_fee.toFixed(2)}%
                </span>
              </div>
              {data.fee_breakdown.adjustments.map((adj, index) => (
                <div key={index} className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>{adj.name}</span>
                  <span className="font-mono" style={{ color: adj.amount >= 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                    {adj.amount >= 0 ? '+' : ''}{adj.amount.toFixed(2)}%
                  </span>
                </div>
              ))}
              <div className="pt-3 border-t flex justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Final Fee</span>
                <span className="font-mono font-bold" style={{ color: 'var(--text-primary)' }}>
                  {data.fee_breakdown.final_fee.toFixed(2)}%
                </span>
              </div>
            </div>
          </Card>

          {/* Amount Summary */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Amount Summary
            </h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Gross Amount</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                  {formatZAR(data.gross_amount)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Fee ({data.fee_percent.toFixed(2)}%)</span>
                <span className="font-mono" style={{ color: 'var(--status-danger)' }}>
                  -{formatZAR(data.fee_amount)}
                </span>
              </div>
              <div className="pt-3 border-t flex justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Net Amount</span>
                <span className="font-mono font-bold text-lg" style={{ color: 'var(--accent-primary)' }}>
                  {formatZAR(data.net_amount)}
                </span>
              </div>
            </div>
          </Card>

          {/* Facility Impact */}
          <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
              Facility Impact
            </h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: 'var(--text-secondary)' }}>Before</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {data.facility_impact.utilization_before.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'var(--border-subtle)' }}>
                  <div
                    className="h-2 rounded-full"
                    style={{ width: `${data.facility_impact.utilization_before}%`, background: 'var(--text-tertiary)' }}
                  />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: 'var(--text-secondary)' }}>After</span>
                  <span className="font-mono" style={{ color: 'var(--text-primary)' }}>
                    {data.facility_impact.utilization_after.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full rounded-full h-2" style={{ background: 'var(--border-subtle)' }}>
                  <div
                    className="h-2 rounded-full"
                    style={{
                      width: `${data.facility_impact.utilization_after}%`,
                      background: data.facility_impact.utilization_after >= 90
                        ? 'var(--status-danger)'
                        : data.facility_impact.utilization_after >= 75
                        ? 'var(--status-warning)'
                        : 'var(--accent-primary)'
                    }}
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
