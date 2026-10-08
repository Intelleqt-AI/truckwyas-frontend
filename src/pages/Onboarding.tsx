import "./auth-brand.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, patchData, postData } from "@/lib/Api";
import { vatNumberProblem } from "@/lib/finance/validation";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { PasteImportPanel, type ImportEntity } from '@/components/import/PasteImportDrawer';

interface CompanyProfile {
  company_name: string;
  industry: string;
  contact?: { phone?: string; email?: string };
  vat_number?: string;
  vat_registered?: boolean;
}

interface VehicleType {
  id: number;
  name: string;
}

export function Onboarding() {
  const navigate = useNavigate();

  // Onboarding is only for admins — redirect everyone else to the dashboard
  useEffect(() => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    if (storedUser?.role?.toUpperCase() !== 'ADMIN') {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const [step, setStep] = useState(1);

  // Step 1: Company details
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  // Asked once, here, so a business that isn't a VAT vendor never issues
  // tax invoices with VAT on them (Company.vat_registered defaults to on).
  const [vatRegistered, setVatRegistered] = useState<'yes' | 'no' | ''>('');
  const [vatNumber, setVatNumber] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(true);

  // Steps 2 and 3 are imports; both are skippable, so all they track is how
  // many landed, to confirm it on screen and on the final step.
  const [customersImported, setCustomersImported] = useState(0);
  const [vehiclesImported, setVehiclesImported] = useState(0);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load company profile
    fetchData('api/v1/company/profile/')
      .then((data: CompanyProfile) => {
        setCompanyName(data.company_name || '');
        setIndustry(data.industry || '');
        setPhone(data.contact?.phone || '');
        setVatNumber(data.vat_number || '');
        // Only a number already on file answers the question for them.
        if ((data.vat_number || '').trim()) setVatRegistered('yes');
      })
      .catch(() => {
        toast.error('Failed to load company info');
      })
      .finally(() => setLoadingCompany(false));

  }, []);

  const handleSkip = () => {
    localStorage.setItem('onboarding_done', 'true');
    patchData({
      url: 'api/v1/company/profile/',
      data: { onboarding_completed_at: new Date().toISOString() },
    }).catch(() => { /* localStorage flag still covers this session */ });
    navigate('/');
  };

  const handleStep1Submit = async () => {
    if (!companyName.trim()) {
      toast.error('Please enter company name');
      return;
    }
    if (!vatRegistered) {
      toast.error('Please say whether you are registered for VAT');
      return;
    }
    const vatProblem = vatRegistered === 'yes' ? vatNumberProblem(vatNumber) : null;
    if (vatProblem) {
      toast.error(vatProblem);
      return;
    }

    setSubmitting(true);
    try {
      await patchData({
        url: 'api/v1/company/profile/',
        data: {
          company_name: companyName, industry, contact: { phone },
          vat_registered: vatRegistered === 'yes',
          ...(vatRegistered === 'yes' ? { vat_number: vatNumber.replace(/[\s-]/g, '') } : {}),
        },
      });
      toast.success('Company details saved');
      setStep(2);
    } catch {
      toast.error('Failed to save company details');
    } finally {
      setSubmitting(false);
    }
  };


  const handleComplete = () => {
    localStorage.setItem('onboarding_done', 'true');
    patchData({
      url: 'api/v1/company/profile/',
      data: { onboarding_completed_at: new Date().toISOString() },
    }).catch(() => { /* localStorage flag still covers this session */ });
    navigate('/');
  };

  const lblSt: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    lineHeight: '20px',
    fontWeight: 500,
    fontFamily: 'var(--font-sans)',
    color: 'var(--text-primary)',
    marginBottom: 6,
  };

  const inSt: React.CSSProperties = {
    width: '100%',
    padding: '8px 12px',
    minHeight: 40,
    background: 'var(--input-bg)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-control)',
    color: 'var(--text-primary)',
    fontSize: 14,
    lineHeight: '20px',
    boxSizing: 'border-box',
  };

  const selSt: React.CSSProperties = {
    ...inSt,
    cursor: 'pointer',
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-deep)',
      padding: 16,
      boxSizing: 'border-box',
    }}>
      <div style={{
        width: '100%',
        // The import steps carry a preview table; 520 is right for a form but
        // squeezes nine columns into nothing.
        maxWidth: step === 2 || step === 3 ? 820 : 520,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-card)',
        padding: 24,
        boxSizing: 'border-box',
      }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 24 }}>
          {/* A grid, not space-between: the step count stays centred whether or
              not Back is showing, instead of shifting as it appears. */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', marginBottom: 8,
          }}>
            <div style={{ justifySelf: 'start' }}>
              {/* Nothing to go back to on the first step, and a dead control
                  reads as a fault. */}
              {step > 1 && step < 4 && (
                <button onClick={() => setStep(step - 1)} style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0, minHeight: 40,
                }}>
                  ← Back
                </button>
              )}
            </div>
            <span style={{ fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-tertiary)', fontVariantNumeric: 'tabular-nums' }}>
              Step {step} of 4
            </span>
            {/* Nothing left to skip on the final screen — setup is already
                done and "Go to dashboard" is the way out. */}
            {step < 4 && (
              <button
                onClick={() => (step === 2 || step === 3 ? setStep(step + 1) : handleSkip())}
                title={step === 2 || step === 3 ? 'Move on without importing' : 'Finish setup later'}
                style={{
                  justifySelf: 'end',
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: 13, lineHeight: '20px', fontWeight: 500, fontFamily: 'var(--font-sans)', cursor: 'pointer', padding: 0, minHeight: 40,
                }}>
                {step === 2 || step === 3 ? 'Skip this →' : 'Skip →'}
              </button>
            )}
          </div>
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 999 }}>
            <div style={{
              height: '100%',
              width: `${(step / 4) * 100}%`,
              background: 'var(--accent-primary)',
              borderRadius: 999,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
                Welcome to TruckWys
              </h1>
              <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
                Let's get your company set up
              </div>
            </div>

            {loadingCompany ? (
              <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
                <Loader size={32} />
              </div>
            ) : (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="onboarding-company-name" style={{
                    display: 'block',
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}>
                    Company name *
                  </label>
                  <input className="tw-auth-control" id="onboarding-company-name"
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ACME Logistics (Pty) Ltd"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                    lineHeight: '20px',
                  }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label htmlFor="onboarding-industry" style={{
                    display: 'block',
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}>
                    Industry
                  </label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger id="onboarding-industry">
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_freight">General freight</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated transport</SelectItem>
                      <SelectItem value="hazmat">Hazmat / dangerous goods</SelectItem>
                      <SelectItem value="construction">Construction materials</SelectItem>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label htmlFor="onboarding-phone" style={{
                    display: 'block',
                    fontSize: 13,
                    lineHeight: '20px',
                    fontWeight: 500,
                    fontFamily: 'var(--font-sans)',
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                  }}>
                    Phone
                  </label>
                  <input className="tw-auth-control" id="onboarding-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+27 11 123 4567"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                    minHeight: 40,
                    boxSizing: 'border-box',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-control)',
                      color: 'var(--text-primary)',
                      fontSize: 14,
                    lineHeight: '20px',
                  }}
                  />
                </div>

                <fieldset style={{ border: 0, padding: 0, margin: '0 0 24px' }}>
                  <legend style={{ ...lblSt, padding: 0 }}>Are you registered for VAT with SARS?</legend>
                  <div className="ob-vat-choice">
                    {([['yes', 'Yes, we charge VAT'], ['no', 'No, not VAT registered']] as const).map(([v, text]) => (
                      <label key={v} className={`ob-vat-choice__opt${vatRegistered === v ? ' is-on' : ''}`}>
                        <input type="radio" name="onboarding-vat" value={v} checked={vatRegistered === v}
                          onChange={() => setVatRegistered(v)} />
                        {text}
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)', marginTop: 6 }}>
                    {vatRegistered === 'no'
                      ? 'Your invoices and quotes will show no VAT. You can change this later in Settings → Company.'
                      : 'VAT vendors add 15% VAT to quotes and tax invoices. You can change this later in Settings → Company.'}
                  </div>
                  {vatRegistered === 'yes' && (
                    <div style={{ marginTop: 16 }}>
                      <label htmlFor="onboarding-vat-number" style={lblSt}>VAT number <span style={{ fontWeight: 400, color: 'var(--text-tertiary)' }}>(optional)</span></label>
                      <input className="tw-auth-control" id="onboarding-vat-number" inputMode="numeric"
                        value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} placeholder="4XXXXXXXXX"
                        aria-invalid={!!vatNumberProblem(vatNumber)}
                        style={{ width: '100%', padding: '8px 12px', minHeight: 40, boxSizing: 'border-box', background: 'var(--input-bg)',
                          border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-control)', color: 'var(--text-primary)',
                          fontSize: 14, lineHeight: '20px' }} />
                      {vatNumberProblem(vatNumber) && (
                        <div role="alert" style={{ fontSize: 13, lineHeight: '20px', color: 'var(--status-danger-text)', marginTop: 4 }}>{vatNumberProblem(vatNumber)}</div>
                      )}
                    </div>
                  )}
                </fieldset>

                <button
                  onClick={handleStep1Submit}
                  disabled={submitting}
                  className="btn-action"
                  style={{ width: '100%', borderRadius: 'var(--radius-control)' }}
                >
                  {submitting ? 'Saving…' : 'Continue'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Customers — bring the list they already have */}
        {step === 2 && (
          <ImportStep
            title="Import your customers"
            blurb="Already have them in a spreadsheet? Paste the list straight in and we work out which column is which. You can always add them later instead."
            entity="customers"
            imported={customersImported}
            onImported={setCustomersImported}
            onNext={() => setStep(3)}
          />
        )}

        {/* Step 3: Vehicles */}
        {step === 3 && (
          <ImportStep
            title="Import your fleet"
            blurb="Paste your vehicle list the same way. Registration, type and capacity are what a quote needs; anything else you have is a bonus."
            entity="vehicles"
            imported={vehiclesImported}
            onImported={setVehiclesImported}
            onNext={() => setStep(4)}
          />
        )}

        {/* Step 4: You're all set */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 8px' }}>
              You're all set!
            </h1>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 24, lineHeight: '20px' }}>
              {customersImported > 0 || vehiclesImported > 0 ? (
                <>
                  {[customersImported > 0 ? `${customersImported} customers` : null,
                    vehiclesImported > 0 ? `${vehiclesImported} vehicles` : null]
                    .filter(Boolean).join(' and ')} imported. Jump in and price your first
                  load. You can add more any time from the app.
                </>
              ) : (
                <>
                  Your business is ready. Jump in and create your first quote. You can
                  import your customers and fleet any time from the app.
                </>
              )}
            </div>

            <button
              onClick={handleComplete}
              className="btn-action"
              style={{ width: '100%', marginBottom: 16, borderRadius: 'var(--radius-control)' }}
            >
              Go to dashboard
            </button>

            {/* Vehicles were just offered as their own step, so pointing back
                at Fleet here asked again for something already answered. */}
            <a href="/bookings/quotes/new" style={{
              padding: '10px 16px',
              minHeight: 40,
              boxSizing: 'border-box',
              background: 'var(--bg-deep)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-control)',
              color: 'var(--text-secondary)',
              textDecoration: 'none',
              display: 'block',
              fontSize: 13,
              lineHeight: '20px',
            }}>
              + Create a quote
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * One onboarding step that imports a list.
 *
 * The panel sits in the step itself rather than sliding a drawer over it: this
 * IS the step, and covering the wizard to do the one thing the wizard is asking
 * for hides the progress bar and the way past it.
 *
 * Skippable by design — plenty of people sign up on a phone, nowhere near the
 * spreadsheet, and a wizard that traps them there is worse than one they finish
 * in ten seconds.
 */
function ImportStep({
  title, blurb, entity, imported, onImported, onNext,
}: {
  title: string;
  blurb: string;
  entity: ImportEntity;
  imported: number;
  onImported: (n: number) => void;
  /** Called once something lands, so the wizard can offer the way forward. */
  onNext: () => void;
}) {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, lineHeight: '28px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>
          {title}
        </h1>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: '20px' }}>
          {blurb}
        </div>
      </div>

      {/* The wizard already has the heading, so the panel does without one. */}
      <PasteImportPanel
        entity={entity}
        showHeading={false}
        onImported={n => { onImported(imported + n); onNext(); }}
      />

    </div>
  );
}
