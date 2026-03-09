import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { formatCurrency, formatDate, formatPercent } from "@/lib/formatters";
import { fetchData, postData, putData, deleteData } from "@/lib/Api";
import { type RiskTier, type RiskScoreResult, type RiskFactorBreakdown } from "@/lib/risk-engine";
import {
  allInvoices as mockInvoicesWithRisk,
  type InvoiceWithRisk,
} from "@/mocks/risk-mock-data";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from "recharts";

// ─── Tier Config ──────────────────────────────────────────────────

const TIER_CONFIG: Record<RiskTier, { label: string; color: string; bgAlpha: string }> = {
  prime:      { label: "PRIME",      color: "#10B981", bgAlpha: "rgba(16,185,129,0.08)" },
  standard:   { label: "STANDARD",   color: "#2563EB", bgAlpha: "rgba(37,99,235,0.08)" },
  elevated:   { label: "ELEVATED",   color: "#F59E0B", bgAlpha: "rgba(245,158,11,0.08)" },
  high:       { label: "HIGH",       color: "#EF4444", bgAlpha: "rgba(239,68,68,0.08)" },
  ineligible: { label: "INELIGIBLE", color: "#64748B", bgAlpha: "rgba(100,116,139,0.08)" },
};

const STATUS_COLOR: Record<string, string> = {
  PAID: 'var(--status-success)', SENT: 'var(--status-warning)',
  OVERDUE: 'var(--status-danger)', DRAFT: 'var(--text-tertiary)',
};

const EXPENSE_STATUS_COLOR: Record<string, string> = {
  PENDING: 'var(--status-warning)',
  APPROVED: 'var(--status-success)',
  REJECTED: 'var(--status-danger)',
};

const PAGE_SIZE = 10;

type FinanceTab = 'invoices' | 'expenses';
type SortField = 'date' | 'amount' | 'risk' | 'customer';
type SortDir = 'asc' | 'desc';

// ─── Sub-components ───────────────────────────────────────────────

function TierBadge({ tier }: { tier: RiskTier }) {
  const cfg = TIER_CONFIG[tier];
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 600,
      color: cfg.color, background: cfg.bgAlpha,
      padding: "2px 8px", borderRadius: 2, textTransform: "uppercase",
      letterSpacing: "0.06em",
    }}>
      {cfg.label}
    </span>
  );
}

function ScorePill({ score }: { score: number }) {
  const color = score >= 85 ? "#10B981"
    : score >= 70 ? "#2563EB"
    : score >= 55 ? "#F59E0B"
    : score >= 40 ? "#EF4444"
    : "#64748B";
  return (
    <span style={{
      fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 600,
      color, minWidth: 28, display: "inline-block", textAlign: "right",
    }}>
      {score}
    </span>
  );
}

function SkeletonRows({ count = 5 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <tr key={i}>
          {Array.from({ length: 8 }).map((_, j) => (
            <td key={j} style={{ padding: "14px 12px" }}>
              <div style={{
                height: 14, borderRadius: 3,
                background: "var(--bg-surface-hover)",
                width: j === 0 ? "60%" : j === 2 ? "40%" : "75%",
                animation: "pulse 1.8s ease-in-out infinite",
              }} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function KPISkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card" style={{ padding: 20 }}>
          <div style={{ height: 12, background: 'var(--bg-surface-hover)', borderRadius: 3, marginBottom: 14, width: '50%' }} />
          <div style={{ height: 22, background: 'var(--bg-surface-hover)', borderRadius: 3, width: '65%' }} />
        </div>
      ))}
    </div>
  );
}

// ─── SHAP-style Waterfall Chart ───────────────────────────────────

function SHAPWaterfall({ riskScore }: { riskScore: RiskScoreResult }) {
  const pillars = riskScore.pillarBreakdown;
  const avgScore = 50;

  const waterfallData = pillars.map(p => {
    const deviation = p.rawScore - avgScore;
    return {
      name: p.pillar
        .replace("Proof of Delivery & Documentation", "POD & Docs")
        .replace("Client Identity & Profile", "Client Identity")
        .replace("Client Financial Health", "Financial Health")
        .replace("Debtor Creditworthiness", "Debtor Credit")
        .replace("Invoice Characteristics", "Invoice Chars")
        .replace("Operational & Trip Factors", "Operational")
        .replace("Macro & Market Factors", "Macro & Market"),
      value: deviation,
      rawScore: p.rawScore,
      weight: p.weight,
      fill: deviation >= 0 ? "#10B981" : "#EF4444",
    };
  }).sort((a, b) => Math.abs(b.value) - Math.abs(a.value));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>
          Risk Factor Contributions
        </div>
        <div style={{ fontSize: 10, color: "var(--text-tertiary)", fontFamily: "var(--font-mono)" }}>
          Deviation from baseline (50)
        </div>
      </div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={waterfallData} layout="vertical" margin={{ left: 100, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" horizontal={false} />
          <XAxis
            type="number"
            domain={[-50, 50]}
            tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "'JetBrains Mono', monospace" }}
            tickFormatter={(v: number) => v > 0 ? `+${v}` : `${v}`}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#475569", fontSize: 10 }}
            width={95}
          />
          <Tooltip
            contentStyle={{
              background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: 6,
              fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
            }}
            itemStyle={{ color: "#0F172A" }}
            labelStyle={{ color: "#94A3B8", fontSize: 11 }}
            formatter={(value: number, _name: string, props: any) => {
              const entry = props.payload;
              return [
                `${value > 0 ? "+" : ""}${value.toFixed(0)} (raw: ${entry.rawScore}, weight: ${(entry.weight * 100).toFixed(0)}%)`,
                "Contribution",
              ];
            }}
          />
          <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
            {waterfallData.map((d, i) => (
              <Cell key={i} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Pillar Score Bar ─────────────────────────────────────────────

function PillarBar({ pillar }: { pillar: RiskFactorBreakdown }) {
  const pct = pillar.rawScore;
  const barColor = pct >= 70 ? "#10B981" : pct >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
          {pillar.pillar.replace("Proof of Delivery & Documentation", "POD & Docs")}
        </span>
        <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 600 }}>
          {pct}
          <span style={{ fontSize: 9, color: "var(--text-tertiary)", fontWeight: 400 }}>/100</span>
        </span>
      </div>
      <div style={{ background: "var(--bg-surface)", borderRadius: 2, height: 6, overflow: "hidden" }}>
        <div style={{
          width: `${pct}%`, height: "100%", background: barColor,
          borderRadius: 2, transition: "width 0.4s ease",
        }} />
      </div>
    </div>
  );
}

// ─── Invoice Detail Modal ─────────────────────────────────────────

function InvoiceDetailModal({
  data,
  onClose,
  onFastPay,
}: {
  data: InvoiceWithRisk;
  onClose: () => void;
  onFastPay: () => void;
}) {
  const rs = data.riskScore;
  const cfg = TIER_CONFIG[rs.riskTier];

  return (
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.6)", zIndex: 1000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: "100%", maxWidth: 820, maxHeight: "90vh",
          overflow: "auto", padding: 0,
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "flex-start",
          padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)",
        }}>
          <div>
            <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
              INVOICE RISK ANALYSIS
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 18, fontWeight: 600, color: "var(--text-primary)" }}>
                {data.invoice.invoiceId}
              </span>
              <TierBadge tier={rs.riskTier} />
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
              {data.customer.customerName} · {data.operator.operatorName}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent", border: "none", color: "var(--text-tertiary)",
              fontSize: 22, cursor: "pointer", padding: "0 4px", lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Score Banner */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr",
          gap: 0, borderBottom: "1px solid var(--border-subtle)",
        }}>
          {[
            { label: "RISK SCORE", value: rs.finalScore.toString(), color: cfg.color },
            { label: "FEE RATE", value: `${rs.finalFeePercent}%`, color: "var(--text-primary)" },
            { label: "MAX ADVANCE", value: `${rs.maxAdvancePercent}%`, color: "var(--text-primary)" },
            { label: "NET ADVANCE", value: formatCurrency(rs.netAdvance), color: "#10B981" },
          ].map((item, i) => (
            <div key={i} style={{
              padding: "16px 24px",
              borderRight: i < 3 ? "1px solid var(--border-subtle)" : "none",
            }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 4 }}>
                {item.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, fontFamily: "var(--font-mono)", color: item.color }}>
                {item.value}
              </div>
            </div>
          ))}
        </div>

        {/* Body */}
        <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
          {/* 7-Pillar Breakdown */}
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 14 }}>
              7-Pillar Scores
            </div>
            {rs.pillarBreakdown.map((p, i) => (
              <PillarBar key={i} pillar={p} />
            ))}
          </div>

          {/* SHAP Waterfall */}
          <SHAPWaterfall riskScore={rs} />

          {/* Drivers & Strengths */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#EF4444", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                TOP RISK DRIVERS
              </div>
              {rs.topRiskDrivers.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  No significant risk factors identified
                </div>
              ) : (
                rs.topRiskDrivers.map((d, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, display: "flex", gap: 8 }}>
                    <span style={{ color: "#EF4444", fontFamily: "var(--font-mono)", minWidth: 60, fontSize: 10, flexShrink: 0 }}>{d.impact}</span>
                    <span>{d.factor}</span>
                  </div>
                ))
              )}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#10B981", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                TOP STRENGTHS
              </div>
              {rs.topStrengths.length === 0 ? (
                <div style={{ fontSize: 11, color: "var(--text-tertiary)", fontStyle: "italic" }}>
                  No notable strengths identified
                </div>
              ) : (
                rs.topStrengths.map((s, i) => (
                  <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, display: "flex", gap: 8 }}>
                    <span style={{ color: "#10B981", fontFamily: "var(--font-mono)", minWidth: 60, fontSize: 10, flexShrink: 0 }}>{s.impact}</span>
                    <span>{s.factor}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Route & Pricing Info */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div className="card" style={{ padding: 16, background: "var(--bg-surface)" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 10 }}>
                ROUTE & OPERATIONS
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <DetailRow label="Route" value={data.routeData.routeName} />
                <DetailRow label="Distance" value={`${data.routeData.distanceKm} km`} />
                <DetailRow label="Cargo" value={data.operational.cargoType} />
                <DetailRow label="Route Risk" value={data.routeData.routeRiskLevel} />
                <DetailRow label="Confidence" value={`${rs.confidenceLevel}%`} />
              </div>
            </div>
            <div className="card" style={{ padding: 16, background: "var(--bg-surface)" }}>
              <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)", letterSpacing: "0.08em", marginBottom: 10 }}>
                PRICING DETAIL
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <DetailRow label="Invoice Amount" value={formatCurrency(rs.invoiceAmount)} />
                <DetailRow label="Base Fee" value={`${rs.baseFeePercent}%`} />
                <DetailRow label="Final Fee" value={`${rs.finalFeePercent}%`} />
                <DetailRow label="Fee Amount" value={formatCurrency(rs.feeAmount)} />
                <DetailRow label="Turnaround" value={rs.estimatedTurnaround} />
              </div>
            </div>
          </div>

          {/* Ineligibility Reasons (if any) */}
          {rs.ineligibilityReasons.length > 0 && (
            <div style={{
              background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)",
              borderRadius: 4, padding: 16,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#EF4444", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                INELIGIBILITY REASONS
              </div>
              {rs.ineligibilityReasons.map((r, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4, display: "flex", gap: 6 }}>
                  <span style={{ color: "#EF4444" }}>•</span>
                  <span>{r.description}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-tertiary)", marginLeft: "auto" }}>
                    {r.severity.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Action Buttons */}
          {rs.isEligible && (
            <div style={{ display: "flex", gap: 12 }}>
              <button
                className="btn-action"
                style={{ flex: 1, padding: "12px 20px", fontSize: 12 }}
                onClick={onFastPay}
              >
                ⚡ REQUEST FAST PAY · {formatCurrency(rs.netAdvance)}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-primary)", fontWeight: 500, textTransform: "capitalize" }}>
        {value}
      </span>
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────

function InvoiceEmptyState({ hasFilters, onClear }: { hasFilters: boolean; onClear: () => void }) {
  return (
    <tr>
      <td colSpan={8} style={{ textAlign: "center", padding: "48px 24px" }}>
        <div style={{ maxWidth: 360, margin: "0 auto" }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>
            {hasFilters ? "🔍" : "📄"}
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6 }}>
            {hasFilters ? "No invoices match your filters" : "No invoices yet"}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5, marginBottom: hasFilters ? 16 : 0 }}>
            {hasFilters
              ? "Try adjusting your search, status, or risk tier filters to see more results."
              : "Create your first invoice to start tracking payments and access Fast Pay early settlement."
            }
          </div>
          {hasFilters && (
            <button
              className="btn-action"
              style={{ fontSize: 11, padding: "6px 16px" }}
              onClick={onClear}
            >
              CLEAR FILTERS
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Component ───────────────────────────────────────────────

export default function Invoices() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<FinanceTab>('invoices');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [tierFilter, setTierFilter] = useState<string>('All');
  const [sortField, setSortField] = useState<SortField>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceWithRisk | null>(null);
  const statuses = ['All', 'SENT', 'OVERDUE', 'PAID', 'DRAFT'];
  const tiers: (RiskTier | 'All')[] = ['All', 'prime', 'standard', 'elevated', 'high', 'ineligible'];

  // Expenses state
  const [expenses, setExpenses] = useState<any[]>([]);
  const [expensesLoading, setExpensesLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('All');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expensePage, setExpensePage] = useState(1);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [expenseForm, setExpenseForm] = useState({
    category: 'FUEL',
    description: '',
    amount: '',
    expense_date: new Date().toISOString().split('T')[0],
    vehicle: '',
    vendor: '',
    receipt_number: '',
    notes: '',
    litres: '',
    price_per_litre: '',
  });

  const expenseCategories = ['All', 'FUEL', 'TOLLS', 'MAINTENANCE', 'DRIVER_COST', 'INSURANCE', 'OVERHEAD', 'OTHER'];
  const expenseStatuses = ['All', 'PENDING', 'APPROVED', 'REJECTED'];

  // ─── Build mock-enriched invoice list ─────────────────────────

  const enrichedInvoices = useMemo(() => {
    // Merge API invoices with mock risk data for demo
    // In production, risk scores would come from the backend
    return mockInvoicesWithRisk.map((mockInv) => {
      const rs = mockInv.riskScore;
      const createdDate = new Date();
      createdDate.setDate(createdDate.getDate() - mockInv.invoice.ageInDays);
      const dueDate = new Date(createdDate);
      dueDate.setDate(dueDate.getDate() + mockInv.invoice.paymentTermsDays);

      // Determine status from risk/age data
      const daysUntilDue = mockInv.invoice.daysUntilDue;
      let status: string;
      if (daysUntilDue < -30) status = 'OVERDUE';
      else if (daysUntilDue < 0) status = 'OVERDUE';
      else if (mockInv.invoice.ageInDays < 3) status = 'DRAFT';
      else status = 'SENT';

      // Some invoices are paid
      if (rs.riskTier === 'prime' && mockInv.invoice.ageInDays > 20) status = 'PAID';

      return {
        id: mockInv.invoice.invoiceId,
        invoice_number: mockInv.invoice.invoiceId,
        customer_name: mockInv.customer.customerName,
        total_amount: mockInv.invoice.amount,
        status,
        due_date: dueDate.toISOString().split('T')[0],
        created_date: createdDate.toISOString().split('T')[0],
        risk_tier: rs.riskTier,
        risk_score: rs.finalScore,
        fast_pay_eligible: rs.isEligible,
        net_advance: rs.netAdvance,
        fee_percent: rs.finalFeePercent,
        turnaround: rs.estimatedTurnaround,
        _mockData: mockInv,
      };
    });
  }, []);

  useEffect(() => {
    document.title = 'Invoices - TruckWys';
  }, []);

  useEffect(() => {
    // Simulate loading, use enriched mock data
    setLoading(true);
    const timer = setTimeout(() => {
      setInvoices(enrichedInvoices);
      setLoading(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [enrichedInvoices]);

  // Load expenses when switching to expenses tab
  useEffect(() => {
    if (activeTab === 'expenses') {
      const loadExpenses = async () => {
        setExpensesLoading(true);
        try {
          const [expensesData, vehiclesData] = await Promise.all([
            fetchData('/api/v1/expenses/'),
            fetchData('/api/v1/vehicles/').catch(() => []),
          ]);
          setExpenses(Array.isArray(expensesData) ? expensesData : (expensesData?.results || []));
          setVehicles(Array.isArray(vehiclesData) ? vehiclesData : (vehiclesData?.results || []));
        } catch (error) {
          console.error('Failed to load expenses:', error);
          setExpenses([]);
        } finally {
          setExpensesLoading(false);
        }
      };

      loadExpenses();
    }
  }, [activeTab]);

  // ─── Expense handlers ────────────────────────────────────────

  const handleExpenseFormChange = (field: string, value: any) => {
    setExpenseForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'litres' || field === 'price_per_litre') {
        const litres = parseFloat(field === 'litres' ? value : updated.litres) || 0;
        const pricePerLitre = parseFloat(field === 'price_per_litre' ? value : updated.price_per_litre) || 0;
        if (litres > 0 && pricePerLitre > 0) {
          updated.amount = (litres * pricePerLitre).toFixed(2);
        }
      }
      return updated;
    });
  };

  const handleAddExpense = async () => {
    try {
      const payload: any = {
        category: expenseForm.category,
        description: expenseForm.description,
        amount: parseFloat(expenseForm.amount),
        expense_date: expenseForm.expense_date,
        vehicle: expenseForm.vehicle || null,
        vendor: expenseForm.vendor || null,
        receipt_number: expenseForm.receipt_number || null,
        notes: expenseForm.notes || '',
      };

      if (expenseForm.category === 'FUEL' && expenseForm.litres && expenseForm.price_per_litre) {
        payload.notes = `Fuel: ${expenseForm.litres}L @ ${formatCurrency(parseFloat(expenseForm.price_per_litre))}/L${payload.notes ? '\n' + payload.notes : ''}`;
      }

      if (editingExpense) {
        await putData({ url: `/api/v1/expenses/${editingExpense.id}/`, data: payload });
        setToast('Expense updated!');
        setExpenses(prev => prev.map(e => e.id === editingExpense.id ? { ...e, ...payload } : e));
      } else {
        const newExpense = await postData({ url: '/api/v1/expenses/', data: payload });
        setToast('Expense added!');
        setExpenses(prev => [newExpense, ...prev]);
      }

      setTimeout(() => setToast(null), 3000);
      setShowExpenseForm(false);
      setEditingExpense(null);
      setExpenseForm({
        category: 'FUEL', description: '', amount: '',
        expense_date: new Date().toISOString().split('T')[0],
        vehicle: '', vendor: '', receipt_number: '', notes: '', litres: '', price_per_litre: '',
      });
    } catch (error) {
      console.error('Failed to save expense:', error);
      setToast('Failed to save expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleApproveExpense = async (expenseId: string) => {
    try {
      await postData({ url: `/api/v1/expenses/${expenseId}/approve/` });
      setToast('Expense approved!');
      setTimeout(() => setToast(null), 3000);
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'APPROVED' } : e));
    } catch (error) {
      console.error('Failed to approve expense:', error);
      setToast('Failed to approve expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleRejectExpense = async (expenseId: string) => {
    try {
      await postData({ url: `/api/v1/expenses/${expenseId}/reject/` });
      setToast('Expense rejected!');
      setTimeout(() => setToast(null), 3000);
      setExpenses(prev => prev.map(e => e.id === expenseId ? { ...e, status: 'REJECTED' } : e));
    } catch (error) {
      console.error('Failed to reject expense:', error);
      setToast('Failed to reject expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleEditExpense = (expense: any) => {
    setEditingExpense(expense);
    let litres = '';
    let pricePerLitre = '';
    if (expense.category === 'FUEL' && expense.notes) {
      const fuelMatch = expense.notes.match(/Fuel: ([\d.]+)L @ R([\d.]+)\/L/);
      if (fuelMatch) {
        litres = fuelMatch[1];
        pricePerLitre = fuelMatch[2];
      }
    }
    setExpenseForm({
      category: expense.category, description: expense.description,
      amount: expense.amount.toString(), expense_date: expense.expense_date,
      vehicle: expense.vehicle || '', vendor: expense.vendor || '',
      receipt_number: expense.receipt_number || '',
      notes: expense.notes?.replace(/^Fuel: [\d.]+L @ R[\d.]+\/L\n?/, '') || '',
      litres, price_per_litre: pricePerLitre,
    });
    setShowExpenseForm(true);
  };

  const handleDeleteExpense = async (expenseId: string) => {
    if (!confirm('Are you sure you want to delete this expense?')) return;
    try {
      await deleteData({ url: `/api/v1/expenses/${expenseId}/` });
      setToast('Expense deleted!');
      setTimeout(() => setToast(null), 3000);
      setExpenses(prev => prev.filter(e => e.id !== expenseId));
    } catch (error) {
      console.error('Failed to delete expense:', error);
      setToast('Failed to delete expense');
      setTimeout(() => setToast(null), 3000);
    }
  };

  const handleSendInvoice = async (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    setSendingId(invoiceId);
    try {
      await postData({ url: `/api/v1/invoices/${invoiceId}/send_invoice/` });
      setToast('Invoice sent!');
      setTimeout(() => setToast(null), 3000);
      setInvoices(prev => prev.map(inv => inv.id === invoiceId ? { ...inv, status: 'SENT' } : inv));
    } catch (error) {
      console.error('Failed to send invoice:', error);
      setToast('Failed to send invoice');
      setTimeout(() => setToast(null), 3000);
    } finally {
      setSendingId(null);
    }
  };

  const handleDownloadPDF = (e: React.MouseEvent, invoiceId: string) => {
    e.stopPropagation();
    const url = `/api/v1/invoices/${invoiceId}/generate_pdf/`;
    window.open(import.meta.env.VITE_API_URL + url, '_blank');
    setToast('PDF downloading...');
    setTimeout(() => setToast(null), 3000);
  };

  // ─── Sorting helper ──────────────────────────────────────────

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir(field === 'risk' ? 'desc' : 'asc');
    }
    setPage(1);
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' ↑' : ' ↓';
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('All');
    setTierFilter('All');
    setPage(1);
  };

  // ─── Filter + Sort ───────────────────────────────────────────

  const allInvoices = invoices;

  const filtered = useMemo(() => {
    let result = allInvoices.filter(inv => {
      const invStatus = inv.status?.toUpperCase();
      const matchStatus = statusFilter === 'All' || invStatus === statusFilter;
      const matchTier = tierFilter === 'All' || inv.risk_tier === tierFilter;
      const invNumber = inv.invoice_number || inv.invoiceNumber || '';
      const custName = inv.customer_name || inv.customerName || '';
      const matchSearch = !search || invNumber.toLowerCase().includes(search.toLowerCase()) || custName.toLowerCase().includes(search.toLowerCase());
      return matchStatus && matchTier && matchSearch;
    });

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case 'date':
          cmp = (a.due_date || '').localeCompare(b.due_date || '');
          break;
        case 'amount':
          cmp = (parseFloat(a.total_amount) || 0) - (parseFloat(b.total_amount) || 0);
          break;
        case 'risk':
          cmp = (a.risk_score || 0) - (b.risk_score || 0);
          break;
        case 'customer':
          cmp = (a.customer_name || '').localeCompare(b.customer_name || '');
          break;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

    return result;
  }, [allInvoices, statusFilter, tierFilter, search, sortField, sortDir]);

  const hasFilters = search !== '' || statusFilter !== 'All' || tierFilter !== 'All';
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ─── KPI calculations ────────────────────────────────────────

  const kpis = useMemo(() => {
    const total = allInvoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const eligible = allInvoices.filter(i => i.fast_pay_eligible && i.status !== 'PAID');
    const eligibleAmount = eligible.reduce((s, i) => s + (i.net_advance || 0), 0);
    const overdueCount = allInvoices.filter(i => i.status === 'OVERDUE').length;
    const avgScore = allInvoices.length > 0
      ? Math.round(allInvoices.reduce((s, i) => s + (i.risk_score || 0), 0) / allInvoices.length)
      : 0;

    return { total, eligibleCount: eligible.length, eligibleAmount, overdueCount, avgScore };
  }, [allInvoices]);

  // ─── Tier distribution for filter counts ──────────────────────

  const tierCounts = useMemo(() => {
    const counts: Record<string, number> = { All: allInvoices.length };
    for (const t of ['prime', 'standard', 'elevated', 'high', 'ineligible']) {
      counts[t] = allInvoices.filter(i => i.risk_tier === t).length;
    }
    return counts;
  }, [allInvoices]);

  return (
    <div>
      {toast && (
        <div style={{ position: 'fixed', top: 80, right: 24, zIndex: 1100, background: 'var(--accent-primary)', color: 'black', padding: '12px 20px', borderRadius: 2, fontSize: 12, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
          {toast}
        </div>
      )}

      {/* Invoice Detail Modal */}
      {selectedInvoice && (
        <InvoiceDetailModal
          data={selectedInvoice}
          onClose={() => setSelectedInvoice(null)}
          onFastPay={() => {
            setSelectedInvoice(null);
            navigate('/capital');
          }}
        />
      )}

      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 4 }}>Finance</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 500, color: 'var(--text-primary)' }}>
              {activeTab === 'invoices' ? 'Invoices' : 'Expenses'}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)', marginTop: 4 }}>
              Last updated: {new Date().toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
          {activeTab === 'invoices' && (
            <button className="btn-action" onClick={() => navigate('/finance/invoices/new')}>+ NEW INVOICE</button>
          )}
          {activeTab === 'expenses' && (
            <button className="btn-action" onClick={() => { setShowExpenseForm(true); setEditingExpense(null); }}>+ ADD EXPENSE</button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div style={{
        borderBottom: '1px solid var(--border-subtle)',
        marginBottom: 32,
        display: 'flex',
        gap: 32,
      }}>
        {([
          { id: 'invoices', label: 'Invoices' },
          { id: 'expenses', label: 'Expenses' },
        ] as { id: FinanceTab; label: string }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--accent-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              padding: '12px 0',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'var(--font-mono)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
            onMouseEnter={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              if (activeTab !== tab.id) e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─── EXPENSES TAB ────────────────────────────────────────── */}
      {activeTab === 'expenses' && (
        <>
          {/* Expense Form Modal */}
          {showExpenseForm && (
            <div style={{
              position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(0, 0, 0, 0.7)', zIndex: 1000,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
            }}>
              <div className="card" style={{ width: '100%', maxWidth: 600, maxHeight: '90vh', overflow: 'auto', padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                  <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>
                    {editingExpense ? 'Edit Expense' : 'Add Expense'}
                  </div>
                  <button
                    onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-tertiary)', fontSize: 24, cursor: 'pointer', padding: 0, lineHeight: 1 }}
                  >×</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Category *</label>
                    <select value={expenseForm.category} onChange={(e) => handleExpenseFormChange('category', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                      <option value="FUEL">Fuel</option>
                      <option value="TOLLS">Tolls</option>
                      <option value="MAINTENANCE">Maintenance</option>
                      <option value="DRIVER_COST">Driver Cost</option>
                      <option value="INSURANCE">Insurance</option>
                      <option value="OVERHEAD">Overhead</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Description *</label>
                    <input type="text" value={expenseForm.description} onChange={(e) => handleExpenseFormChange('description', e.target.value)} placeholder="e.g. Fuel refill at Shell"
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-sans)' }} />
                  </div>

                  {expenseForm.category === 'FUEL' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Litres</label>
                        <input type="number" step="0.01" value={expenseForm.litres} onChange={(e) => handleExpenseFormChange('litres', e.target.value)} placeholder="0.00"
                          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Price/Litre</label>
                        <input type="number" step="0.01" value={expenseForm.price_per_litre} onChange={(e) => handleExpenseFormChange('price_per_litre', e.target.value)} placeholder="0.00"
                          style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Amount (ZAR) *</label>
                    <input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => handleExpenseFormChange('amount', e.target.value)} placeholder="0.00"
                      readOnly={!!(expenseForm.category === 'FUEL' && expenseForm.litres && expenseForm.price_per_litre)}
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date *</label>
                      <input type="date" value={expenseForm.expense_date} onChange={(e) => handleExpenseFormChange('expense_date', e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle</label>
                      <select value={expenseForm.vehicle} onChange={(e) => handleExpenseFormChange('vehicle', e.target.value)}
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-sans)' }}>
                        <option value="">Select vehicle...</option>
                        {vehicles.map(v => (
                          <option key={v.id} value={v.id}>{v.registration || v.vehicle_number}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vendor</label>
                      <input type="text" value={expenseForm.vendor} onChange={(e) => handleExpenseFormChange('vendor', e.target.value)} placeholder="e.g. Shell, BP"
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-sans)' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Receipt #</label>
                      <input type="text" value={expenseForm.receipt_number} onChange={(e) => handleExpenseFormChange('receipt_number', e.target.value)} placeholder="Receipt number"
                        style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-mono)' }} />
                    </div>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
                    <textarea value={expenseForm.notes} onChange={(e) => handleExpenseFormChange('notes', e.target.value)} placeholder="Additional notes..." rows={3}
                      style={{ width: '100%', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '10px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 13, fontFamily: 'var(--font-sans)', resize: 'vertical' }} />
                  </div>

                  <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                    <button className="btn-action" onClick={handleAddExpense}
                      disabled={!expenseForm.category || !expenseForm.description || !expenseForm.amount || !expenseForm.expense_date}
                      style={{ flex: 1 }}>
                      {editingExpense ? 'UPDATE EXPENSE' : 'ADD EXPENSE'}
                    </button>
                    <button onClick={() => { setShowExpenseForm(false); setEditingExpense(null); }}
                      style={{ flex: 1, background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 16px', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', fontWeight: 600, letterSpacing: '0.05em' }}>
                      CANCEL
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Expenses KPIs */}
          {expensesLoading ? <KPISkeleton /> : (
            <>
              {(() => {
                const now = new Date();
                const currentMonth = now.getMonth();
                const currentYear = now.getFullYear();
                const thisMonthExpenses = expenses.filter(e => {
                  const expDate = new Date(e.expense_date);
                  return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
                });
                const totalMtd = thisMonthExpenses.filter(e => e.status === 'APPROVED').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                const pendingExpenses = expenses.filter(e => e.status === 'PENDING');
                const pendingAmount = pendingExpenses.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                const fuelCosts = thisMonthExpenses.filter(e => e.category === 'FUEL').reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
                const categoryTotals: Record<string, number> = {};
                thisMonthExpenses.forEach(e => { categoryTotals[e.category] = (categoryTotals[e.category] || 0) + parseFloat(e.amount || 0); });
                const topCategoryEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
                const topCategory = topCategoryEntry ? topCategoryEntry[0].replace('_', ' ') : 'N/A';
                const topCategoryAmount = topCategoryEntry ? topCategoryEntry[1] : 0;

                return (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
                    {[
                      { label: 'Total Expenses MTD', value: formatCurrency(totalMtd), color: 'var(--text-primary)' },
                      { label: 'Pending Approval', value: `${pendingExpenses.length} / ${formatCurrency(pendingAmount)}`, color: 'var(--status-warning)' },
                      { label: 'Fuel Costs MTD', value: formatCurrency(fuelCosts), color: 'var(--accent-primary)' },
                      { label: 'Top Category', value: `${topCategory}\n${formatCurrency(topCategoryAmount)}`, color: 'var(--text-primary)' },
                    ].map(m => (
                      <div key={m.label} className="card metric-card">
                        <div className="card-header"><span className="card-title">{m.label}</span></div>
                        <div className="metric-value" style={{ fontSize: 20, color: m.color, whiteSpace: 'pre-line' }}>{m.value}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Search expenses..." value={expenseSearch}
              onChange={e => { setExpenseSearch(e.target.value); setExpensePage(1); }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 220, fontFamily: 'var(--font-sans)' }} />
            <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setExpensePage(1); }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '7px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 11, fontFamily: 'var(--font-mono)', outline: 'none', cursor: 'pointer' }}>
              {expenseCategories.map(c => (
                <option key={c} value={c}>{c === 'All' ? 'All Categories' : c.replace('_', ' ')}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 4 }}>
              {expenseStatuses.map(s => (
                <button key={s} onClick={() => { setExpenseStatusFilter(s); setExpensePage(1); }}
                  style={{
                    background: expenseStatusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
                    border: '1px solid var(--border-subtle)',
                    color: expenseStatusFilter === s ? 'var(--bg-deep)' : 'var(--text-secondary)',
                    padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    fontWeight: expenseStatusFilter === s ? 600 : 400, transition: 'all 0.2s ease',
                  }}>
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Expenses Table */}
          {(() => {
            const filteredExpenses = expenses.filter(e => {
              const matchCategory = categoryFilter === 'All' || e.category === categoryFilter;
              const matchStatus = expenseStatusFilter === 'All' || e.status === expenseStatusFilter;
              const matchSearch = !expenseSearch ||
                e.description?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                e.vendor?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                e.expense_number?.toLowerCase().includes(expenseSearch.toLowerCase());
              return matchCategory && matchStatus && matchSearch;
            });
            const expTotalPages = Math.max(1, Math.ceil(filteredExpenses.length / PAGE_SIZE));
            const expenseRows = filteredExpenses.slice((expensePage - 1) * PAGE_SIZE, expensePage * PAGE_SIZE);

            return (
              <>
                <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'flex-end' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                    {filteredExpenses.length} expenses
                  </span>
                </div>

                <div className="card table-card">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th><th>Category</th><th>Description</th><th>Vehicle</th>
                        <th className="text-right">Amount</th><th>Status</th><th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expenseRows.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '48px 0' }}>
                            <div style={{ fontSize: 32, marginBottom: 8 }}>💰</div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>No expenses recorded yet</div>
                            <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Track fuel, tolls, maintenance and other fleet costs here.</div>
                          </td>
                        </tr>
                      ) : expenseRows.map(exp => {
                        const vehicleName = vehicles.find(v => v.id === exp.vehicle)?.registration ||
                          vehicles.find(v => v.id === exp.vehicle)?.vehicle_number || 'N/A';
                        return (
                          <tr key={exp.id}>
                            <td className="mono" style={{ fontSize: 12 }}>{formatDate(exp.expense_date)}</td>
                            <td style={{ fontSize: 12 }}><span style={{ fontFamily: 'var(--font-sans)' }}>{exp.category.replace('_', ' ')}</span></td>
                            <td style={{ fontSize: 12 }}>{exp.description}</td>
                            <td className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{vehicleName}</td>
                            <td className="mono text-right" style={{ fontSize: 13, fontWeight: 500 }}>{formatCurrency(exp.amount)}</td>
                            <td>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: EXPENSE_STATUS_COLOR[exp.status] || 'var(--text-secondary)', padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2 }}>
                                {exp.status}
                              </span>
                            </td>
                            <td className="text-right">
                              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                                {exp.status === 'PENDING' && (
                                  <>
                                    <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'var(--status-success)', border: 'none' }} onClick={() => handleApproveExpense(exp.id)}>APPROVE</button>
                                    <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'var(--status-danger)', border: 'none' }} onClick={() => handleRejectExpense(exp.id)}>REJECT</button>
                                  </>
                                )}
                                <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} onClick={() => handleEditExpense(exp)}>EDIT</button>
                                <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--status-danger)', color: 'var(--status-danger)' }} onClick={() => handleDeleteExpense(exp.id)}>DEL</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {expTotalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                        Page {expensePage} of {expTotalPages} · showing {expenseRows.length} of {filteredExpenses.length}
                      </span>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-action" onClick={() => setExpensePage(p => Math.max(1, p - 1))} disabled={expensePage === 1}>← PREV</button>
                        <button className="btn-action" onClick={() => setExpensePage(p => Math.min(expTotalPages, p + 1))} disabled={expensePage === expTotalPages}>NEXT →</button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </>
      )}

      {/* ─── INVOICES TAB ────────────────────────────────────────── */}
      {activeTab === 'invoices' && (
        <>
          {/* KPIs */}
          {loading ? <KPISkeleton /> : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
              {[
                { label: 'Total Invoiced', value: formatCurrency(kpis.total), color: 'var(--text-primary)' },
                { label: 'Fast Pay Eligible', value: `${kpis.eligibleCount} · ${formatCurrency(kpis.eligibleAmount)}`, color: '#10B981' },
                { label: 'Overdue', value: `${kpis.overdueCount} invoices`, color: 'var(--status-danger)' },
                { label: 'Avg Risk Score', value: kpis.avgScore.toString(), color: kpis.avgScore >= 70 ? '#10B981' : kpis.avgScore >= 55 ? '#F59E0B' : '#EF4444' },
              ].map(m => (
                <div key={m.label} className="card metric-card">
                  <div className="card-header"><span className="card-title">{m.label}</span></div>
                  <div className="metric-value" style={{ fontSize: 20, color: m.color, fontFamily: 'var(--font-mono)' }}>{m.value}</div>
                </div>
              ))}
            </div>
          )}

          {/* Filters */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              type="text" placeholder="Search invoices or customers..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', padding: '8px 12px', color: 'var(--text-primary)', borderRadius: 2, fontSize: 12, outline: 'none', width: 240, fontFamily: 'var(--font-sans)' }}
            />
            <div style={{ display: 'flex', gap: 4 }}>
              {statuses.map(s => (
                <button key={s} onClick={() => { setStatusFilter(s); setPage(1); }} style={{
                  background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)',
                  color: statusFilter === s ? 'var(--bg-deep)' : 'var(--text-secondary)',
                  padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2,
                  cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                  fontWeight: statusFilter === s ? 600 : 400, transition: 'all 0.2s ease',
                }}>{s}</button>
              ))}
            </div>
          </div>

          {/* Tier Filter */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginRight: 4 }}>
              RISK TIER
            </span>
            {tiers.map(t => {
              const isActive = tierFilter === t;
              const cfg = t === 'All' ? null : TIER_CONFIG[t];
              const count = tierCounts[t] || 0;
              return (
                <button
                  key={t}
                  onClick={() => { setTierFilter(t); setPage(1); }}
                  style={{
                    background: isActive ? (cfg ? cfg.bgAlpha : 'var(--accent-primary)') : 'transparent',
                    border: `1px solid ${isActive ? (cfg ? cfg.color : 'var(--accent-primary)') : 'var(--border-subtle)'}`,
                    color: isActive ? (cfg ? cfg.color : 'var(--bg-deep)') : 'var(--text-tertiary)',
                    padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2,
                    cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.06em',
                    fontWeight: isActive ? 600 : 400, transition: 'all 0.2s ease',
                    display: 'flex', alignItems: 'center', gap: 4,
                  }}
                >
                  {t === 'All' ? 'ALL' : cfg!.label}
                  <span style={{ fontSize: 9, opacity: 0.7 }}>{count}</span>
                </button>
              );
            })}
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
              {filtered.length} invoices
            </span>
          </div>

          {/* Table */}
          <div className="card table-card">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('customer')}>
                    Customer{sortIndicator('customer')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('amount')}>
                    Amount{sortIndicator('amount')}
                  </th>
                  <th>Status</th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('date')}>
                    Due Date{sortIndicator('date')}
                  </th>
                  <th style={{ cursor: 'pointer', userSelect: 'none' }} onClick={() => handleSort('risk')}>
                    Risk{sortIndicator('risk')}
                  </th>
                  <th>Tier</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <SkeletonRows count={8} />
                ) : rows.length === 0 ? (
                  <InvoiceEmptyState hasFilters={hasFilters} onClear={clearFilters} />
                ) : rows.map(inv => {
                  const invStatus = inv.status?.toUpperCase();
                  const tier = (inv.risk_tier || 'standard') as RiskTier;
                  const amount = parseFloat(inv.total_amount || inv.amount) || 0;
                  const invNumber = inv.invoice_number || inv.invoiceNumber;
                  const custName = inv.customer_name || inv.customerName;
                  const dueDate = inv.due_date || inv.dueDate;
                  const riskScore = inv.risk_score || 0;
                  const isFastPayEligible = inv.fast_pay_eligible;

                  // Aging indicator
                  const ageDays = dueDate ? Math.floor((Date.now() - new Date(dueDate).getTime()) / 86400000) : 0;
                  const agingColor = ageDays <= 0 ? 'var(--status-success)' : ageDays <= 30 ? 'var(--status-warning)' : 'var(--status-danger)';
                  const agingLabel = ageDays <= 0 ? `${Math.abs(ageDays)}d left` : `${ageDays}d late`;

                  return (
                    <tr
                      key={inv.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (inv._mockData) {
                          setSelectedInvoice(inv._mockData);
                        }
                      }}
                    >
                      <td className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{invNumber}</td>
                      <td style={{ fontSize: 12 }}>{custName}</td>
                      <td className="mono" style={{ fontSize: 12 }}>{formatCurrency(amount)}</td>
                      <td>
                        <span style={{
                          fontFamily: 'var(--font-mono)', fontSize: 10,
                          color: STATUS_COLOR[invStatus] || 'var(--text-secondary)',
                          padding: '2px 6px', background: 'var(--bg-surface-hover)', borderRadius: 2,
                        }}>
                          {invStatus}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{
                            color: invStatus === 'OVERDUE' ? 'var(--status-danger)' : 'var(--text-secondary)',
                            fontFamily: 'var(--font-mono)', fontSize: 11,
                          }}>
                            {dueDate}
                          </span>
                          {invStatus !== 'PAID' && dueDate && (
                            <span style={{
                              fontSize: 9, fontFamily: 'var(--font-mono)', color: agingColor,
                              padding: '1px 5px', border: `1px solid ${agingColor}`, borderRadius: 2,
                              whiteSpace: 'nowrap',
                            }}>
                              {agingLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <ScorePill score={riskScore} />
                      </td>
                      <td>
                        <TierBadge tier={tier} />
                      </td>
                      <td className="text-right" onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {invStatus === 'DRAFT' && (
                            <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }}
                              onClick={(e) => handleSendInvoice(e, inv.id)} disabled={sendingId === inv.id}>
                              {sendingId === inv.id ? '...' : 'SEND'}
                            </button>
                          )}
                          {invStatus !== 'DRAFT' && (
                            <button className="btn-action"
                              style={{ fontSize: 10, padding: '4px 8px', background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                              onClick={(e) => handleDownloadPDF(e, inv.id)}>
                              PDF
                            </button>
                          )}
                          {isFastPayEligible && invStatus !== 'PAID' && (
                            <button className="btn-action" style={{ fontSize: 10, padding: '4px 8px' }}
                              onClick={() => navigate('/capital')}>
                              ⚡ FAST PAY
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)' }}>
                  Page {page} of {totalPages} · showing {rows.length} of {filtered.length}
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-action" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>← PREV</button>
                  <button className="btn-action" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>NEXT →</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
