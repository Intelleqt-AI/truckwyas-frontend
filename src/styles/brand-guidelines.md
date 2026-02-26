# TruckWys V3 Brand Guidelines

## Design Philosophy

TruckWys OS is an agentic operating system for trucking logistics. The design follows an "OS-style" aesthetic with:
- Ultra-dark mode as default (near-black backgrounds)
- Monospace typography for labels and data
- Minimal UI chrome with high contrast accent colors
- Grid-based layouts with fixed navigation zones

---

## Color System

### Dark Mode (Default)

```css
/* Base Surfaces */
--bg-deep: #030303;           /* Deepest background - body */
--bg-surface: #0A0A0A;        /* Card backgrounds */
--bg-surface-hover: #121212;  /* Card hover states */

/* Borders */
--border-subtle: #1F1F1F;     /* Default borders */
--border-active: #333333;     /* Hover/focus borders */

/* Accent - Blue */
--accent-primary: #4D9EFF;    /* Primary accent (buttons, links, highlights) */
--accent-dim: #1A3A6B;        /* Dimmed accent (backgrounds, inactive) */
--accent-glow: rgba(77, 158, 255, 0.15);  /* Glow effects */

/* Text */
--text-primary: #EDEDED;      /* Primary text */
--text-secondary: #888888;    /* Secondary/muted text */
--text-tertiary: #444444;     /* Disabled/very muted text */
```

### Light Mode

```css
/* Base Surfaces */
--bg-deep: #F3F4F6;           /* Page background */
--bg-surface: #FFFFFF;        /* Card backgrounds */
--bg-surface-hover: #F9FAFB;  /* Card hover states */
--bg-sidebar: #FFFFFF;        /* Sidebar background */

/* Borders */
--border-subtle: #E5E7EB;     /* Default borders */
--border-active: #D1D5DB;     /* Hover/focus borders */

/* Accent - Blue */
--accent-primary: #2563EB;    /* Primary accent */
--accent-bright: #3B82F6;     /* Brighter accent for charts */
--accent-dim: #EFF6FF;        /* Light blue backgrounds */
--accent-glow: rgba(37, 99, 235, 0.15);

/* Text */
--text-primary: #111827;      /* Primary text */
--text-secondary: #6B7280;    /* Secondary text */
--text-tertiary: #9CA3AF;     /* Tertiary/muted text */
```

### Status Colors

```css
/* Shared across modes */
--status-active: #10B981;     /* Green - Active/Success */
--status-warning: #F59E0B;    /* Amber - Warning */
--status-danger: #FF4949;     /* Red - Error/Danger */
--status-delayed: #EF4444;    /* Red variant for delays */
```

---

## Typography

### Font Families

```css
--font-mono: 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace;
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
```

### Usage

| Element | Font | Size | Weight | Letter Spacing |
|---------|------|------|--------|----------------|
| Logo | font-mono | 18px | 700 | -0.05em |
| Card Title | font-mono | 11px | 400 | 0.05em |
| Metric Value | font-sans | 28px | 500 | -0.03em |
| Metric Delta | font-mono | 12px | 400 | normal |
| Body Text | font-sans | 14px | 400 | -0.01em |
| Table Header | font-mono | 10px | 400 | 0.05em |
| Table Cell | font-sans | 13px | 400 | normal |
| Status Badge | font-sans | 11px | 500 | normal |
| Input | font-mono | 13px | 400 | normal |
| Button | font-sans | 11px | 600 | normal |

### Text Transform

- Card titles: `uppercase`
- Table headers: `uppercase`
- Status badges: Normal case
- Navigation tooltips: Normal case

---

## Spacing Scale

Base unit: 4px

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Minimal gaps |
| sm | 8px | Small gaps, badge padding |
| md | 12px | Card header margins |
| lg | 16px | Section gaps |
| xl | 20px | Card padding, feed items |
| 2xl | 24px | Nav padding, workspace padding |
| 3xl | 40px | Command bar margins |

---

## Border Radius

```css
--radius-none: 0px;           /* Tables, data display */
--radius-xs: 1px;             /* Heat cells */
--radius-sm: 2px;             /* Cards, bars, buttons */
--radius-md: 4px;             /* Input fields, alert boxes */
--radius-lg: 6px;             /* Nav items, input focus (light mode) */
--radius-full: 100px;         /* Status badges, avatar */
```

Note: Dark mode uses `2px` for cards. Light mode uses `8px` for softer feel.

---

## Layout Grid

### OS Container

```
60px | flex-1 | 320px
 Nav | Workspace | Agent Sidebar
```

### Grid Template

```css
.os-container {
  display: grid;
  grid-template-columns: 60px 1fr 320px;
  grid-template-rows: 60px 1fr;  /* 60px header */
  height: 100vh;
}
```

### Header

- Height: 60px
- Full width (spans all columns)
- Contains: Logo, Agent Command Bar, Status Badge, Avatar

### Left Navigation

- Width: 60px fixed
- Icon-only navigation
- Icons: 36x36px hit area, 20x20px icon
- Items: Home, Bookings, Fleet, Finance, Capital, Insights, Settings (at bottom)

### Main Workspace

- Flexible width
- Padding: 24px
- 3-column grid for cards
- Auto-scroll overflow

### Agent Sidebar

- Width: 320px fixed
- Contains: Agent Activity Stream, Quick Quote form
- Feed items with timestamps

---

## Card Styles

### Metric Card

```css
.metric-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-subtle);
  padding: 20px;
  border-radius: 2px;
}

.metric-card:hover {
  border-color: var(--border-active);
}
```

### Card Layout

- Header: Title (left) + Action icon (right), margin-bottom: 16px
- Content: Metric value, delta indicator

### Chart Card

- Spans 2 columns
- Min-height: 280px
- Contains placeholder bars or chart

### Table Card

- Spans 2 columns, 2 rows
- Sticky headers with `text-transform: uppercase`

### Utilization Card

- Spans 1 column, 2 rows
- Contains heatmap grid (7x4)

---

## Status Badges

```css
.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border-radius: 100px;
  font-size: 11px;
  font-weight: 500;
}

/* Default (inactive) */
.status-badge {
  background: #141414;  /* dark mode */
  color: var(--text-secondary);
}

/* Active */
.status-badge.active {
  background: rgba(184, 255, 73, 0.1);  /* or accent-dim */
  color: var(--accent-primary);
}

/* Delayed (danger) */
.status-badge.delayed {
  background: rgba(255, 73, 73, 0.1);
  color: #FF4949;
}
```

---

## Data Table

```css
.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.data-table th {
  text-align: left;
  font-family: var(--font-mono);
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-secondary);
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border-subtle);
}

.data-table td {
  padding: 12px 0;
  border-bottom: 1px solid #141414;  /* Very subtle */
  color: var(--text-tertiary);
}

.data-table tr:hover td {
  color: var(--text-primary);
}

.data-table tr td:first-child {
  color: var(--text-primary);  /* First column always visible */
}
```

---

## Buttons

### Primary Action

```css
.btn-action {
  background: var(--accent-primary);
  color: black;
  border: none;
  padding: 8px 12px;
  border-radius: 2px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  width: 100%;
  transition: opacity 0.2s;
}

.btn-action:hover {
  opacity: 0.9;
}
```

### Ghost/Outline Button

```css
.btn-ghost {
  background: transparent;
  border: 1px solid var(--accent-primary);
  color: var(--accent-primary);
}
```

### Export Button (Table)

```css
.btn-export {
  background: transparent;
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  padding: 4px 8px;
  font-size: 10px;
  border-radius: 2px;
}
```

---

## Input Fields

```css
.input {
  width: 100%;
  background: var(--bg-surface);  /* or #1a1a1a for darker */
  border: 1px solid var(--border-subtle);
  color: var(--text-primary);
  padding: 10px 16px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 13px;
  transition: all 0.2s;
}

.input:focus {
  outline: none;
  border-color: var(--accent-dim);
  box-shadow: 0 0 0 1px var(--accent-dim), 0 0 20px var(--accent-glow);
}

.input::placeholder {
  color: var(--text-tertiary);
}
```

---

## Heatmap Grid

```css
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.heat-cell {
  aspect-ratio: 1;
  border-radius: 1px;
}

/* Heat levels (dark mode) */
.heat-cell { background: #1a1a1a; }  /* Empty */
.heat-cell.low { background: var(--accent-dim); }
.heat-cell.medium { background: #333; }
.heat-cell.high { background: var(--accent-primary); }

/* Heat levels (light mode) */
.heat-cell.low { background: #DBEAFF; }
.heat-cell.medium { background: #93C5FD; }
.heat-cell.high { background: #3B82F6; }
.heat-cell.max { background: #1D4ED8; }
```

---

## Animation Standards

### Transition Timing

```css
--ease-out: cubic-bezier(0.2, 0.8, 0.2, 1);
```

### Common Transitions

```css
/* Border/color transitions */
transition: all 0.2s var(--ease-out);

/* Opacity transitions */
transition: opacity 0.2s;

/* Bar height animations */
transition: height 0.5s var(--ease-out);
```

### Pulse Animation (Agent Icon)

```css
@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(77, 158, 255, 0.4); }
  70% { box-shadow: 0 0 0 6px rgba(77, 158, 255, 0); }
  100% { box-shadow: 0 0 0 0 rgba(77, 158, 255, 0); }
}

.agent-icon {
  animation: pulse 2s infinite;
}
```

---

## Ambient Effects

### Glow Background

```css
.ambient-glow {
  position: fixed;
  top: -20%;
  left: 50%;
  transform: translateX(-50%);
  width: 80vw;
  height: 60vh;
  background: radial-gradient(circle, rgba(77, 158, 255, 0.08) 0%, rgba(5, 5, 5, 0) 70%);
  filter: blur(80px);
  pointer-events: none;
  z-index: 0;
}
```

---

## Scrollbars

```css
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: #222;  /* Dark mode */
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #333;
}

/* Light mode */
::-webkit-scrollbar-thumb {
  background: #E5E7EB;
}
```

---

## Theme Toggle

The theme is controlled via `data-theme` attribute on `<html>`:

```html
<html data-theme="dark">  <!-- Default -->
<html data-theme="light">
```

CSS variables automatically switch based on this attribute.

---

## Icon Guidelines

- Stroke-based icons (Lucide or similar)
- Stroke width: 1.5-2px
- Size: 20x20px for navigation, 16x16px for inline
- Color: Inherit from text color, accent on active state
