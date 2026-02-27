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
              <AlertCircle className="w-5 h-5" style={{ color: 'var(--status-danger)' }} />
              Not Eligible for Fast Pay
            </DialogTitle>
            <DialogDescription>
              Invoice {invoiceNumber} does not meet eligibility criteria.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-4 rounded-lg" style={{ background: 'var(--accent-dim)' }}>
              <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--status-danger)' }}>Reasons:</h4>
              <ul className="list-disc list-inside space-y-1 text-sm" style={{ color: 'var(--status-danger)' }}>
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
          <div className="flex items-center justify-between p-4 rounded-lg" style={{ background: 'var(--bg-surface-hover)' }}>
            <div>
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Risk Assessment</p>
              <RiskBadge tier={riskResult.riskTier} score={riskResult.riskScore} size="lg" />
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Approval Rate</p>
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                {riskResult.riskTier === 'excellent' ? '98%' :
                 riskResult.riskTier === 'good' ? '95%' :
                 riskResult.riskTier === 'fair' ? '85%' : '70%'}
              </p>
            </div>
          </div>

          {/* Fee Breakdown */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Pricing Breakdown</h4>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>Invoice Amount</span>
                <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{formatZAR(riskResult.netAmount + riskResult.feeAmount)}</span>
              </div>

              <div className="flex justify-between text-sm">
                <span style={{ color: 'var(--text-secondary)' }}>
                  Base Fee ({riskResult.baseFeePercent}%)
                </span>
                <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>
                  {formatZAR((riskResult.netAmount + riskResult.feeAmount) * riskResult.baseFeePercent / 100)}
                </span>
              </div>

              {riskResult.adjustments.map((adj, idx) => (
                <div key={idx} className="flex justify-between text-xs pl-4">
                  <span style={{ color: 'var(--text-tertiary)' }}>{adj.description}</span>
                  <span className="font-mono" style={{ color: adj.amountPercent > 0 ? 'var(--status-danger)' : 'var(--status-success)' }}>
                    {adj.amountPercent > 0 ? '+' : ''}{adj.amountPercent.toFixed(2)}%
                  </span>
                </div>
              ))}

              <div className="border-t pt-2 mt-2 flex justify-between text-sm font-medium" style={{ borderColor: 'var(--border-subtle)' }}>
                <span style={{ color: 'var(--text-primary)' }}>Total Fee ({riskResult.finalFeePercent}%)</span>
                <span className="font-mono" style={{ color: 'var(--status-danger)' }}>-{formatZAR(riskResult.feeAmount)}</span>
              </div>

              <div className="border-t-2 pt-3 flex justify-between" style={{ borderColor: 'var(--text-primary)' }}>
                <span className="text-base font-medium" style={{ color: 'var(--text-primary)' }}>You Receive</span>
                <span className="text-xl font-mono font-bold" style={{ color: 'var(--status-success)' }}>{formatZAR(riskResult.netAmount)}</span>
              </div>
            </div>
          </div>

          {/* Benefits */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--accent-dim)' }}>
              <Clock className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--status-success)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--status-success)' }}>1-2 Hours</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Typical deposit</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--accent-dim)' }}>
              <CheckCircle2 className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--accent-primary)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--accent-primary)' }}>Verified POD</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Delivery confirmed</p>
            </div>
            <div className="text-center p-3 rounded-lg" style={{ background: 'var(--accent-dim)' }}>
              <TrendingUp className="w-5 h-5 mx-auto mb-1" style={{ color: 'var(--status-warning)' }} />
              <p className="text-xs font-medium" style={{ color: 'var(--status-warning)' }}>Grow Faster</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Unlock capital</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              className="text-white"
              style={{ background: 'var(--status-success)', '--tw-bg-opacity': '1' } as React.CSSProperties}
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
