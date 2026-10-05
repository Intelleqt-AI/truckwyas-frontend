import { useEffect, useId, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown } from 'lucide-react';
import { fetchData, postData } from '@/lib/Api';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FIN_URL, errorText } from '@/lib/finance/api';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { vatNumberProblem } from '@/lib/finance/validation';
import type { Supplier } from '@/lib/finance/types';
import './finance-ledger.css';

const NONE = '__none';
const ADD = '__add';
/** Matches shown at once; typing narrows the rest (server-side search). */
const LIMIT = 20;

/**
 * Supplier picker for the expense form: type to search every active
 * supplier on the server (name, VAT or registration number, email), with
 * "Add a new supplier" inline (name and VAT number; the rest can be filled
 * in on the Suppliers page). Inactive suppliers are hidden unless one is
 * already selected.
 */
export function SupplierPicker({ value, onChange, fallbackName, category, labelId }: {
  value: number | null;
  onChange: (s: Supplier | null) => void;
  /** The old free-text vendor, shown when no supplier is linked. */
  fallbackName?: string;
  /** Category for a supplier added here. */
  category?: string;
  labelId: string;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const q = useDebouncedValue(query.trim());
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const matches = useQuery({
    queryKey: ['suppliers', 'picker', q],
    queryFn: () => {
      const params = new URLSearchParams({ is_active: 'true', page_size: String(LIMIT) });
      if (q) params.set('search', q);
      return fetchData(`${FIN_URL.suppliers}?${params}`) as Promise<{ count: number; results: Supplier[] }>;
    },
    enabled: open,
    placeholderData: keepPreviousData,
  });
  // The linked supplier's name, even when it's inactive or not among the matches.
  const current = useQuery({
    queryKey: ['suppliers', 'one', value],
    queryFn: () => fetchData(`${FIN_URL.suppliers}${value}/`) as Promise<Supplier>,
    enabled: value != null,
    staleTime: 60_000,
  });
  const isError = matches.isError;
  const results = matches.data?.results ?? [];
  const more = Math.max(0, (matches.data?.count ?? 0) - results.length);
  // Options in order: No supplier, the matches, Add a new supplier.
  const options: { key: string; supplier?: Supplier }[] = [
    { key: NONE }, ...results.map(s => ({ key: String(s.id), supplier: s })), { key: ADD },
  ];
  useEffect(() => { setActive(0); }, [q, open]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const choose = (key: string, supplier?: Supplier) => {
    setOpen(false);
    setQuery('');
    if (key === ADD) { startAdd(); return; }
    onChange(key === NONE ? null : supplier ?? null);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(options.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); const o = options[active]; if (o) choose(o.key, o.supplier); }
  };
  const noneLabel = fallbackName && value == null ? `Not linked (${fallbackName})` : 'No supplier';
  const triggerLabel = value == null ? noneLabel
    : current.data ? `${current.data.name}${current.data.is_active === false ? ' (inactive)' : ''}`
    : current.isError ? 'Linked supplier' : 'Loading…';

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [vat, setVat] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const vatProblem = vatNumberProblem(vat);

  const startAdd = () => { setAdding(true); setName(fallbackName && !value ? fallbackName : ''); setVat(''); setError(''); };

  const add = async () => {
    if (!name.trim() || vatProblem) return;
    setBusy(true); setError('');
    try {
      const saved: Supplier = await postData({
        url: FIN_URL.suppliers,
        data: { name: name.trim(), vat_number: vat.replace(/[\s-]/g, ''), registration_number: '', email: '', phone: '', category: category || 'OTHER', is_active: true },
      });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      qc.setQueryData(['suppliers', 'one', saved.id], saved);
      onChange(saved);
      setAdding(false);
    } catch (err) {
      setError(errorText(err, "Couldn't add the supplier"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button type="button" className="tw-select-trigger sp-combo__trigger" role="combobox" aria-expanded={open}
            aria-controls={listId} aria-labelledby={labelId}>
            <span className={value == null ? 'sp-combo__placeholder' : undefined}>{triggerLabel}</span>
            <ChevronDown size={13} aria-hidden="true" style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="sp-combo__pop" onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector('input')?.focus(); }}>
          <input className="fin-control sp-combo__search" type="search" value={query} onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey} placeholder="Search suppliers" aria-label="Search suppliers" role="searchbox"
            aria-controls={listId} aria-activedescendant={`${listId}-${active}`} />
          <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelId} className="sp-combo__list" aria-busy={matches.isFetching}>
            {options.map((o, i) => (
              <li key={o.key} id={`${listId}-${i}`} data-index={i} role="option" aria-selected={i === active}
                className={`sp-combo__opt${i === active ? ' is-active' : ''}${o.key === ADD ? ' sp-combo__opt--add' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={e => e.preventDefault()} onClick={() => choose(o.key, o.supplier)}>
                {o.key === NONE ? noneLabel : o.key === ADD ? 'Add a new supplier…' : o.supplier!.name}
              </li>
            ))}
          </ul>
          {matches.isLoading && <p className="sp-combo__note">Loading suppliers…</p>}
          {!matches.isLoading && q && results.length === 0 && <p className="sp-combo__note">No active supplier matches “{q}”.</p>}
          {more > 0 && <p className="sp-combo__note">{more} more. Keep typing to narrow the list.</p>}
        </PopoverContent>
      </Popover>
      {isError && <p className="fin-help fin-text-danger">Couldn't load suppliers. You can still save the expense.</p>}
      {adding && (
        <div className="fl-inline-add" role="group" aria-label="New supplier">
          <div className="fl-inline-add__fields">
            <div>
              <label className="fin-label" htmlFor="sp-new-name">Supplier name</label>
              <input id="sp-new-name" className="fin-control" type="text" value={name} onChange={e => setName(e.target.value)} autoFocus
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            </div>
            <div>
              <label className="fin-label" htmlFor="sp-new-vat">VAT number (optional)</label>
              <input id="sp-new-vat" className="fin-control" type="text" inputMode="numeric" value={vat} onChange={e => setVat(e.target.value)} placeholder="4XXXXXXXXX"
                aria-invalid={!!vatProblem} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} />
            </div>
          </div>
          {(vatProblem || error) && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{vatProblem || error}</p>}
          <div className="fl-inline-add__actions">
            <button type="button" className="tw-btn tw-btn--ghost" onClick={() => setAdding(false)} disabled={busy}>Cancel</button>
            <button type="button" className="tw-btn" onClick={add} disabled={busy || !name.trim() || !!vatProblem}>{busy ? 'Adding…' : 'Add supplier'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default SupplierPicker;
