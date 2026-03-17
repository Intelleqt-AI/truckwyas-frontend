/**
 * Comprehensive Mock Data for TruckWys 7-Pillar Risk Engine
 *
 * Contains:
 * - 8 fleet operators (full profiles)
 * - 12 customers/debtors across all risk tiers
 * - 30+ invoices with SA-specific routes and cargo
 * - Macro/market data for South Africa
 */

import {
  calculateRiskScore,
  ClientIdentityData,
  ClientFinancialData,
  DebtorCreditData,
  InvoiceCharacteristics,
  PODDocumentation,
  OperationalFactors,
  MacroMarketFactors,
  RiskScoreResult,
} from '@/lib/risk-engine';

// ==========================
// MACRO & MARKET DATA (SA-specific)
// ==========================

export const currentMacroData: MacroMarketFactors = {
  zarVolatility30d: 4.2, // Moderate volatility
  sarbRepoRate: 8.25, // Current SARB rate
  freightDemandIndex: 62, // Moderate demand
  fuelPriceTrend3Mo: 'stable',
  platformDefaultRate90d: 1.8, // Healthy platform
  pmiIndex: 51.2, // Slight expansion
  loadSheddingImpactIndex: 25, // Moderate load shedding
  isSeasonalPaymentSlowdown: false, // Not Dec/Jan
};

// ==========================
// CUSTOMERS / DEBTORS (12 total)
// ==========================

export interface CustomerProfile {
  customerId: string;
  customerName: string;
  debtorCredit: DebtorCreditData;
}

// PRIME tier customers (scores 85-100)
export const primeCustomers: CustomerProfile[] = [
  {
    customerId: 'CUST-001',
    customerName: 'Pick n Pay',
    debtorCredit: {
      paydexScore: 92,
      platformAvgDaysToPay: 28,
      platformPaymentConsistency: 3.5,
      operatorSpecificAvgDays: 26,
      customerIndustry: 'retail',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 2400000,
      disputeRate: 0,
      platformTenureMonths: 36,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-002',
    customerName: 'Shoprite Holdings',
    debtorCredit: {
      creditRating: 'AA',
      platformAvgDaysToPay: 25,
      platformPaymentConsistency: 2.8,
      operatorSpecificAvgDays: 24,
      customerIndustry: 'retail',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 3200000,
      disputeRate: 0.5,
      platformTenureMonths: 42,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'auto_pay',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-003',
    customerName: 'Department of Health (Gauteng)',
    debtorCredit: {
      creditRating: 'A',
      platformAvgDaysToPay: 45, // Gov pays slower but certain
      platformPaymentConsistency: 5.2,
      operatorSpecificAvgDays: 43,
      customerIndustry: 'government',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 5800000,
      disputeRate: 1.2,
      platformTenureMonths: 28,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
];

// STANDARD tier customers (scores 70-84)
export const standardCustomers: CustomerProfile[] = [
  {
    customerId: 'CUST-004',
    customerName: 'Tiger Brands',
    debtorCredit: {
      paydexScore: 76,
      platformAvgDaysToPay: 38,
      platformPaymentConsistency: 6.8,
      operatorSpecificAvgDays: 36,
      customerIndustry: 'fmcg',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 1800000,
      disputeRate: 2.1,
      platformTenureMonths: 24,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-005',
    customerName: 'Coca-Cola Beverages SA',
    debtorCredit: {
      creditRating: 'BBB',
      platformAvgDaysToPay: 42,
      platformPaymentConsistency: 8.2,
      customerIndustry: 'fmcg',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 2100000,
      disputeRate: 3.5,
      platformTenureMonths: 18,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-006',
    customerName: 'Massmart (Makro)',
    debtorCredit: {
      paydexScore: 68,
      platformAvgDaysToPay: 48,
      platformPaymentConsistency: 9.5,
      operatorSpecificAvgDays: 45,
      customerIndustry: 'retail',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 1500000,
      disputeRate: 4.8,
      platformTenureMonths: 15,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
];

// ELEVATED tier customers (scores 55-69)
export const elevatedCustomers: CustomerProfile[] = [
  {
    customerId: 'CUST-007',
    customerName: 'Anglo American Platinum',
    debtorCredit: {
      paydexScore: 58,
      platformAvgDaysToPay: 62,
      platformPaymentConsistency: 14.2,
      operatorSpecificAvgDays: 65,
      customerIndustry: 'mining',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 3800000,
      disputeRate: 6.5,
      platformTenureMonths: 22,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-008',
    customerName: 'Murray & Roberts Construction',
    debtorCredit: {
      creditRating: 'BB',
      platformAvgDaysToPay: 68,
      platformPaymentConsistency: 16.8,
      operatorSpecificAvgDays: 72,
      customerIndustry: 'construction',
      customerSize: 'mid_market',
      customerOutstandingBalance: 950000,
      disputeRate: 8.2,
      platformTenureMonths: 12,
      hasCrossOperatorLatePaymentFlag: false,
      paymentMethod: 'eft',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-009',
    customerName: 'Game Stores',
    debtorCredit: {
      paydexScore: 52,
      platformAvgDaysToPay: 58,
      platformPaymentConsistency: 18.5,
      customerIndustry: 'retail',
      customerSize: 'mid_market',
      customerOutstandingBalance: 680000,
      disputeRate: 9.8,
      platformTenureMonths: 9,
      hasCrossOperatorLatePaymentFlag: true,
      paymentMethod: 'cheque',
      jurisdiction: 'sa_domestic',
    },
  },
];

// HIGH tier customers (scores 40-54)
export const highRiskCustomers: CustomerProfile[] = [
  {
    customerId: 'CUST-010',
    customerName: 'ABC Transport & Logistics',
    debtorCredit: {
      paydexScore: 42,
      platformAvgDaysToPay: 78,
      platformPaymentConsistency: 22.5,
      customerIndustry: 'other',
      customerSize: 'sme',
      customerOutstandingBalance: 420000,
      disputeRate: 12.5,
      platformTenureMonths: 6,
      hasCrossOperatorLatePaymentFlag: true,
      paymentMethod: 'cheque',
      jurisdiction: 'sa_domestic',
    },
  },
  {
    customerId: 'CUST-011',
    customerName: 'Sappi Paper Mills',
    debtorCredit: {
      creditRating: 'B',
      platformAvgDaysToPay: 85,
      platformPaymentConsistency: 24.8,
      operatorSpecificAvgDays: 88,
      customerIndustry: 'other',
      customerSize: 'mid_market',
      customerOutstandingBalance: 720000,
      disputeRate: 15.2,
      platformTenureMonths: 8,
      hasCrossOperatorLatePaymentFlag: true,
      paymentMethod: 'manual',
      jurisdiction: 'sa_domestic',
    },
  },
];

// INELIGIBLE customers (score <40)
export const ineligibleCustomers: CustomerProfile[] = [
  {
    customerId: 'CUST-012',
    customerName: 'Edcon Holdings (Edgars)',
    debtorCredit: {
      creditRating: 'D', // Under business rescue
      platformAvgDaysToPay: 120,
      platformPaymentConsistency: 35.5,
      customerIndustry: 'retail',
      customerSize: 'large_corporate',
      customerOutstandingBalance: 2200000,
      disputeRate: 22.5,
      platformTenureMonths: 18,
      hasCrossOperatorLatePaymentFlag: true,
      paymentMethod: 'manual',
      jurisdiction: 'sa_domestic',
    },
  },
];

export const allCustomers = [
  ...primeCustomers,
  ...standardCustomers,
  ...elevatedCustomers,
  ...highRiskCustomers,
  ...ineligibleCustomers,
];

export const customerMap = new Map<string, CustomerProfile>(
  allCustomers.map((c) => [c.customerId, c])
);

// ==========================
// OPERATORS (8 total)
// ==========================

export interface OperatorProfile {
  operatorId: string;
  operatorName: string;
  clientIdentity: ClientIdentityData;
  clientFinancial: ClientFinancialData;
  facilityLimit: number;
  avgInvoiceAmount: number;
}

export const operators: OperatorProfile[] = [
  // Large established operator (PRIME profile)
  {
    operatorId: 'OP-001',
    operatorName: 'TransNamib Logistics (Pty) Ltd',
    clientIdentity: {
      companyAgeYears: 12,
      businessType: 'pty_ltd',
      fleetSize: 65,
      fleetGrowthRate: 8.5,
      directorships: 2,
      hasAdverseFindings: false,
      beeLevel: 2,
      provinceCount: 6,
      subSector: 'fmcg',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: true,
    },
    clientFinancial: {
      monthlyTurnover: 8500000,
      turnoverTrend6Mo: 'growing',
      turnoverVolatility: 0.12,
      grossMarginTrend: 'improving',
      outstandingInvoicesRatio: 1.2,
      advanceUtilizationRate: 35,
      advanceFrequency: 'low',
      revenueConcentration: 18,
      hasTaxCompliance: true,
      bankRelationshipYears: 10,
      returnedPayments: 0,
    },
    facilityLimit: 5000000,
    avgInvoiceAmount: 42000,
  },

  // Mid-sized STANDARD operator
  {
    operatorId: 'OP-002',
    operatorName: 'Karoo Freight Services',
    clientIdentity: {
      companyAgeYears: 6,
      businessType: 'pty_ltd',
      fleetSize: 28,
      fleetGrowthRate: 4.2,
      directorships: 1,
      hasAdverseFindings: false,
      provinceCount: 4,
      subSector: 'general',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: true,
    },
    clientFinancial: {
      monthlyTurnover: 3200000,
      turnoverTrend6Mo: 'stable',
      turnoverVolatility: 0.22,
      grossMarginTrend: 'stable',
      outstandingInvoicesRatio: 1.8,
      advanceUtilizationRate: 52,
      advanceFrequency: 'moderate',
      revenueConcentration: 28,
      hasTaxCompliance: true,
      bankRelationshipYears: 6,
      returnedPayments: 0,
    },
    facilityLimit: 2500000,
    avgInvoiceAmount: 28000,
  },

  // Mining specialist (ELEVATED due to sector)
  {
    operatorId: 'OP-003',
    operatorName: 'Mpumalanga Mining Haulage',
    clientIdentity: {
      companyAgeYears: 8,
      businessType: 'pty_ltd',
      fleetSize: 42,
      fleetGrowthRate: -2.5, // Shrinking
      directorships: 3,
      hasAdverseFindings: false,
      provinceCount: 2,
      subSector: 'mining',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: false, // Missing one
    },
    clientFinancial: {
      monthlyTurnover: 5800000,
      turnoverTrend6Mo: 'declining',
      turnoverVolatility: 0.35,
      grossMarginTrend: 'declining',
      outstandingInvoicesRatio: 2.6,
      advanceUtilizationRate: 72,
      advanceFrequency: 'high',
      revenueConcentration: 48, // High concentration
      hasTaxCompliance: true,
      bankRelationshipYears: 8,
      returnedPayments: 1,
    },
    facilityLimit: 4000000,
    avgInvoiceAmount: 58000,
  },

  // Small owner-operator (HIGH risk)
  {
    operatorId: 'OP-004',
    operatorName: 'Sipho Logistics CC',
    clientIdentity: {
      companyAgeYears: 3,
      businessType: 'sole_prop',
      fleetSize: 4,
      directorships: 1,
      hasAdverseFindings: false,
      provinceCount: 1,
      subSector: 'general',
      hasGoodsInTransitInsurance: false,
      hasFleetInsurance: true,
      hasLiabilityInsurance: false,
    },
    clientFinancial: {
      monthlyTurnover: 420000,
      turnoverTrend6Mo: 'stable',
      turnoverVolatility: 0.45,
      grossMarginTrend: 'stable',
      outstandingInvoicesRatio: 2.8,
      advanceUtilizationRate: 85,
      advanceFrequency: 'every_invoice',
      revenueConcentration: 62,
      hasTaxCompliance: true,
      bankRelationshipYears: 3,
      returnedPayments: 2,
    },
    facilityLimit: 500000,
    avgInvoiceAmount: 18000,
  },

  // Agricultural specialist
  {
    operatorId: 'OP-005',
    operatorName: 'Freestate Agri-Transport',
    clientIdentity: {
      companyAgeYears: 15,
      businessType: 'pty_ltd',
      fleetSize: 32,
      fleetGrowthRate: 1.2,
      directorships: 2,
      hasAdverseFindings: false,
      beeLevel: 4,
      provinceCount: 3,
      subSector: 'agricultural',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: true,
    },
    clientFinancial: {
      monthlyTurnover: 2800000,
      turnoverTrend6Mo: 'stable',
      turnoverVolatility: 0.28,
      grossMarginTrend: 'stable',
      outstandingInvoicesRatio: 1.6,
      advanceUtilizationRate: 45,
      advanceFrequency: 'moderate',
      revenueConcentration: 22,
      hasTaxCompliance: true,
      bankRelationshipYears: 12,
      returnedPayments: 0,
    },
    facilityLimit: 2000000,
    avgInvoiceAmount: 32000,
  },

  // Construction materials hauler
  {
    operatorId: 'OP-006',
    operatorName: 'Concrete Express Logistics',
    clientIdentity: {
      companyAgeYears: 5,
      businessType: 'pty_ltd',
      fleetSize: 18,
      fleetGrowthRate: 6.8,
      directorships: 1,
      hasAdverseFindings: false,
      provinceCount: 2,
      subSector: 'construction',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: true,
    },
    clientFinancial: {
      monthlyTurnover: 1500000,
      turnoverTrend6Mo: 'growing',
      turnoverVolatility: 0.32,
      grossMarginTrend: 'improving',
      outstandingInvoicesRatio: 2.1,
      advanceUtilizationRate: 58,
      advanceFrequency: 'high',
      revenueConcentration: 35,
      hasTaxCompliance: true,
      bankRelationshipYears: 5,
      returnedPayments: 0,
    },
    facilityLimit: 1200000,
    avgInvoiceAmount: 22000,
  },

  // New entrant
  {
    operatorId: 'OP-007',
    operatorName: 'Cape Coastal Transport',
    clientIdentity: {
      companyAgeYears: 1,
      businessType: 'pty_ltd',
      fleetSize: 8,
      directorships: 1,
      hasAdverseFindings: false,
      provinceCount: 2,
      subSector: 'general',
      hasGoodsInTransitInsurance: true,
      hasFleetInsurance: true,
      hasLiabilityInsurance: false,
    },
    clientFinancial: {
      monthlyTurnover: 680000,
      turnoverTrend6Mo: 'growing',
      turnoverVolatility: 0.52,
      grossMarginTrend: 'stable',
      outstandingInvoicesRatio: 1.9,
      advanceUtilizationRate: 68,
      advanceFrequency: 'high',
      revenueConcentration: 45,
      hasTaxCompliance: true,
      bankRelationshipYears: 1,
      returnedPayments: 0,
    },
    facilityLimit: 800000,
    avgInvoiceAmount: 24000,
  },

  // Problem operator (tax issues)
  {
    operatorId: 'OP-008',
    operatorName: 'Budget Hauliers',
    clientIdentity: {
      companyAgeYears: 7,
      businessType: 'sole_prop',
      fleetSize: 12,
      fleetGrowthRate: -8.5,
      directorships: 1,
      hasAdverseFindings: true,
      provinceCount: 2,
      subSector: 'general',
      hasGoodsInTransitInsurance: false,
      hasFleetInsurance: true,
      hasLiabilityInsurance: false,
    },
    clientFinancial: {
      monthlyTurnover: 950000,
      turnoverTrend6Mo: 'declining',
      turnoverVolatility: 0.58,
      grossMarginTrend: 'declining',
      outstandingInvoicesRatio: 3.2,
      advanceUtilizationRate: 92,
      advanceFrequency: 'every_invoice',
      revenueConcentration: 55,
      hasTaxCompliance: false, // SARS issue
      bankRelationshipYears: 7,
      returnedPayments: 4,
    },
    facilityLimit: 600000,
    avgInvoiceAmount: 16000,
  },
];

export const operatorMap = new Map<string, OperatorProfile>(
  operators.map((o) => [o.operatorId, o])
);

// ==========================
// SA-SPECIFIC ROUTES & CARGO
// ==========================

export interface RouteData {
  routeName: string;
  fromCity: string;
  toCity: string;
  distanceKm: number;
  routeRiskLevel: 'low' | 'moderate' | 'high' | 'very_high';
  typicalCargo: string;
}

export const saRoutes: RouteData[] = [
  {
    routeName: 'Johannesburg → Durban',
    fromCity: 'Johannesburg',
    toCity: 'Durban',
    distanceKm: 568,
    routeRiskLevel: 'moderate',
    typicalCargo: 'FMCG, retail goods',
  },
  {
    routeName: 'Cape Town → Johannesburg',
    fromCity: 'Cape Town',
    toCity: 'Johannesburg',
    distanceKm: 1402,
    routeRiskLevel: 'high', // Long haul
    typicalCargo: 'Fresh produce, wine',
  },
  {
    routeName: 'Durban → Richards Bay',
    fromCity: 'Durban',
    toCity: 'Richards Bay',
    distanceKm: 182,
    routeRiskLevel: 'low',
    typicalCargo: 'Coal, containers',
  },
  {
    routeName: 'Pretoria → Rustenburg',
    fromCity: 'Pretoria',
    toCity: 'Rustenburg',
    distanceKm: 124,
    routeRiskLevel: 'very_high', // Platinum belt hijacking hotspot
    typicalCargo: 'Platinum ore, mining equipment',
  },
  {
    routeName: 'Port Elizabeth → East London',
    fromCity: 'Port Elizabeth',
    toCity: 'East London',
    distanceKm: 312,
    routeRiskLevel: 'low',
    typicalCargo: 'Automotive parts',
  },
  {
    routeName: 'Johannesburg → Bloemfontein',
    fromCity: 'Johannesburg',
    toCity: 'Bloemfontein',
    distanceKm: 398,
    routeRiskLevel: 'moderate',
    typicalCargo: 'General freight',
  },
  {
    routeName: 'Nelspruit → Maputo (SADC)',
    fromCity: 'Nelspruit',
    toCity: 'Maputo',
    distanceKm: 356,
    routeRiskLevel: 'high', // Cross-border
    typicalCargo: 'Containers, agricultural',
  },
  {
    routeName: 'Cape Town → Saldanha Bay',
    fromCity: 'Cape Town',
    toCity: 'Saldanha Bay',
    distanceKm: 110,
    routeRiskLevel: 'low',
    typicalCargo: 'Iron ore, steel',
  },
];

// Helper function to get route data
export function getRouteData(idx: number): RouteData {
  return saRoutes[idx % saRoutes.length];
}

// ==========================
// HELPER: Generate Invoice with Risk Score
// ==========================

export interface InvoiceWithRisk {
  invoice: InvoiceCharacteristics;
  operator: OperatorProfile;
  customer: CustomerProfile;
  pod: PODDocumentation;
  operational: OperationalFactors;
  riskScore: RiskScoreResult;
  routeData: RouteData;
}

function generateInvoice(
  invoiceId: string,
  operatorId: string,
  customerId: string,
  amount: number,
  ageInDays: number,
  routeIdx: number,
  podType: 'e_signature' | 'geo_photo' | 'scanned' | 'manual' | 'none',
  cargoType: 'general' | 'perishable' | 'hazmat' | 'high_value'
): InvoiceWithRisk {
  const operator = operatorMap.get(operatorId)!;
  const customer = customerMap.get(customerId)!;
  const route = getRouteData(routeIdx);

  const now = new Date();
  const createdDate = new Date(now);
  createdDate.setDate(createdDate.getDate() - ageInDays);

  const dueDate = new Date(createdDate);
  dueDate.setDate(dueDate.getDate() + 30); // NET30

  const daysUntilDue = Math.floor((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  const invoice: InvoiceCharacteristics = {
    invoiceId,
    amount,
    operatorAvgInvoiceAmount: operator.avgInvoiceAmount,
    facilityLimit: operator.facilityLimit,
    ageInDays,
    paymentTermsDays: 30,
    daysUntilDue,
    currency: 'ZAR',
    invoiceType: 'single_trip',
    hasDetailedLineItems: true,
    hasCreditNotes: false,
    hasLinkedPO: Math.random() > 0.5,
    isRecurringCustomer: customer.debtorCredit.platformTenureMonths > 12,
  };

  const pod: PODDocumentation = {
    podType,
    hasReceiverName: podType !== 'none',
    hasSignature: podType !== 'none' && podType !== 'manual',
    hasDate: podType !== 'none',
    hasConditionNotes: podType === 'e_signature' || podType === 'geo_photo',
    podTimestampMatchesDelivery: podType !== 'manual' && podType !== 'none',
    hasGPSTracking: podType === 'geo_photo' || podType === 'e_signature',
    hasDeliveryExceptions: false,
    hasWaybill: true,
    hasWeighbridgeTicket: cargoType !== 'general',
    hasCustomsClearance: route.fromCity === 'Nelspruit', // Cross-border
    hasPhotos: podType === 'geo_photo' || podType === 'e_signature',
  };

  const operational: OperationalFactors = {
    routeRiskLevel: route.routeRiskLevel,
    cargoType,
    distanceKm: route.distanceKm,
    tripCompletionRate: 94.5,
    vehicleLastServiceDays: 45,
    hasCurrentRoadworthy: true,
    driverViolations: 0,
    driverExperienceYears: 8,
    isSeasonalSlowdown: false,
  };

  const riskScore = calculateRiskScore(
    operator.clientIdentity,
    operator.clientFinancial,
    customer.debtorCredit,
    invoice,
    pod,
    operational,
    currentMacroData
  );

  return {
    invoice,
    operator,
    customer,
    pod,
    operational,
    riskScore,
    routeData: route,
  };
}

// ==========================
// INVOICES (30+ across all tiers)
// ==========================

// PRIME invoices (OP-001 with PRIME customers)
export const primeInvoices = [
  generateInvoice('INV-2026-001', 'OP-001', 'CUST-001', 45200, 5, 0, 'e_signature', 'general'),
  generateInvoice('INV-2026-002', 'OP-001', 'CUST-002', 38900, 7, 1, 'e_signature', 'general'),
  generateInvoice('INV-2026-003', 'OP-001', 'CUST-003', 52100, 12, 5, 'geo_photo', 'general'),
  generateInvoice('INV-2026-004', 'OP-002', 'CUST-001', 28400, 4, 2, 'e_signature', 'general'),
  generateInvoice('INV-2026-005', 'OP-002', 'CUST-002', 31200, 9, 4, 'geo_photo', 'general'),
];

// STANDARD invoices
export const standardInvoices = [
  generateInvoice('INV-2026-006', 'OP-002', 'CUST-004', 29800, 15, 1, 'geo_photo', 'general'),
  generateInvoice('INV-2026-007', 'OP-005', 'CUST-005', 35600, 18, 5, 'scanned', 'perishable'),
  generateInvoice('INV-2026-008', 'OP-006', 'CUST-006', 22400, 22, 3, 'scanned', 'general'),
  generateInvoice('INV-2026-009', 'OP-001', 'CUST-004', 48700, 14, 0, 'e_signature', 'general'),
  generateInvoice('INV-2026-010', 'OP-005', 'CUST-004', 32800, 20, 6, 'geo_photo', 'perishable'),
];

// ELEVATED invoices
export const elevatedInvoices = [
  generateInvoice('INV-2026-011', 'OP-003', 'CUST-007', 58200, 28, 3, 'scanned', 'high_value'),
  generateInvoice('INV-2026-012', 'OP-006', 'CUST-008', 18900, 35, 5, 'manual', 'general'),
  generateInvoice('INV-2026-013', 'OP-007', 'CUST-009', 24600, 32, 7, 'manual', 'general'),
  generateInvoice('INV-2026-014', 'OP-003', 'CUST-008', 62400, 38, 3, 'scanned', 'hazmat'),
  generateInvoice('INV-2026-015', 'OP-006', 'CUST-007', 21800, 42, 1, 'manual', 'general'),
];

// HIGH risk invoices
export const highRiskInvoices = [
  generateInvoice('INV-2026-016', 'OP-004', 'CUST-010', 18200, 52, 5, 'manual', 'general'),
  generateInvoice('INV-2026-017', 'OP-008', 'CUST-011', 16800, 58, 1, 'manual', 'general'),
  generateInvoice('INV-2026-018', 'OP-007', 'CUST-010', 22400, 48, 0, 'scanned', 'general'),
  generateInvoice('INV-2026-019', 'OP-004', 'CUST-009', 15600, 55, 4, 'manual', 'general'),
  generateInvoice('INV-2026-020', 'OP-008', 'CUST-010', 14200, 62, 2, 'manual', 'general'),
];

// INELIGIBLE invoices
export const ineligibleInvoices = [
  generateInvoice('INV-2026-021', 'OP-008', 'CUST-012', 28500, 95, 3, 'none', 'general'), // Too old
  generateInvoice('INV-2026-022', 'OP-004', 'CUST-012', 19400, 72, 1, 'manual', 'general'), // Bad customer
  generateInvoice('INV-2026-023', 'OP-007', 'CUST-011', 32100, 88, 6, 'none', 'general'), // No POD
  generateInvoice('INV-2026-024', 'OP-003', 'CUST-012', 68200, 68, 3, 'manual', 'high_value'), // Bad customer + high value
  generateInvoice('INV-2026-025', 'OP-008', 'CUST-011', 11200, 102, 5, 'none', 'general'), // Way too old
];

// Additional recent invoices (mix of tiers)
export const recentInvoices = [
  generateInvoice('INV-2026-026', 'OP-001', 'CUST-002', 42800, 2, 0, 'e_signature', 'general'),
  generateInvoice('INV-2026-027', 'OP-002', 'CUST-005', 26400, 3, 2, 'geo_photo', 'perishable'),
  generateInvoice('INV-2026-028', 'OP-005', 'CUST-001', 34200, 1, 7, 'e_signature', 'perishable'),
  generateInvoice('INV-2026-029', 'OP-006', 'CUST-004', 19800, 6, 5, 'scanned', 'general'),
  generateInvoice('INV-2026-030', 'OP-003', 'CUST-007', 55600, 10, 3, 'geo_photo', 'high_value'),
];

export const allInvoices = [
  ...primeInvoices,
  ...standardInvoices,
  ...elevatedInvoices,
  ...highRiskInvoices,
  ...ineligibleInvoices,
  ...recentInvoices,
];

export const invoiceMap = new Map<string, InvoiceWithRisk>(
  allInvoices.map((inv) => [inv.invoice.invoiceId, inv])
);

// ==========================
// PORTFOLIO ANALYTICS
// ==========================

export function getPortfolioSummary() {
  const eligibleInvoices = allInvoices.filter((inv) => inv.riskScore.isEligible);

  const totalEligibleAmount = eligibleInvoices.reduce((sum, inv) => sum + inv.invoice.amount, 0);
  const avgRiskScore =
    eligibleInvoices.reduce((sum, inv) => sum + inv.riskScore.finalScore, 0) / eligibleInvoices.length;

  const tierDistribution = {
    prime: allInvoices.filter((inv) => inv.riskScore.riskTier === 'prime').length,
    standard: allInvoices.filter((inv) => inv.riskScore.riskTier === 'standard').length,
    elevated: allInvoices.filter((inv) => inv.riskScore.riskTier === 'elevated').length,
    high: allInvoices.filter((inv) => inv.riskScore.riskTier === 'high').length,
    ineligible: allInvoices.filter((inv) => inv.riskScore.riskTier === 'ineligible').length,
  };

  return {
    totalInvoices: allInvoices.length,
    eligibleCount: eligibleInvoices.length,
    totalEligibleAmount,
    avgRiskScore: Math.round(avgRiskScore),
    tierDistribution,
  };
}
