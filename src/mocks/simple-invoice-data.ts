// Simple static invoice data — no risk engine calls at module load time
export type InvoiceTier = 'prime' | 'standard' | 'elevated' | 'high' | 'ineligible';

export interface SimpleInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  status: 'SENT' | 'OVERDUE' | 'PAID' | 'DRAFT';
  dueDate: string;
  tier: InvoiceTier;
  fastPay: boolean;
  score: number;
}

export const INVOICES: SimpleInvoice[] = [
  { id: '1',  invoiceNumber: 'INV-2026-001', customerName: 'Pick n Pay',          amount: 45200, status: 'SENT',    dueDate: '2026-03-05', tier: 'prime',      fastPay: true,  score: 92 },
  { id: '2',  invoiceNumber: 'INV-2026-002', customerName: 'Shoprite Holdings',   amount: 38900, status: 'SENT',    dueDate: '2026-03-07', tier: 'prime',      fastPay: true,  score: 89 },
  { id: '3',  invoiceNumber: 'INV-2026-003', customerName: 'Woolworths',          amount: 52100, status: 'SENT',    dueDate: '2026-03-03', tier: 'prime',      fastPay: true,  score: 94 },
  { id: '4',  invoiceNumber: 'INV-2026-004', customerName: 'Tiger Brands',        amount: 61200, status: 'SENT',    dueDate: '2026-03-06', tier: 'prime',      fastPay: true,  score: 91 },
  { id: '5',  invoiceNumber: 'INV-2026-005', customerName: 'Coca-Cola SA',        amount: 48700, status: 'SENT',    dueDate: '2026-03-04', tier: 'prime',      fastPay: true,  score: 88 },
  { id: '6',  invoiceNumber: 'INV-2026-006', customerName: 'Massmart',            amount: 33500, status: 'SENT',    dueDate: '2026-03-12', tier: 'standard',   fastPay: true,  score: 78 },
  { id: '7',  invoiceNumber: 'INV-2026-007', customerName: 'SPAR Group',          amount: 29800, status: 'SENT',    dueDate: '2026-03-15', tier: 'standard',   fastPay: true,  score: 75 },
  { id: '8',  invoiceNumber: 'INV-2026-008', customerName: 'Checkers',            amount: 41200, status: 'SENT',    dueDate: '2026-03-10', tier: 'standard',   fastPay: true,  score: 72 },
  { id: '9',  invoiceNumber: 'INV-2026-009', customerName: 'Astral Foods',        amount: 27600, status: 'SENT',    dueDate: '2026-03-18', tier: 'standard',   fastPay: true,  score: 71 },
  { id: '10', invoiceNumber: 'INV-2026-010', customerName: 'Rhodes Food Group',   amount: 36900, status: 'SENT',    dueDate: '2026-03-14', tier: 'standard',   fastPay: true,  score: 73 },
  { id: '11', invoiceNumber: 'INV-2026-011', customerName: 'Game Stores',         amount: 24500, status: 'SENT',    dueDate: '2026-03-25', tier: 'elevated',   fastPay: false, score: 62 },
  { id: '12', invoiceNumber: 'INV-2026-012', customerName: 'Oceana Group',        amount: 31200, status: 'SENT',    dueDate: '2026-03-28', tier: 'elevated',   fastPay: false, score: 58 },
  { id: '13', invoiceNumber: 'INV-2026-013', customerName: 'Nestle SA',           amount: 19800, status: 'SENT',    dueDate: '2026-04-01', tier: 'elevated',   fastPay: false, score: 60 },
  { id: '14', invoiceNumber: 'INV-2026-014', customerName: 'Mondi Group',         amount: 22400, status: 'OVERDUE', dueDate: '2026-02-20', tier: 'elevated',   fastPay: false, score: 55 },
  { id: '15', invoiceNumber: 'INV-2026-015', customerName: 'Afrox Limited',       amount: 26700, status: 'OVERDUE', dueDate: '2026-02-18', tier: 'high',       fastPay: false, score: 48 },
  { id: '16', invoiceNumber: 'INV-2026-016', customerName: 'Sappi Limited',       amount: 18900, status: 'OVERDUE', dueDate: '2026-02-10', tier: 'high',       fastPay: false, score: 44 },
  { id: '17', invoiceNumber: 'INV-2026-017', customerName: 'Barloworld',          amount: 21500, status: 'OVERDUE', dueDate: '2026-02-05', tier: 'ineligible', fastPay: false, score: 32 },
  { id: '18', invoiceNumber: 'INV-2026-018', customerName: 'Dis-Chem',            amount: 28500, status: 'OVERDUE', dueDate: '2026-02-01', tier: 'ineligible', fastPay: false, score: 28 },
  { id: '19', invoiceNumber: 'INV-2026-026', customerName: 'Pick n Pay',          amount: 42800, status: 'PAID',    dueDate: '2026-02-15', tier: 'prime',      fastPay: false, score: 90 },
  { id: '20', invoiceNumber: 'INV-2026-027', customerName: 'Shoprite Holdings',   amount: 39500, status: 'PAID',    dueDate: '2026-02-12', tier: 'prime',      fastPay: false, score: 87 },
  { id: '21', invoiceNumber: 'INV-2026-028', customerName: 'Woolworths',          amount: 48900, status: 'PAID',    dueDate: '2026-02-08', tier: 'prime',      fastPay: false, score: 93 },
];

export const facilityInfo = {
  facilityLimit: 500000,
  outstandingAdvances: 125000,
};

export function getEligibleInvoices() {
  return INVOICES.filter(i => i.fastPay && i.status !== 'PAID');
}

export function getRiskDistribution() {
  return INVOICES.reduce((acc, inv) => {
    acc[inv.tier] = (acc[inv.tier] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export function getTotalEligibleAmount() {
  return getEligibleInvoices().reduce((s, i) => s + i.amount, 0);
}
