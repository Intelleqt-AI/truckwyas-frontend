import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { patchData, postData } from '@/lib/Api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FinDialog } from './FinDialog';
import { EXPENSE_CATEGORIES } from '@/lib/finance/categories';
import { FIN_URL, errorText } from '@/lib/finance/api';
import { registrationNumberProblem, normaliseRegistrationNumber, vatNumberProblem } from '@/lib/finance/validation';
import type { Supplier, SupplierInput } from '@/lib/finance/types';

const empty = (name = '', category = 'OTHER'): SupplierInput => ({
  name, vat_number: '', registration_number: '', email: '', phone: '', category, is_active: true,
});

/** Add or edit a supplier. Returns the saved supplier so a picker can select it. */
export function SupplierDialog({ supplier, initialName, initialCategory, onClose, onSaved }: {
  supplier?: Supplier;
  initialName?: string;
  initialCategory?: string;
  onClose: () => void;
  onSaved: (s: Supplier) => void;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<SupplierInput>(() => supplier
    ? { name: supplier.name, vat_number: supplier.vat_number || '', registration_number: supplier.registration_number || '', email: supplier.email || '', phone: supplier.phone || '', category: supplier.category || 'OTHER', is_active: supplier.is_active !== false }
    : empty(initialName, initialCategory || 'OTHER'));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const set = <K extends keyof SupplierInput>(k: K, v: SupplierInput[K]) => setForm(f => ({ ...f, [k]: v }));

  const vatProblem = vatNumberProblem(form.vat_number);
  const regProblem = registrationNumberProblem(form.registration_number);
  const valid = !!form.name.trim() && !vatProblem && !regProblem;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setBusy(true); setError('');
    const data: SupplierInput = {
      ...form,
      name: form.name.trim(),
      vat_number: form.vat_number.replace(/[\s-]/g, ''),
      registration_number: form.registration_number ? normaliseRegistrationNumber(form.registration_number) : '',
    };
    try {
      const saved: Supplier = supplier
        ? await patchData({ url: FIN_URL.supplier(supplier.id), data })
        : await postData({ url: FIN_URL.suppliers, data });
      qc.invalidateQueries({ queryKey: ['suppliers'] });
      onSaved(saved);
    } catch (err) {
      setError(errorText(err, "Couldn't save the supplier. Check the fields and try again."));
      setBusy(false);
    }
  };

  return (
    <FinDialog title={supplier ? 'Edit supplier' : 'Add supplier'} onClose={onClose} busy={busy}>
      <form className="fin-form" onSubmit={submit}>
        <div>
          <label className="fin-label" htmlFor="sup-name">Name</label>
          <input id="sup-name" className="fin-control" type="text" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Engen Midrand" required data-autofocus />
        </div>
        <div>
          <label className="fin-label" id="sup-cat-label">Usual category</label>
          <Select value={form.category} onValueChange={v => set('category', v)}>
            <SelectTrigger aria-labelledby="sup-cat-label"><SelectValue /></SelectTrigger>
            <SelectContent>{EXPENSE_CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="fin-help">New expenses from this supplier start in this category.</p>
        </div>
        <div className="fin-form__row">
          <div>
            <label className="fin-label" htmlFor="sup-vat">VAT number <span className="fin-label__hint">Optional</span></label>
            <input id="sup-vat" className="fin-control" type="text" inputMode="numeric" value={form.vat_number} onChange={e => set('vat_number', e.target.value)} placeholder="4XXXXXXXXX"
              aria-invalid={!!vatProblem} aria-describedby="sup-vat-help" />
            <p id="sup-vat-help" className={`fin-help${vatProblem ? ' fin-text-danger' : ''}`}>{vatProblem || 'Needed to claim input VAT on their invoices.'}</p>
          </div>
          <div>
            <label className="fin-label" htmlFor="sup-reg">Registration number <span className="fin-label__hint">Optional</span></label>
            <input id="sup-reg" className="fin-control" type="text" value={form.registration_number} onChange={e => set('registration_number', e.target.value)} placeholder="YYYY/NNNNNN/NN"
              aria-invalid={!!regProblem} aria-describedby="sup-reg-help" />
            <p id="sup-reg-help" className={`fin-help${regProblem ? ' fin-text-danger' : ''}`}>{regProblem || 'CIPC company number.'}</p>
          </div>
        </div>
        <div className="fin-form__row">
          <div>
            <label className="fin-label" htmlFor="sup-email">Email <span className="fin-label__hint">Optional</span></label>
            <input id="sup-email" className="fin-control" type="email" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div>
            <label className="fin-label" htmlFor="sup-phone">Phone <span className="fin-label__hint">Optional</span></label>
            <input id="sup-phone" className="fin-control" type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
        </div>
        {supplier && (
          <label className="fl-check fin-help" style={{ margin: 0 }}>
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} />
            Active (inactive suppliers are hidden from the expense picker)
          </label>
        )}
        {error && <p className="fin-help fin-text-danger" role="alert" style={{ margin: 0 }}>{error}</p>}
        <div className="fin-dialog__foot">
          <button type="button" className="tw-btn" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="tw-btn tw-btn--primary" disabled={busy || !valid}>{busy ? 'Saving…' : supplier ? 'Save changes' : 'Add supplier'}</button>
        </div>
      </form>
    </FinDialog>
  );
}

export default SupplierDialog;
