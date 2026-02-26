# TruckWys V3 — Complete UI Redesign Task

## Reference Designs
Read these HTML files in this directory — they define the EXACT look and feel:
- `DESIGN-REFERENCE-DARK.html` — dark mode
- `DESIGN-REFERENCE-LIGHT.html` — light mode

## Tasks (in order)

### 1. Brand Guidelines
Create `src/styles/brand-guidelines.md`:
- Color system (dark + light mode CSS variables)
- Typography (SF Mono for labels/mono, system sans for body)
- Spacing scale, border-radius conventions
- Card styles, status badges, metric cards
- Layout grid (60px nav | main | 320px sidebar)
- Animation/transition standards

### 2. Theme System
Create `src/styles/theme.css` with CSS variables for both dark and light mode matching the reference designs EXACTLY. Add dark/light toggle support via `data-theme` attribute on `<html>`.

### 3. Layout Shell
Rebuild the app shell to match the OS-style grid layout:
- 60px icon-only left nav (Home, Bookings, Fleet, Finance, Capital, Insights, Settings)
- Header: TRUCKWYS OS logo, agent command bar with pulsing icon, status badge, avatar
- 320px right sidebar: Agent Activity Stream
- Main workspace area

### 4. Home Page (Overview.tsx)
Rebuild to EXACTLY match the design:
- 3 metric cards top row (Net Rev/Trip, Fleet Margin, Avg Payment Days)
- Chart card spanning 2 cols (Fuel Efficiency vs Revenue)
- Utilization card with heatmap grid
- Live Trip P&L table spanning 2 cols
- Agent sidebar with feed items, alert boxes, Quick Quote form

### 5. Bookings Page
Create a functional Bookings page connected to Django backend `/api/` (proxied via Vite on :3700). List bookings, status badges, create new bookings. Same design system.

### 6. Update ALL Other Pages
Apply the new design system to every existing page:
- Overview, Bookings, BookingsList, Capital, Invoices, InvoiceDetail, CreateInvoice
- Expenses, FleetDashboard, Vehicles, VehicleDigitalTwin, Drivers, DriverProfile
- FinanceReports, Insights, Settings, Login, Signup
- QuotesList, NewQuote, QuoteCopilot, QuoteBookings
- AdvanceRequest, AdvanceDetail, NotFound

Every page must use new CSS variables, card components, table styles, status badges. No old styling should remain.

## Rules
- React + TypeScript + Vite
- Backend: Django on port 3700, frontend proxied via Vite
- EXACT colors, fonts, spacing from the reference HTML files
- Dark mode default, with toggle in Settings page
- Keep all existing API connections and data fetching logic
- Do NOT use Tailwind — extract styles into CSS variables and plain CSS/modules
- Run `npm run build` when done to verify no errors

## When Finished
Run: `openclaw system event --text "Done: TruckWys V3 UI redesign complete" --mode now`
