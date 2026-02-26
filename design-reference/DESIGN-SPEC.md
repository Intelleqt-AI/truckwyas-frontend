# TruckWys OS — Design Specification

## Layout: OS-Style Grid
```
┌─────────────────────────────────────────────────────────┐
│ HEADER (60px) — Logo | Agent Command | Status | Avatar  │
├────┬────────────────────────────────┬───────────────────┤
│NAV │          WORKSPACE             │  AGENT SIDEBAR    │
│60px│     (3-col grid, scrollable)   │     (320px)       │
│    │                                │                   │
│icon│  [Metric] [Metric] [Metric]    │ Agent Activity    │
│only│  [Chart --------] [Util]       │ Stream            │
│    │  [Table ---------] [    ]      │                   │
│    │                                │ Quick Quote       │
└────┴────────────────────────────────┴───────────────────┘
```

Grid: `grid-template-columns: 60px 1fr 320px; grid-template-rows: 60px 1fr;`

## Color System

### Light Mode
```
--bg-deep: #F3F4F6          (page background)
--bg-surface: #FFFFFF        (cards)
--bg-surface-hover: #F9FAFB  (hover state)
--bg-sidebar: #FFFFFF        (nav + agent sidebar)
--border-subtle: #E5E7EB     (default borders)
--border-active: #D1D5DB     (hover/active borders)
--accent-primary: #2563EB    (primary actions, active states)
--accent-bright: #3B82F6     (chart highlights)
--accent-dim: #EFF6FF        (active backgrounds)
--accent-glow: rgba(37, 99, 235, 0.15)
--text-primary: #111827      (headings, primary text)
--text-secondary: #6B7280    (body text, labels)
--text-tertiary: #9CA3AF     (muted text, timestamps)
```

### Dark Mode
```
--bg-deep: #030303
--bg-surface: #0A0A0A
--bg-surface-hover: #121212
--border-subtle: #1F1F1F
--border-active: #333333
--accent-primary: #4D9EFF
--accent-dim: #1A3A6B
--accent-glow: rgba(77, 158, 255, 0.15)
--text-primary: #EDEDED
--text-secondary: #888888
--text-tertiary: #444444
```

## Typography
- **Sans:** -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto (system font stack)
- **Mono:** 'SF Mono', 'Menlo', 'Monaco', 'Courier New', monospace
- **Body:** 14px, line-height 1.5, letter-spacing -0.01em
- **Card titles:** 11px, mono, uppercase, letter-spacing 0.05em, font-weight 600, --text-secondary
- **Metric values:** 28px, font-weight 600 (light) / 500 (dark), letter-spacing -0.03em
- **Metric deltas:** 12px, mono, font-weight 500
- **Table headers:** 10px, mono, uppercase, --text-secondary
- **Table cells:** 13px, sans, --text-secondary (hover: --text-primary)
- **Feed content:** 13px, sans, --text-secondary, line-height 1.5
- **Feed meta:** 10px, mono, --text-tertiary

## Spacing
- Header height: 60px, padding 0 24px
- Nav width: 60px
- Agent sidebar width: 320px
- Workspace padding: 24px
- Card padding: 20px
- Card gap: 20px
- Card header margin-bottom: 16px
- Nav item size: 40px (light) / 36px (dark)
- Nav gap: 16px (light) / 24px (dark)
- Feed item gap: 24px (light) / 20px (dark)

## Border Radius
- Cards: 8px (light) / 2px (dark)
- Nav items: 8px (light) / 6px (dark)
- Agent input: 6px (light) / 4px (dark)
- Status badges: 100px (pill shape)
- Buttons: 4px
- Heatmap cells: 2px (light) / 1px (dark)
- Bars: 2px 2px 0 0

## Card Patterns

### Metric Card (span 1 col)
- Title: mono 11px uppercase --text-secondary
- Value: 28px bold --text-primary
- Delta: 12px mono with arrow icon + color

### Chart Card (span 2 cols)
- Title + legend in header
- Bar chart with highlight on max bar
- Axis labels: mono 10px --text-tertiary

### Table Card (span 2 cols, span 2 rows)
- Export button in header (transparent bg, subtle border, 10px mono)
- Dense rows: 12px vertical padding
- First column: --text-primary, font-weight 500
- Status badges: pill shape, tiny text
- Numbers: mono font

### Utilization Card (span 1 col, span 2 rows)
- Large percentage value
- 7-column heatmap grid
- Muted note text at bottom

## Agent Sidebar
- Header: mono 11px uppercase with live dot (pulsing blue)
- Feed items: meta (source + time) then content
- Alert boxes: accent-dim bg, accent border, recommendation text
- Action buttons: full width, accent-primary bg
- Quick Quote: 2-col input grid at bottom, bordered outline button

## Status Badges
- Default: --bg-deep bg, --text-secondary text, no border
- Active: --accent-dim bg, --accent-primary text, accent border 20% opacity
- Delayed: #FEF2F2 bg, #EF4444 text, #FECACA border

## Numbers
ALWAYS use comma-separated full amounts: R 18,450 / R 45,200 / R 120,000
NEVER use K/M abbreviations on a financial platform.

## Theme Toggle
Top-right area of header. Toggle between light and dark CSS variables.

## What This Is NOT
- NOT a wide sidebar layout (60px icon nav only)
- NOT rounded-xl anything (max rounded-lg in light, rounded-sm in dark)
- NOT rainbow colors (blue accent ONLY + red for errors/delays)
- NOT gradient backgrounds on cards
- NOT colored left border panels
- NOT sparkle emoji AI decorations
- NOT generic dashboard — it's an AGENTIC OS
