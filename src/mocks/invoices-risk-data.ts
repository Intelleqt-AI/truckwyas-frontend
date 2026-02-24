/**
 * Comprehensive invoice mock data with risk scoring
 */

import {
  InvoiceData,
  PODVerification,
  FacilityData,
  calculateRiskScore,
  RiskScoreResult,
} from '@/lib/risk-engine';
import {
  getCustomerRiskProfile,
  excellentCustomers,
  goodCustomers,
  fairCustomers,
  elevatedCustomers,
  ineligibleCustomers,
} from './customers-risk-data';

/**
 * Facility data for the operator
 */
export const facilityData: FacilityData = {
  facilityLimit: 5000000, // R5M facility
  currentOutstanding: 850000, // R850k outstanding
  invoiceAmount: 0, // Will be set per invoice
};

/**
 * POD verification types covering all quality levels
 */
const podVerifications: Record<string, PODVerification> = {
  excellent: {
    method: 'e_signature',
    allFieldsComplete: true,
  },
  good: {
    method: 'photo_timestamp',
    allFieldsComplete: true,
  },
  fair: {
    method: 'driver_signature',
    allFieldsComplete: false,
  },
  manual: {
    method: 'manual',
    allFieldsComplete: true,
  },
  none: {
    method: 'none',
    allFieldsComplete: false,
  },
};

/**
 * Generate invoices with full risk scoring
 */
function generateInvoiceWithRisk(
  invoiceId: string,
  customerId: string,
  customerName: string,
  amount: number,
  ageInDays: number,
  podType: keyof typeof podVerifications,
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID'
): { invoice: InvoiceData; riskScore: RiskScoreResult | null } {
  const now = new Date();
  const createdDate = new Date(now);
  createdDate.setDate(createdDate.getDate() - ageInDays);

  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 30); // NET30 terms

  const invoice: InvoiceData = {
    invoiceId,
    customerId,
    customerName,
    amount,
    createdDate: createdDate.toISOString(),
    dueDate: dueDate.toISOString(),
    status,
    ageInDays,
  };

  // Calculate risk score if not paid
  let riskScore: RiskScoreResult | null = null;
  if (status !== 'PAID') {
    const customerProfile = getCustomerRiskProfile(customerName);
    if (customerProfile) {
      const facility: FacilityData = {
        ...facilityData,
        invoiceAmount: amount,
      };

      riskScore = calculateRiskScore(
        invoice,
        customerProfile.paymentHistory,
        podVerifications[podType],
        customerProfile.creditBureau,
        customerProfile.relationship,
        facility
      );
    }
  }

  return { invoice, riskScore };
}

/**
 * Excellent tier invoices (score 85-100)
 */
export const excellentInvoices = [
  generateInvoiceWithRisk('INV-2026-001', 'CUST-001', 'Pick n Pay', 45200, 5, 'excellent', 'SENT'),
  generateInvoiceWithRisk('INV-2026-002', 'CUST-002', 'Shoprite Holdings', 38900, 7, 'excellent', 'SENT'),
  generateInvoiceWithRisk('INV-2026-003', 'CUST-003', 'Woolworths', 52100, 3, 'excellent', 'SENT'),
  generateInvoiceWithRisk('INV-2026-004', 'CUST-004', 'Tiger Brands', 61200, 6, 'excellent', 'SENT'),
  generateInvoiceWithRisk('INV-2026-005', 'CUST-005', 'Coca-Cola SA', 48700, 4, 'excellent', 'SENT'),
];

/**
 * Good tier invoices (score 70-84)
 */
export const goodInvoices = [
  generateInvoiceWithRisk('INV-2026-006', 'CUST-006', 'Massmart', 33500, 12, 'good', 'SENT'),
  generateInvoiceWithRisk('INV-2026-007', 'CUST-007', 'SPAR Group', 29800, 15, 'good', 'SENT'),
  generateInvoiceWithRisk('INV-2026-008', 'CUST-008', 'Checkers', 41200, 10, 'good', 'SENT'),
  generateInvoiceWithRisk('INV-2026-009', 'CUST-009', 'Astral Foods', 27600, 18, 'good', 'SENT'),
  generateInvoiceWithRisk('INV-2026-010', 'CUST-010', 'Rhodes Food Group', 36900, 14, 'good', 'SENT'),
];

/**
 * Fair tier invoices (score 55-69)
 */
export const fairInvoices = [
  generateInvoiceWithRisk('INV-2026-011', 'CUST-011', 'Game Stores', 24500, 25, 'fair', 'SENT'),
  generateInvoiceWithRisk('INV-2026-012', 'CUST-012', 'Oceana Group', 31200, 28, 'fair', 'SENT'),
  generateInvoiceWithRisk('INV-2026-013', 'CUST-013', 'Nestle SA', 19800, 32, 'fair', 'SENT'),
  generateInvoiceWithRisk('INV-2026-014', 'CUST-014', 'Mondi Group', 22400, 30, 'manual', 'SENT'),
  generateInvoiceWithRisk('INV-2026-015', 'CUST-015', 'Afrox Limited', 26700, 27, 'fair', 'SENT'),
];

/**
 * Elevated tier invoices (score 40-54)
 */
export const elevatedInvoices = [
  generateInvoiceWithRisk('INV-2026-016', 'CUST-016', 'Sappi Limited', 18900, 48, 'manual', 'SENT'),
  generateInvoiceWithRisk('INV-2026-017', 'CUST-017', 'Barloworld', 21500, 52, 'manual', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-018', 'CUST-018', 'Super Group', 15200, 55, 'fair', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-019', 'CUST-019', 'Harmony Gold', 19700, 50, 'manual', 'SENT'),
  generateInvoiceWithRisk('INV-2026-020', 'CUST-020', 'Cell C', 17800, 53, 'manual', 'OVERDUE'),
];

/**
 * Ineligible invoices (<40 score or other disqualifying factors)
 */
export const ineligibleInvoices = [
  generateInvoiceWithRisk('INV-2026-021', 'CUST-021', 'Dis-Chem', 28500, 65, 'manual', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-022', 'CUST-022', 'Clover Industries', 14300, 72, 'none', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-023', 'CUST-023', 'Pioneer Foods', 22100, 88, 'manual', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-024', 'CUST-024', 'Distell Group', 31400, 95, 'none', 'OVERDUE'),
  generateInvoiceWithRisk('INV-2026-025', 'CUST-025', 'Multichoice', 19600, 68, 'none', 'OVERDUE'),
];

/**
 * Paid invoices (no risk scoring needed)
 */
export const paidInvoices = [
  generateInvoiceWithRisk('INV-2026-026', 'CUST-001', 'Pick n Pay', 42800, 45, 'excellent', 'PAID'),
  generateInvoiceWithRisk('INV-2026-027', 'CUST-002', 'Shoprite Holdings', 39500, 52, 'excellent', 'PAID'),
  generateInvoiceWithRisk('INV-2026-028', 'CUST-003', 'Woolworths', 48900, 38, 'excellent', 'PAID'),
  generateInvoiceWithRisk('INV-2026-029', 'CUST-006', 'Massmart', 35200, 41, 'good', 'PAID'),
  generateInvoiceWithRisk('INV-2026-030', 'CUST-007', 'SPAR Group', 28700, 46, 'good', 'PAID'),
];

/**
 * All invoices combined
 */
export const allInvoices = [
  ...excellentInvoices,
  ...goodInvoices,
  ...fairInvoices,
  ...elevatedInvoices,
  ...ineligibleInvoices,
  ...paidInvoices,
];

/**
 * Map of invoice ID to invoice data and risk score
 */
export const invoiceRiskMap = new Map<
  string,
  { invoice: InvoiceData; riskScore: RiskScoreResult | null }
>();
allInvoices.forEach((data) => {
  invoiceRiskMap.set(data.invoice.invoiceId, data);
});

/**
 * Get invoice with risk score by ID
 */
export function getInvoiceWithRisk(
  invoiceId: string
): { invoice: InvoiceData; riskScore: RiskScoreResult | null } | undefined {
  return invoiceRiskMap.get(invoiceId);
}

/**
 * Get eligible invoices (score >= 40 and eligible)
 */
export function getEligibleInvoices() {
  return allInvoices.filter(
    (data) =>
      data.riskScore &&
      data.riskScore.isEligible &&
      data.riskScore.riskScore >= 40
  );
}

/**
 * Get risk distribution summary
 */
export function getRiskDistribution() {
  const distribution = {
    excellent: 0,
    good: 0,
    fair: 0,
    elevated: 0,
    ineligible: 0,
  };

  allInvoices.forEach((data) => {
    if (data.riskScore) {
      const tier = data.riskScore.riskTier;
      if (tier in distribution) {
        distribution[tier]++;
      }
    }
  });

  return distribution;
}

/**
 * Get total eligible amount
 */
export function getTotalEligibleAmount() {
  return getEligibleInvoices().reduce((sum, data) => sum + data.invoice.amount, 0);
}
