import type { InputHTMLAttributes, ReactNode } from 'react';
import { Search } from 'lucide-react';

/**
 * Page toolbar (R3 rhythm, DESIGN-PRINCIPLES §11.1). The FIRST content block
 * of a page: it sits at the content-start y and every control in it is
 * --control-h (36px; 44 on touch/phones). Shared Select triggers inside it
 * size themselves to 36 automatically (--select-h).
 *
 *   <Toolbar
 *     meta="42 invoices"
 *     end={<button className="tw-btn">Export</button>}
 *   >
 *     <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search invoices" aria-label="Search invoices" />
 *     <Select …><SelectTrigger className="…" style={{ width: 180 }}>…</SelectTrigger></Select>
 *   </Toolbar>
 *
 * Styles: `.tw-toolbar` in src/styles/theme.css.
 */
export function Toolbar({
  children, meta, end, className, 'aria-label': ariaLabel,
}: {
  children?: ReactNode;
  /** Quiet count/summary text after the controls ("42 invoices"). */
  meta?: ReactNode;
  /** Right-aligned controls (export, secondary actions). */
  end?: ReactNode;
  className?: string;
  'aria-label'?: string;
}) {
  return (
    <div className={['tw-toolbar', className ?? ''].filter(Boolean).join(' ')} role={ariaLabel ? 'toolbar' : undefined} aria-label={ariaLabel}>
      {children}
      {meta !== undefined && meta !== null && meta !== '' && <span className="tw-toolbar__meta">{meta}</span>}
      {end ? <div className="tw-toolbar__end">{end}</div> : null}
    </div>
  );
}

/** 36px search field with the magnifier inside (`.tw-search-wrap` / `.tw-search`). */
export function SearchInput({ className, wrapClassName, ...props }: InputHTMLAttributes<HTMLInputElement> & { wrapClassName?: string }) {
  return (
    <label className={['tw-search-wrap', wrapClassName ?? ''].filter(Boolean).join(' ')}>
      <Search aria-hidden="true" strokeWidth={1.75} />
      <input type="search" className={['tw-search', className ?? ''].filter(Boolean).join(' ')} {...props} />
    </label>
  );
}

export default Toolbar;
