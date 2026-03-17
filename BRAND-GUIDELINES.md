# TruckWys V3 Brand Guidelines

**Derived from:** `QuoteBookings.tsx` and `QuotesList.tsx` (live production pages)
**Style:** Mercury-inspired institutional financial platform
**Aesthetic:** Clean, professional, high-density data presentation

---

## Color Palette

### Primary Colors (USE ONLY THESE)
```css
/* Dark Text */
#0F172A  /* Slate 900 - Primary headings, data */
#475569  /* Slate 600 - Body text */
#64748B  /* Slate 500 - Secondary text */
#94A3B8  /* Slate 400 - Muted text, icons */

/* Borders & Backgrounds */
#E2E8F0  /* Slate 200 - Card borders, dividers */
#F1F5F9  /* Slate 100 - Top bar border */
#F8FAFC  /* Slate 50 - Hover states, expanded rows */
#FAFAFA  /* Grey 50 - Page background */
#FFFFFF  /* White - Card backgrounds */

/* Primary Action */
#2563EB  /* Blue 600 - Primary buttons, links, active states */
#1D4ED8  /* Blue 700 - Primary hover */

/* Status Colors (ONLY for status indicators) */
#10B981  /* Green 500 - Success, completed */
#F59E0B  /* Amber 500 - Warning, in-progress */
#EF4444  /* Red 500 - Error, critical */
```

### What NOT to Use
- ❌ NO gradient backgrounds (`bg-gradient-*`)
- ❌ NO rainbow of colors
- ❌ NO colored left border panels
- ❌ NO backdrop-blur effects
- ❌ NO shadow-glow
- ❌ NO CSS variables like `text-primary` — use direct hex codes

---

## Typography

### Font Stack
```tsx
// Headings & Body
font-family: 'Inter', sans-serif

// Numbers, Currency, Tabular Data
font-family: 'JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', monospace
```

### Size & Weight Hierarchy
```tsx
// Page Title (H1)
className="text-2xl font-semibold text-[#0F172A]"

// Section Heading (H2)
className="text-xl font-semibold text-[#0F172A]"

// Card/Table Heading (H3)
className="text-sm font-medium text-[#0F172A]"

// Body Text
className="text-sm text-[#475569]"

// Secondary/Muted Text
className="text-sm text-[#64748B]"

// Caption/Small Text
className="text-xs text-[#94A3B8]"

// Numbers/Currency
className="text-sm font-medium text-[#0F172A] font-mono tabular-nums"

// KPI Large Numbers
className="text-2xl font-semibold text-[#0F172A] font-mono tabular-nums"
```

---

## Layout System

### Page Container
```tsx
<div className="space-y-6">
  {/* All page content */}
</div>
```

### DashboardLayout Structure
```tsx
// Sidebar: 240px fixed width, dark (#0F172A)
// TopBar: 64px height, white bg, border-b border-[#F1F5F9]
// Main Content: flex-1, padding: p-8, bg-[#FAFAFA]
```

### Grid Spacing
```tsx
// Between major sections: gap-6 or space-y-6
// Between cards in grid: gap-4
// Between list items: space-y-3
// Inside cards: gap-3
```

---

## Card Components

### Standard Card
```tsx
<Card className="border-[#E2E8F0] bg-white rounded-md">
  <CardContent className="p-4">
    {/* Content */}
  </CardContent>
</Card>
```

### KPI Card (4-column grid)
```tsx
<div className="grid grid-cols-4 gap-4 mb-6">
  <Card className="border-[#E2E8F0] bg-white rounded-md">
    <CardContent className="p-4 text-center">
      <div className="text-2xl font-semibold text-[#2563EB] font-mono tabular-nums">
        {value}
      </div>
      <div className="text-xs text-[#94A3B8] mt-1">Label</div>
    </CardContent>
  </Card>
</div>
```

### Expandable List Card
```tsx
<Card className="border-[#E2E8F0] bg-white rounded-md overflow-hidden">
  <div className="p-4 cursor-pointer hover:bg-[#F8FAFC] transition-colors">
    {/* Main row content */}
  </div>
  {/* Expanded section */}
  <div className="border-t border-[#E2E8F0]">
    <div className="p-4 bg-[#F8FAFC]">
      {/* Expanded details */}
    </div>
  </div>
</Card>
```

---

## Table Styling

### Table Wrapper
```tsx
<Card className="border-[#E2E8F0] bg-white rounded-md">
  <CardContent className="p-0">
    <Table>
      {/* Table content */}
    </Table>
  </CardContent>
</Card>
```

### Table Headers
```tsx
<TableHeader>
  <TableRow className="border-[#E2E8F0]">
    <TableHead className="text-xs text-[#94A3B8]">Column Name</TableHead>
  </TableRow>
</TableHeader>
```

### Table Rows
```tsx
<TableRow className="cursor-pointer hover:bg-[#F8FAFC] transition-colors border-[#E2E8F0]">
  <TableCell className="text-sm text-[#0F172A]">Data</TableCell>
  <TableCell className="text-sm font-medium text-[#0F172A] font-mono tabular-nums">
    {formatCurrency(amount)}
  </TableCell>
</TableRow>
```

---

## Badge Styling

### Status Badges (Small Pills)
```tsx
// Success
<Badge className="bg-[#10B981]/5 text-[#10B981] border-[#10B981]/20">
  Completed
</Badge>

// Warning
<Badge className="bg-[#F59E0B]/5 text-[#F59E0B] border-[#F59E0B]/20">
  In Progress
</Badge>

// Primary
<Badge className="bg-[#2563EB]/5 text-[#2563EB] border-[#2563EB]/20">
  Sent
</Badge>

// Muted
<Badge className="bg-[#E2E8F0] text-[#64748B] border-0">
  Draft
</Badge>
```

---

## Border Radius

### Maximum Allowed
```tsx
// Cards, inputs, buttons: rounded-md (6px max)
// NO rounded-xl, NO rounded-2xl

rounded-sm   // 2px - rare
rounded-md   // 6px - cards, inputs, buttons (STANDARD)
rounded-lg   // 8px - modals, sheets only
rounded-full // badges, avatars, status dots
```

---

## Number Formatting

### CRITICAL RULE: NO ABBREVIATIONS
```tsx
// ✅ CORRECT
{formatCurrency(120000)}  // → "R 120,000.00"

// ❌ WRONG
"R 120K"
"120k"
"R 120 000"
```

### Format Function Usage
```tsx
import { formatCurrency } from "@/lib/formatters";

// All currency
{formatCurrency(amount)}  // Returns: "R 120,000.00"

// All large numbers
className="font-mono tabular-nums"
```

---

## Button Hierarchy

### Primary Action
```tsx
<Button className="gap-2">
  <Icon className="w-4 h-4" />
  Label
</Button>
```

### Secondary/Outline
```tsx
<Button variant="outline">
  <Icon className="w-4 h-4 mr-2" />
  Label
</Button>
```

### Ghost/Icon
```tsx
<Button variant="ghost" size="icon" className="h-8 w-8">
  <Icon className="h-4 w-4" />
</Button>
```

---

## Input & Select Styling

### Search Input
```tsx
<div className="relative flex-1">
  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[#94A3B8]" />
  <Input
    placeholder="Search..."
    className="pl-10"
  />
</div>
```

### Select Dropdown
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger className="w-44">
    <SelectValue placeholder="Select..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option">Option</SelectItem>
  </SelectContent>
</Select>
```

---

## Empty States

```tsx
<div className="text-center py-12">
  <Icon className="h-12 w-12 text-[#94A3B8] mx-auto mb-4" />
  <p className="text-sm text-[#64748B] mb-4">No data found</p>
  <Button onClick={action} variant="outline" className="gap-2">
    <Plus className="w-4 h-4" />
    Create New
  </Button>
</div>
```

---

## What NOT to Do

### ❌ AI Slop Patterns to AVOID

1. **Gradient Backgrounds**
   ```tsx
   // ❌ NEVER
   className="bg-gradient-to-br from-blue-500 to-purple-600"
   ```

2. **Colored Left Borders**
   ```tsx
   // ❌ NEVER
   <div className="border-l-4 border-blue-500 pl-4">
   ```

3. **Backdrop Blur / Glassy Effects**
   ```tsx
   // ❌ NEVER
   className="backdrop-blur-sm bg-white/80"
   ```

4. **Shadow Glow**
   ```tsx
   // ❌ NEVER
   className="shadow-glow hover:shadow-glow-lg"
   ```

5. **Emoji Spam**
   ```tsx
   // ❌ NEVER (unless explicitly requested)
   <h1>✨ Analytics Dashboard 🚀</h1>
   ```

6. **Giant Status Panels**
   ```tsx
   // ❌ NEVER
   <div className="bg-green-100 border-l-4 border-green-500 p-6">
     <div className="text-3xl">✓</div>
     <div>Success!</div>
   </div>
   ```

7. **K/M Number Abbreviations**
   ```tsx
   // ❌ NEVER
   "R 120K"
   "R 1.2M"

   // ✅ ALWAYS
   formatCurrency(120000)  // "R 120,000.00"
   ```

---

## Motion & Transitions

### Standard Timing
```tsx
// Hover states
transition-colors  // 150ms

// Page entrance
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
>
```

### Stagger Delays
```tsx
// Cards entering in sequence
transition={{ delay: 0.1 * index }}
```

---

## Code Quality

### Remove Development Artifacts
```tsx
// ❌ Remove ALL console.log statements
console.log("data", data);

// ❌ Remove commented-out code
// const oldFunction = () => { ... }

// ✅ Clean, production-ready code only
```

---

## Layout Z-Index Hierarchy

```css
/* Left Sidebar: z-index: auto */
/* TopBar: z-index: 40 */
/* Dropdown overlays: z-index: 50 */
/* Modals/Sheets: z-index: 50+ */
```

**TopBar must NOT overlap LeftNav** — fixed with proper flex layout in DashboardLayout.tsx

---

## Summary Checklist

When creating or fixing a page, ensure:

- ✅ Cards: `border-[#E2E8F0] bg-white rounded-md`
- ✅ Max border-radius: `rounded-md` (6px)
- ✅ Colors: ONLY from approved palette (no rainbow)
- ✅ Typography: Direct hex colors, proper hierarchy
- ✅ Numbers: `formatCurrency()` + `font-mono tabular-nums`
- ✅ Spacing: `gap-3`, `gap-4`, `gap-6` (tight, professional)
- ✅ NO gradients, NO backdrop-blur, NO shadow-glow
- ✅ NO colored left borders
- ✅ NO K/M abbreviations
- ✅ NO console.log statements
- ✅ Clean, institutional financial platform aesthetic

---

**Reference Pages:**
- `src/pages/QuoteBookings.tsx` (Orders)
- `src/pages/QuotesList.tsx` (Pipeline)

These pages are LIVE with real users. All other pages must match their design language.
