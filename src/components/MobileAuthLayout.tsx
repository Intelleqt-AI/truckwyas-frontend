import type { ReactNode } from 'react';

// Purpose-built mobile layout for the auth pages (Login/Signup/PasswordReset/
// EmailVerification) — NOT the desktop side-by-side split just stacked and
// reordered. Those pages' marketing panel is sized for half a desktop
// screen (32px logo, 26px headline, feature grid, price card, footer
// tagline) — dropped whole onto a phone, above OR below the form, it reads
// as a wall of content to scroll past either way.
//
// This condenses the panel into just what orients a first-time visitor
// (small logo, eyebrow, title, subtitle) directly above the form — the
// thing they actually came to do — and demotes everything else (feature
// list, pricing, steps, reminders, footer tagline) to a `footer` slot below
// the form. That's allowed to run long; scrolling to it is fine, since
// nothing there blocks completing the form above it.
interface MobileAuthLayoutProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
}

export function MobileAuthLayout({ eyebrow, title, subtitle, children, footer }: MobileAuthLayoutProps) {
  return (
    <div className="mobile-auth-layout">
      <style>{`
        .mobile-auth-layout {
          /* html/body/#root are pinned to height:100vh + overflow:hidden
             app-wide — same reasoning as the desktop split's own scroll
             container (see Login.tsx etc.), just column-oriented here since
             there's only ever one column on mobile. */
          min-height: 100vh;
          overflow-y: auto;
          background: var(--bg-deep);
          font-family: var(--font-sans);
          display: flex;
          flex-direction: column;
          padding: 28px 20px 40px;
          box-sizing: border-box;
        }
        .mobile-auth-layout__logo {
          height: 22px;
          width: auto;
          margin-bottom: 20px;
        }
        .mobile-auth-layout__eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--accent-primary);
          margin-bottom: 6px;
        }
        .mobile-auth-layout__title {
          font-size: 20px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
          letter-spacing: -0.01em;
          margin-bottom: 6px;
        }
        .mobile-auth-layout__subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .mobile-auth-layout__footer {
          margin-top: 32px;
          padding-top: 24px;
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>

      <img src="/brand/truckwys-logo-transparent.png" alt="TruckWys" className="mobile-auth-layout__logo" />
      {eyebrow && <div className="mobile-auth-layout__eyebrow">{eyebrow}</div>}
      <div className="mobile-auth-layout__title">{title}</div>
      {subtitle && <div className="mobile-auth-layout__subtitle">{subtitle}</div>}

      {children}

      {footer && <div className="mobile-auth-layout__footer">{footer}</div>}
    </div>
  );
}

export default MobileAuthLayout;
