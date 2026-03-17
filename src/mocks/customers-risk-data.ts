/**
 * Comprehensive mock data for Risk Engine testing
 * Covers all 5 risk tiers: excellent (85-100), good (70-84), fair (55-69), elevated (40-54), ineligible (<40)
 */

import {
  PaymentHistoryData,
  PODVerification,
  CreditBureauData,
  RelationshipData,
} from '@/lib/risk-engine';

export interface CustomerRiskProfile {
  customerId: string;
  customerName: string;
  paymentHistory: PaymentHistoryData;
  creditBureau: CreditBureauData;
  relationship: RelationshipData;
}

/**
 * Excellent tier customers (85-100 score)
 * - Impeccable payment history
 * - Strong credit ratings
 * - Long relationships
 */
export const excellentCustomers: CustomerRiskProfile[] = [
  {
    customerId: 'CUST-001',
    customerName: 'Pick n Pay',
    paymentHistory: {
      totalInvoices: 48,
      onTimeCount: 47,
      avgDaysLate: 2,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'A',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2022-03-15',
      transactionCount: 48,
    },
  },
  {
    customerId: 'CUST-002',
    customerName: 'Shoprite Holdings',
    paymentHistory: {
      totalInvoices: 52,
      onTimeCount: 51,
      avgDaysLate: 1,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'A',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2021-11-20',
      transactionCount: 52,
    },
  },
  {
    customerId: 'CUST-003',
    customerName: 'Woolworths',
    paymentHistory: {
      totalInvoices: 44,
      onTimeCount: 43,
      avgDaysLate: 3,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'A',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2022-06-10',
      transactionCount: 44,
    },
  },
  {
    customerId: 'CUST-004',
    customerName: 'Tiger Brands',
    paymentHistory: {
      totalInvoices: 38,
      onTimeCount: 37,
      avgDaysLate: 2,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'A',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2022-08-05',
      transactionCount: 38,
    },
  },
  {
    customerId: 'CUST-005',
    customerName: 'Coca-Cola SA',
    paymentHistory: {
      totalInvoices: 56,
      onTimeCount: 55,
      avgDaysLate: 1,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 95,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2021-09-12',
      transactionCount: 56,
    },
  },
];

/**
 * Good tier customers (70-84 score)
 * - Mostly reliable payment history
 * - Good credit ratings
 * - Moderate relationships
 */
export const goodCustomers: CustomerRiskProfile[] = [
  {
    customerId: 'CUST-006',
    customerName: 'Massmart',
    paymentHistory: {
      totalInvoices: 32,
      onTimeCount: 28,
      avgDaysLate: 8,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B+',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2023-01-18',
      transactionCount: 32,
    },
  },
  {
    customerId: 'CUST-007',
    customerName: 'SPAR Group',
    paymentHistory: {
      totalInvoices: 28,
      onTimeCount: 25,
      avgDaysLate: 12,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B+',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2023-04-22',
      transactionCount: 28,
    },
  },
  {
    customerId: 'CUST-008',
    customerName: 'Checkers',
    paymentHistory: {
      totalInvoices: 36,
      onTimeCount: 31,
      avgDaysLate: 10,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2022-10-05',
      transactionCount: 36,
    },
  },
  {
    customerId: 'CUST-009',
    customerName: 'Astral Foods',
    paymentHistory: {
      totalInvoices: 24,
      onTimeCount: 21,
      avgDaysLate: 15,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2023-06-14',
      transactionCount: 24,
    },
  },
  {
    customerId: 'CUST-010',
    customerName: 'Rhodes Food Group',
    paymentHistory: {
      totalInvoices: 30,
      onTimeCount: 26,
      avgDaysLate: 9,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 72,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2023-02-28',
      transactionCount: 30,
    },
  },
];

/**
 * Fair tier customers (55-69 score)
 * - Inconsistent payment history
 * - Fair credit ratings
 * - Newer or infrequent relationships
 */
export const fairCustomers: CustomerRiskProfile[] = [
  {
    customerId: 'CUST-011',
    customerName: 'Game Stores',
    paymentHistory: {
      totalInvoices: 18,
      onTimeCount: 14,
      avgDaysLate: 22,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B-',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-03-10',
      transactionCount: 18,
    },
  },
  {
    customerId: 'CUST-012',
    customerName: 'Oceana Group',
    paymentHistory: {
      totalInvoices: 16,
      onTimeCount: 12,
      avgDaysLate: 25,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'B-',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-05-22',
      transactionCount: 16,
    },
  },
  {
    customerId: 'CUST-013',
    customerName: 'Nestle SA',
    paymentHistory: {
      totalInvoices: 22,
      onTimeCount: 17,
      avgDaysLate: 28,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'C',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-01-05',
      transactionCount: 22,
    },
  },
  {
    customerId: 'CUST-014',
    customerName: 'Mondi Group',
    paymentHistory: {
      totalInvoices: 12,
      onTimeCount: 9,
      avgDaysLate: 30,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 52,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-08-15',
      transactionCount: 12,
    },
  },
  {
    customerId: 'CUST-015',
    customerName: 'Afrox Limited',
    paymentHistory: {
      totalInvoices: 14,
      onTimeCount: 10,
      avgDaysLate: 27,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 55,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-07-01',
      transactionCount: 14,
    },
  },
];

/**
 * Elevated tier customers (40-54 score)
 * - Poor payment history
 * - Weak credit ratings
 * - Very new or troubled relationships
 */
export const elevatedCustomers: CustomerRiskProfile[] = [
  {
    customerId: 'CUST-016',
    customerName: 'Sappi Limited',
    paymentHistory: {
      totalInvoices: 10,
      onTimeCount: 6,
      avgDaysLate: 35,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'C',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-01-20',
      transactionCount: 10,
    },
  },
  {
    customerId: 'CUST-017',
    customerName: 'Barloworld',
    paymentHistory: {
      totalInvoices: 8,
      onTimeCount: 5,
      avgDaysLate: 40,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'C-',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-05-10',
      transactionCount: 8,
    },
  },
  {
    customerId: 'CUST-018',
    customerName: 'Super Group',
    paymentHistory: {
      totalInvoices: 6,
      onTimeCount: 3,
      avgDaysLate: 45,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 35,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-08-01',
      transactionCount: 6,
    },
  },
  {
    customerId: 'CUST-019',
    customerName: 'Harmony Gold',
    paymentHistory: {
      totalInvoices: 12,
      onTimeCount: 7,
      avgDaysLate: 38,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 42,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-11-12',
      transactionCount: 12,
    },
  },
  {
    customerId: 'CUST-020',
    customerName: 'Cell C',
    paymentHistory: {
      totalInvoices: 9,
      onTimeCount: 5,
      avgDaysLate: 42,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 38,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-03-18',
      transactionCount: 9,
    },
  },
];

/**
 * Ineligible customers (<40 score)
 * - Bankruptcy or active disputes
 * - Very poor payment history
 * - High risk indicators
 */
export const ineligibleCustomers: CustomerRiskProfile[] = [
  {
    customerId: 'CUST-021',
    customerName: 'Dis-Chem',
    paymentHistory: {
      totalInvoices: 15,
      onTimeCount: 8,
      avgDaysLate: 50,
      hasActiveDispute: true,
    },
    creditBureau: {
      rating: 'C-',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2024-09-05',
      transactionCount: 15,
    },
  },
  {
    customerId: 'CUST-022',
    customerName: 'Clover Industries',
    paymentHistory: {
      totalInvoices: 7,
      onTimeCount: 3,
      avgDaysLate: 55,
      hasActiveDispute: false,
    },
    creditBureau: {
      rating: 'D',
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-07-22',
      transactionCount: 7,
    },
  },
  {
    customerId: 'CUST-023',
    customerName: 'Pioneer Foods',
    paymentHistory: {
      totalInvoices: 10,
      onTimeCount: 4,
      avgDaysLate: 60,
      hasActiveDispute: true,
    },
    creditBureau: {
      score: 28,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-04-15',
      transactionCount: 10,
    },
  },
  {
    customerId: 'CUST-024',
    customerName: 'Distell Group',
    paymentHistory: {
      totalInvoices: 5,
      onTimeCount: 2,
      avgDaysLate: 65,
      hasActiveDispute: false,
    },
    creditBureau: {
      score: 22,
      hasBankruptcy: true,
    },
    relationship: {
      firstTransactionDate: '2025-10-01',
      transactionCount: 5,
    },
  },
  {
    customerId: 'CUST-025',
    customerName: 'Multichoice',
    paymentHistory: {
      totalInvoices: 8,
      onTimeCount: 3,
      avgDaysLate: 58,
      hasActiveDispute: true,
    },
    creditBureau: {
      score: 25,
      hasBankruptcy: false,
    },
    relationship: {
      firstTransactionDate: '2025-06-10',
      transactionCount: 8,
    },
  },
];

/**
 * Map of customer ID to customer risk profile
 */
export const customerRiskMap = new Map<string, CustomerRiskProfile>();
[
  ...excellentCustomers,
  ...goodCustomers,
  ...fairCustomers,
  ...elevatedCustomers,
  ...ineligibleCustomers,
].forEach((customer) => {
  customerRiskMap.set(customer.customerId, customer);
  customerRiskMap.set(customer.customerName, customer); // Also map by name for easy lookup
});

/**
 * Get customer risk profile by ID or name
 */
export function getCustomerRiskProfile(
  customerIdOrName: string
): CustomerRiskProfile | undefined {
  return customerRiskMap.get(customerIdOrName);
}
