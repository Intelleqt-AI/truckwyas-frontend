/**
 * Realistic Mock Data for Capital Module Testing
 *
 * 5-8 customers with varied risk profiles
 * 15-20 invoices exercising all risk tiers
 * SA freight context (routes, amounts in ZAR)
 */

export interface Customer {
  id: string;
  name: string;
  industry: string;
  location: string;
  paymentTerms: 'NET30' | 'NET60' | 'NET90';
  creditRating: 'A' | 'B+' | 'B' | 'B-' | 'C' | 'C-' | 'D';
  hasBankruptcy: boolean;
  firstTransactionDate: string;
  totalInvoices: number;
  onTimeCount: number;
  avgDaysLate: number;
  hasActiveDispute: boolean;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  amount: number; // ZAR
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID';
  createdDate: string;
  dueDate: string;
  ageInDays: number;
  route: string;
  podMethod: 'e_signature' | 'photo_timestamp' | 'driver_signature' | 'photo' | 'manual' | 'none';
  podComplete: boolean;
  podQualityIssues?: string[];
  description: string;
}

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'CUST-001',
    name: 'Tiger Brands Ltd',
    industry: 'FMCG Manufacturing',
    location: 'Johannesburg',
    paymentTerms: 'NET30',
    creditRating: 'A',
    hasBankruptcy: false,
    firstTransactionDate: '2023-01-15',
    totalInvoices: 48,
    onTimeCount: 46,
    avgDaysLate: 3,
    hasActiveDispute: false
  },
  {
    id: 'CUST-002',
    name: 'Shoprite Distribution',
    industry: 'Retail Distribution',
    location: 'Cape Town',
    paymentTerms: 'NET60',
    creditRating: 'B+',
    hasBankruptcy: false,
    firstTransactionDate: '2023-06-10',
    totalInvoices: 32,
    onTimeCount: 28,
    avgDaysLate: 8,
    hasActiveDispute: false
  },
  {
    id: 'CUST-003',
    name: 'Build It Supplies Pty',
    industry: 'Construction Materials',
    location: 'Pretoria',
    paymentTerms: 'NET30',
    creditRating: 'B',
    hasBankruptcy: false,
    firstTransactionDate: '2024-03-20',
    totalInvoices: 18,
    onTimeCount: 14,
    avgDaysLate: 15,
    hasActiveDispute: false
  },
  {
    id: 'CUST-004',
    name: 'Coastal Mining Equipment',
    industry: 'Mining Services',
    location: 'Durban',
    paymentTerms: 'NET60',
    creditRating: 'B-',
    hasBankruptcy: false,
    firstTransactionDate: '2024-09-05',
    totalInvoices: 8,
    onTimeCount: 5,
    avgDaysLate: 32,
    hasActiveDispute: false
  },
  {
    id: 'CUST-005',
    name: 'Limpopo Agri Holdings',
    industry: 'Agriculture',
    location: 'Polokwane',
    paymentTerms: 'NET90',
    creditRating: 'C',
    hasBankruptcy: false,
    firstTransactionDate: '2024-11-12',
    totalInvoices: 6,
    onTimeCount: 3,
    avgDaysLate: 48,
    hasActiveDispute: false
  },
  {
    id: 'CUST-006',
    name: 'Karoo Transport Co-op',
    industry: 'Logistics',
    location: 'Beaufort West',
    paymentTerms: 'NET30',
    creditRating: 'B',
    hasBankruptcy: false,
    firstTransactionDate: '2024-01-08',
    totalInvoices: 24,
    onTimeCount: 20,
    avgDaysLate: 10,
    hasActiveDispute: false
  },
  {
    id: 'CUST-007',
    name: 'NewStart Logistics (Pty)',
    industry: 'E-commerce Fulfillment',
    location: 'Johannesburg',
    paymentTerms: 'NET30',
    creditRating: 'B+',
    hasBankruptcy: false,
    firstTransactionDate: '2025-11-20',
    totalInvoices: 2,
    onTimeCount: 2,
    avgDaysLate: 0,
    hasActiveDispute: false
  },
  {
    id: 'CUST-008',
    name: 'Eastern Cape Traders',
    industry: 'Wholesale Distribution',
    location: 'Port Elizabeth',
    paymentTerms: 'NET60',
    creditRating: 'C-',
    hasBankruptcy: false,
    firstTransactionDate: '2024-07-15',
    totalInvoices: 12,
    onTimeCount: 6,
    avgDaysLate: 55,
    hasActiveDispute: true // Has active dispute
  }
];

const today = new Date();
const daysAgo = (days: number) => new Date(today.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
const daysFromNow = (days: number) => new Date(today.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

export const MOCK_INVOICES: Invoice[] = [
  // EXCELLENT TIER - Tiger Brands (fresh, high-quality POD, great history)
  {
    id: 'INV-001',
    invoiceNumber: 'INV-20260215-0001',
    customerId: 'CUST-001',
    customerName: 'Tiger Brands Ltd',
    amount: 45800,
    status: 'SENT',
    createdDate: daysAgo(3),
    dueDate: daysFromNow(27),
    ageInDays: 3,
    route: 'JHB → DBN (Albany Bread)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Palletized bread delivery to Durban DC'
  },
  {
    id: 'INV-002',
    invoiceNumber: 'INV-20260218-0002',
    customerId: 'CUST-001',
    customerName: 'Tiger Brands Ltd',
    amount: 32400,
    status: 'SENT',
    createdDate: daysAgo(6),
    dueDate: daysFromNow(24),
    ageInDays: 6,
    route: 'JHB → CPT (Cereal Products)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Breakfast cereal run to Cape Town warehouse'
  },

  // GOOD TIER - Shoprite Distribution (solid history, slight aging)
  {
    id: 'INV-003',
    invoiceNumber: 'INV-20260205-0003',
    customerId: 'CUST-002',
    customerName: 'Shoprite Distribution',
    amount: 128500,
    status: 'SENT',
    createdDate: daysAgo(19),
    dueDate: daysFromNow(41),
    ageInDays: 19,
    route: 'CPT → George (Fresh Produce)',
    podMethod: 'photo_timestamp',
    podComplete: true,
    description: 'Refrigerated fresh produce delivery'
  },
  {
    id: 'INV-004',
    invoiceNumber: 'INV-20260210-0004',
    customerId: 'CUST-002',
    customerName: 'Shoprite Distribution',
    amount: 87200,
    status: 'SENT',
    createdDate: daysAgo(14),
    dueDate: daysFromNow(46),
    ageInDays: 14,
    route: 'CPT → Stellenbosch (Dry Goods)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Non-perishable goods to regional depot'
  },
  {
    id: 'INV-005',
    invoiceNumber: 'INV-20260212-0005',
    customerId: 'CUST-006',
    customerName: 'Karoo Transport Co-op',
    amount: 54300,
    status: 'SENT',
    createdDate: daysAgo(12),
    dueDate: daysFromNow(18),
    ageInDays: 12,
    route: 'Beaufort West → Kimberley (General Cargo)',
    podMethod: 'driver_signature',
    podComplete: true,
    description: 'Mixed cargo to Northern Cape'
  },

  // FAIR TIER - Build It (moderate history, some aging, OK POD)
  {
    id: 'INV-006',
    invoiceNumber: 'INV-20260125-0006',
    customerId: 'CUST-003',
    customerName: 'Build It Supplies Pty',
    amount: 96700,
    status: 'SENT',
    createdDate: daysAgo(30),
    dueDate: daysFromNow(0),
    ageInDays: 30,
    route: 'PTA → Polokwane (Building Materials)',
    podMethod: 'photo_timestamp',
    podComplete: true,
    description: 'Cement and steel delivery'
  },
  {
    id: 'INV-007',
    invoiceNumber: 'INV-20260201-0007',
    customerId: 'CUST-003',
    customerName: 'Build It Supplies Pty',
    amount: 112400,
    status: 'SENT',
    createdDate: daysAgo(23),
    dueDate: daysFromNow(7),
    ageInDays: 23,
    route: 'PTA → Rustenburg (Lumber)',
    podMethod: 'driver_signature',
    podComplete: false,
    podQualityIssues: ['no_recipient'],
    description: 'Timber and hardware supplies'
  },
  {
    id: 'INV-008',
    invoiceNumber: 'INV-20260208-0008',
    customerId: 'CUST-004',
    customerName: 'Coastal Mining Equipment',
    amount: 234000,
    status: 'SENT',
    createdDate: daysAgo(16),
    dueDate: daysFromNow(44),
    ageInDays: 16,
    route: 'DBN → Richards Bay (Mining Parts)',
    podMethod: 'photo',
    podComplete: true,
    description: 'Heavy mining equipment components'
  },

  // ELEVATED TIER - Limpopo Agri (poor history, aging invoices)
  {
    id: 'INV-009',
    invoiceNumber: 'INV-20260115-0009',
    customerId: 'CUST-005',
    customerName: 'Limpopo Agri Holdings',
    amount: 67800,
    status: 'OVERDUE',
    createdDate: daysAgo(40),
    dueDate: daysAgo(10),
    ageInDays: 40,
    route: 'Polokwane → Tzaneen (Fertilizer)',
    podMethod: 'driver_signature',
    podComplete: false,
    podQualityIssues: ['illegible'],
    description: 'Bulk fertilizer delivery'
  },
  {
    id: 'INV-010',
    invoiceNumber: 'INV-20260128-0010',
    customerId: 'CUST-005',
    customerName: 'Limpopo Agri Holdings',
    amount: 45200,
    status: 'SENT',
    createdDate: daysAgo(27),
    dueDate: daysFromNow(63),
    ageInDays: 27,
    route: 'JHB → Makhado (Seed & Feed)',
    podMethod: 'manual',
    podComplete: false,
    description: 'Agricultural supplies'
  },
  {
    id: 'INV-011',
    invoiceNumber: 'INV-20260105-0011',
    customerId: 'CUST-004',
    customerName: 'Coastal Mining Equipment',
    amount: 189500,
    status: 'SENT',
    createdDate: daysAgo(50),
    dueDate: daysFromNow(10),
    ageInDays: 50,
    route: 'JHB → Witbank (Mining Machinery)',
    podMethod: 'photo',
    podComplete: true,
    description: 'Oversize mining equipment'
  },

  // MIXED - NewStart (brand new customer, good credit, small history)
  {
    id: 'INV-012',
    invoiceNumber: 'INV-20260220-0012',
    customerId: 'CUST-007',
    customerName: 'NewStart Logistics (Pty)',
    amount: 28400,
    status: 'SENT',
    createdDate: daysAgo(4),
    dueDate: daysFromNow(26),
    ageInDays: 4,
    route: 'JHB → Sandton (E-commerce Parcels)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Last-mile e-commerce fulfillment'
  },
  {
    id: 'INV-013',
    invoiceNumber: 'INV-20260222-0013',
    customerId: 'CUST-007',
    customerName: 'NewStart Logistics (Pty)',
    amount: 31200,
    status: 'SENT',
    createdDate: daysAgo(2),
    dueDate: daysFromNow(28),
    ageInDays: 2,
    route: 'JHB → Centurion (E-commerce Parcels)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Express e-commerce delivery'
  },

  // INELIGIBLE - Eastern Cape Traders (active dispute, poor credit, very aged)
  {
    id: 'INV-014',
    invoiceNumber: 'INV-20251210-0014',
    customerId: 'CUST-008',
    customerName: 'Eastern Cape Traders',
    amount: 124800,
    status: 'OVERDUE',
    createdDate: daysAgo(76),
    dueDate: daysAgo(16),
    ageInDays: 76,
    route: 'PE → East London (General Freight)',
    podMethod: 'driver_signature',
    podComplete: false,
    podQualityIssues: ['no_date', 'illegible'],
    description: 'Mixed freight - DISPUTED INVOICE'
  },
  {
    id: 'INV-015',
    invoiceNumber: 'INV-20260102-0015',
    customerId: 'CUST-008',
    customerName: 'Eastern Cape Traders',
    amount: 87600,
    status: 'OVERDUE',
    createdDate: daysAgo(53),
    dueDate: daysAgo(0),
    ageInDays: 53,
    route: 'PE → Mthatha (Wholesale Goods)',
    podMethod: 'manual',
    podComplete: false,
    description: 'Wholesale delivery - customer slow to pay'
  },

  // Additional variety
  {
    id: 'INV-016',
    invoiceNumber: 'INV-20260219-0016',
    customerId: 'CUST-006',
    customerName: 'Karoo Transport Co-op',
    amount: 73500,
    status: 'SENT',
    createdDate: daysAgo(5),
    dueDate: daysFromNow(25),
    ageInDays: 5,
    route: 'Beaufort West → Oudtshoorn (Tourism Supplies)',
    podMethod: 'photo_timestamp',
    podComplete: true,
    description: 'Hotel and restaurant supplies'
  },
  {
    id: 'INV-017',
    invoiceNumber: 'INV-20260216-0017',
    customerId: 'CUST-001',
    customerName: 'Tiger Brands Ltd',
    amount: 156000,
    status: 'SENT',
    createdDate: daysAgo(8),
    dueDate: daysFromNow(22),
    ageInDays: 8,
    route: 'JHB → Bloemfontein (Canned Goods)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Bulk canned food products'
  },
  {
    id: 'INV-018',
    invoiceNumber: 'INV-20260214-0018',
    customerId: 'CUST-002',
    customerName: 'Shoprite Distribution',
    amount: 94200,
    status: 'SENT',
    createdDate: daysAgo(10),
    dueDate: daysFromNow(50),
    ageInDays: 10,
    route: 'CPT → Paarl (Beverages)',
    podMethod: 'e_signature',
    podComplete: true,
    description: 'Soft drinks and water delivery'
  },
  {
    id: 'INV-019',
    invoiceNumber: 'INV-20260207-0019',
    customerId: 'CUST-003',
    customerName: 'Build It Supplies Pty',
    amount: 67900,
    status: 'SENT',
    createdDate: daysAgo(17),
    dueDate: daysFromNow(13),
    ageInDays: 17,
    route: 'PTA → Midrand (Paint & Hardware)',
    podMethod: 'driver_signature',
    podComplete: true,
    description: 'Paint supplies and tools'
  },
  {
    id: 'INV-020',
    invoiceNumber: 'INV-20260211-0020',
    customerId: 'CUST-006',
    customerName: 'Karoo Transport Co-op',
    amount: 42100,
    status: 'SENT',
    createdDate: daysAgo(13),
    dueDate: daysFromNow(17),
    ageInDays: 13,
    route: 'Beaufort West → Graaff-Reinet (General)',
    podMethod: 'photo_timestamp',
    podComplete: true,
    description: 'Mixed general cargo'
  }
];

export const FACILITY_DATA = {
  facilityId: 'FAC-MAIN-001',
  fleetOperatorId: 'OP-001',
  facilityLimit: 500000, // R500,000
  currentOutstanding: 125000, // R125,000 (25% utilization)
  utilizationPercent: 25,
  status: 'ACTIVE',
  establishedDate: '2023-01-10',
  lastReviewDate: '2025-12-01'
};

/**
 * Calculate how many invoices are eligible for fast pay
 */
export function getEligibleInvoicesCount(): number {
  return MOCK_INVOICES.filter(inv => {
    // Simple heuristic: not overdue, not too old, not from disputed customer
    return inv.status === 'SENT' &&
           inv.ageInDays <= 60 &&
           inv.customerId !== 'CUST-008' && // Eastern Cape Traders (dispute)
           inv.podMethod !== 'none' &&
           inv.podMethod !== 'manual';
  }).length;
}

/**
 * Get customer by ID
 */
export function getCustomerById(customerId: string): Customer | undefined {
  return MOCK_CUSTOMERS.find(c => c.id === customerId);
}

/**
 * Get invoices for a specific customer
 */
export function getInvoicesByCustomer(customerId: string): Invoice[] {
  return MOCK_INVOICES.filter(inv => inv.customerId === customerId);
}

/**
 * Get total outstanding from all SENT invoices
 */
export function getTotalOutstanding(): number {
  return MOCK_INVOICES
    .filter(inv => inv.status === 'SENT')
    .reduce((sum, inv) => sum + inv.amount, 0);
}
