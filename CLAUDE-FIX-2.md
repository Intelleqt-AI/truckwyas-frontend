# FIX ROUND 2 — Light mode must be IDENTICAL layout to dark mode

## Problems Dennis Found
1. **Light mode layout differs from dark mode** — the left nav changes, cards have rounded edges in light but sharp in dark. THIS IS WRONG. Both modes must have the EXACT SAME layout, spacing, border-radius, nav style. The ONLY difference is colors.
2. **Cards:** border-radius must be `2px` in BOTH modes (sharp, not rounded). Check DESIGN-REFERENCE-DARK.html — `border-radius: 2px`.
3. **Left nav:** Must be identical 60px icon-only nav in BOTH modes. Same padding, same icon size, same hover states. Only colors change.
4. **Every element** must use the same structural CSS in both modes. Only `--bg-*`, `--text-*`, `--border-*`, `--accent-*` variables change between modes.

## What To Do

### 1. Audit theme.css
Ensure NO layout/spacing/border-radius differences between dark and light mode. Only color variables should differ. Specifically:
- `border-radius: 2px` on all cards (BOTH modes)
- Same padding, margins, gaps in both modes
- Same font sizes, weights in both modes

### 2. Audit every component
Search for any conditional styling that changes layout based on theme. Remove it. Only colors should change.

### 3. Full E2E review of EVERY page
Navigate to EACH page in the app and verify:
- Dark mode: text readable, correct background (#030303), cards (#0A0A0A)
- Light mode: text readable, correct background (#F3F4F6), cards (#FFFFFF)
- Both modes: identical layout, spacing, border-radius, nav, sidebar
- All buttons clickable and visible
- All tables readable
- Status badges correct colors
- No broken/missing elements

Pages to check:
1. / (Overview/Home)
2. /bookings
3. /fleet
4. /invoices
5. /capital
6. /insights
7. /settings
8. /login
9. /signup
10. /expenses
11. /drivers
12. /vehicles
13. /quotes
14. /finance-reports
15. Any other routes that exist

### 4. Fix everything you find
Don't just report issues — FIX them.

### 5. npm run build — zero errors

When finished run: `openclaw system event --text "Done: TruckWys design fixes round 2 — all pages verified E2E" --mode now`
