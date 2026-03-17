/**
 * TruckWys Institutional-Grade Risk Scoring Engine
 *
 * 7-Pillar weighted scoring system (0-100) for invoice factoring risk assessment.
 * Designed for institutional lenders evaluating fintech underwriting capability.
 *
 * ARCHITECTURE: Hybrid AI + Rules Engine
 * Phase A (NOW): Comprehensive client-side scoring with production-grade algorithm
 * Phase B (Backend): XGBoost/LightGBM models replace this logic
 *
 * PILLAR WEIGHTS:
 * 1. Client Identity & Profile (15%)
 * 2. Client Financial Health (20%)
 * 3. Debtor Creditworthiness (20%)
 * 4. Invoice Characteristics (15%)
 * 5. Proof of Delivery & Documentation (10%)
 * 6. Operational & Trip Factors (10%)
 * 7. Macro & Market Factors (10%)
 *
 * RISK TIERS → PRICING:
 * - 85-100 (PRIME): 1.5-2.0%, 90% advance, 2-4h
 * - 70-84 (STANDARD): 2.0-2.75%, 85% advance, 4-8h
 * - 55-69 (ELEVATED): 2.75-3.5%, 75% advance, 8-24h
 * - 40-54 (HIGH): 3.5-4.5%, 65% advance, 24-48h
 * - <40 (INELIGIBLE): Denied
 */

export type RiskTier = 'prime' | 'standard' | 'elevated' | 'high' | 'ineligible';

// ==========================
// PILLAR 1: CLIENT IDENTITY & PROFILE
// ==========================

export interface ClientIdentityData {
  // Company registration
  companyAgeYears: number; // CIPC years
  businessType: 'sole_prop' | 'pty_ltd' | 'listed' | 'corporate';

  // Fleet
  fleetSize: number; // Number of trucks
  fleetGrowthRate?: number; // % change last 12mo

  // Governance
  directorships: number;
  hasAdverseFindings: boolean;
  beeLevel?: number; // 1-8, lower = better

  // Geography & Industry
  provinceCount: number; // Operating provinces
  subSector: 'mining' | 'agricultural' | 'fmcg' | 'construction' | 'general';

  // Insurance
  hasGoodsInTransitInsurance: boolean;
  hasFleetInsurance: boolean;
  hasLiabilityInsurance: boolean;
}

// ==========================
// PILLAR 2: CLIENT FINANCIAL HEALTH
// ==========================

export interface ClientFinancialData {
  // Revenue
  monthlyTurnover: number; // ZAR
  turnoverTrend6Mo: 'growing' | 'stable' | 'declining';
  turnoverVolatility: number; // Coefficient of variation (0-1+)

  // Profitability
  grossMarginTrend: 'improving' | 'stable' | 'declining';

  // Receivables & Utilization
  outstandingInvoicesRatio: number; // Total receivables / monthly turnover
  advanceUtilizationRate: number; // % of facility used (0-100)
  advanceFrequency: 'low' | 'moderate' | 'high' | 'every_invoice';

  // Concentration
  revenueConcentration: number; // % from largest customer (0-100)

  // Compliance
  hasTaxCompliance: boolean; // SARS good standing
  bankRelationshipYears: number;
  returnedPayments: number; // Last 12mo
}

// ==========================
// PILLAR 3: DEBTOR CREDITWORTHINESS
// ==========================

export interface DebtorCreditData {
  // External credit
  paydexScore?: number; // D&B PAYDEX 0-100
  creditRating?: 'AAA' | 'AA' | 'A' | 'BBB' | 'BB' | 'B' | 'CCC' | 'CC' | 'C' | 'D';

  // Platform payment history
  platformAvgDaysToPay?: number; // Across all operators
  platformPaymentConsistency?: number; // Std dev of payment days
  operatorSpecificAvgDays?: number; // With THIS operator

  // Customer profile
  customerIndustry: 'mining' | 'retail' | 'fmcg' | 'construction' | 'government' | 'other';
  customerSize: 'large_corporate' | 'mid_market' | 'sme' | 'micro';
  customerOutstandingBalance: number; // Total unpaid across platform

  // Disputes & tenure
  disputeRate: number; // % of invoices disputed (0-100)
  platformTenureMonths: number;
  hasCrossOperatorLatePaymentFlag: boolean;

  // Payment method
  paymentMethod: 'auto_pay' | 'eft' | 'cheque' | 'manual';

  // Jurisdiction
  jurisdiction: 'sa_domestic' | 'sadc_cross_border' | 'international';
}

// ==========================
// PILLAR 4: INVOICE CHARACTERISTICS
// ==========================

export interface InvoiceCharacteristics {
  invoiceId: string;
  amount: number; // ZAR
  operatorAvgInvoiceAmount: number; // For outlier detection
  facilityLimit: number;

  // Age & terms
  ageInDays: number;
  paymentTermsDays: number; // NET7/14/30/60/90
  daysUntilDue: number; // Negative = overdue

  // Currency & type
  currency: 'ZAR' | 'USD' | 'EUR' | 'other';
  invoiceType: 'single_trip' | 'consolidated';

  // Structure
  hasDetailedLineItems: boolean;
  hasCreditNotes: boolean;
  hasLinkedPO: boolean;
  isRecurringCustomer: boolean;
}

// ==========================
// PILLAR 5: POD & DOCUMENTATION
// ==========================

export interface PODDocumentation {
  // POD type
  podType: 'e_signature' | 'geo_photo' | 'scanned' | 'manual' | 'none';

  // Completeness
  hasReceiverName: boolean;
  hasSignature: boolean;
  hasDate: boolean;
  hasConditionNotes: boolean;

  // Verification
  podTimestampMatchesDelivery: boolean;
  hasGPSTracking: boolean;
  hasDeliveryExceptions: boolean;

  // Supporting docs
  hasWaybill: boolean;
  hasWeighbridgeTicket: boolean;
  hasCustomsClearance: boolean;
  hasPhotos: boolean;
}

// ==========================
// PILLAR 6: OPERATIONAL & TRIP FACTORS
// ==========================

export interface OperationalFactors {
  // Route risk
  routeRiskLevel: 'low' | 'moderate' | 'high' | 'very_high'; // Hijacking/loss rates

  // Cargo
  cargoType: 'general' | 'perishable' | 'hazmat' | 'high_value';
  distanceKm: number;

  // Operator track record
  tripCompletionRate: number; // % (0-100)

  // Vehicle & driver
  vehicleLastServiceDays: number;
  hasCurrentRoadworthy: boolean;
  driverViolations: number; // Last 12mo
  driverExperienceYears: number;

  // Seasonality
  isSeasonalSlowdown: boolean; // Q4, agricultural, etc.
}

// ==========================
// PILLAR 7: MACRO & MARKET FACTORS
// ==========================

export interface MacroMarketFactors {
  // Currency & rates
  zarVolatility30d: number; // % (0-100)
  sarbRepoRate: number; // %

  // Industry conditions
  freightDemandIndex: number; // 0-100
  fuelPriceTrend3Mo: 'rising' | 'stable' | 'declining';

  // Platform health
  platformDefaultRate90d: number; // % (0-100)

  // Economic
  pmiIndex?: number; // Purchasing Managers Index

  // Operational disruptions
  loadSheddingImpactIndex: number; // 0-100
  isSeasonalPaymentSlowdown: boolean; // Dec/Jan
}

// ==========================
// RISK SCORE RESULT
// ==========================

export interface RiskFactorBreakdown {
  pillar: string;
  weight: number;
  rawScore: number; // 0-100 for this pillar
  weightedScore: number; // rawScore * weight
  maxScore: number;
  description: string;
  subFactors?: Array<{
    factor: string;
    impact: number; // Positive or negative contribution
    description: string;
  }>;
}

export interface ScoreAdjustment {
  type: string;
  amountPoints: number; // Score adjustment (not fee)
  description: string;
}

export interface FeeAdjustment {
  type: string;
  amountPercent: number;
  description: string;
}

export interface IneligibilityReason {
  rule: string;
  description: string;
  severity: 'critical' | 'major' | 'minor';
}

export interface RiskScoreResult {
  invoiceId: string;

  // Core score
  rawScore: number; // 0-100 before adjustments
  adjustments: ScoreAdjustment[];
  finalScore: number; // After adjustments, capped 0-100
  riskTier: RiskTier;

  // Eligibility
  isEligible: boolean;
  ineligibilityReasons: IneligibilityReason[];

  // Breakdown
  pillarBreakdown: RiskFactorBreakdown[];

  // Pricing
  baseFeePercent: number;
  feeAdjustments: FeeAdjustment[];
  finalFeePercent: number; // After adjustments, capped 1.0-5.0%
  maxAdvancePercent: number; // 65-90%
  estimatedTurnaround: string; // "2-4 hours"

  // Amounts
  invoiceAmount: number;
  feeAmount: number;
  netAdvance: number;

  // Explainability
  topRiskDrivers: Array<{ factor: string; impact: string }>;
  topStrengths: Array<{ factor: string; impact: string }>;
  confidenceLevel: number; // % (0-100) based on data completeness

  // Metadata
  calculatedAt: string; // ISO timestamp
  validUntil: string; // ISO timestamp (24h cache)
}

// ==========================
// PILLAR CALCULATION FUNCTIONS
// ==========================

/**
 * PILLAR 1: CLIENT IDENTITY & PROFILE (15%)
 */
function calculateClientIdentityScore(data: ClientIdentityData): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // Company age (0-15 points)
  let ageScore = 0;
  if (data.companyAgeYears >= 10) {
    ageScore = 15;
    subFactors.push({ factor: 'Company Age', impact: 15, description: `${data.companyAgeYears}+ years established` });
  } else if (data.companyAgeYears >= 5) {
    ageScore = 12;
    subFactors.push({ factor: 'Company Age', impact: 12, description: `${data.companyAgeYears} years established` });
  } else if (data.companyAgeYears >= 3) {
    ageScore = 8;
    subFactors.push({ factor: 'Company Age', impact: 8, description: `${data.companyAgeYears} years established` });
  } else if (data.companyAgeYears >= 1) {
    ageScore = 4;
    subFactors.push({ factor: 'Company Age', impact: 4, description: `${data.companyAgeYears} year(s) established` });
  } else {
    ageScore = 0;
    subFactors.push({ factor: 'Company Age', impact: 0, description: 'Less than 1 year established' });
  }
  score += ageScore;

  // Business type (0-10 points)
  let typeScore = 0;
  switch (data.businessType) {
    case 'listed':
    case 'corporate':
      typeScore = 10;
      subFactors.push({ factor: 'Business Type', impact: 10, description: 'Listed/corporate entity' });
      break;
    case 'pty_ltd':
      typeScore = 7;
      subFactors.push({ factor: 'Business Type', impact: 7, description: '(Pty) Ltd company' });
      break;
    case 'sole_prop':
      typeScore = 3;
      subFactors.push({ factor: 'Business Type', impact: 3, description: 'Sole proprietor (higher risk)' });
      break;
  }
  score += typeScore;

  // Fleet size (0-15 points)
  let fleetScore = 0;
  if (data.fleetSize >= 50) {
    fleetScore = 15;
    subFactors.push({ factor: 'Fleet Size', impact: 15, description: `${data.fleetSize} trucks - large established fleet` });
  } else if (data.fleetSize >= 20) {
    fleetScore = 12;
    subFactors.push({ factor: 'Fleet Size', impact: 12, description: `${data.fleetSize} trucks - mid-sized fleet` });
  } else if (data.fleetSize >= 10) {
    fleetScore = 8;
    subFactors.push({ factor: 'Fleet Size', impact: 8, description: `${data.fleetSize} trucks - growing fleet` });
  } else if (data.fleetSize >= 5) {
    fleetScore = 5;
    subFactors.push({ factor: 'Fleet Size', impact: 5, description: `${data.fleetSize} trucks - small fleet` });
  } else {
    fleetScore = 2;
    subFactors.push({ factor: 'Fleet Size', impact: 2, description: `${data.fleetSize} trucks - micro operator` });
  }
  score += fleetScore;

  // Fleet growth
  if (data.fleetGrowthRate !== undefined) {
    if (data.fleetGrowthRate > 10) {
      score += 5;
      subFactors.push({ factor: 'Fleet Growth', impact: 5, description: `Growing ${data.fleetGrowthRate}% (positive signal)` });
    } else if (data.fleetGrowthRate < -10) {
      score -= 5;
      subFactors.push({ factor: 'Fleet Growth', impact: -5, description: `Shrinking ${Math.abs(data.fleetGrowthRate)}% (red flag)` });
    }
  }

  // Governance
  if (data.hasAdverseFindings) {
    score -= 10;
    subFactors.push({ factor: 'Adverse Findings', impact: -10, description: 'Director has adverse findings' });
  }

  // Geographic diversification
  if (data.provinceCount >= 5) {
    score += 5;
    subFactors.push({ factor: 'Geographic Spread', impact: 5, description: `Operates in ${data.provinceCount} provinces` });
  } else if (data.provinceCount === 1) {
    score -= 3;
    subFactors.push({ factor: 'Geographic Concentration', impact: -3, description: 'Single province operation (concentration risk)' });
  }

  // Insurance coverage (critical)
  let insuranceCount = 0;
  if (data.hasGoodsInTransitInsurance) insuranceCount++;
  if (data.hasFleetInsurance) insuranceCount++;
  if (data.hasLiabilityInsurance) insuranceCount++;

  if (insuranceCount === 3) {
    score += 10;
    subFactors.push({ factor: 'Insurance', impact: 10, description: 'Full insurance coverage' });
  } else if (insuranceCount === 2) {
    score += 5;
    subFactors.push({ factor: 'Insurance', impact: 5, description: 'Partial insurance coverage' });
  } else if (insuranceCount < 2) {
    score -= 5;
    subFactors.push({ factor: 'Insurance', impact: -5, description: 'Inadequate insurance (risk)' });
  }

  // Industry sub-sector
  if (data.subSector === 'fmcg') {
    score += 5;
    subFactors.push({ factor: 'Industry', impact: 5, description: 'FMCG sector (stable demand)' });
  } else if (data.subSector === 'mining' || data.subSector === 'construction') {
    score -= 3;
    subFactors.push({ factor: 'Industry', impact: -3, description: `${data.subSector} sector (cyclical risk)` });
  }

  // Normalize to 0-100 for this pillar
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.15;

  return {
    pillar: 'Client Identity & Profile',
    weight: 0.15,
    rawScore,
    weightedScore,
    maxScore: 15,
    description: `Company: ${data.companyAgeYears}y old, ${data.fleetSize} trucks, ${data.businessType}`,
    subFactors,
  };
}

/**
 * PILLAR 2: CLIENT FINANCIAL HEALTH (20%)
 */
function calculateClientFinancialScore(data: ClientFinancialData): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // Turnover trend (0-25 points)
  if (data.turnoverTrend6Mo === 'growing') {
    score += 25;
    subFactors.push({ factor: 'Revenue Trend', impact: 25, description: 'Growing revenue (strong signal)' });
  } else if (data.turnoverTrend6Mo === 'stable') {
    score += 15;
    subFactors.push({ factor: 'Revenue Trend', impact: 15, description: 'Stable revenue' });
  } else {
    score += 5;
    subFactors.push({ factor: 'Revenue Trend', impact: 5, description: 'Declining revenue (warning)' });
  }

  // Turnover volatility (0-15 points)
  if (data.turnoverVolatility < 0.15) {
    score += 15;
    subFactors.push({ factor: 'Revenue Stability', impact: 15, description: 'Very consistent revenue' });
  } else if (data.turnoverVolatility < 0.30) {
    score += 10;
    subFactors.push({ factor: 'Revenue Stability', impact: 10, description: 'Moderately stable revenue' });
  } else {
    score += 3;
    subFactors.push({ factor: 'Revenue Volatility', impact: 3, description: 'Erratic revenue (risk)' });
  }

  // Gross margin trend (0-20 points)
  if (data.grossMarginTrend === 'improving') {
    score += 20;
    subFactors.push({ factor: 'Margin Trend', impact: 20, description: 'Improving profitability' });
  } else if (data.grossMarginTrend === 'stable') {
    score += 12;
    subFactors.push({ factor: 'Margin Trend', impact: 12, description: 'Stable profitability' });
  } else {
    score += 4;
    subFactors.push({ factor: 'Margin Decline', impact: 4, description: 'Declining margins (concern)' });
  }

  // Outstanding invoices ratio (0-15 points)
  if (data.outstandingInvoicesRatio < 1.5) {
    score += 15;
    subFactors.push({ factor: 'Receivables Health', impact: 15, description: 'Healthy receivables (<1.5x monthly turnover)' });
  } else if (data.outstandingInvoicesRatio < 2.5) {
    score += 10;
    subFactors.push({ factor: 'Receivables', impact: 10, description: 'Moderate receivables load' });
  } else {
    score += 3;
    subFactors.push({ factor: 'Receivables Pressure', impact: 3, description: 'High receivables (cash squeeze signal)' });
  }

  // Advance utilization rate (0-10 points)
  if (data.advanceUtilizationRate < 50) {
    score += 10;
    subFactors.push({ factor: 'Facility Usage', impact: 10, description: `${data.advanceUtilizationRate.toFixed(0)}% utilization (low)` });
  } else if (data.advanceUtilizationRate < 80) {
    score += 6;
    subFactors.push({ factor: 'Facility Usage', impact: 6, description: `${data.advanceUtilizationRate.toFixed(0)}% utilization (moderate)` });
  } else {
    score += 1;
    subFactors.push({ factor: 'Facility Stress', impact: 1, description: `${data.advanceUtilizationRate.toFixed(0)}% utilization (high stress)` });
  }

  // Advance frequency
  if (data.advanceFrequency === 'every_invoice') {
    score -= 5;
    subFactors.push({ factor: 'Dependency Signal', impact: -5, description: 'Advances on every invoice (dependency)' });
  } else if (data.advanceFrequency === 'low') {
    score += 5;
    subFactors.push({ factor: 'Selective Usage', impact: 5, description: 'Occasional advances (healthy)' });
  }

  // Revenue concentration
  if (data.revenueConcentration > 40) {
    score -= 10;
    subFactors.push({ factor: 'Customer Concentration', impact: -10, description: `${data.revenueConcentration.toFixed(0)}% from top customer (concentration risk)` });
  } else if (data.revenueConcentration < 20) {
    score += 5;
    subFactors.push({ factor: 'Diversified Revenue', impact: 5, description: 'Well-diversified customer base' });
  }

  // Tax compliance (critical)
  if (data.hasTaxCompliance) {
    score += 10;
    subFactors.push({ factor: 'Tax Compliance', impact: 10, description: 'SARS good standing' });
  } else {
    score -= 15;
    subFactors.push({ factor: 'Tax Non-Compliance', impact: -15, description: 'No SARS good standing (major risk)' });
  }

  // Banking relationship
  if (data.bankRelationshipYears >= 5) {
    score += 5;
    subFactors.push({ factor: 'Banking History', impact: 5, description: `${data.bankRelationshipYears}+ years banking relationship` });
  }

  // Returned payments
  if (data.returnedPayments > 2) {
    score -= 10;
    subFactors.push({ factor: 'Payment Returns', impact: -10, description: `${data.returnedPayments} returned payments last 12mo` });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.20;

  return {
    pillar: 'Client Financial Health',
    weight: 0.20,
    rawScore,
    weightedScore,
    maxScore: 20,
    description: `Revenue ${data.turnoverTrend6Mo}, ${data.advanceUtilizationRate.toFixed(0)}% facility used`,
    subFactors,
  };
}

/**
 * PILLAR 3: DEBTOR CREDITWORTHINESS (20%)
 */
function calculateDebtorCreditScore(data: DebtorCreditData): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // PAYDEX score (0-30 points)
  if (data.paydexScore !== undefined) {
    if (data.paydexScore >= 80) {
      score += 30;
      subFactors.push({ factor: 'D&B PAYDEX', impact: 30, description: `Excellent credit (${data.paydexScore})` });
    } else if (data.paydexScore >= 70) {
      score += 22;
      subFactors.push({ factor: 'D&B PAYDEX', impact: 22, description: `Good credit (${data.paydexScore})` });
    } else if (data.paydexScore >= 50) {
      score += 12;
      subFactors.push({ factor: 'D&B PAYDEX', impact: 12, description: `Fair credit (${data.paydexScore})` });
    } else {
      score += 3;
      subFactors.push({ factor: 'D&B PAYDEX', impact: 3, description: `Poor credit (${data.paydexScore})` });
    }
  } else if (data.creditRating) {
    // Alternative: credit rating
    const ratingScore: Record<string, number> = {
      'AAA': 30, 'AA': 28, 'A': 25, 'BBB': 20, 'BB': 15, 'B': 10, 'CCC': 5, 'CC': 3, 'C': 1, 'D': 0
    };
    const points = ratingScore[data.creditRating] || 10;
    score += points;
    subFactors.push({ factor: 'Credit Rating', impact: points, description: `${data.creditRating} rated` });
  } else {
    // No external data - use platform history
    score += 15;
    subFactors.push({ factor: 'Credit Score', impact: 15, description: 'No bureau data (using platform history)' });
  }

  // Platform payment history (0-25 points)
  if (data.platformAvgDaysToPay !== undefined) {
    if (data.platformAvgDaysToPay <= 30) {
      score += 25;
      subFactors.push({ factor: 'Platform History', impact: 25, description: `Pays in ${data.platformAvgDaysToPay} days on average (excellent)` });
    } else if (data.platformAvgDaysToPay <= 45) {
      score += 18;
      subFactors.push({ factor: 'Platform History', impact: 18, description: `Pays in ${data.platformAvgDaysToPay} days on average (good)` });
    } else if (data.platformAvgDaysToPay <= 60) {
      score += 10;
      subFactors.push({ factor: 'Platform History', impact: 10, description: `Pays in ${data.platformAvgDaysToPay} days on average (slow)` });
    } else {
      score += 3;
      subFactors.push({ factor: 'Platform History', impact: 3, description: `Pays in ${data.platformAvgDaysToPay} days on average (very slow)` });
    }
  }

  // Operator-specific relationship
  if (data.operatorSpecificAvgDays !== undefined && data.platformAvgDaysToPay !== undefined) {
    if (data.operatorSpecificAvgDays < data.platformAvgDaysToPay - 5) {
      score += 5;
      subFactors.push({ factor: 'Operator Relationship', impact: 5, description: 'Pays this operator faster than average' });
    } else if (data.operatorSpecificAvgDays > data.platformAvgDaysToPay + 5) {
      score -= 5;
      subFactors.push({ factor: 'Operator Relationship', impact: -5, description: 'Pays this operator slower than average' });
    }
  }

  // Payment consistency
  if (data.platformPaymentConsistency !== undefined) {
    if (data.platformPaymentConsistency < 7) {
      score += 10;
      subFactors.push({ factor: 'Payment Consistency', impact: 10, description: 'Very consistent payment timing' });
    } else if (data.platformPaymentConsistency > 15) {
      score -= 5;
      subFactors.push({ factor: 'Payment Variability', impact: -5, description: 'Erratic payment timing' });
    }
  }

  // Customer industry risk
  if (data.customerIndustry === 'government') {
    score += 10;
    subFactors.push({ factor: 'Customer Type', impact: 10, description: 'Government/SOE customer (low default risk)' });
  } else if (data.customerIndustry === 'fmcg' || data.customerIndustry === 'retail') {
    score += 5;
    subFactors.push({ factor: 'Customer Type', impact: 5, description: 'FMCG/Retail (stable)' });
  } else if (data.customerIndustry === 'mining' || data.customerIndustry === 'construction') {
    score -= 3;
    subFactors.push({ factor: 'Customer Type', impact: -3, description: `${data.customerIndustry} sector (cyclical)` });
  }

  // Customer size
  if (data.customerSize === 'large_corporate') {
    score += 8;
    subFactors.push({ factor: 'Customer Size', impact: 8, description: 'Large corporate (lower default risk)' });
  } else if (data.customerSize === 'sme' || data.customerSize === 'micro') {
    score -= 5;
    subFactors.push({ factor: 'Customer Size', impact: -5, description: 'SME/Micro (higher risk)' });
  }

  // Dispute rate
  if (data.disputeRate > 10) {
    score -= 15;
    subFactors.push({ factor: 'Dispute Rate', impact: -15, description: `${data.disputeRate.toFixed(0)}% dispute rate (major concern)` });
  } else if (data.disputeRate > 5) {
    score -= 8;
    subFactors.push({ factor: 'Dispute Rate', impact: -8, description: `${data.disputeRate.toFixed(0)}% dispute rate (elevated)` });
  } else if (data.disputeRate === 0) {
    score += 5;
    subFactors.push({ factor: 'No Disputes', impact: 5, description: 'Zero disputes on record' });
  }

  // Platform tenure
  if (data.platformTenureMonths >= 24) {
    score += 8;
    subFactors.push({ factor: 'Platform Tenure', impact: 8, description: `${data.platformTenureMonths} months on platform (established)` });
  } else if (data.platformTenureMonths < 6) {
    score -= 5;
    subFactors.push({ factor: 'New Customer', impact: -5, description: `Only ${data.platformTenureMonths} months of history` });
  }

  // Cross-operator intelligence
  if (data.hasCrossOperatorLatePaymentFlag) {
    score -= 12;
    subFactors.push({ factor: 'Cross-Platform Flag', impact: -12, description: 'Late payments to other operators (red flag)' });
  }

  // Payment method
  if (data.paymentMethod === 'auto_pay') {
    score += 8;
    subFactors.push({ factor: 'Payment Method', impact: 8, description: 'Automated payments (best)' });
  } else if (data.paymentMethod === 'cheque') {
    score -= 5;
    subFactors.push({ factor: 'Payment Method', impact: -5, description: 'Cheque payments (slow/risky)' });
  }

  // Jurisdiction
  if (data.jurisdiction === 'international') {
    score -= 8;
    subFactors.push({ factor: 'Jurisdiction', impact: -8, description: 'International customer (FX & legal risk)' });
  } else if (data.jurisdiction === 'sadc_cross_border') {
    score -= 3;
    subFactors.push({ factor: 'Jurisdiction', impact: -3, description: 'SADC cross-border (moderate risk)' });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.20;

  return {
    pillar: 'Debtor Creditworthiness',
    weight: 0.20,
    rawScore,
    weightedScore,
    maxScore: 20,
    description: `${data.customerIndustry} customer, ${data.customerSize}`,
    subFactors,
  };
}

/**
 * PILLAR 4: INVOICE CHARACTERISTICS (15%)
 */
function calculateInvoiceCharacteristicsScore(data: InvoiceCharacteristics): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // Invoice age (0-35 points) - CRITICAL
  if (data.ageInDays <= 7) {
    score += 35;
    subFactors.push({ factor: 'Invoice Age', impact: 35, description: `${data.ageInDays} days old (fresh - best)` });
  } else if (data.ageInDays <= 30) {
    score += 25;
    subFactors.push({ factor: 'Invoice Age', impact: 25, description: `${data.ageInDays} days old (normal)` });
  } else if (data.ageInDays <= 60) {
    score += 12;
    subFactors.push({ factor: 'Invoice Age', impact: 12, description: `${data.ageInDays} days old (aging)` });
  } else if (data.ageInDays <= 90) {
    score += 4;
    subFactors.push({ factor: 'Invoice Age', impact: 4, description: `${data.ageInDays} days old (stale)` });
  } else {
    score += 0;
    subFactors.push({ factor: 'Invoice Age', impact: 0, description: `${data.ageInDays} days old (ineligible - too old)` });
  }

  // Invoice amount vs average (outlier detection) (0-15 points)
  const amountRatio = data.amount / data.operatorAvgInvoiceAmount;
  if (amountRatio < 0.5) {
    score += 15;
    subFactors.push({ factor: 'Invoice Size', impact: 15, description: 'Below average size (low risk)' });
  } else if (amountRatio <= 1.5) {
    score += 12;
    subFactors.push({ factor: 'Invoice Size', impact: 12, description: 'Normal size' });
  } else if (amountRatio <= 2.5) {
    score += 6;
    subFactors.push({ factor: 'Invoice Size', impact: 6, description: `${amountRatio.toFixed(1)}x average size (outlier)` });
  } else {
    score += 2;
    subFactors.push({ factor: 'Invoice Size', impact: 2, description: `${amountRatio.toFixed(1)}x average size (major outlier risk)` });
  }

  // Concentration in facility (0-15 points)
  const facilityPercent = (data.amount / data.facilityLimit) * 100;
  if (facilityPercent < 5) {
    score += 15;
    subFactors.push({ factor: 'Facility Concentration', impact: 15, description: `${facilityPercent.toFixed(1)}% of facility (minimal)` });
  } else if (facilityPercent < 15) {
    score += 10;
    subFactors.push({ factor: 'Facility Concentration', impact: 10, description: `${facilityPercent.toFixed(1)}% of facility (low)` });
  } else if (facilityPercent < 30) {
    score += 5;
    subFactors.push({ factor: 'Facility Concentration', impact: 5, description: `${facilityPercent.toFixed(1)}% of facility (moderate)` });
  } else {
    score += 1;
    subFactors.push({ factor: 'Facility Concentration', impact: 1, description: `${facilityPercent.toFixed(1)}% of facility (concentrated)` });
  }

  // Days until due (0-15 points)
  if (data.daysUntilDue < 0) {
    const overdueDays = Math.abs(data.daysUntilDue);
    score -= 10;
    subFactors.push({ factor: 'Overdue', impact: -10, description: `${overdueDays} days overdue (escalating risk)` });
  } else if (data.daysUntilDue <= 7) {
    score += 5;
    subFactors.push({ factor: 'Due Soon', impact: 5, description: `Due in ${data.daysUntilDue} days` });
  } else {
    score += 15;
    subFactors.push({ factor: 'Payment Terms', impact: 15, description: `${data.daysUntilDue} days until due` });
  }

  // Currency (0-10 points)
  if (data.currency === 'ZAR') {
    score += 10;
    subFactors.push({ factor: 'Currency', impact: 10, description: 'ZAR (no FX risk)' });
  } else if (data.currency === 'USD') {
    score += 5;
    subFactors.push({ factor: 'Currency', impact: 5, description: 'USD (FX risk)' });
  } else {
    score += 2;
    subFactors.push({ factor: 'Currency', impact: 2, description: `${data.currency} (higher FX risk)` });
  }

  // Invoice type
  if (data.invoiceType === 'single_trip') {
    score += 5;
    subFactors.push({ factor: 'Invoice Type', impact: 5, description: 'Single trip (clearer)' });
  } else {
    score -= 3;
    subFactors.push({ factor: 'Invoice Type', impact: -3, description: 'Consolidated (partial dispute risk)' });
  }

  // Documentation quality
  if (data.hasDetailedLineItems) {
    score += 5;
    subFactors.push({ factor: 'Line Items', impact: 5, description: 'Detailed breakdown provided' });
  }

  if (data.hasCreditNotes) {
    score -= 5;
    subFactors.push({ factor: 'Credit Notes', impact: -5, description: 'Credit notes issued (disputes)' });
  }

  if (data.hasLinkedPO) {
    score += 5;
    subFactors.push({ factor: 'Purchase Order', impact: 5, description: 'Linked PO (traceable supply chain)' });
  }

  // Recurring customer
  if (data.isRecurringCustomer) {
    score += 5;
    subFactors.push({ factor: 'Recurring Business', impact: 5, description: 'Recurring customer relationship' });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.15;

  return {
    pillar: 'Invoice Characteristics',
    weight: 0.15,
    rawScore,
    weightedScore,
    maxScore: 15,
    description: `R${(data.amount / 1000).toFixed(0)}k, ${data.ageInDays}d old, ${data.daysUntilDue}d until due`,
    subFactors,
  };
}

/**
 * PILLAR 5: POD & DOCUMENTATION (10%)
 */
function calculatePODScore(data: PODDocumentation): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // POD type (0-40 points)
  switch (data.podType) {
    case 'e_signature':
      score += 40;
      subFactors.push({ factor: 'POD Type', impact: 40, description: 'E-signature (best)' });
      break;
    case 'geo_photo':
      score += 32;
      subFactors.push({ factor: 'POD Type', impact: 32, description: 'Geo-tagged photo (good)' });
      break;
    case 'scanned':
      score += 24;
      subFactors.push({ factor: 'POD Type', impact: 24, description: 'Scanned document (ok)' });
      break;
    case 'manual':
      score += 10;
      subFactors.push({ factor: 'POD Type', impact: 10, description: 'Manual entry (poor)' });
      break;
    case 'none':
      score += 0;
      subFactors.push({ factor: 'POD Type', impact: 0, description: 'No POD (ineligible)' });
      break;
  }

  // Completeness (0-25 points)
  let completenessScore = 0;
  if (data.hasReceiverName) completenessScore += 7;
  if (data.hasSignature) completenessScore += 10;
  if (data.hasDate) completenessScore += 5;
  if (data.hasConditionNotes) completenessScore += 3;

  score += completenessScore;
  if (completenessScore === 25) {
    subFactors.push({ factor: 'POD Completeness', impact: 25, description: 'All fields complete' });
  } else if (completenessScore >= 15) {
    subFactors.push({ factor: 'POD Completeness', impact: completenessScore, description: 'Most fields complete' });
  } else {
    subFactors.push({ factor: 'POD Incompleteness', impact: completenessScore, description: 'Missing critical fields' });
  }

  // Verification (0-15 points)
  if (data.podTimestampMatchesDelivery) {
    score += 8;
    subFactors.push({ factor: 'Timestamp Match', impact: 8, description: 'POD timestamp matches delivery date' });
  } else {
    score -= 5;
    subFactors.push({ factor: 'Timestamp Mismatch', impact: -5, description: 'POD timestamp suspicious' });
  }

  if (data.hasGPSTracking) {
    score += 7;
    subFactors.push({ factor: 'GPS Tracking', impact: 7, description: 'GPS confirms delivery location' });
  }

  // Exceptions
  if (data.hasDeliveryExceptions) {
    score -= 10;
    subFactors.push({ factor: 'Delivery Exceptions', impact: -10, description: 'Damage/shortage/refusal noted' });
  }

  // Supporting documents (0-20 points)
  let docsScore = 0;
  if (data.hasWaybill) docsScore += 6;
  if (data.hasWeighbridgeTicket) docsScore += 5;
  if (data.hasCustomsClearance) docsScore += 5;
  if (data.hasPhotos) docsScore += 4;

  score += docsScore;
  if (docsScore >= 15) {
    subFactors.push({ factor: 'Supporting Docs', impact: docsScore, description: 'Comprehensive documentation' });
  } else if (docsScore > 0) {
    subFactors.push({ factor: 'Supporting Docs', impact: docsScore, description: 'Some supporting documents' });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.10;

  return {
    pillar: 'Proof of Delivery & Documentation',
    weight: 0.10,
    rawScore,
    weightedScore,
    maxScore: 10,
    description: `${data.podType} POD, ${completenessScore === 25 ? 'complete' : 'partial'} fields`,
    subFactors,
  };
}

/**
 * PILLAR 6: OPERATIONAL & TRIP FACTORS (10%)
 */
function calculateOperationalScore(data: OperationalFactors): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // Route risk (0-25 points)
  switch (data.routeRiskLevel) {
    case 'low':
      score += 25;
      subFactors.push({ factor: 'Route Risk', impact: 25, description: 'Low-risk corridor' });
      break;
    case 'moderate':
      score += 18;
      subFactors.push({ factor: 'Route Risk', impact: 18, description: 'Moderate-risk corridor' });
      break;
    case 'high':
      score += 10;
      subFactors.push({ factor: 'Route Risk', impact: 10, description: 'High-risk corridor (hijacking)' });
      break;
    case 'very_high':
      score += 3;
      subFactors.push({ factor: 'Route Risk', impact: 3, description: 'Very high-risk corridor (major concern)' });
      break;
  }

  // Cargo type (0-20 points)
  switch (data.cargoType) {
    case 'general':
      score += 20;
      subFactors.push({ factor: 'Cargo Type', impact: 20, description: 'General freight (standard)' });
      break;
    case 'perishable':
      score += 12;
      subFactors.push({ factor: 'Cargo Type', impact: 12, description: 'Perishable goods (time pressure)' });
      break;
    case 'hazmat':
      score += 8;
      subFactors.push({ factor: 'Cargo Type', impact: 8, description: 'Hazardous materials (regulatory risk)' });
      break;
    case 'high_value':
      score += 10;
      subFactors.push({ factor: 'Cargo Type', impact: 10, description: 'High-value goods (theft risk)' });
      break;
  }

  // Distance
  if (data.distanceKm > 1000) {
    score += 5;
    subFactors.push({ factor: 'Distance', impact: 5, description: `${data.distanceKm}km long haul` });
  } else if (data.distanceKm < 200) {
    score += 10;
    subFactors.push({ factor: 'Distance', impact: 10, description: `${data.distanceKm}km short haul (lower risk)` });
  } else {
    score += 8;
    subFactors.push({ factor: 'Distance', impact: 8, description: `${data.distanceKm}km medium haul` });
  }

  // Trip completion rate (0-20 points)
  if (data.tripCompletionRate >= 95) {
    score += 20;
    subFactors.push({ factor: 'Completion Rate', impact: 20, description: `${data.tripCompletionRate.toFixed(0)}% completion rate (excellent)` });
  } else if (data.tripCompletionRate >= 90) {
    score += 15;
    subFactors.push({ factor: 'Completion Rate', impact: 15, description: `${data.tripCompletionRate.toFixed(0)}% completion rate (good)` });
  } else if (data.tripCompletionRate >= 85) {
    score += 10;
    subFactors.push({ factor: 'Completion Rate', impact: 10, description: `${data.tripCompletionRate.toFixed(0)}% completion rate (fair)` });
  } else {
    score += 3;
    subFactors.push({ factor: 'Completion Rate', impact: 3, description: `${data.tripCompletionRate.toFixed(0)}% completion rate (concerning)` });
  }

  // Vehicle condition
  if (data.hasCurrentRoadworthy) {
    score += 10;
    subFactors.push({ factor: 'Roadworthy', impact: 10, description: 'Current roadworthy certificate' });
  } else {
    score -= 10;
    subFactors.push({ factor: 'No Roadworthy', impact: -10, description: 'No current roadworthy (major risk)' });
  }

  if (data.vehicleLastServiceDays <= 30) {
    score += 5;
    subFactors.push({ factor: 'Vehicle Service', impact: 5, description: `Serviced ${data.vehicleLastServiceDays} days ago` });
  } else if (data.vehicleLastServiceDays > 180) {
    score -= 5;
    subFactors.push({ factor: 'Service Overdue', impact: -5, description: `Not serviced in ${data.vehicleLastServiceDays} days` });
  }

  // Driver
  if (data.driverViolations === 0) {
    score += 8;
    subFactors.push({ factor: 'Driver Record', impact: 8, description: 'Clean driving record' });
  } else if (data.driverViolations > 3) {
    score -= 8;
    subFactors.push({ factor: 'Driver Violations', impact: -8, description: `${data.driverViolations} violations last 12mo` });
  }

  if (data.driverExperienceYears >= 10) {
    score += 5;
    subFactors.push({ factor: 'Driver Experience', impact: 5, description: `${data.driverExperienceYears}+ years experience` });
  } else if (data.driverExperienceYears < 3) {
    score -= 3;
    subFactors.push({ factor: 'Driver Experience', impact: -3, description: `Only ${data.driverExperienceYears} years experience` });
  }

  // Seasonal factors
  if (data.isSeasonalSlowdown) {
    score -= 5;
    subFactors.push({ factor: 'Seasonality', impact: -5, description: 'Q4 holiday slowdown period' });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.10;

  return {
    pillar: 'Operational & Trip Factors',
    weight: 0.10,
    rawScore,
    weightedScore,
    maxScore: 10,
    description: `${data.routeRiskLevel} risk route, ${data.cargoType} cargo`,
    subFactors,
  };
}

/**
 * PILLAR 7: MACRO & MARKET FACTORS (10%)
 */
function calculateMacroScore(data: MacroMarketFactors): RiskFactorBreakdown {
  let score = 0;
  const subFactors: Array<{ factor: string; impact: number; description: string }> = [];

  // ZAR volatility (0-20 points)
  if (data.zarVolatility30d < 3) {
    score += 20;
    subFactors.push({ factor: 'ZAR Stability', impact: 20, description: 'Low FX volatility' });
  } else if (data.zarVolatility30d < 6) {
    score += 12;
    subFactors.push({ factor: 'ZAR Volatility', impact: 12, description: 'Moderate FX volatility' });
  } else {
    score += 5;
    subFactors.push({ factor: 'ZAR Volatility', impact: 5, description: `High FX volatility (${data.zarVolatility30d.toFixed(1)}%)` });
  }

  // SARB repo rate (0-15 points) - higher rate = more demand for advances
  if (data.sarbRepoRate > 8.0) {
    score += 10;
    subFactors.push({ factor: 'Repo Rate', impact: 10, description: `${data.sarbRepoRate}% repo rate (tight cash)` });
  } else if (data.sarbRepoRate < 6.0) {
    score += 15;
    subFactors.push({ factor: 'Repo Rate', impact: 15, description: `${data.sarbRepoRate}% repo rate (easier cash)` });
  } else {
    score += 12;
    subFactors.push({ factor: 'Repo Rate', impact: 12, description: `${data.sarbRepoRate}% repo rate (neutral)` });
  }

  // Freight demand index (0-20 points)
  if (data.freightDemandIndex >= 70) {
    score += 20;
    subFactors.push({ factor: 'Freight Demand', impact: 20, description: 'Strong freight demand' });
  } else if (data.freightDemandIndex >= 50) {
    score += 12;
    subFactors.push({ factor: 'Freight Demand', impact: 12, description: 'Moderate freight demand' });
  } else {
    score += 5;
    subFactors.push({ factor: 'Freight Demand', impact: 5, description: 'Weak freight demand (pressure on rates)' });
  }

  // Fuel price trend (0-15 points)
  if (data.fuelPriceTrend3Mo === 'declining') {
    score += 15;
    subFactors.push({ factor: 'Fuel Prices', impact: 15, description: 'Declining fuel prices (margin relief)' });
  } else if (data.fuelPriceTrend3Mo === 'stable') {
    score += 10;
    subFactors.push({ factor: 'Fuel Prices', impact: 10, description: 'Stable fuel prices' });
  } else {
    score += 3;
    subFactors.push({ factor: 'Fuel Prices', impact: 3, description: 'Rising fuel prices (margin squeeze)' });
  }

  // Platform default rate (0-20 points)
  if (data.platformDefaultRate90d < 1.0) {
    score += 20;
    subFactors.push({ factor: 'Platform Health', impact: 20, description: `${data.platformDefaultRate90d.toFixed(1)}% default rate (healthy)` });
  } else if (data.platformDefaultRate90d < 3.0) {
    score += 12;
    subFactors.push({ factor: 'Platform Health', impact: 12, description: `${data.platformDefaultRate90d.toFixed(1)}% default rate (normal)` });
  } else {
    score += 3;
    subFactors.push({ factor: 'Platform Health', impact: 3, description: `${data.platformDefaultRate90d.toFixed(1)}% default rate (stressed)` });
  }

  // PMI Index
  if (data.pmiIndex !== undefined) {
    if (data.pmiIndex > 50) {
      score += 10;
      subFactors.push({ factor: 'PMI', impact: 10, description: `PMI ${data.pmiIndex} (expansion)` });
    } else {
      score += 3;
      subFactors.push({ factor: 'PMI', impact: 3, description: `PMI ${data.pmiIndex} (contraction)` });
    }
  }

  // Load shedding
  if (data.loadSheddingImpactIndex > 50) {
    score -= 10;
    subFactors.push({ factor: 'Load Shedding', impact: -10, description: 'High load shedding (operational disruption)' });
  } else if (data.loadSheddingImpactIndex > 20) {
    score -= 5;
    subFactors.push({ factor: 'Load Shedding', impact: -5, description: 'Moderate load shedding' });
  }

  // Seasonal payment slowdown
  if (data.isSeasonalPaymentSlowdown) {
    score -= 8;
    subFactors.push({ factor: 'Seasonal Slowdown', impact: -8, description: 'Dec/Jan payment slowdown period' });
  }

  // Normalize to 0-100
  const rawScore = Math.max(0, Math.min(100, score));
  const weightedScore = rawScore * 0.10;

  return {
    pillar: 'Macro & Market Factors',
    weight: 0.10,
    rawScore,
    weightedScore,
    maxScore: 10,
    description: `ZAR volatility ${data.zarVolatility30d.toFixed(1)}%, freight demand ${data.freightDemandIndex}`,
    subFactors,
  };
}

// ==========================
// SCORE ADJUSTMENTS
// ==========================

function calculateScoreAdjustments(
  clientIdentity: ClientIdentityData,
  clientFinancial: ClientFinancialData,
  debtorCredit: DebtorCreditData,
  invoice: InvoiceCharacteristics,
  pod: PODDocumentation
): ScoreAdjustment[] {
  const adjustments: ScoreAdjustment[] = [];

  // First-time operator (no history)
  if (clientIdentity.companyAgeYears < 1) {
    adjustments.push({
      type: 'first_time_operator',
      amountPoints: -10,
      description: 'First-time operator (<1 year) - limited track record',
    });
  }

  // Active dispute on invoice - NEVER (this is on different invoice, per spec)

  // High facility utilization
  if (clientFinancial.advanceUtilizationRate > 85) {
    adjustments.push({
      type: 'high_utilization',
      amountPoints: -8,
      description: `${clientFinancial.advanceUtilizationRate.toFixed(0)}% facility utilization (stress signal)`,
    });
  }

  // Cross-platform late payment flag
  if (debtorCredit.hasCrossOperatorLatePaymentFlag) {
    adjustments.push({
      type: 'cross_platform_flag',
      amountPoints: -12,
      description: 'Customer late on other operators (cross-platform intelligence)',
    });
  }

  // Perfect repayment record (bonus)
  if (clientFinancial.returnedPayments === 0 && clientIdentity.companyAgeYears >= 1) {
    adjustments.push({
      type: 'perfect_record',
      amountPoints: 5,
      description: 'Perfect 12-month repayment record',
    });
  }

  // Government/SOE customer (bonus)
  if (debtorCredit.customerIndustry === 'government') {
    adjustments.push({
      type: 'government_customer',
      amountPoints: 8,
      description: 'Government/SOE customer (low default risk)',
    });
  }

  // Multiple POD types (bonus)
  if (pod.hasPhotos && pod.hasGPSTracking && pod.podType === 'e_signature') {
    adjustments.push({
      type: 'multiple_pod_types',
      amountPoints: 3,
      description: 'Multiple POD verification methods',
    });
  }

  return adjustments;
}

// ==========================
// INELIGIBILITY CHECKS
// ==========================

function checkIneligibility(
  finalScore: number,
  invoice: InvoiceCharacteristics,
  debtorCredit: DebtorCreditData,
  pod: PODDocumentation,
  clientFinancial: ClientFinancialData,
  clientIdentity: ClientIdentityData
): IneligibilityReason[] {
  const reasons: IneligibilityReason[] = [];

  // 1. Score too low
  if (finalScore < 40) {
    reasons.push({
      rule: 'score_below_minimum',
      description: 'Risk score below minimum threshold (40)',
      severity: 'critical',
    });
  }

  // 2. Invoice too old
  if (invoice.ageInDays > 90) {
    reasons.push({
      rule: 'invoice_age_exceeds_limit',
      description: `Invoice age (${invoice.ageInDays} days) exceeds 90-day limit`,
      severity: 'critical',
    });
  }

  // 3. Customer flagged as bankrupt
  if (debtorCredit.creditRating === 'D') {
    reasons.push({
      rule: 'customer_bankrupt',
      description: 'Customer flagged as bankrupt/under business rescue',
      severity: 'critical',
    });
  }

  // 4. Active dispute on THIS specific invoice - would need invoice-specific data
  // (Not implementable here without per-invoice dispute flag)

  // 5. No POD attached
  if (pod.podType === 'none') {
    reasons.push({
      rule: 'no_pod',
      description: 'Proof of Delivery not attached or verified',
      severity: 'critical',
    });
  }

  // 6. Operator flagged for fraud - would need operator flag
  // (Not implementable without specific fraud flag)

  // 7. Advance would exceed facility limit
  const currentOutstanding = (clientFinancial.advanceUtilizationRate / 100) * invoice.facilityLimit;
  if (currentOutstanding + invoice.amount > invoice.facilityLimit) {
    reasons.push({
      rule: 'exceeds_facility_limit',
      description: 'Advance would exceed facility limit',
      severity: 'critical',
    });
  }

  // 8. Invoice already factored elsewhere - would need duplicate check
  // (Not implementable without external data)

  // 9. Operator account suspended - would need status flag
  // (Not implementable without specific status)

  // 10. Missing KYC/FICA - assume if no tax compliance
  if (!clientFinancial.hasTaxCompliance) {
    reasons.push({
      rule: 'missing_kyc_fica',
      description: 'Missing KYC/FICA documentation (no SARS compliance)',
      severity: 'major',
    });
  }

  return reasons;
}

// ==========================
// RISK TIER MAPPING
// ==========================

function getRiskTier(score: number): RiskTier {
  if (score >= 85) return 'prime';
  if (score >= 70) return 'standard';
  if (score >= 55) return 'elevated';
  if (score >= 40) return 'high';
  return 'ineligible';
}

function getTierPricing(tier: RiskTier): {
  baseFee: number;
  maxAdvancePercent: number;
  turnaround: string;
} {
  switch (tier) {
    case 'prime':
      return { baseFee: 1.75, maxAdvancePercent: 90, turnaround: '2-4 hours' };
    case 'standard':
      return { baseFee: 2.375, maxAdvancePercent: 85, turnaround: '4-8 hours' };
    case 'elevated':
      return { baseFee: 3.125, maxAdvancePercent: 75, turnaround: '8-24 hours' };
    case 'high':
      return { baseFee: 4.0, maxAdvancePercent: 65, turnaround: '24-48 hours' };
    case 'ineligible':
      return { baseFee: 0, maxAdvancePercent: 0, turnaround: 'N/A' };
  }
}

// ==========================
// FEE ADJUSTMENTS
// ==========================

function calculateFeeAdjustments(
  invoice: InvoiceCharacteristics,
  clientFinancial: ClientFinancialData,
  debtorCredit: DebtorCreditData,
  clientIdentity: ClientIdentityData
): FeeAdjustment[] {
  const adjustments: FeeAdjustment[] = [];

  // Invoice age adjustments
  if (invoice.ageInDays >= 61 && invoice.ageInDays <= 90) {
    adjustments.push({
      type: 'aged_invoice_61_90',
      amountPercent: 0.75,
      description: 'Invoice aged 61-90 days',
    });
  } else if (invoice.ageInDays >= 31 && invoice.ageInDays <= 60) {
    adjustments.push({
      type: 'aged_invoice_31_60',
      amountPercent: 0.25,
      description: 'Invoice aged 31-60 days',
    });
  }

  // First-time customer
  if (debtorCredit.platformTenureMonths < 3) {
    adjustments.push({
      type: 'first_time_customer',
      amountPercent: 0.50,
      description: 'First-time customer (<3 months)',
    });
  }

  // Active dispute on DIFFERENT invoice - would need additional data
  // (Skipped for now)

  // High facility utilization
  if (clientFinancial.advanceUtilizationRate > 80) {
    adjustments.push({
      type: 'high_facility_utilization',
      amountPercent: 0.25,
      description: `High facility utilization (${clientFinancial.advanceUtilizationRate.toFixed(0)}%)`,
    });
  }

  // Perfect repayment history (discount)
  if (clientFinancial.returnedPayments === 0 && clientIdentity.companyAgeYears >= 1) {
    adjustments.push({
      type: 'perfect_repayment_history',
      amountPercent: -0.25,
      description: 'Perfect repayment history (12mo)',
    });
  }

  // Government/SOE debtor (discount)
  if (debtorCredit.customerIndustry === 'government') {
    adjustments.push({
      type: 'government_debtor',
      amountPercent: -0.25,
      description: 'Government/SOE debtor',
    });
  }

  return adjustments;
}

// ==========================
// EXPLAINABILITY
// ==========================

function extractTopDriversAndStrengths(pillars: RiskFactorBreakdown[]): {
  topRiskDrivers: Array<{ factor: string; impact: string }>;
  topStrengths: Array<{ factor: string; impact: string }>;
} {
  const allSubFactors: Array<{ factor: string; impact: number; pillar: string }> = [];

  pillars.forEach((pillar) => {
    if (pillar.subFactors) {
      pillar.subFactors.forEach((sub) => {
        allSubFactors.push({
          factor: sub.factor,
          impact: sub.impact,
          pillar: pillar.pillar,
        });
      });
    }
  });

  // Sort by impact (most negative first for risk drivers, most positive for strengths)
  const sortedByImpact = [...allSubFactors].sort((a, b) => a.impact - b.impact);

  // Top 3 risk drivers (negative impact)
  const topRiskDrivers = sortedByImpact
    .filter((f) => f.impact < 0)
    .slice(0, 3)
    .map((f) => ({
      factor: f.factor,
      impact: `${f.impact > 0 ? '+' : ''}${f.impact} points`,
    }));

  // Top 3 strengths (positive impact)
  const topStrengths = sortedByImpact
    .filter((f) => f.impact > 0)
    .reverse()
    .slice(0, 3)
    .map((f) => ({
      factor: f.factor,
      impact: `+${f.impact} points`,
    }));

  return { topRiskDrivers, topStrengths };
}

function calculateConfidenceLevel(
  clientIdentity: ClientIdentityData,
  clientFinancial: ClientFinancialData,
  debtorCredit: DebtorCreditData,
  pod: PODDocumentation
): number {
  let dataPoints = 0;
  let providedPoints = 0;

  // Client Identity (10 data points)
  dataPoints += 10;
  providedPoints += 10; // Always provided

  // Client Financial (10 data points)
  dataPoints += 10;
  if (clientFinancial.monthlyTurnover > 0) providedPoints++;
  if (clientFinancial.turnoverTrend6Mo) providedPoints++;
  if (clientFinancial.turnoverVolatility >= 0) providedPoints++;
  if (clientFinancial.grossMarginTrend) providedPoints++;
  if (clientFinancial.outstandingInvoicesRatio >= 0) providedPoints++;
  if (clientFinancial.advanceUtilizationRate >= 0) providedPoints++;
  if (clientFinancial.hasTaxCompliance !== undefined) providedPoints++;
  if (clientFinancial.bankRelationshipYears >= 0) providedPoints++;
  if (clientFinancial.returnedPayments >= 0) providedPoints++;
  if (clientFinancial.revenueConcentration >= 0) providedPoints++;

  // Debtor Credit (8 data points)
  dataPoints += 8;
  if (debtorCredit.paydexScore !== undefined || debtorCredit.creditRating !== undefined) providedPoints++;
  if (debtorCredit.platformAvgDaysToPay !== undefined) providedPoints++;
  if (debtorCredit.operatorSpecificAvgDays !== undefined) providedPoints++;
  if (debtorCredit.platformPaymentConsistency !== undefined) providedPoints++;
  if (debtorCredit.disputeRate >= 0) providedPoints++;
  if (debtorCredit.platformTenureMonths >= 0) providedPoints++;
  if (debtorCredit.customerOutstandingBalance >= 0) providedPoints++;
  if (debtorCredit.paymentMethod) providedPoints++;

  // POD (5 data points)
  dataPoints += 5;
  if (pod.podType !== 'none') providedPoints++;
  if (pod.hasReceiverName) providedPoints++;
  if (pod.hasSignature) providedPoints++;
  if (pod.hasDate) providedPoints++;
  if (pod.hasGPSTracking) providedPoints++;

  return Math.round((providedPoints / dataPoints) * 100);
}

// ==========================
// MAIN SCORING FUNCTION
// ==========================

export function calculateRiskScore(
  clientIdentity: ClientIdentityData,
  clientFinancial: ClientFinancialData,
  debtorCredit: DebtorCreditData,
  invoice: InvoiceCharacteristics,
  pod: PODDocumentation,
  operational: OperationalFactors,
  macro: MacroMarketFactors
): RiskScoreResult {
  // Calculate each pillar
  const pillar1 = calculateClientIdentityScore(clientIdentity);
  const pillar2 = calculateClientFinancialScore(clientFinancial);
  const pillar3 = calculateDebtorCreditScore(debtorCredit);
  const pillar4 = calculateInvoiceCharacteristicsScore(invoice);
  const pillar5 = calculatePODScore(pod);
  const pillar6 = calculateOperationalScore(operational);
  const pillar7 = calculateMacroScore(macro);

  const pillarBreakdown = [pillar1, pillar2, pillar3, pillar4, pillar5, pillar6, pillar7];

  // Sum weighted scores to get raw score
  const rawScore = Math.round(
    pillarBreakdown.reduce((sum, pillar) => sum + pillar.weightedScore, 0) * (100 / 100) // Already weighted, scale to 0-100
  );

  // Calculate score adjustments
  const scoreAdjustments = calculateScoreAdjustments(
    clientIdentity,
    clientFinancial,
    debtorCredit,
    invoice,
    pod
  );

  // Apply adjustments
  const adjustmentTotal = scoreAdjustments.reduce((sum, adj) => sum + adj.amountPoints, 0);
  const finalScore = Math.max(0, Math.min(100, rawScore + adjustmentTotal));

  // Determine tier
  const tier = getRiskTier(finalScore);
  const { baseFee, maxAdvancePercent, turnaround } = getTierPricing(tier);

  // Calculate fee adjustments
  const feeAdjustments = calculateFeeAdjustments(invoice, clientFinancial, debtorCredit, clientIdentity);

  // Apply fee adjustments
  const feeAdjustmentTotal = feeAdjustments.reduce((sum, adj) => sum + adj.amountPercent, 0);
  const finalFee = Math.max(1.0, Math.min(5.0, baseFee + feeAdjustmentTotal));

  // Calculate amounts
  const feeAmount = (invoice.amount * finalFee) / 100;
  const grossAdvance = (invoice.amount * maxAdvancePercent) / 100;
  const netAdvance = grossAdvance - feeAmount;

  // Check ineligibility
  const ineligibilityReasons = checkIneligibility(
    finalScore,
    invoice,
    debtorCredit,
    pod,
    clientFinancial,
    clientIdentity
  );
  const isEligible = ineligibilityReasons.length === 0;

  // Explainability
  const { topRiskDrivers, topStrengths } = extractTopDriversAndStrengths(pillarBreakdown);
  const confidenceLevel = calculateConfidenceLevel(clientIdentity, clientFinancial, debtorCredit, pod);

  // Timestamps
  const now = new Date();
  const validUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h

  return {
    invoiceId: invoice.invoiceId,
    rawScore,
    adjustments: scoreAdjustments,
    finalScore,
    riskTier: tier,
    isEligible,
    ineligibilityReasons,
    pillarBreakdown,
    baseFeePercent: baseFee,
    feeAdjustments,
    finalFeePercent: Number(finalFee.toFixed(2)),
    maxAdvancePercent,
    estimatedTurnaround: turnaround,
    invoiceAmount: invoice.amount,
    feeAmount: Number(feeAmount.toFixed(2)),
    netAdvance: Number(netAdvance.toFixed(2)),
    topRiskDrivers,
    topStrengths,
    confidenceLevel,
    calculatedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
  };
}

// ==========================
// TIER DISPLAY INFO
// ==========================

export function getRiskTierInfo(tier: RiskTier): {
  label: string;
  color: string;
  bgColor: string;
  description: string;
} {
  switch (tier) {
    case 'prime':
      return {
        label: 'PRIME',
        color: 'var(--status-success)',
        bgColor: 'var(--bg-success-subtle)',
        description: 'Very low risk, premium pricing, fast turnaround',
      };
    case 'standard':
      return {
        label: 'STANDARD',
        color: 'var(--accent-primary)',
        bgColor: 'var(--bg-info-subtle)',
        description: 'Low risk, competitive pricing',
      };
    case 'elevated':
      return {
        label: 'ELEVATED',
        color: 'var(--status-warning)',
        bgColor: 'var(--bg-warning-subtle)',
        description: 'Moderate risk, standard pricing',
      };
    case 'high':
      return {
        label: 'HIGH',
        color: 'var(--status-danger)',
        bgColor: 'var(--bg-danger-subtle)',
        description: 'High risk, premium pricing required',
      };
    case 'ineligible':
      return {
        label: 'INELIGIBLE',
        color: 'var(--text-secondary)',
        bgColor: 'var(--bg-surface)',
        description: 'Does not meet eligibility criteria',
      };
  }
}
