/**
 * Risk Engine Tests
 *
 * Comprehensive test coverage for all 6 scoring factors, tiers, fees, and edge cases.
 */

import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore,
  getRiskTierInfo,
  type InvoiceData,
  type PaymentHistoryData,
  type PODVerification,
  type CreditBureauData,
  type RelationshipData,
  type FacilityData
} from './risk-engine';

// Helper to create base test data
function createBaseInvoice(): InvoiceData {
  return {
    invoiceId: 'INV-TEST-001',
    customerId: 'CUST-001',
    customerName: 'Test Customer',
    amount: 10000, // R10,000
    createdDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    dueDate: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'SENT',
    ageInDays: 5
  };
}

function createBasePaymentHistory(): PaymentHistoryData {
  return {
    totalInvoices: 20,
    onTimeCount: 19, // 95% on-time
    avgDaysLate: 5,
    hasActiveDispute: false
  };
}

function createBasePOD(): PODVerification {
  return {
    method: 'e_signature',
    allFieldsComplete: true,
    hasQualityIssues: []
  };
}

function createBaseCredit(): CreditBureauData {
  return {
    rating: 'A',
    hasBankruptcy: false
  };
}

function createBaseRelationship(): RelationshipData {
  return {
    firstTransactionDate: new Date(Date.now() - 18 * 30 * 24 * 60 * 60 * 1000).toISOString(), // 18 months ago
    transactionCount: 54 // ~3 per month
  };
}

function createBaseFacility(): FacilityData {
  return {
    facilityLimit: 200000, // R200,000
    currentOutstanding: 50000, // R50,000
    invoiceAmount: 10000 // R10,000 (5% of facility)
  };
}

describe('Risk Engine - Perfect Customer (Excellent Tier)', () => {
  it('should score 95+ for perfect customer with fresh invoice', () => {
    const invoice = createBaseInvoice();
    const payment = { ...createBasePaymentHistory(), onTimeCount: 20 }; // 100% on-time
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = { ...createBaseRelationship(), transactionCount: 60 };
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.riskScore).toBeGreaterThanOrEqual(95);
    expect(result.riskTier).toBe('excellent');
    expect(result.isEligible).toBe(true);
    expect(result.finalFeePercent).toBeLessThan(2.5);
  });

  it('should apply discount for very fresh invoice (<7 days)', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 3 };
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const hasFreshDiscount = result.adjustments.some(
      adj => adj.type === 'fresh_invoice' && adj.amountPercent < 0
    );
    expect(hasFreshDiscount).toBe(true);
  });
});

describe('Risk Engine - Good Tier Customer', () => {
  it('should score 70-84 for good customer with minor issues', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 15 };
    const payment = { ...createBasePaymentHistory(), onTimeCount: 17 }; // 85% on-time
    const pod = createBasePOD();
    const credit = { rating: 'B+' as const, hasBankruptcy: false };
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.riskScore).toBeGreaterThanOrEqual(70);
    expect(result.riskScore).toBeLessThan(85);
    expect(result.riskTier).toBe('good');
    expect(result.baseFeePercent).toBe(2.75);
  });
});

describe('Risk Engine - Fair Tier Customer', () => {
  it('should score 55-69 for fair customer with moderate risk', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 35 };
    const payment = { ...createBasePaymentHistory(), onTimeCount: 15, avgDaysLate: 12 }; // 75% on-time
    const pod = { method: 'photo_timestamp' as const, allFieldsComplete: true };
    const credit = { rating: 'B' as const, hasBankruptcy: false };
    const relationship = {
      firstTransactionDate: new Date(Date.now() - 8 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactionCount: 20
    };
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.riskScore).toBeGreaterThanOrEqual(55);
    expect(result.riskScore).toBeLessThan(70);
    expect(result.riskTier).toBe('fair');
    expect(result.baseFeePercent).toBe(3.25);
  });

  it('should add penalty for aged invoice (31-45 days)', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 35 };
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const hasAgePenalty = result.adjustments.some(
      adj => adj.type === 'aged_invoice' && adj.amountPercent > 0
    );
    expect(hasAgePenalty).toBe(true);
  });
});

describe('Risk Engine - Elevated Tier Customer', () => {
  it('should score 40-54 for elevated risk customer', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 50 };
    const payment = { totalInvoices: 10, onTimeCount: 6, avgDaysLate: 35, hasActiveDispute: false }; // 60% on-time
    const pod = { method: 'driver_signature' as const, allFieldsComplete: false };
    const credit = { rating: 'B-' as const, hasBankruptcy: false };
    const relationship = {
      firstTransactionDate: new Date(Date.now() - 4 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactionCount: 6
    };
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.riskScore).toBeGreaterThanOrEqual(40);
    expect(result.riskScore).toBeLessThan(55);
    expect(result.riskTier).toBe('elevated');
    expect(result.baseFeePercent).toBe(3.75);
  });

  it('should charge maximum fee (4.0%) with multiple risk factors', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 70 };
    const payment = { totalInvoices: 5, onTimeCount: 3, avgDaysLate: 40, hasActiveDispute: false };
    const pod = { method: 'photo' as const, allFieldsComplete: false };
    const credit = { rating: 'C' as const, hasBankruptcy: false };
    const relationship = {
      firstTransactionDate: new Date(Date.now() - 2 * 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactionCount: 2
    };
    const facility = { ...createBaseFacility(), currentOutstanding: 170000 }; // High utilization

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.finalFeePercent).toBe(4.0); // At cap
  });
});

describe('Risk Engine - Ineligible Cases', () => {
  it('should reject invoice with score < 40', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 85 };
    const payment = { totalInvoices: 10, onTimeCount: 4, avgDaysLate: 60, hasActiveDispute: false }; // 40% on-time
    const pod = { method: 'manual' as const, allFieldsComplete: false };
    const credit = { rating: 'C-' as const, hasBankruptcy: false };
    const relationship = {
      firstTransactionDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      transactionCount: 1
    };
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.riskScore).toBeLessThan(40);
    expect(result.riskTier).toBe('ineligible');
    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Risk score below minimum threshold (40)');
  });

  it('should reject invoice > 91 days old', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 95 };
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Invoice age exceeds 91 days');
  });

  it('should reject customer with bankruptcy history', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = { rating: 'B' as const, hasBankruptcy: true };
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Customer has bankruptcy history');
  });

  it('should reject invoice with active dispute', () => {
    const invoice = createBaseInvoice();
    const payment = { ...createBasePaymentHistory(), hasActiveDispute: true };
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Invoice has active payment dispute');
  });

  it('should reject invoice without POD', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod = { method: 'none' as const, allFieldsComplete: false };
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Proof of Delivery not verified');
  });

  it('should reject invoice that exceeds facility limit', () => {
    const invoice = { ...createBaseInvoice(), amount: 60000 };
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = {
      facilityLimit: 100000,
      currentOutstanding: 50000,
      invoiceAmount: 60000 // Would total 110k, exceeding 100k limit
    };

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.isEligible).toBe(false);
    expect(result.ineligibilityReasons).toContain('Advance would exceed facility limit');
  });
});

describe('Risk Engine - Edge Cases', () => {
  it('should handle new customer with no payment history', () => {
    const invoice = createBaseInvoice();
    const payment = { totalInvoices: 0, onTimeCount: 0, avgDaysLate: 0, hasActiveDispute: false };
    const pod = createBasePOD();
    const credit = { rating: 'A' as const, hasBankruptcy: false }; // Good credit compensates
    const relationship = {
      firstTransactionDate: new Date().toISOString(),
      transactionCount: 0
    };
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    // Should fallback to credit bureau + apply first-time penalty
    expect(result.isEligible).toBe(true);
    const hasFirstTimePenalty = result.adjustments.some(adj => adj.type === 'first_time');
    expect(hasFirstTimePenalty).toBe(true);
  });

  it('should handle very small invoice (concentration risk)', () => {
    const invoice = { ...createBaseInvoice(), amount: 1000 }; // R1,000
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = { ...createBaseFacility(), invoiceAmount: 1000 }; // 0.5% of facility

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    // Should score well on facility ratio (minimal risk)
    const facilityFactor = result.scoreBreakdown.find(f => f.factor === 'Invoice/Facility Ratio');
    expect(facilityFactor?.rawScore).toBe(5); // Max score
    expect(result.isEligible).toBe(true);
  });

  it('should handle large invoice (concentration risk)', () => {
    const invoice = { ...createBaseInvoice(), amount: 120000 }; // R120,000
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = { ...createBaseFacility(), invoiceAmount: 120000 }; // 60% of facility

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    // Should score low on facility ratio (concentrated risk)
    const facilityFactor = result.scoreBreakdown.find(f => f.factor === 'Invoice/Facility Ratio');
    expect(facilityFactor?.rawScore).toBeLessThanOrEqual(1);
  });

  it('should apply low utilization discount', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = {
      facilityLimit: 200000,
      currentOutstanding: 10000, // Only 5%
      invoiceAmount: 10000 // Total 10% - very low
    };

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const hasLowUtilizationDiscount = result.adjustments.some(
      adj => adj.type === 'low_utilization' && adj.amountPercent < 0
    );
    expect(hasLowUtilizationDiscount).toBe(true);
  });

  it('should apply high utilization penalty', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = {
      facilityLimit: 100000,
      currentOutstanding: 75000, // 75%
      invoiceAmount: 15000 // Total 90% - very high
    };

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const hasHighUtilizationPenalty = result.adjustments.some(
      adj => adj.type === 'high_utilization' && adj.amountPercent > 0
    );
    expect(hasHighUtilizationPenalty).toBe(true);
  });
});

describe('Risk Engine - POD Quality Variations', () => {
  it('should score e-signature complete highest (15 points)', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod: PODVerification = { method: 'e_signature', allFieldsComplete: true };
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const podFactor = result.scoreBreakdown.find(f => f.factor === 'POD Verification');
    expect(podFactor?.rawScore).toBe(15);
  });

  it('should penalize incomplete e-signature (12 points)', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod: PODVerification = { method: 'e_signature', allFieldsComplete: false };
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const podFactor = result.scoreBreakdown.find(f => f.factor === 'POD Verification');
    expect(podFactor?.rawScore).toBe(12);
  });

  it('should apply quality issue penalties', () => {
    const invoice = createBaseInvoice();
    const payment = createBasePaymentHistory();
    const pod: PODVerification = {
      method: 'driver_signature',
      allFieldsComplete: true,
      hasQualityIssues: ['illegible', 'no_recipient']
    };
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = createBaseFacility();

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    const podFactor = result.scoreBreakdown.find(f => f.factor === 'POD Verification');
    // Base 10 - (2 issues × 2) = 6
    expect(podFactor?.rawScore).toBe(6);
  });
});

describe('Risk Engine - Fee Calculation', () => {
  it('should calculate fee amount and net correctly', () => {
    const invoice = { ...createBaseInvoice(), amount: 100000 }; // R100,000
    const payment = createBasePaymentHistory();
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = createBaseRelationship();
    const facility = { ...createBaseFacility(), invoiceAmount: 100000 };

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    // Fee amount should be invoice * fee%
    const expectedFee = (100000 * result.finalFeePercent) / 100;
    expect(result.feeAmount).toBeCloseTo(expectedFee, 2);

    // Net should be invoice - fee
    expect(result.netAmount).toBeCloseTo(100000 - result.feeAmount, 2);
  });

  it('should respect minimum fee cap (0.75%)', () => {
    const invoice = createBaseInvoice();
    const payment = { ...createBasePaymentHistory(), onTimeCount: 20 }; // Perfect
    const pod = createBasePOD();
    const credit = createBaseCredit();
    const relationship = { ...createBaseRelationship(), transactionCount: 100 }; // High volume
    const facility = { ...createBaseFacility(), currentOutstanding: 10000 }; // Low util

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.finalFeePercent).toBeGreaterThanOrEqual(0.75);
  });

  it('should respect maximum fee cap (4.0%)', () => {
    const invoice = { ...createBaseInvoice(), ageInDays: 80 };
    const payment = { totalInvoices: 8, onTimeCount: 5, avgDaysLate: 50, hasActiveDispute: false };
    const pod = { method: 'manual' as const, allFieldsComplete: false };
    const credit = { rating: 'C' as const, hasBankruptcy: false };
    const relationship = {
      firstTransactionDate: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString(),
      transactionCount: 2
    };
    const facility = { ...createBaseFacility(), currentOutstanding: 170000 };

    const result = calculateRiskScore(invoice, payment, pod, credit, relationship, facility);

    expect(result.finalFeePercent).toBeLessThanOrEqual(4.0);
  });
});

describe('Risk Engine - Utility Functions', () => {
  it('should return correct tier info for all tiers', () => {
    const excellent = getRiskTierInfo('excellent');
    expect(excellent.label).toBe('Excellent');
    expect(excellent.color).toBe('#10B981');

    const good = getRiskTierInfo('good');
    expect(good.label).toBe('Good');
    expect(good.color).toBe('#3B82F6');

    const fair = getRiskTierInfo('fair');
    expect(fair.label).toBe('Fair');
    expect(fair.color).toBe('#F59E0B');

    const elevated = getRiskTierInfo('elevated');
    expect(elevated.label).toBe('Elevated');
    expect(elevated.color).toBe('#EF4444');

    const ineligible = getRiskTierInfo('ineligible');
    expect(ineligible.label).toBe('Ineligible');
    expect(ineligible.color).toBe('#64748B');
  });
});
