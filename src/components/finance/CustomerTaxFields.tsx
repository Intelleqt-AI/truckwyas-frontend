import type { CSSProperties } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { COUNTRIES, registrationNumberProblem, vatNumberProblem } from '@/lib/finance/validation';
import type { CustomerTaxValues } from '@/lib/finance/customerTax';

/**
 * Country, VAT number and company registration number for the customer
 * forms. South African formats are hinted as the user types; the server
 * validates and normalises on save.
 */
export function CustomerTaxFields({ idPrefix, value, onChange, fieldStyle, labelStyle }: {
  idPrefix: string;
  value: CustomerTaxValues;
  onChange: (v: CustomerTaxValues) => void;
  fieldStyle: CSSProperties;
  labelStyle: CSSProperties;
}) {
  const za = value.country === 'ZA';
  const vatProblem = vatNumberProblem(value.vat_number, value.country);
  const regProblem = registrationNumberProblem(value.registration_number, value.country);
  const help: CSSProperties = { fontSize: 13, lineHeight: '20px', margin: '6px 0 0', color: 'var(--text-tertiary)' };
  const bad: CSSProperties = { ...help, color: 'var(--status-danger-text)' };
  const countries = COUNTRIES.some(c => c.code === value.country) ? COUNTRIES : [...COUNTRIES, { code: value.country, label: value.country }];
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} id={`${idPrefix}-country-label`}>Country</label>
        <Select value={value.country} onValueChange={country => onChange({ ...value, country })}>
          <SelectTrigger aria-labelledby={`${idPrefix}-country-label`}><SelectValue /></SelectTrigger>
          <SelectContent>{countries.map(c => <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} htmlFor={`${idPrefix}-vat`}>VAT number</label>
        <input id={`${idPrefix}-vat`} className="qi-input" type="text" inputMode={za ? 'numeric' : 'text'} style={fieldStyle}
          placeholder={za ? '4XXXXXXXXX' : 'Tax number'} value={value.vat_number} aria-invalid={!!vatProblem} aria-describedby={`${idPrefix}-vat-help`}
          onChange={e => onChange({ ...value, vat_number: e.target.value })} />
        <p id={`${idPrefix}-vat-help`} style={vatProblem ? bad : help}>
          {vatProblem || (za ? '10 digits starting with 4. Printed on tax invoices to VAT vendors.' : 'As the customer gives it.')}
        </p>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={labelStyle} htmlFor={`${idPrefix}-reg`}>Company registration number</label>
        <input id={`${idPrefix}-reg`} className="qi-input" type="text" style={fieldStyle}
          placeholder={za ? 'YYYY/NNNNNN/NN' : 'Registration number'} value={value.registration_number} aria-invalid={!!regProblem} aria-describedby={`${idPrefix}-reg-help`}
          onChange={e => onChange({ ...value, registration_number: e.target.value })} />
        <p id={`${idPrefix}-reg-help`} style={regProblem ? bad : help}>
          {regProblem || (za ? 'CIPC number, e.g. 2015/123456/07.' : 'Optional.')}
        </p>
      </div>
    </>
  );
}

export default CustomerTaxFields;
