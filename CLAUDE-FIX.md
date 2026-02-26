# URGENT FIX — Design System Broken

## Problem
The dark mode design is broken. Text is unreadable, backgrounds wrong, spacing inconsistent. The root cause:

1. `src/styles/theme.css` has the CORRECT design variables (from DESIGN-REFERENCE-DARK.html / DESIGN-REFERENCE-LIGHT.html)
2. `src/index.css` has OLD Mercury/shadcn CSS variables using HSL format that CLASH with theme.css
3. Many pages still use old Tailwind classes (bg-slate-900, text-gray-500, etc.) instead of the new CSS variables
4. 16 pages were NOT updated at all (listed below)

## What You Must Do

### Step 1: NUKE the old CSS variables
In `src/index.css`, REMOVE all the old `:root` CSS variable declarations (the HSL-based Mercury system). Keep ONLY the `@import './styles/theme.css'` and Tailwind directives. ALL styling must come from theme.css.

### Step 2: Make theme.css the SINGLE source of truth
Ensure `src/styles/theme.css` contains ALL variables needed. Reference DESIGN-REFERENCE-DARK.html and DESIGN-REFERENCE-LIGHT.html for exact values.

### Step 3: Create a Tailwind config that maps to CSS variables
Update `tailwind.config.ts` so that Tailwind classes like `bg-surface`, `text-primary`, `border-subtle` etc. map to the CSS variables in theme.css. This way pages can use Tailwind BUT the values come from our design system.

### Step 4: Fix ALL 25 pages
Every page must use ONLY:
- CSS variables from theme.css (via inline styles or Tailwind mappings)
- No hardcoded colors, no old HSL variables, no bg-slate-900 etc.

Pages NOT yet updated (must fix):
- AdvanceDetail.tsx, AdvanceRequest.tsx, CreateInvoice.tsx
- DriverProfile.tsx, Drivers.tsx, Expenses.tsx
- FinanceReports.tsx, Insights.tsx, InvoiceDetail.tsx
- NewQuote.tsx, NotFound.tsx, QuoteBookings.tsx
- QuoteCopilot.tsx, QuotesList.tsx
- VehicleDigitalTwin.tsx, Vehicles.tsx

Pages already updated but likely still broken (verify and fix):
- Overview.tsx, Bookings.tsx, BookingsList.tsx
- Capital.tsx, FleetDashboard.tsx, Invoices.tsx
- Login.tsx, Signup.tsx, Settings.tsx

### Step 5: Verify in browser
After all changes, the dark mode homepage at localhost:3701 must look IDENTICAL to DESIGN-REFERENCE-DARK.html:
- Background: #030303 (near black)
- Card backgrounds: #0A0A0A
- Borders: #1F1F1F
- Text: #EDEDED (primary), #888888 (secondary)
- Accent: #4D9EFF (blue)
- ALL text must be readable

### Step 6: Build check
Run `npm run build` — zero errors.

## Reference
- DESIGN-REFERENCE-DARK.html — the EXACT dark mode design
- DESIGN-REFERENCE-LIGHT.html — the EXACT light mode design
- src/styles/theme.css — the variable definitions (correct values, keep this)

When finished run: `openclaw system event --text "Done: TruckWys design system fixed — all pages updated" --mode now`
