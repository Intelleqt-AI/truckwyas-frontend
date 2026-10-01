import { useRef, type KeyboardEvent, type ReactNode } from 'react';

/**
 * v3 segmented control (DESIGN-PRINCIPLES §11.4). The one filter and period
 * control in the product: 28px on desktop (40px on touch), one raised track,
 * a neutral chip for the active option, never accent-filled, never a row of
 * separately boxed buttons. Options may carry a count ("Pending 3").
 *
 *   <Segmented
 *     label="Period"
 *     value={period}
 *     onChange={setPeriod}
 *     options={[{ value: '1m', label: '1M' }, { value: '3m', label: '3M' }]}
 *   />
 *
 * Styles: `.tw-seg` in src/styles/theme.css. Pages that cannot use the React
 * wrapper can use the same classes directly:
 *   <div class="tw-seg"><button class="tw-seg__opt is-active" aria-pressed="true">…</button></div>
 */
export interface SegmentedOption<V extends string = string> {
  value: V;
  label: ReactNode;
  /** Optional count shown after the label in tertiary text. */
  count?: number | string;
  disabled?: boolean;
  /** Accessible name when `label` is not plain text. */
  ariaLabel?: string;
}

export interface SegmentedProps<V extends string = string> {
  options: SegmentedOption<V>[];
  /** Inferred from `options`, so a useState setter or a narrower union works. */
  value: NoInfer<V>;
  onChange: (value: NoInfer<V>) => void;
  /** Accessible group name, e.g. "Period" or "Status". */
  label: string;
  /** `sm` = 24px (inside cards); default `md` = 28px. */
  size?: 'sm' | 'md';
  /** Stretch to the container width, options share it equally (phone toolbars). */
  block?: boolean;
  className?: string;
}

export function Segmented<V extends string = string>({
  options, value, onChange, label, size = 'md', block = false, className,
}: SegmentedProps<V>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  // Arrow keys move between options (roving focus), like a native radio group.
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);
    if (!enabled.length) return;
    const cur = enabled.indexOf(options.findIndex((o) => o.value === value));
    let next = cur;
    if (e.key === 'ArrowLeft') next = cur <= 0 ? enabled.length - 1 : cur - 1;
    if (e.key === 'ArrowRight') next = cur >= enabled.length - 1 ? 0 : cur + 1;
    if (e.key === 'Home') next = 0;
    if (e.key === 'End') next = enabled.length - 1;
    const idx = enabled[next];
    e.preventDefault();
    onChange(options[idx].value);
    refs.current[idx]?.focus();
  };

  const cls = ['tw-seg', size === 'sm' ? 'tw-seg--sm' : '', block ? 'tw-seg--block' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="radiogroup" aria-label={label} onKeyDown={onKey}>
      {options.map((o, i) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            ref={(el) => { refs.current[i] = el; }}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={o.ariaLabel}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            className={`tw-seg__opt${active ? ' is-active' : ''}`}
            onClick={() => { if (!active) onChange(o.value); }}
          >
            {o.label}
            {o.count !== undefined && o.count !== null && o.count !== '' && (
              <span className="tw-seg__count">{o.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default Segmented;
