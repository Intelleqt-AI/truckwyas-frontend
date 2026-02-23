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
    '/api/v1/invoices/?early_pay_eligible=true'
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
      url: '/api/v1/risk/score/',
      data: { invoice_id: selectedInvoiceId }
    });
  };

  const handleConfirmRequest = () => {
    if (!selectedInvoiceId) return;
    requestAdvance({
      url: '/api/v1/advances/',
      data: { invoice_id: selectedInvoiceId }
    });
  };

  const renderStep1 = () => (
    <Card className="p-6 bg-white border-0 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-[#0F172A]">Select Invoice</h2>
        <p className="text-sm text-[#64748B]">
          Choose an eligible invoice to request early payment
        </p>

        {loadingInvoices ? (
          <div className="py-12 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#2563EB]" />
          </div>
        ) : !invoices || invoices.length === 0 ? (
          <div className="py-12 text-center text-[#64748B]">
            No eligible invoices found. Check back later.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#F1F5F9]">
                  <th className="w-12 py-3 px-4"></th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Invoice #
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Customer
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Amount
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Age (days)
                  </th>
                  <th className="text-right py-3 px-4 text-xs font-medium text-[#64748B] uppercase tracking-wide">
                    Due Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr
                    key={invoice.id}
                    className={`border-b border-[#F1F5F9] last:border-0 cursor-pointer transition-colors ${
                      selectedInvoiceId === invoice.id
                        ? 'bg-blue-50'
                        : 'hover:bg-[#F8FAFC]'
                    }`}
                    onClick={() => handleSelectInvoice(invoice.id)}
                  >
                    <td className="py-3 px-4">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedInvoiceId === invoice.id
                            ? 'border-[#2563EB] bg-[#2563EB]'
                            : 'border-slate-300'
                        }`}
                      >
                        {selectedInvoiceId === invoice.id && (
                          <Check className="w-3 h-3 text-white" />
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-[#2563EB]">
                      {invoice.invoice_number}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#0F172A]">
                      {invoice.customer_name}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-[#0F172A] text-right">
                      {formatZAR(invoice.total_amount)}
                    </td>
                    <td className="py-3 px-4 text-sm font-mono text-[#64748B] text-right">
                      {invoice.age_days || calculateDaysAge(invoice.invoice_date)}
                    </td>
                    <td className="py-3 px-4 text-sm text-[#64748B] text-right">
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
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
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
              <h3 className="text-lg font-semibold text-[#0F172A]">
                {selectedInvoice.invoice_number}
              </h3>
              <p className="text-sm text-[#64748B] mt-1">
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
              className="text-[#64748B] hover:text-[#0F172A]"
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
              <p className="text-sm font-medium text-[#0F172A]">
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
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
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
              <h2 className="text-2xl font-bold text-[#0F172A]">
                Confirm Your Request
              </h2>
              <p className="text-[#64748B] mt-2">
                Review the details below before submitting
              </p>
            </div>

            {/* Summary */}
            <div className="border-t border-b border-slate-200 py-6 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Invoice</span>
                <span className="text-[#0F172A] font-mono font-medium">
                  {selectedInvoice.invoice_number}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Customer</span>
                <span className="text-[#0F172A] font-medium">
                  {selectedInvoice.customer_name}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Invoice Amount</span>
                <span className="text-[#0F172A] font-mono font-medium">
                  {formatZAR(riskScore.gross_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#64748B]">Risk Tier</span>
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
                <span className="text-[#64748B]">Fee ({riskScore.fee_percent}%)</span>
                <span className="text-[#64748B] font-mono">
                  -{formatZAR(riskScore.fee_amount)}
                </span>
              </div>
              <div className="flex justify-between items-center pt-4 border-t border-slate-200">
                <span className="text-[#0F172A] font-semibold text-lg">
                  Net Payout
                </span>
                <span className="text-3xl text-[#2563EB] font-mono font-bold">
                  {formatZAR(riskScore.net_amount)}
                </span>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-[#0F172A]">
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
            className="gap-2 bg-[#2563EB] hover:bg-[#1D4ED8]"
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
        <div className="flex items-center gap-2 text-sm text-[#64748B] mb-2">
          <button
            onClick={() => navigate('/capital')}
            className="hover:text-[#2563EB] transition-colors"
          >
            Capital
          </button>
          <span>/</span>
          <span>Request Advance</span>
        </div>
        <h1 className="text-3xl font-bold text-[#0F172A]">Request Early Payment</h1>
      </div>

      {/* Progress Steps */}
      <div className="flex items-center justify-center gap-4">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-medium text-sm ${
                  step >= stepNum
                    ? 'bg-[#2563EB] text-white'
                    : 'bg-slate-200 text-[#64748B]'
                }`}
              >
                {step > stepNum ? <Check className="w-4 h-4" /> : stepNum}
              </div>
              <span
                className={`text-sm font-medium ${
                  step >= stepNum ? 'text-[#0F172A]' : 'text-[#64748B]'
                }`}
              >
                {stepNum === 1 ? 'Select' : stepNum === 2 ? 'Risk Score' : 'Confirm'}
              </span>
            </div>
            {stepNum < 3 && (
              <div
                className={`w-12 h-0.5 ${
                  step > stepNum ? 'bg-[#2563EB]' : 'bg-slate-200'
                }`}
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
