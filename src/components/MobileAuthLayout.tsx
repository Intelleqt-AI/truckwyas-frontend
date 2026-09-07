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
          box-sizing: border-box;
          padding: 24px 20px 32px;
        }
        .mobile-auth-layout__eyebrow {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--accent-primary);
          margin-bottom: 4px;
        }
        .mobile-auth-layout__title {
          font-size: 19px;
          font-weight: 600;
          color: var(--text-primary);
          line-height: 1.3;
          letter-spacing: -0.01em;
          margin-bottom: 4px;
        }
        .mobile-auth-layout__subtitle {
          font-size: 13px;
          color: var(--text-secondary);
          line-height: 1.5;
          margin-bottom: 18px;
        }
        .mobile-auth-layout__footer {
          margin-top: 24px;
          padding-top: 20px;
          border-top: 1px solid var(--border-subtle);
        }
      `}</style>

      {/* Centered column, same 440px cap the desktop content panel uses —
          without it, a wider phone/small-tablet viewport (anything short of
          the 860px breakpoint) stretched the form and body text edge to
          edge. Logo size is set inline, not via a CSS class: the
          transparent PNG's own intrinsic box is much wider than its visible
          mark, and a plain `img` selector elsewhere in the app's global
          styles was overriding a same-specificity class rule and stretching
          it — an inline style always wins that fight. Logo + header text
          are centered as a block (the form/footer below stay left-aligned —
          that's the normal, more readable way to present form fields and
          body copy). */}
      <div style={{ maxWidth: 440, width: '100%', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 14 }}>
          <img
            src="/brand/truckwys-logo-transparent.png"
            alt="TruckWys"
            style={{ display: 'inline-block', maxHeight: 20, width: 'auto', marginBottom: 14 }}
          />
          {eyebrow && <div className="mobile-auth-layout__eyebrow">{eyebrow}</div>}
          <div className="mobile-auth-layout__title">{title}</div>
          {subtitle && <div className="mobile-auth-layout__subtitle" style={{ marginBottom: 0 }}>{subtitle}</div>}
        </div>

        {/* flex-centered, not just a wrapping div: the form card each page
            passes in sets its own fixed maxWidth (400px, narrower than this
            440px column) with no auto margin of its own, so without this it
            sat flush against the column's left edge instead of centering
            under the header text above it. */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {children}
        </div>

        {footer && <div className="mobile-auth-layout__footer">{footer}</div>}
      </div>
    </div>
  );
}

export default MobileAuthLayout;
