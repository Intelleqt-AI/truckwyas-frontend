import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "./RiskBadge";
import { formatZAR } from "@/lib/constants";
import { RiskScoreResult } from "@/lib/risk-engine";
import { AlertCircle, CheckCircle2, TrendingUp, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FastPayModalProps {
  isOpen: boolean;
  onClose: () => void;
  riskResult: RiskScoreResult;
  invoiceNumber: string;
  customerName: string;
}

export function FastPayModal({
  isOpen,
  onClose,
  riskResult,
  invoiceNumber,
  customerName
}: FastPayModalProps) {
  const navigate = useNavigate();

  const handleRequestAdvance = () => {
    // Navigate to Capital page with pre-selected invoice
    navigate(`/capital?invoice=${riskResult.invoiceId}`);
  };

  if (!riskResult.isEligible) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-[#EF4444]" />
              Not Eligible for Fast Pay
            </DialogTitle>
            <DialogDescription>
              Invoice {invoiceNumber} does not meet eligibility criteria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 bg-[#FEE2E2] rounded-lg">
              <h4 className="text-sm font-medium text-[#991B1B] mb-2">Reasons:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm text-[#991B1B]">
                {riskResult.ineligibilityReasons?.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={onClose}>
                Close
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Fast Pay Offer</DialogTitle>
          <DialogDescription>
            Get paid today for invoice {invoiceNumber} from {customerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Risk Summary */}
          <div className="flex items-center justify-between p-4 bg-[#F8FAFC] rounded-lg">
            <div>
              <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Risk Assessment</p>
              <RiskBadge tier={riskResult.riskTier} score={riskResult.riskScore} size="lg" />
            </div>
            <div className="text-right">
              <p className="text-xs text-[#64748B] uppercase tracking-wide mb-1">Approval Rate</p>
              <p className="text-lg font-medium text-[#0F172A]">
                {riskResult.riskTier === 'excellent' ? '98%' :
                 riskResult.riskTier === 'good' ? '95%' :
                 riskResult.riskTier === 'fair' ? '85%' : '70%'}
              </p>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium text-[#0F172A]">Pricing Breakdown</h4>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">Invoice Amount</span>
                <span className="font-mono text-[#0F172A]">{formatZAR(riskResult.netAmount + riskResult.feeAmount)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span className="text-[#64748B]">
                  Base Fee ({riskResult.baseFeePercent}%)
                </span>
                <span className="font-mono text-[#64748B]">
                  {formatZAR((riskResult.netAmount + riskResult.feeAmount) * riskResult.baseFeePercent / 100)}
                </span>
              </div>

              {riskResult.adjustments.map((adj, idx) => (
                <div key={idx} className="flex justify-between text-xs pl-4">
                  <span className="text-[#94A3B8]">{adj.description}</span>
                  <span className={`font-mono ${adj.amountPercent > 0 ? 'text-[#EF4444]' : 'text-[#10B981]'}`}>
                    {adj.amountPercent > 0 ? '+' : ''}{adj.amountPercent.toFixed(2)}%
                  </span>
                </div>
              ))}

              <div className="border-t border-[#F1F5F9] pt-2 mt-2 flex justify-between text-sm font-medium">
                <span className="text-[#0F172A]">Total Fee ({riskResult.finalFeePercent}%)</span>
                <span className="font-mono text-[#EF4444]">-{formatZAR(riskResult.feeAmount)}</span>
              </div>

              <div className="border-t-2 border-[#0F172A] pt-3 flex justify-between">
                <span className="text-base font-medium text-[#0F172A]">You Receive</span>
                <span className="text-xl font-mono font-bold text-[#10B981]">{formatZAR(riskResult.netAmount)}</span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-[#F0FDF4] rounded-lg">
              <Clock className="w-5 h-5 text-[#10B981] mx-auto mb-1" />
              <p className="text-xs text-[#166534] font-medium">1-2 Hours</p>
              <p className="text-xs text-[#64748B]">Typical deposit</p>
            </div>
            <div className="text-center p-3 bg-[#EFF6FF] rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-[#2563EB] mx-auto mb-1" />
              <p className="text-xs text-[#1E40AF] font-medium">Verified POD</p>
              <p className="text-xs text-[#64748B]">Delivery confirmed</p>
            </div>
            <div className="text-center p-3 bg-[#FEF3C7] rounded-lg">
              <TrendingUp className="w-5 h-5 text-[#F59E0B] mx-auto mb-1" />
              <p className="text-xs text-[#92400E] font-medium">Grow Faster</p>
              <p className="text-xs text-[#64748B]">Unlock capital</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t border-[#F1F5F9]">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-[#10B981] hover:bg-[#059669] text-white"
              onClick={handleRequestAdvance}
            >
              Request Advance
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
