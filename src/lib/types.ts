// Core Truckwys Types
export interface Quote {
  id: string;
  loadId: string;
  origin: string;
  destination: string;
  distance: number;
  estimatedHours: number;
  baseRate: number;
  fuelSurcharge: number;
  totalCost: number;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  confidence: number;
  createdAt: string;
  expiresAt?: string;
  acceptedAt?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  agent: AgentInsight;
}

export interface Lane {
  id: string;
  origin: string;
  destination: string;
  distance: number;
  averageHours: number;
  frequency: string;
  performance: LanePerformance;
  pricing: LanePricing;
  demand: LaneDemand;
  lastUpdate: string;
}

export interface LanePerformance {
  onTime: number;
  utilizationRate: number;
  profitMargin: number;
}

export interface LanePricing {
  baseRate: number;
  currentFuelSurcharge: number;
  marketRate: number;
  competitivePosition: 'premium' | 'optimal' | 'competitive' | 'underpriced';
}

export interface LaneDemand {
  level: 'low' | 'medium' | 'high';
  trend: 'declining' | 'stable' | 'increasing';
  seasonality: 'stable' | 'summer_peak' | 'winter_peak';
}

export interface AgentInsight {
  name: string;
  confidence: number;
  reasoning: string;
}

export interface CashFlow {
  currentBalance: number;
  projectedWeekly: WeeklyCashFlow[];
  dso: number;
  dsoTrend: 'improving' | 'stable' | 'declining';
}

export interface WeeklyCashFlow {
  week: string;
  inflow: number;
  outflow: number;
  net: number;
}

export interface Invoices {
  outstanding: number;
  overdue: number;
  overduePercentage: number;
  aging: InvoiceAging[];
}

export interface InvoiceAging {
  period: string;
  amount: number;
  percentage: number;
}

export interface Profitability {
  grossMargin: number;
  netMargin: number;
  ebitda: number;
  trends: {
    quarterly: QuarterlyTrend[];
  };
}

export interface QuarterlyTrend {
  quarter: string;
  margin: number;
}

export interface Leakage {
  type: string;
  amount: number;
  impact: 'low' | 'medium' | 'high';
  trend: 'decreasing' | 'stable' | 'increasing';
  description: string;
}

// Navigation Types
export interface NavigationItem {
  id: string;
  label: string;
  href: string;
  icon: string;
  badge?: string | number;
}

// Component State Types
export interface LoadingState {
  isLoading: boolean;
  error?: string | null;
}

export interface DataState<T> extends LoadingState {
  data: T | null;
}