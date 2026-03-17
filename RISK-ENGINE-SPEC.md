# TruckWys Risk Engine — Institutional-Grade Specification

## Context
Partners lending BILLIONS. This is not a hobby project. The risk engine must demonstrate 
the sophistication that institutional lenders expect when evaluating a fintech platform's 
underwriting capability. Every variable matters. Every edge case matters.

## Architecture: Hybrid AI + Rules Engine

### Phase A (NOW — Frontend Demo)
A comprehensive client-side scoring engine that demonstrates the FULL methodology.
Uses realistic mock data but the algorithm must be production-grade.
When backend is ready, this exact logic ports to Python/Django.

### Phase B (Backend)
XGBoost/LightGBM models trained on real operational data.
The frontend displays model outputs via API.

---

## RISK SCORE MODEL: 7 Pillars (not 6 generic factors)

### Pillar 1: CLIENT IDENTITY & PROFILE (15%)
The WHO — before we even look at the invoice.

Variables:
- **Company registration age** (CIPC years) — <1yr=0, 1-3yr=4, 3-5yr=8, 5-10yr=12, 10yr+=15
- **Business type** — Sole prop=riskier, (Pty) Ltd=moderate, listed/corporate=lower
- **Fleet size** — proxy for operational stability (1-5 trucks=higher risk, 50+=established)
- **Fleet growth trajectory** — growing=positive signal, shrinking=red flag
- **Owner/director profile** — number of directorships, adverse findings
- **BEE level** — relevant for government contract eligibility
- **Geographic concentration** — single province=riskier than multi-province
- **Industry sub-sector** — mining transport, agricultural, FMCG, construction (each has different risk profile)
- **Insurance coverage** — goods-in-transit, fleet, liability (missing=red flag)

### Pillar 2: CLIENT FINANCIAL HEALTH (20%)
The client's (fleet operator's) own financial standing.

Variables:
- **Monthly turnover** — trend over 6/12 months (growing, stable, declining)
- **Turnover volatility** — coefficient of variation (erratic revenue=higher risk)
- **Gross margin trend** — are they profitable or bleeding?
- **Outstanding invoices ratio** — total receivables vs monthly turnover (high=cash squeeze)
- **Advance utilization rate** — how much of facility is already used (>80%=stress signal)
- **Advance frequency** — are they requesting advances on every invoice? (dependency signal)
- **Revenue concentration** — does 1 customer = >40% of revenue? (concentration risk)
- **Expense ratio** — operational costs vs revenue (high=thin margins=more risk)
- **Tax compliance** — SARS good standing (yes/no)
- **Banking relationship** — length with primary bank, number of returned payments

### Pillar 3: DEBTOR (CUSTOMER) CREDITWORTHINESS (20%)
The CUSTOMER who owes the money — the actual payer.

Variables:
- **D&B PAYDEX score** (0-100) — external credit bureau data
- **Customer payment history ON PLATFORM** — avg days to pay across ALL operators
- **Customer payment history WITH THIS OPERATOR** — specific relationship
- **Payment consistency score** — std deviation of payment days (erratic=risky)
- **Customer industry risk** — mining pays slow, FMCG pays fast, construction varies
- **Customer size** — large corporates are slower but more certain; SMEs are faster but riskier
- **Customer outstanding balance** — total unpaid across platform (exposure check)
- **Dispute rate** — % of invoices disputed by this customer
- **Customer tenure on platform** — how long have we been seeing this customer pay?
- **Cross-operator intelligence** — if Customer X pays late to Operator A, flag for Operator B
- **Customer payment method** — EFT=standard, cheque=slower/riskier, auto-pay=best
- **Customer country/jurisdiction** — SA domestic, SADC cross-border, international

### Pillar 4: INVOICE CHARACTERISTICS (15%)
The specific invoice being evaluated.

Variables:
- **Invoice amount** — absolute and relative to client's average (2x average=outlier risk)
- **Invoice amount vs facility limit** — concentration in single invoice
- **Invoice age** — days since issue (0-7=fresh/best, 8-30=normal, 31-60=aging, 61-90=stale, 91+=ineligible)
- **Payment terms** — NET7/14/30/60/90 (longer terms=higher risk per day)
- **Days until due** — negative=overdue (escalating risk)
- **Currency** — ZAR=baseline, USD=fx risk, other=higher risk
- **Invoice type** — single trip vs consolidated (multi-trip invoices may have partial disputes)
- **Line item clarity** — well-structured with breakdowns vs lump sum (clearer=lower risk)
- **Credit notes** — any credits issued against this invoice
- **Related POs** — linked purchase orders (traceable supply chain=better)
- **Recurring vs one-off** — recurring customer relationship=lower risk

### Pillar 5: PROOF OF DELIVERY & DOCUMENTATION (10%)
The evidence that the service was delivered — critical for lenders.

Variables:
- **POD type** — e-signature=best(10), geo-tagged photo=good(8), scanned document=ok(6), manual/none=poor(2/0)
- **POD completeness** — receiver name + signature + date + condition notes
- **POD timestamp vs delivery date** — same day=credible, days later=suspicious
- **GPS tracking confirmation** — route data confirms delivery location
- **Delivery exceptions** — any damage, shortages, refusals noted
- **Supporting documents** — waybill, weighbridge ticket, customs clearance
- **Photo evidence** — loading/offloading photos
- **Chain of custody** — can we trace the goods from pickup to delivery?

### Pillar 6: OPERATIONAL & TRIP FACTORS (10%)
The underlying transport operation.

Variables:
- **Route risk** — certain SA corridors have higher hijacking/loss rates
- **Cargo type** — perishable=time pressure, hazmat=regulatory risk, high-value=theft risk
- **Distance** — long haul (>500km) vs short haul (different risk profiles)
- **Trip completion rate** — operator's historical % of completed vs cancelled trips
- **Vehicle condition** — last service date, roadworthy certificate currency
- **Driver record** — violations, accident history, experience years
- **Seasonal factors** — Q4 holiday slowdown, agricultural seasons, mining cycles
- **Fuel price index** — current vs 3-month average (rapid increases squeeze margins)

### Pillar 7: MACRO & MARKET FACTORS (10%)
External conditions affecting the entire ecosystem.

Variables:
- **ZAR volatility** — USD/ZAR 30-day volatility (high=stress on cross-border)
- **SA repo rate** — SARB interest rate (higher=tighter cash, more demand for advances)
- **Freight demand index** — industry volume trends (low demand=pressure on rates)
- **Fuel price trend** — 3-month trajectory (rising=margin squeeze)
- **Industry default rate** — platform-wide 90-day rolling default rate
- **Economic sentiment** — PMI, business confidence index
- **Regulatory changes** — new SANRAL tolls, CO2 tax, labour law changes
- **Load shedding impact** — operational disruption index
- **Seasonal payment patterns** — December slowdown is real in SA

---

## SCORING METHODOLOGY

### Raw Score Calculation (0-100)
Each pillar produces a sub-score (0-100), then weighted:

```
TOTAL = (Identity × 0.15) + (Financial × 0.20) + (Debtor × 0.20) + 
        (Invoice × 0.15) + (POD × 0.10) + (Operational × 0.10) + (Macro × 0.10)
```

### Score Adjustments (can push above or below)
- **First-time operator** (no history): -10 penalty
- **Active dispute on invoice**: -15 penalty
- **Advance would exceed 85% facility utilization**: -8 penalty
- **Customer has cross-platform late payment flag**: -12 penalty
- **Operator has perfect 12-month repayment record**: +5 bonus
- **Invoice backed by government/SOE customer**: +8 bonus
- **Multiple POD types submitted**: +3 bonus

### Final Score = max(0, min(100, RAW + ADJUSTMENTS))

---

## RISK TIERS & PRICING

| Score | Tier | Base Fee | Approval Rate | Advance % | Turnaround |
|-------|------|----------|---------------|-----------|------------|
| 85-100 | PRIME | 1.5-2.0% | 99% | up to 90% | 2-4 hours |
| 70-84 | STANDARD | 2.0-2.75% | 95% | up to 85% | 4-8 hours |
| 55-69 | ELEVATED | 2.75-3.5% | 80% | up to 75% | 8-24 hours |
| 40-54 | HIGH | 3.5-4.5% | 60% | up to 65% | 24-48 hours |
| <40 | INELIGIBLE | N/A | 0% | N/A | N/A |

### Fee Adjustments
- Invoice age 31-60d: +0.25%
- Invoice age 61-90d: +0.75%  
- First-time customer: +0.50%
- Active dispute (different invoice): +1.0%
- Facility utilization >80%: +0.25%
- Perfect repayment history (12mo): -0.25%
- Government/SOE debtor: -0.25%

### Fee Caps
- Minimum: 1.0% (even PRIME has a floor)
- Maximum: 5.0% (regulatory/ethical cap)

---

## HARD STOP INELIGIBILITY RULES

These override any score — automatic rejection:
1. Score < 40
2. Invoice age > 90 days
3. Customer flagged as bankrupt/under business rescue
4. Active dispute on THIS specific invoice
5. No POD attached
6. Operator flagged for fraud
7. Advance would exceed facility limit
8. Invoice already factored elsewhere (duplicate financing)
9. Operator account suspended
10. Missing KYC/FICA documentation

---

## MODEL EXPLAINABILITY (SHAP-Style)

Every score MUST show:
1. **Waterfall chart** — each factor's contribution to final score (positive/negative)
2. **Top 3 risk drivers** — what's pulling the score down
3. **Top 3 strength signals** — what's keeping the score up
4. **Score trajectory** — how this client's scores have changed over time
5. **Comparison to portfolio** — where does this sit vs average on the platform
6. **Confidence level** — how confident are we in this score (data completeness %)

---

## HOMEPAGE: COMMAND CENTER

Not a generic dashboard. A COMMAND CENTER for a fleet operator managing cash flow.

### Top Strip — Cash Position (Real-Time)
- **Cash Available Now**: R X (bank balance if connected, or manual)
- **Expected In (7d/30d/90d)**: predicted cash inflow from AI payment prediction
- **Expected Out (7d/30d/90d)**: known expenses + predicted costs
- **Net Cash Position**: surplus or gap
- **Advance Available**: facility limit minus outstanding

### Signal Cards (4 maximum, prioritized by urgency)
AI-generated alerts, NOT static cards:
- "3 invoices overdue >30 days — R 145,000 at risk" (red)
- "Fuel prices up 8% this month — margin impact on 12 active trips" (amber)
- "R 280,000 eligible for early pay at 2.1% average fee" (green/CTA)
- "Customer ABC late on 2 invoices across 3 operators" (amber/network intelligence)

### Portfolio Health Score
Single number (0-100) representing overall book health:
- Weighted average of all active invoice risk scores
- Trend arrow (improving/declining)
- Breakdown: X% Prime, Y% Standard, Z% Elevated, W% High

### Cash Flow Forecast Chart
- 90-day forward-looking
- Stacked: confirmed payments + predicted payments + scheduled expenses
- Confidence band (70% / 90%)
- Mark advance disbursements on the timeline

### Recent Activity Feed
- Invoice generated, advance requested, payment received, alert triggered
- Each entry is actionable (click to navigate)

### Quick Actions
- "Request Early Pay" (with count of eligible invoices)
- "Generate Invoice" (for completed trips)
- "View Collections" (overdue items)

---

## REPORTS: INSTITUTIONAL-GRADE ANALYTICS

### 1. Portfolio Risk Report
- Risk distribution pie/bar chart (by tier)
- Concentration analysis (by customer, by corridor, by industry)
- Vintage analysis (cohort performance over time)
- Default rate tracking (30/60/90 day)
- Score migration matrix (how scores change period to period)

### 2. Cash Flow Report
- Actual vs predicted cash flow (model accuracy tracking)
- DSO (Days Sales Outstanding) trend
- Collection efficiency ratio
- Payment prediction accuracy over time
- Seasonal patterns visualization

### 3. Customer/Debtor Report
- Customer risk ranking table
- Payment behavior heatmap (which customers pay when)
- Exposure concentration chart
- Cross-platform payment intelligence
- Customer profitability (revenue minus cost of capital)

### 4. Advance Performance Report
- Advance volume and utilization over time
- Fee income earned
- Default/write-off rate
- Average days to settlement
- Advance-to-revenue ratio trend

### 5. Operational Report
- Revenue per km by corridor
- Margin analysis by route/customer/cargo type
- Fleet utilization rate
- Driver performance metrics
- Cost breakdown trends (fuel, tolls, labor, overhead)

---

## UI/UX DESIGN SYSTEM — MANDATORY CONSISTENCY

This is NOT optional. Every page MUST follow these standards. No exceptions.
This is what separates a world-class product from AI slop.

### Design Philosophy
- **Mercury-inspired**: Clean, institutional, data-dense but not cluttered
- **Finance-first**: Numbers are the hero. Charts support, text explains.
- **Agentic**: AI features are woven in naturally, not bolted on with sparkle emojis
- **Deliberate**: Every pixel has a purpose. No decorative filler.

### Color System (EXACT values, no approximations)
```
Background:     #FAFAFA (page bg, already set in DashboardLayout)
Surface:        #FFFFFF (cards, panels)
Sidebar:        #0F172A (dark navy, already exists)
Border:         #E2E8F0 (subtle, 1px)
Border Hover:   #CBD5E1

Text Primary:   #0F172A
Text Secondary: #475569
Text Muted:     #94A3B8

Blue Primary:   #2563EB (actions, links, Standard tier)
Blue Hover:     #1D4ED8
Green:          #10B981 (success, Prime tier, positive trends)
Amber:          #F59E0B (warning, Elevated tier)
Red:            #EF4444 (danger, High tier, negative trends)
Gray:           #64748B (disabled, Ineligible tier)
```

### Typography (NO EXCEPTIONS)
```
Headings:       Inter, 600/700 weight
Body:           Inter, 400 weight
Numbers/Money:  font-variant-numeric: tabular-nums; font-family: 'JetBrains Mono', monospace
Labels:         Inter, 500, text-xs, uppercase, tracking-wider, text-[#94A3B8]
```

### Page Layout Pattern (EVERY page follows this)
```
┌─────────────────────────────────────────────────┐
│ PAGE TITLE (text-2xl font-semibold)       [CTA] │
│ Subtitle/description (text-sm text-[#475569])   │
├─────────────────────────────────────────────────┤
│ KPI STRIP (3-5 cards, consistent height)        │
│ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐               │
│ │ KPI │ │ KPI │ │ KPI │ │ KPI │               │
│ └─────┘ └─────┘ └─────┘ └─────┘               │
├─────────────────────────────────────────────────┤
│ MAIN CONTENT                                    │
│ (table, chart, detail view — depends on page)   │
│                                                 │
└─────────────────────────────────────────────────┘
```

### KPI Card Standard
```tsx
<Card className="border border-[#E2E8F0] shadow-none">
  <div className="p-5">
    <p className="text-xs font-medium uppercase tracking-wider text-[#94A3B8]">
      {label}
    </p>
    <p className="text-2xl font-semibold text-[#0F172A] mt-1 tabular-nums font-mono">
      {value}
    </p>
    <div className="flex items-center gap-1 mt-1">
      <TrendIcon className={trendColor} size={14} />
      <span className="text-xs font-medium">{trend}</span>
      <span className="text-xs text-[#94A3B8]">vs last month</span>
    </div>
  </div>
</Card>
```

### Table Standard (ALL tables)
```
- Header: text-xs uppercase tracking-wider text-[#94A3B8] bg-[#F8FAFC] font-medium
- Rows: text-sm, py-3.5 px-4, hover:bg-[#F8FAFC] transition
- Numbers: font-mono tabular-nums text-right
- Status badges: consistent StatusBadge component
- Actions: icon-only, muted, hover:primary
- Borders: border-b border-[#F1F5F9] (very subtle)
- No heavy borders, no alternating row colors
- Pagination: bottom right, text-sm, clean
```

### Empty States (NO "No data found" laziness)
```tsx
// WRONG ❌
<p>No data found</p>

// RIGHT ✅
<div className="flex flex-col items-center justify-center py-16">
  <FileText className="h-12 w-12 text-[#CBD5E1] mb-4" />
  <h3 className="text-lg font-medium text-[#0F172A]">No invoices yet</h3>
  <p className="text-sm text-[#64748B] mt-1 max-w-sm text-center">
    Invoices will appear here once trips are completed and invoiced.
  </p>
  <Button className="mt-4" size="sm">Create Invoice</Button>
</div>
```

### Loading States (skeletons ONLY, no spinners)
```tsx
// WRONG ❌
<Loader className="animate-spin" />

// RIGHT ✅
<div className="animate-pulse space-y-3">
  <div className="h-4 w-48 bg-[#E2E8F0] rounded" />
  <div className="h-8 w-32 bg-[#E2E8F0] rounded" />
  <div className="h-3 w-24 bg-[#E2E8F0] rounded" />
</div>
```

### Chart Standards (Recharts)
```
- Grid: stroke="#F1F5F9", strokeDasharray="3 3"
- Axis text: fill="#94A3B8", fontSize=12
- Tooltip: bg white, border #E2E8F0, shadow-lg, rounded-lg
- Area fills: opacity 0.1 of main color
- Line strokes: 2px
- Always include ResponsiveContainer
- Always include proper margin
```

### Button Hierarchy
```
Primary: bg-[#2563EB] text-white hover:bg-[#1D4ED8]
Secondary: bg-transparent border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC]
Ghost: bg-transparent text-[#475569] hover:bg-[#F8FAFC]
Danger: bg-[#EF4444] text-white hover:bg-[#DC2626]
```

### Spacing System
```
Page padding: p-8 (already in DashboardLayout)
Section gap: space-y-8
Card padding: p-5 or p-6
Between cards in grid: gap-4 or gap-6
Table cell padding: py-3.5 px-4
```

### AI/Agentic Elements (NOT AI SLOP)
```
NO sparkle emojis everywhere
NO "AI-powered" labels on everything
NO rainbow gradients
NO animated robot icons

YES subtle intelligence indicators:
- Small "AI" pill badge (bg-[#EFF6FF] text-[#2563EB] text-[10px] font-semibold) next to AI-generated values
- Confidence indicators (small progress bar or percentage)
- "Last updated 2m ago" timestamps on AI predictions
- Expandable "How this was calculated" sections
- Natural language summaries that feel like a smart analyst wrote them, not a chatbot
```

---

## PAGE-BY-PAGE REQUIREMENTS

### Overview (/) — Command Center
See spec above. Cash strip + Signal cards + Portfolio health + Cash flow chart + Activity + Quick actions.
This is the FIRST thing users see. It must be stunning.

### Bookings (/bookings, /bookings/pipeline) — DO NOT TOUCH
Live user. Leave exactly as-is.

### Fleet (/fleet, /fleet/vehicles, /fleet/drivers) 
- Remove console.log statements
- Fleet dashboard: vehicle utilization chart, profitability summary, active trips
- Vehicles: sortable table with status, km, last service, revenue/km
- Drivers: profile cards or table, performance metrics, compliance status
- Remove mock JSON imports → use API hooks with fallback mock data

### Finance (/finance/invoices, /finance/expenses, /finance/reports)
- Invoices: MUST have risk score column + fast pay button (see risk engine spec)
- Invoice detail: full risk breakdown + payment timeline + early pay offer
- Expenses: clean table, category filters, KPI strip (MTD spend, fuel, vs budget)
- Finance Reports: chart+table toggle, DSO, aging analysis, margin trends

### Capital (/capital, /capital/request, /capital/advances/:id)
- Capital overview: facility meter, risk distribution, eligible invoices CTA, advance history
- Request flow: step-by-step, shows risk score calculation live, fee preview
- Advance detail: full status timeline, risk breakdown, settlement tracking

### Insights (/insights)
- AI insights feed: NOT generic "Consider reviewing margins" fluff
- Each insight: specific data point, specific recommendation, severity, timestamp
- Organized by category (Cash, Margin, Customer, Fleet)
- Dismiss/acknowledge functionality

### Settings (/settings)
- Clean tabs: Company, Users, Integrations, Notifications, Security
- Xero integration: connection status, last sync, sync button
- Fleet import: upload flow, mapping preview
- Professional, minimal

### Reports (/finance/reports)
- 5 report types (see spec above)
- Tab navigation between reports
- Chart/Table toggle on every report
- Date range picker (preset + custom)
- Export button (CSV/PDF stub)

---

## THINGS TO REMOVE / FIX
1. ALL console.log statements
2. ALL mock JSON file imports → convert to API hooks with inline fallback
3. QuoteCopilot, QuoteLibrary, RevenueGuard, EconomicModel pages (if they exist as routes or nav items)
4. Any Lovable branding/tags
5. Inconsistent card styles (some have shadows, some borders, some both)
6. Any spinner/loader components → replace with skeletons
7. Any "No data found" text → proper empty states
8. Inconsistent number formatting → ALL through formatZAR() with mono font
9. Fix FinanceHQ route — currently /finance-hq, should be removed (Finance section covers it)
