import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import useFetch from "@/hooks/useFetch";
import { usePost } from "@/hooks/usePost";
import { formatZAR, calculateDaysAge } from "@/lib/constants";
import { RiskScoreCard } from "@/components/capital/RiskScoreCard";
import { useToast } from "@/hooks/use-toast";

interface EligibleInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  total_amount: number;
  invoice_date: string;
  due_date: string;
  age_days: number;
}

interface RiskScoreResult {
  score: number;
  tier: string;
  factors: Array<{
    name: string;
    score: number;
    max: number;
  }>;
  fee_percent: number;
  fee_amount: number;
  net_amount: number;
  gross_amount: number;
  estimated_turnaround_days: string;
}

export default function AdvanceRequest() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [riskScore, setRiskScore] = useState<RiskScoreResult | null>(null);

  // Fetch eligible invoices
  const { data: invoices, isLoading: loadingInvoices } = useFetch<EligibleInvoice[]>(
    '/api/invoices/?early_pay_eligible=true'
  );

  // Risk score mutation
  const { mutate: scoreInvoice, isPending: scoring } = usePost({
    onSuccess: (data) => {
      setRiskScore(data);
      setStep(2);
    },
    onError: (error: any) => {
      toast({
        title: "Risk Scoring Failed",
        description: error?.response?.data?.detail || "Could not score this invoice. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Advance request mutation
  const { mutate: requestAdvance, isPending: requesting } = usePost({
    onSuccess: (data) => {
      toast({
        title: "Advance Requested",
        description: "Your early payment request has been submitted successfully.",
      });
      navigate('/capital');
    },
    onError: (error: any) => {
      toast({
        title: "Request Failed",
        description: error?.response?.data?.detail || "Could not submit your request. Please try again.",
        variant: "destructive",
      });
    }
  });

  const selectedInvoice = invoices?.find(inv => inv.id === selectedInvoiceId);

  const handleSelectInvoice = (invoiceId: string) => {
    setSelectedInvoiceId(invoiceId);
  };

  const handleGetRiskScore = () => {
    if (!selectedInvoiceId) return;
    scoreInvoice({
      url: '/api/risk/score/',
      data: { invoice_id: selectedInvoiceId }
    });
  };

  const handleConfirmRequest = () => {
    if (!selectedInvoiceId) return;
    requestAdvance({
      url: '/api/advances/',
      data: { invoice_id: selectedInvoiceId }
    });
  };

  const renderStep1 = () => (
    <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Select Invoice</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Choose an eligible invoice to request early payment
        </p>

        {loadingInvoices ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--accent-primary)' }} />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="py-12 text-center" style={{ color: 'var(--text-secondary)' }}>
            No eligible invoices found. Check back later.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                  <th className="w-12 py-3 px-4"></th>
                  <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Customer
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Age (days)
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className="border-b last:border-0 cursor-pointer transition-colors"
                    style={{
                      borderColor: 'var(--border-subtle)',
                      background: selectedInvoiceId === invoice.id ? 'var(--accent-dim)' : 'transparent'
                    }}
                    onClick={() => handleSelectInvoice(invoice.id)}
                  >
                    <td className="py-3 px-4">
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center"
                        style={{
                          borderColor: selectedInvoiceId === invoice.id ? 'var(--accent-primary)' : 'var(--border-subtle)',
                          background: selectedInvoiceId === invoice.id ? 'var(--accent-primary)' : 'transparent'
                        }}
                      >
                        {selectedInvoiceId === invoice.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono" style={{ color: 'var(--accent-primary)' }}>
                      {invoice.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-sm" style={{ color: 'var(--text-primary)' }}>
                      {invoice.customer_name}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-right" style={{ color: 'var(--text-primary)' }}>
                      {formatZAR(invoice.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-right" style={{ color: 'var(--text-secondary)' }}>
                      {invoice.age_days || calculateDaysAge(invoice.invoice_date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(invoice.due_date).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => navigate('/capital')}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Capital
          </Button>
          <Button
            onClick={handleGetRiskScore}
            disabled={!selectedInvoiceId || scoring}
            className="gap-2"
            style={{ background: 'var(--accent-primary)' }}
          >
            {scoring ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Calculating...
              </>
            ) : (
              <>
                Continue to Risk Score
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    </Card>
  );

  const renderStep2 = () => {
    if (!riskScore || !selectedInvoice) return null;

    return (
      <div className="space-y-6">
        {/* Selected Invoice Info */}
        <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                {selectedInvoice.invoice_number}
              </h3>
              <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                {selectedInvoice.customer_name} • {formatZAR(selectedInvoice.total_amount)}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep(1);
                setRiskScore(null);
              }}
              style={{ color: 'var(--text-secondary)' }}
            >
              Change Invoice
            </Button>
          </div>
        </Card>

        {/* Risk Score Card */}
        <RiskScoreCard
          score={riskScore.score}
          tier={riskScore.tier}
          factors={riskScore.factors}
          fee={riskScore.fee_percent}
          feeAmount={riskScore.fee_amount}
          netAmount={riskScore.net_amount}
        />

        {/* Estimated Turnaround */}
        <Card className="p-6 bg-gradient-to-r from-green-50 to-white border border-green-200 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <Check className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Estimated Turnaround
              </p>
              <p className="text-2xl font-bold text-green-600 mt-1">
                {riskScore.estimated_turnaround_days}
              </p>
            </div>
          </div>
        </Card>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => {
              setStep(1);
              setRiskScore(null);
            }}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={() => setStep(3)}
            className="gap-2"
            style={{ background: 'var(--accent-primary)' }}
          >
            Continue to Confirm
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    );
  };

  const renderStep3 = () => {
    if (!riskScore || !selectedInvoice) return null;

    return (
      <div className="space-y-6">
        <Card className="p-8 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <div className="space-y-6">
            <div className="text-center">
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Confirm Your Request
              </h2>
              <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>
                Review the details below before submitting
              </p>
            </div>

            {/* Summary */}
            <div className="border-t border-b py-6 space-y-4" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>Invoice</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                  {selectedInvoice.invoice_number}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>Customer</span>
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {selectedInvoice.customer_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>Invoice Amount</span>
                <span className="font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                  {formatZAR(riskScore.gross_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>Risk Tier</span>
                <Badge className={`${
                  riskScore.tier.toLowerCase() === 'excellent'
                    ? 'bg-green-50 text-green-700 border-green-200'
                    : riskScore.tier.toLowerCase() === 'good'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : riskScore.tier.toLowerCase() === 'fair'
                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                    : 'bg-red-50 text-red-700 border-red-200'
                } border font-medium`}>
                  {riskScore.tier}
                </Badge>
              </div>
              <div className="flex justify-between items-center">
                <span style={{ color: 'var(--text-secondary)' }}>Fee ({riskScore.fee_percent}%)</span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  -{formatZAR(riskScore.fee_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
                <span className="font-semibold text-lg" style={{ color: 'var(--text-primary)' }}>
                  Net Payout
                </span>
                <span className="text-3xl font-mono font-bold" style={{ color: 'var(--accent-primary)' }}>
                  {formatZAR(riskScore.net_amount)}
                </span>
              </div>
            </div>

            <div className="border rounded-lg p-4" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent-primary)' }}>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                By submitting this request, you authorize TruckWys to advance funds for this invoice.
                Payment will be processed within {riskScore.estimated_turnaround_days}.
              </p>
            </div>
          </div>
        </Card>

        <div className="flex justify-between pt-4">
          <Button
            variant="outline"
            onClick={() => setStep(2)}
            disabled={requesting}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <Button
            onClick={handleConfirmRequest}
            disabled={requesting}
            className="gap-2"
            style={{ background: 'var(--accent-primary)' }}
          >
            {requesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                Request Early Payment
                <Check className="w-4 h-4" />
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
          <button
            onClick={() => navigate('/capital')}
            className="transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            Capital
          </button>
          <span>/</span>
          <span>Request Advance</span>
        </div>
        <h1 className="text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Request Early Payment</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm"
                style={{
                  background: step >= stepNum ? 'var(--accent-primary)' : 'var(--border-subtle)',
                  color: step >= stepNum ? 'white' : 'var(--text-secondary)'
                }}
              >
                {step > stepNum ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: step >= stepNum ? 'var(--text-primary)' : 'var(--text-secondary)' }}
              >
                {stepNum === 1 ? 'Select' : stepNum === 2 ? 'Risk Score' : 'Confirm'}
              </span>
            </div>
            {stepNum < 3 && (
              <div
                className="w-12 h-0.5"
                style={{ background: step > stepNum ? 'var(--accent-primary)' : 'var(--border-subtle)' }}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </div>
  );
}
