# Truckwys Design System

Professional design system for the Truckwys AI-powered logistics platform.

## Overview

The Truckwys design system provides a comprehensive set of design tokens, components, and utilities for building consistent, accessible, and professional logistics dashboard interfaces.

### Design Principles

- **Bold, Technical, Confident**: Professional logistics industry aesthetic
- **Human-Centered**: Clear, readable interfaces for operational efficiency  
- **Consistent**: Unified visual language across all platform modules
- **Accessible**: AA contrast standards, keyboard navigation, screen reader support

## Usage

### Design Tokens

Import tokens from `/lib/tokens.ts`:

```tsx
import { colors, typography, motion, layout } from '@/lib/tokens';

// Use semantic color classes
<div className={`bg-${colors.brand[500]} text-white`}>
  Primary Action Button
</div>

// Typography system
<h1 className={typography.styles.h1}>Dashboard Header</h1>
<p className={typography.styles.body}>Dashboard description text</p>

// Motion and interactions
<div className={`${motion.transitions.smooth} ${motion.interactive.hoverLift}`}>
  Interactive Card
</div>
```

### Color System

#### Brand Colors
- `brand-900`: Deep navy headers (#0F172A)
- `brand-700`: Secondary dark (#1E293B) 
- `brand-500`: Primary action blue (#2563EB)
- `brand-300`: Accent blue (#93C5FD)
- `brand-100`: Subtle backgrounds (#E2E8F0)

#### Functional Colors
- `success-500`: Operations green (#16A34A)
- `warning-500`: Alert amber (#F59E0B)
- `danger-500`: Critical red (#EF4444)

#### Surface Colors (Dark Mode)
- `surface`: Dark card background (#0E1320)
- `surface-contrast`: Alternate card background (#111826)

### Typography

#### Font Families
- **Inter Tight**: Display text (H1: weight 700, H2: weight 600)
- **Inter**: Body text (Regular: 400, Medium: 500)
- **Tabular Numbers**: Dashboard metrics (automatic via `font-variant-numeric`)

#### Semantic Classes
```tsx
<h1 className="text-display-1">Main Header</h1>
<h2 className="text-display-2">Section Header</h2>  
<h3 className="text-heading">Subsection</h3>
<p className="text-body">Regular content</p>
<p className="text-body-medium">Emphasized content</p>
<span className="text-caption">Small text</span>
<div className="text-tabular">123,456.78</div>
```

### Layout & Spacing

#### Border Radius
- Cards: `rounded-xl` (12px)
- Sheets/Drawers: `rounded-2xl` (16px) 
- Buttons: `rounded-lg` (8px)

#### Shadows
- Cards: `shadow-card` (subtle elevation)
- Navigation: `shadow-nav` (header shadow)
- Modals: `shadow-modal` (overlay depth)
- Focus: `shadow-glow` (accessibility indicator)

### Motion System

#### Timing
- **Page Transitions**: 150ms ease-out (`transition-fast`)
- **Hover Effects**: 200ms ease-out (`transition-smooth`)
- **Drawers/Sheets**: 200ms ease-out (`transition-modal`)

#### Animations
```tsx
// Entrance animations
<div className="animate-fade-in">Fading in content</div>
<div className="animate-agent-enter">Agent card entrance</div>

// Staggered animations (for lists)
<div className="animate-agent-enter-delay-1">First item</div>
<div className="animate-agent-enter-delay-2">Second item</div>

// Interactive effects
<button className="hover-lift">Hover to lift</button>
<div className="animate-pulse-glow">Status indicator</div>
```

#### Utility Functions
```tsx
import { staggeredAnimation, getCSSVar } from '@/lib/tokens';

// Staggered list animations
{items.map((item, index) => (
  <div key={item.id} className={staggeredAnimation(index)}>
    {item.content}
  </div>
))}

// CSS variable access for inline styles
<div style={{ 
  backgroundColor: getCSSVar('brand.500'),
  borderColor: getCSSVar('brand.300')
}}>
  Custom styled element
</div>
```

### Gradients

#### Background Gradients
- `bg-gradient-primary`: Brand blue gradient
- `bg-gradient-hero`: Deep navy dashboard hero
- `bg-gradient-accent`: KPI accent stripe (8% opacity)

### Iconography

#### Standards
- **Size**: 20-24px stroke (use `w-5 h-5` or `w-6 h-6`)
- **Stroke Weight**: 2px consistent (`stroke-2`)
- **Library**: Lucide React icons

```tsx
import { Truck, BarChart3, Shield } from 'lucide-react';

<Truck className="w-5 h-5 stroke-2" />
<BarChart3 className="w-6 h-6 text-brand-500" />
```

## Accessibility

### Focus States
All interactive elements include visible focus indicators:
```tsx
<button className="focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
  Accessible Button
</button>
```

### Screen Reader Support
```tsx
<div className="sr-only">Screen reader only content</div>
<img src="chart.png" alt="Revenue trend showing 15% growth over Q3" />
```

### Contrast Standards
- All text meets AA contrast requirements
- Interactive elements have 3:1 minimum contrast ratios
- Focus indicators are clearly visible

## Dark Mode Support

The system automatically supports dark mode via the `dark` class:

```tsx
// Automatic theme-aware colors
<div className="bg-card text-card-foreground">
  Content adapts to light/dark modes
</div>
```

## File Structure

```
src/lib/
├── tokens.ts          # Design system tokens
├── constants.ts       # App constants
├── formatters.ts      # Data formatting utilities
├── types.ts           # TypeScript type definitions
└── utils.ts           # General utilities

src/index.css          # CSS custom properties
tailwind.config.ts     # Tailwind configuration
```

## Examples

### Dashboard Card
```tsx
import { colors, layout, motion } from '@/lib/tokens';

<div className={`
  ${layout.shadows.card}
  ${layout.radius.card}
  ${motion.transitions.smooth}
  ${motion.interactive.hoverLift}
  bg-card p-6
`}>
  <h3 className="text-heading text-card-foreground mb-4">
    Revenue Overview
  </h3>
  <div className="text-tabular text-2xl font-display-bold text-brand-500">
    £1,234,567
  </div>
</div>
```

### Agent Status Indicator
```tsx
<div className="flex items-center gap-2">
  <div className="w-2 h-2 bg-success rounded-full animate-pulse-glow" />
  <span className="text-caption text-success">All Agents Active</span>
</div>
```

### Navigation Item
```tsx
<NavLink 
  to="/dashboard"
  className={`
    flex items-center gap-3 px-3 py-2 rounded-lg
    transition-smooth hover-lift
    text-sidebar-foreground hover:bg-sidebar-accent
  `}
>
  <Truck className="w-5 h-5 stroke-2" />
  <span className="text-body-medium">Fleet Direct</span>
</NavLink>
```