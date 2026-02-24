/**
 * TruckWys Risk Scoring Engine
 *
 * 6-Factor weighted scoring system (0-100) for invoice risk assessment
 * and early pay fee calculation.
 *
 * Factors:
 * 1. Customer Payment History (35%)
 * 2. Invoice Age (20%)
 * 3. POD Verification Quality (15%)
 * 4. Customer Credit Score (15%)
 * 5. Relationship Length (10%)
 * 6. Invoice/Facility Ratio (5%)
 *
 * Score Tiers → Fees:
 * - 85-100 (Excellent): 2.0-2.5%
 * - 70-84 (Good): 2.5-3.0%
 * - 55-69 (Fair): 3.0-3.5%
 * - 40-54 (Elevated): 3.5-4.0%
 * - <40 (Ineligible): Denied
 */

export type RiskTier = 'excellent' | 'good' | 'fair' | 'elevated' | 'ineligible';

export interface PaymentHistoryData {
  totalInvoices: number;
  onTimeCount: number;
  avgDaysLate: number; // For late payments
  hasActiveDispute: boolean;
}

export interface PODVerification {
  method: 'e_signature' | 'photo_timestamp' | 'driver_signature' | 'photo' | 'manual' | 'none';
  allFieldsComplete: boolean;
  hasQualityIssues?: string[]; // 'illegible', 'no_recipient', 'no_date'
}

export interface CreditBureauData {
  score?: number; // D&B PAYDEX 0-100, or similar
  rating?: 'A' | 'B+' | 'B' | 'B-' | 'C' | 'C-' | 'D' | null;
  hasBankruptcy?: boolean;
}

export interface RelationshipData {
  firstTransactionDate: string; // ISO date
  transactionCount: number;
}

export interface FacilityData {
  facilityLimit: number; // ZAR
  currentOutstanding: number; // ZAR
  invoiceAmount: number; // ZAR
}

export interface InvoiceData {
  invoiceId: string;
  customerId: string;
  customerName: string;
  amount: number; // ZAR
  createdDate: string; // ISO date
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID';
  ageInDays: number;
}

export interface RiskFactorBreakdown {
  factor: string;
  weight: number;
  rawScore: number;
  maxScore: number;
  description: string;
}

export interface FeeAdjustment {
  type: string;
  amountPercent: number;
  description: string;
}

export interface RiskScoreResult {
  invoiceId: string;
  riskScore: number; // 0-100
  riskTier: RiskTier;
  isEligible: boolean;
  ineligibilityReasons?: string[];

  scoreBreakdown: RiskFactorBreakdown[];

  baseFeePercent: number;
  adjustments: FeeAdjustment[];
  finalFeePercent: number;
  feeAmount: number; // ZAR
  netAmount: number; // ZAR

  calculatedAt: string; // ISO timestamp
  validUntil: string; // ISO timestamp (24h cache)
}

/**
 * Calculate Payment History Score (35% weight)
 */
function calculatePaymentHistoryScore(data: PaymentHistoryData): RiskFactorBreakdown {
  if (data.totalInvoices === 0) {
    return {
      factor: 'Payment History',
      weight: 0.35,
      rawScore: 7, // Fallback for new customers
      maxScore: 35,
      description: 'No payment history - fallback score'
    };
  }

  const onTimeRate = data.onTimeCount / data.totalInvoices;
  let baseScore = 0;
  let description = '';

  if (onTimeRate >= 0.95) {
    baseScore = 35;
    description = `Excellent payment history (${Math.round(onTimeRate * 100)}% on-time)`;
  } else if (onTimeRate >= 0.85) {
    baseScore = 32;
    description = `Good payment history (${Math.round(onTimeRate * 100)}% on-time), minor late payments`;
  } else if (onTimeRate >= 0.75) {
    baseScore = 28;
    description = `Fair payment history (${Math.round(onTimeRate * 100)}% on-time), some late payments`;
  } else if (onTimeRate >= 0.60) {
    baseScore = 20;
    description = `Below average (${Math.round(onTimeRate * 100)}% on-time), frequent late payments`;
  } else {
    baseScore = 10;
    description = `Poor payment history (${Math.round(onTimeRate * 100)}% on-time)`;
  }

  // Penalty for average days late
  if (data.avgDaysLate > 30) {
    const penalty = (data.avgDaysLate - 30) * 0.3;
    baseScore = Math.max(0, baseScore - penalty);
    description += `, avg ${Math.round(data.avgDaysLate)} days late`;
  }

  // Severe penalty for active disputes
  if (data.hasActiveDispute) {
    baseScore = Math.max(0, baseScore - 15);
    description += ', ACTIVE DISPUTE';
  }

  return {
    factor: 'Payment History',
    weight: 0.35,
    rawScore: Math.min(Math.round(baseScore), 35),
    maxScore: 35,
    description
  };
}

/**
 * Calculate Invoice Age Score (20% weight)
 */
function calculateInvoiceAgeScore(ageInDays: number): RiskFactorBreakdown {
  let score = 0;
  let strength = '';

  if (ageInDays <= 7) {
    score = 20;
    strength = 'Very strong (fresh invoice)';
  } else if (ageInDays <= 14) {
    score = 18;
    strength = 'Strong (recent)';
  } else if (ageInDays <= 30) {
    score = 14;
    strength = 'Moderate (2-4 weeks)';
  } else if (ageInDays <= 60) {
    score = 8;
    strength = 'Weak (1-2 months old)';
  } else if (ageInDays <= 91) {
    score = 4;
    strength = 'Very weak (2.5-3 months old)';
  } else {
    score = 0;
    strength = 'Ineligible (too old)';
  }

  return {
    factor: 'Invoice Age',
    weight: 0.20,
    rawScore: score,
    maxScore: 20,
    description: `${ageInDays} days old - ${strength}`
  };
}

/**
 * Calculate POD Verification Score (15% weight)
 */
function calculatePODScore(pod: PODVerification): RiskFactorBreakdown {
  let score = 0;
  let description = '';

  switch (pod.method) {
    case 'e_signature':
      score = pod.allFieldsComplete ? 15 : 12;
      description = pod.allFieldsComplete
        ? 'E-signature with all fields complete'
        : 'E-signature, some optional fields missing';
      break;
    case 'photo_timestamp':
      score = 12;
      description = 'Photo with timestamp verification';
      break;
    case 'driver_signature':
      score = 10;
      description = 'Paper signature scanned and legible';
      break;
    case 'photo':
      score = 8;
      description = 'Photo provided without timestamp';
      break;
    case 'manual':
      score = 5;
      description = 'Manual entry, no independent verification';
      break;
    case 'none':
      score = 0;
      description = 'POD not yet verified - INELIGIBLE';
      break;
  }

  // Quality issue penalties
  if (pod.hasQualityIssues && pod.hasQualityIssues.length > 0) {
    const penalty = pod.hasQualityIssues.length * 2;
    score = Math.max(0, score - penalty);
    description += ` (issues: ${pod.hasQualityIssues.join(', ')})`;
  }

  return {
    factor: 'POD Verification',
    weight: 0.15,
    rawScore: score,
    maxScore: 15,
    description
  };
}

/**
 * Calculate Credit Bureau Score (15% weight)
 */
function calculateCreditScore(credit: CreditBureauData): RiskFactorBreakdown {
  let score = 0;
  let description = '';

  if (credit.hasBankruptcy) {
    return {
      factor: 'Credit Bureau Score',
      weight: 0.15,
      rawScore: 0,
      maxScore: 15,
      description: 'Bankruptcy history - INELIGIBLE'
    };
  }

  if (credit.rating) {
    switch (credit.rating) {
      case 'A':
        score = 15;
        description = 'Excellent D&B rating (A)';
        break;
      case 'B+':
        score = 13;
        description = 'Good D&B rating (B+)';
        break;
      case 'B':
        score = 12;
        description = 'Satisfactory D&B rating (B)';
        break;
      case 'B-':
        score = 10;
        description = 'Fair D&B rating (B-)';
        break;
      case 'C':
        score = 5;
        description = 'Poor D&B rating (C)';
        break;
      case 'C-':
        score = 2;
        description = 'Very poor D&B rating (C-)';
        break;
      case 'D':
        score = 0;
        description = 'Ineligible D&B rating (D)';
        break;
    }
  } else if (credit.score !== undefined) {
    // PAYDEX score mapping
    if (credit.score >= 80) {
      score = 15;
      description = `Excellent credit score (${credit.score})`;
    } else if (credit.score >= 60) {
      score = 10;
      description = `Good credit score (${credit.score})`;
    } else if (credit.score >= 40) {
      score = 5;
      description = `Fair credit score (${credit.score})`;
    } else {
      score = 0;
      description = `Poor credit score (${credit.score})`;
    }
  } else {
    // No bureau data - use fallback
    score = 7;
    description = 'No credit bureau data - using payment history fallback';
  }

  return {
    factor: 'Credit Bureau Score',
    weight: 0.15,
    rawScore: score,
    maxScore: 15,
    description
  };
}

/**
 * Calculate Relationship Length Score (10% weight)
 */
function calculateRelationshipScore(relationship: RelationshipData): RiskFactorBreakdown {
  const firstDate = new Date(relationship.firstTransactionDate);
  const now = new Date();
  const monthsDiff = (now.getFullYear() - firstDate.getFullYear()) * 12 + (now.getMonth() - firstDate.getMonth());

  let score = 0;
  let description = '';

  if (monthsDiff >= 24) {
    score = 10;
    description = `${Math.round(monthsDiff / 12)} years - established relationship`;
  } else if (monthsDiff >= 12) {
    score = 8;
    description = `${monthsDiff} months - solid relationship`;
  } else if (monthsDiff >= 6) {
    score = 5;
    description = `${monthsDiff} months - growing relationship`;
  } else if (monthsDiff >= 3) {
    score = 3;
    description = `${monthsDiff} months - new but established`;
  } else if (monthsDiff >= 1) {
    score = 1;
    description = `${monthsDiff} month(s) - very new`;
  } else {
    score = 1;
    description = 'Brand new customer (<1 month)';
  }

  // Frequency adjustment
  const expectedTransactions = Math.max(1, monthsDiff / 3); // ~1 per quarter
  if (relationship.transactionCount < expectedTransactions && monthsDiff > 3) {
    score = Math.max(1, score - 1);
    description += ' (infrequent)';
  } else if (relationship.transactionCount > monthsDiff * 2 && monthsDiff > 0) {
    score = Math.min(10, score + 1);
    description += ' (high volume)';
  }

  return {
    factor: 'Relationship Length',
    weight: 0.10,
    rawScore: score,
    maxScore: 10,
    description
  };
}

/**
 * Calculate Invoice/Facility Ratio Score (5% weight)
 */
function calculateFacilityRatioScore(facility: FacilityData): RiskFactorBreakdown {
  const percentOfFacility = (facility.invoiceAmount / facility.facilityLimit) * 100;
  let score = 0;
  let riskLevel = '';

  if (percentOfFacility <= 5) {
    score = 5;
    riskLevel = 'Minimal';
  } else if (percentOfFacility <= 10) {
    score = 5;
    riskLevel = 'Low';
  } else if (percentOfFacility <= 25) {
    score = 4;
    riskLevel = 'Moderate';
  } else if (percentOfFacility <= 50) {
    score = 3;
    riskLevel = 'Elevated';
  } else {
    score = 1;
    riskLevel = 'Concentrated';
  }

  return {
    factor: 'Invoice/Facility Ratio',
    weight: 0.05,
    rawScore: score,
    maxScore: 5,
    description: `${percentOfFacility.toFixed(1)}% of facility - ${riskLevel} risk`
  };
}

/**
 * Map risk score to tier
 */
function getRiskTier(score: number): RiskTier {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 55) return 'fair';
  if (score >= 40) return 'elevated';
  return 'ineligible';
}

/**
 * Get base fee for risk tier
 */
function getBaseFee(tier: RiskTier): number {
  switch (tier) {
    case 'excellent': return 2.2;
    case 'good': return 2.75;
    case 'fair': return 3.25;
    case 'elevated': return 3.75;
    case 'ineligible': return 0;
  }
}

/**
 * Calculate fee adjustments based on various factors
 */
function calculateFeeAdjustments(
  invoice: InvoiceData,
  relationship: RelationshipData,
  facility: FacilityData,
  paymentHistory: PaymentHistoryData
): FeeAdjustment[] {
  const adjustments: FeeAdjustment[] = [];

  // Invoice age adjustments
  if (invoice.ageInDays <= 7) {
    adjustments.push({
      type: 'fresh_invoice',
      amountPercent: -0.25,
      description: 'Fresh invoice (<7 days)'
    });
  } else if (invoice.ageInDays >= 61) {
    adjustments.push({
      type: 'aged_invoice',
      amountPercent: 0.75,
      description: 'Significantly aged invoice (>60 days)'
    });
  } else if (invoice.ageInDays >= 46) {
    adjustments.push({
      type: 'aged_invoice',
      amountPercent: 0.5,
      description: 'Aged invoice (46-60 days)'
    });
  } else if (invoice.ageInDays >= 31) {
    adjustments.push({
      type: 'aged_invoice',
      amountPercent: 0.25,
      description: 'Aging invoice (31-45 days)'
    });
  }

  // First-time customer (< 3 transactions)
  if (relationship.transactionCount <= 3) {
    adjustments.push({
      type: 'first_time',
      amountPercent: 0.5,
      description: 'First-time customer (<3 transactions)'
    });
  }

  // Active dispute penalty
  if (paymentHistory.hasActiveDispute) {
    adjustments.push({
      type: 'dispute',
      amountPercent: 1.0,
      description: 'Active payment dispute'
    });
  }

  // Facility utilization
  const utilization = ((facility.currentOutstanding + facility.invoiceAmount) / facility.facilityLimit) * 100;
  if (utilization < 25) {
    adjustments.push({
      type: 'low_utilization',
      amountPercent: -0.25,
      description: 'Low facility utilization (<25%)'
    });
  } else if (utilization > 80) {
    adjustments.push({
      type: 'high_utilization',
      amountPercent: 0.25,
      description: 'High facility utilization (>80%)'
    });
  }

  return adjustments;
}

/**
 * Check ineligibility conditions
 */
function checkIneligibility(
  invoice: InvoiceData,
  paymentHistory: PaymentHistoryData,
  pod: PODVerification,
  credit: CreditBureauData,
  facility: FacilityData,
  riskScore: number
): { isEligible: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Score too low
  if (riskScore < 40) {
    reasons.push('Risk score below minimum threshold (40)');
  }

  // Invoice too old
  if (invoice.ageInDays > 91) {
    reasons.push('Invoice age exceeds 91 days');
  }

  // Bankruptcy
  if (credit.hasBankruptcy) {
    reasons.push('Customer has bankruptcy history');
  }

  // Active dispute
  if (paymentHistory.hasActiveDispute) {
    reasons.push('Invoice has active payment dispute');
  }

  // No POD
  if (pod.method === 'none') {
    reasons.push('Proof of Delivery not verified');
  }

  // Exceeds facility
  if (facility.currentOutstanding + facility.invoiceAmount > facility.facilityLimit) {
    reasons.push('Advance would exceed facility limit');
  }

  return {
    isEligible: reasons.length === 0,
    reasons
  };
}

/**
 * Main risk scoring function
 */
export function calculateRiskScore(
  invoice: InvoiceData,
  paymentHistory: PaymentHistoryData,
  pod: PODVerification,
  credit: CreditBureauData,
  relationship: RelationshipData,
  facility: FacilityData
): RiskScoreResult {
  // Calculate individual factor scores
  const factors: RiskFactorBreakdown[] = [
    calculatePaymentHistoryScore(paymentHistory),
    calculateInvoiceAgeScore(invoice.ageInDays),
    calculatePODScore(pod),
    calculateCreditScore(credit),
    calculateRelationshipScore(relationship),
    calculateFacilityRatioScore(facility)
  ];

  // Sum up total risk score
  const riskScore = Math.round(
    factors.reduce((sum, factor) => sum + factor.rawScore, 0)
  );

  // Determine tier and base fee
  const tier = getRiskTier(riskScore);
  const baseFee = getBaseFee(tier);

  // Calculate adjustments
  const adjustments = calculateFeeAdjustments(invoice, relationship, facility, paymentHistory);

  // Apply adjustments to fee
  const adjustmentTotal = adjustments.reduce((sum, adj) => sum + adj.amountPercent, 0);
  let finalFee = baseFee + adjustmentTotal;

  // Apply caps: min 0.75%, max 4.0% (except for ineligible)
  if (tier !== 'ineligible') {
    finalFee = Math.max(0.75, Math.min(4.0, finalFee));
  }

  // Calculate fee amount and net
  const feeAmount = (invoice.amount * finalFee) / 100;
  const netAmount = invoice.amount - feeAmount;

  // Check eligibility
  const { isEligible, reasons } = checkIneligibility(
    invoice,
    paymentHistory,
    pod,
    credit,
    facility,
    riskScore
  );

  // Timestamps
  const now = new Date();
  const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h cache

  return {
    invoiceId: invoice.invoiceId,
    riskScore,
    riskTier: tier,
    isEligible,
    ineligibilityReasons: isEligible ? undefined : reasons,
    scoreBreakdown: factors,
    baseFeePercent: baseFee,
    adjustments,
    finalFeePercent: Number(finalFee.toFixed(2)),
    feeAmount: Number(feeAmount.toFixed(2)),
    netAmount: Number(netAmount.toFixed(2)),
    calculatedAt: now.toISOString(),
    validUntil: validUntil.toISOString()
  };
}

/**
 * Get risk tier display info
 */
export function getRiskTierInfo(tier: RiskTier): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  switch (tier) {
    case 'excellent':
      return {
        label: 'Excellent',
        color: '#10B981',
        bgColor: '#D1FAE5',
        description: 'Very low risk, premium pricing'
      };
    case 'good':
      return {
        label: 'Good',
        color: '#3B82F6',
        bgColor: '#DBEAFE',
        description: 'Low risk, competitive pricing'
      };
    case 'fair':
      return {
        label: 'Fair',
        color: '#F59E0B',
        bgColor: '#FEF3C7',
        description: 'Moderate risk, standard pricing'
      };
    case 'elevated':
      return {
        label: 'Elevated',
        color: '#EF4444',
        bgColor: '#FEE2E2',
        description: 'High risk, premium pricing required'
      };
    case 'ineligible':
      return {
        label: 'Ineligible',
        color: '#64748B',
        bgColor: '#F1F5F9',
        description: 'Does not meet eligibility criteria'
      };
  }
}
