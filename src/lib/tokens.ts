/**
 * Truckwys Design System Tokens
 * 
 * Design system tokens for the Truckwys logistics platform.
 * Provides consistent access to colors, typography, spacing, and motion values.
 * 
 * Usage:
 * ```tsx
 * import { colors, typography, motion } from '@/lib/tokens';
 * 
 * // Use in components
 * className={`text-${colors.brand[500]} ${typography.heading} ${motion.smooth}`}
 * 
 * // Or access raw CSS variables
 * style={{ color: `hsl(${colors.css.brand500})` }}
 * ```
 */

/* ===== BRAND COLOR TOKENS ===== */
export const colors = {
  /* Truckwys Brand Palette */
  brand: {
    900: 'brand-900',  // Deep navy headers - #0F172A
    700: 'brand-700',  // #1E293B
    500: 'brand-500',  // Primary action blue - #2563EB
    300: 'brand-300',  // Accent blue - #93C5FD
    100: 'brand-100'   // Subtle backgrounds - #E2E8F0
  },
  
  /* Functional Colors */
  functional: {
    success: 'success-500',   // #16A34A
    warning: 'warning-500',   // #F59E0B
    danger: 'danger-500'      // #EF4444
  },
  
  /* Neutral System */
  neutral: {
    900: 'neutral-900',  // #0B0F1A
    600: 'neutral-600',  // #475569
    200: 'neutral-200'   // #E5E7EB
  },
  
  /* Surface Colors - Dashboard specific */
  surface: {
    DEFAULT: 'surface',          // #0E1320 - Dark cards
    contrast: 'surface-contrast' // #111826 - Alternate cards
  },
  
  /* Core System Colors */
  system: {
    primary: 'primary',
    secondary: 'secondary',
    background: 'background',
    foreground: 'foreground',
    muted: 'muted',
    accent: 'accent',
    border: 'border',
    card: 'card'
  },
  
  /* Raw CSS Variable Access */
  css: {
    brand900: 'var(--brand-900)',
    brand700: 'var(--brand-700)', 
    brand500: 'var(--brand-500)',
    brand300: 'var(--brand-300)',
    brand100: 'var(--brand-100)',
    success500: 'var(--success-500)',
    warn500: 'var(--warn-500)',
    danger500: 'var(--danger-500)',
    neutral900: 'var(--neutral-900)',
    neutral600: 'var(--neutral-600)',
    neutral200: 'var(--neutral-200)',
    surface: 'var(--surface)',
    surfaceContrast: 'var(--surface-contrast)',
    gridLine: 'var(--grid-line)'
  }
} as const;

/* ===== TYPOGRAPHY TOKENS ===== */
export const typography = {
  /* Font Families */
  fonts: {
    display: 'font-display',    // Inter Tight - H1, H2
    body: 'font-body',          // Inter - Body text
    mono: 'font-mono'           // Monospace
  },
  
  /* Font Weights */
  weights: {
    displayBold: 'font-display-bold',        // 700 - H1
    displaySemibold: 'font-display-semibold', // 600 - H2
    bodyMedium: 'font-body-medium',          // 500 - Medium body
    bodyRegular: 'font-body-regular'         // 400 - Regular body
  },
  
  /* Text Styles - Semantic classes */
  styles: {
    h1: 'text-display-1',     // Display 1 - Main headers
    h2: 'text-display-2',     // Display 2 - Section headers
    h3: 'text-heading',       // Heading - Subsection headers
    body: 'text-body',        // Body - Regular text
    bodyMedium: 'text-body-medium', // Body Medium - Emphasized text
    caption: 'text-caption',  // Caption - Small text
    tabular: 'text-tabular'   // Tabular numbers for dashboards
  }
} as const;

/* ===== SPACING & LAYOUT TOKENS ===== */
export const layout = {
  /* Border Radius */
  radius: {
    card: 'rounded-xl',        // Cards - xl
    sheet: 'rounded-2xl',      // Drawers/Sheets - 2xl
    button: 'rounded-lg',      // Buttons
    input: 'rounded-md'        // Form inputs
  },
  
  /* Shadows - Professional, subtle */
  shadows: {
    card: 'shadow-card',       // Card elevation
    nav: 'shadow-nav',         // Navigation shadow
    modal: 'shadow-modal',     // Modal/overlay shadow
    glow: 'shadow-glow'        // Focus glow effect
  },
  
  /* Container Sizes */
  containers: {
    page: 'container mx-auto px-6',
    card: 'p-6',
    section: 'py-12'
  }
} as const;

/* ===== MOTION TOKENS ===== */
export const motion = {
  /* Transition Classes */
  transitions: {
    fast: 'transition-fast',       // 150ms - Page transitions
    smooth: 'transition-smooth',   // 200ms - Hover effects
    modal: 'transition-modal'      // 200ms - Drawer/sheet slides
  },
  
  /* Animation Classes */
  animations: {
    fadeIn: 'animate-fade-in',
    fadeOut: 'animate-fade-out',
    scaleIn: 'animate-scale-in',
    scaleOut: 'animate-scale-out',
    slideInRight: 'animate-slide-in-right',
    slideOutRight: 'animate-slide-out-right',
    agentEnter: 'animate-agent-enter',
    pulseGlow: 'animate-pulse-glow',
    lift: 'animate-lift'
  },
  
  /* Staggered Agent Card Animations */
  staggered: {
    delay1: 'animate-agent-enter-delay-1',
    delay2: 'animate-agent-enter-delay-2', 
    delay3: 'animate-agent-enter-delay-3'
  },
  
  /* Interactive Effects */
  interactive: {
    hoverLift: 'hover-lift',           // 1px lift
    hoverLiftStrong: 'hover-lift-strong' // 2px lift
  },
  
  /* Timing Values - For inline styles */
  timing: {
    fast: '150ms',
    smooth: '200ms',
    stagger: '50ms'
  }
} as const;

/* ===== GRADIENTS TOKENS ===== */
export const gradients = {
  /* Background Gradients */
  backgrounds: {
    primary: 'bg-gradient-primary',     // Brand blue gradient
    hero: 'bg-gradient-hero',           // Deep navy hero gradient
    dashboard: 'bg-gradient-dashboard', // Subtle dashboard background
    accent: 'bg-gradient-accent'        // KPI accent stripe (8% opacity)
  },
  
  /* CSS Variable Access */
  css: {
    primary: 'var(--gradient-primary)',
    hero: 'var(--gradient-hero)',
    dashboard: 'var(--gradient-dashboard)',
    accent: 'var(--gradient-accent)'
  }
} as const;

/* ===== ICONOGRAPHY TOKENS ===== */
export const icons = {
  /* Standard Sizes - Consistent with Lucide */
  sizes: {
    sm: 'w-4 h-4',     // 16px
    md: 'w-5 h-5',     // 20px - Standard
    lg: 'w-6 h-6',     // 24px - Large
    xl: 'w-8 h-8'      // 32px - Extra large
  },
  
  /* Stroke Weights */
  strokes: {
    thin: 'stroke-1',      // 1px
    normal: 'stroke-2',    // 2px - Standard
    thick: 'stroke-2.5'    // 2.5px - Emphasis
  }
} as const;

/* ===== ACCESSIBILITY TOKENS ===== */
export const accessibility = {
  /* Focus States */
  focus: {
    ring: 'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    outline: 'focus-visible:outline-none'
  },
  
  /* Screen Reader Classes */
  srOnly: 'sr-only',
  
  /* High Contrast Support */
  contrast: {
    text: 'contrast-more:text-foreground',
    border: 'contrast-more:border-border'
  }
} as const;

/* ===== UTILITY FUNCTIONS ===== */

/**
 * Get a CSS variable value for inline styles
 * @param token - Token path (e.g., 'brand.500')
 * @returns CSS variable string
 */
export function getCSSVar(token: string): string {
  const tokenMap: Record<string, string> = {
    'brand.900': colors.css.brand900,
    'brand.700': colors.css.brand700,
    'brand.500': colors.css.brand500,
    'brand.300': colors.css.brand300,
    'brand.100': colors.css.brand100,
    'success.500': colors.css.success500,
    'warning.500': colors.css.warn500,
    'danger.500': colors.css.danger500
  };
  
  return tokenMap[token] || `var(--${token.replace('.', '-')})`;
}

/**
 * Create staggered animation delay for multiple elements
 * @param index - Element index (0-based)
 * @returns Animation class with delay
 */
export function staggeredAnimation(index: number): string {
  const delays = ['animate-agent-enter', ...Object.values(motion.staggered)];
  return delays[Math.min(index, delays.length - 1)];
}

/* ===== EXPORT DEFAULT ===== */
export default {
  colors,
  typography,
  layout,
  motion,
  gradients,
  icons,
  accessibility,
  getCSSVar,
  staggeredAnimation
};