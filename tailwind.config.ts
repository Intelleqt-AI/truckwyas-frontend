import type { Config } from "tailwindcss";

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			/* Grid System Extensions */
			gridTemplateColumns: {
				'18': 'repeat(18, minmax(0, 1fr))',
				'30': 'repeat(30, minmax(0, 1fr))'
			},
			/* Typography - Mercury-inspired system */
			fontFamily: {
				'display': ['Inter', 'sans-serif'],        // Headings
				'body': ['Inter', 'sans-serif'],           // Body text
				'mono': ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Consolas', 'monospace']
			},
			fontWeight: {
				'display-bold': '700',    // H1
				'display-semibold': '600', // H2
				'body-medium': '500',     // Medium body
				'body-regular': '400'     // Regular body
			},
			colors: {
				/* Brand Color System */
				brand: {
					900: 'hsl(var(--brand-900))',  // Deep navy headers
					700: 'hsl(var(--brand-700))',
					500: 'hsl(var(--brand-500))',  // Primary action
					300: 'hsl(var(--brand-300))',  // Accents
					100: 'hsl(var(--brand-100))'   // Subtle backgrounds
				},
				success: {
					DEFAULT: 'hsl(var(--success-500))',
					500: 'hsl(var(--success-500))',
					foreground: 'hsl(var(--success-foreground))',
					light: 'hsl(var(--success-light))'
				},
				warning: {
					DEFAULT: 'hsl(var(--warn-500))',
					500: 'hsl(var(--warn-500))',
					foreground: 'hsl(var(--warning-foreground))',
					light: 'hsl(var(--warning-light))'
				},
				danger: {
					DEFAULT: 'hsl(var(--danger-500))',
					500: 'hsl(var(--danger-500))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				neutral: {
					900: 'hsl(var(--neutral-900))',
					600: 'hsl(var(--neutral-600))',
					200: 'hsl(var(--neutral-200))'
				},
				surface: {
					DEFAULT: 'hsl(var(--surface))',
					contrast: 'hsl(var(--surface-contrast))'
				},
				
				/* Core System Colors */
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))',
					hover: 'hsl(var(--primary-hover))',
					light: 'hsl(var(--primary-light))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))',
					hover: 'hsl(var(--secondary-hover))',
					light: 'hsl(var(--secondary-light))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				sidebar: {
					DEFAULT: 'hsl(var(--sidebar-background))',
					background: 'hsl(var(--sidebar-background))',
					foreground: 'hsl(var(--sidebar-foreground))',
					primary: 'hsl(var(--sidebar-primary))',
					'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
					accent: 'hsl(var(--sidebar-accent))',
					'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
					border: 'hsl(var(--sidebar-border))',
					ring: 'hsl(var(--sidebar-ring))'
				},
				dashboard: {
					bg: 'hsl(var(--dashboard-bg))'
				},
				nav: {
					bg: 'hsl(var(--nav-bg))',
					border: 'hsl(var(--nav-border))'
				}
			},
			backgroundImage: {
				'gradient-primary': 'var(--gradient-primary)',
				'gradient-hero': 'var(--gradient-hero)',
				'gradient-dashboard': 'var(--gradient-dashboard)',
				'gradient-accent': 'var(--gradient-accent)'
			},
			boxShadow: {
				'card': 'var(--shadow-card)',
				'nav': 'var(--shadow-nav)',
				'modal': 'var(--shadow-modal)',
				'glow': 'var(--shadow-glow)'
			},
			/* Border Radius - Professional logistics design */
			borderRadius: {
				lg: 'var(--radius)',           // Standard cards
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)',
				xl: 'var(--radius)',           // Cards (same as lg for consistency)
				'2xl': 'var(--radius-sheet)',  // Sheets and drawers
				'sheet': 'var(--radius-sheet)'
			},
			/* Animation System - Truckwys Motion Language */
			keyframes: {
				/* Accordion Animations */
				'accordion-down': {
					from: { height: '0', opacity: '0' },
					to: { height: 'var(--radix-accordion-content-height)', opacity: '1' }
				},
				'accordion-up': {
					from: { height: 'var(--radix-accordion-content-height)', opacity: '1' },
					to: { height: '0', opacity: '0' }
				},
				
				/* Fade Animations */
				'fade-in': {
					'0%': { opacity: '0', transform: 'translateY(10px)' },
					'100%': { opacity: '1', transform: 'translateY(0)' }
				},
				'fade-out': {
					'0%': { opacity: '1', transform: 'translateY(0)' },
					'100%': { opacity: '0', transform: 'translateY(10px)' }
				},
				
				/* Scale Animations */
				'scale-in': {
					'0%': { transform: 'scale(0.95)', opacity: '0' },
					'100%': { transform: 'scale(1)', opacity: '1' }
				},
				'scale-out': {
					'0%': { transform: 'scale(1)', opacity: '1' },
					'100%': { transform: 'scale(0.95)', opacity: '0' }
				},
				
				/* Slide Animations - Sheet/Drawer */
				'slide-in-right': {
					'0%': { transform: 'translateX(100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-right': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(100%)' }
				},
				'slide-in-left': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(0)' }
				},
				'slide-out-left': {
					'0%': { transform: 'translateX(0)' },
					'100%': { transform: 'translateX(-100%)' }
				},
				
				/* Agent Card Staggered Entrance */
				'agent-enter': {
					'0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
					'100%': { opacity: '1', transform: 'translateY(0) scale(1)' }
				},
				
				/* Pulse Glow for Status Indicators */
				'pulse-glow': {
					'0%, 100%': { opacity: '1', transform: 'scale(1)' },
					'50%': { opacity: '0.7', transform: 'scale(1.05)' }
				},
				
				/* Hover Lift Animation */
				'lift': {
					'0%': { transform: 'translateY(0)' },
					'100%': { transform: 'translateY(-2px)' }
				}
			},
			animation: {
				/* Basic Animations - Professional timing */
				'accordion-down': 'accordion-down 200ms ease-out',
				'accordion-up': 'accordion-up 200ms ease-out',
				'fade-in': 'fade-in 150ms ease-out',
				'fade-out': 'fade-out 150ms ease-out',
				'scale-in': 'scale-in 150ms ease-out',
				'scale-out': 'scale-out 150ms ease-out',
				
				/* Slide Animations - Sheet timing */
				'slide-in-right': 'slide-in-right 200ms ease-out',
				'slide-out-right': 'slide-out-right 200ms ease-out',
				'slide-in-left': 'slide-in-left 200ms ease-out',
				'slide-out-left': 'slide-out-left 200ms ease-out',
				
				/* Agent Card System */
				'agent-enter': 'agent-enter 200ms ease-out',
				'agent-enter-delay-1': 'agent-enter 200ms ease-out 50ms both',
				'agent-enter-delay-2': 'agent-enter 200ms ease-out 100ms both',
				'agent-enter-delay-3': 'agent-enter 200ms ease-out 150ms both',
				
				/* Status Indicators */
				'pulse-glow': 'pulse-glow 2s ease-in-out infinite',
				
				/* Interactive Elements */
				'lift': 'lift 200ms ease-out forwards'
			},
			/* Transitions - Truckwys timing system */
			transitionDuration: {
				'fast': '150ms',    // Page transitions
				'smooth': '200ms',  // Hover effects, drawer slides
				'modal': '200ms'    // Modal/sheet animations
			},
			transitionTimingFunction: {
				'ease-out-smooth': 'cubic-bezier(0.4, 0, 0.2, 1)'
			}
		}
	},
	plugins: [require("tailwindcss-animate")],
} satisfies Config;