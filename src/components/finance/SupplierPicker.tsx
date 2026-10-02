import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { postData } from '@/lib/Api';
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FIN_URL, errorText, useSuppliers } from '@/lib/finance/api';
import { vatNumberProblem } from '@/lib/finance/validation';
import type { Supplier } from '@/lib/finance/types';
import './finance-ledger.css';

const NONE = '__none';
const ADD = '__add';

/**
 * Supplier select for the expense form, with "Add a new supplier" inline
 * (name and VAT number; the rest can be filled in on the Suppliers page).
 * Inactive suppliers are hidden unless one is already selected.
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
  const { data, isLoading, isError } = useSuppliers();
  const suppliers = (data?.rows ?? []).filter(s => s.is_active !== false || s.id === value).sort((a, b) => a.name.localeCompare(b.name));
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
      <Select
        value={value != null ? String(value) : NONE}
        onValueChange={v => {
          if (v === ADD) { startAdd(); return; }
          if (v === NONE) { onChange(null); return; }
          onChange(suppliers.find(s => String(s.id) === v) ?? null);
        }}
      >
        <SelectTrigger aria-labelledby={labelId}>
          <SelectValue placeholder={isLoading ? 'Loading suppliers…' : 'No supplier'} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{fallbackName && value == null ? `Not linked (${fallbackName})` : 'No supplier'}</SelectItem>
          {suppliers.map(s => <SelectItem key={s.id} value={String(s.id)}>{s.name}{s.is_active === false ? ' (inactive)' : ''}</SelectItem>)}
          <SelectSeparator />
          <SelectItem value={ADD}>Add a new supplier…</SelectItem>
        </SelectContent>
      </Select>
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
