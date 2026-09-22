import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, patchData, postData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader } from '@/components/Loader';
import { PasteImportPanel, type ImportEntity } from '@/components/import/PasteImportDrawer';

interface CompanyProfile {
  company_name: string;
  industry: string;
  contact?: { phone?: string; email?: string };
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

    setSubmitting(true);
    try {
      await patchData({
        url: 'api/v1/company/profile/',
        data: { company_name: companyName, industry, contact: { phone } },
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
    fontSize: 11,
    fontFamily: 'var(--font-mono)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: 'var(--text-tertiary)',
    marginBottom: 6,
  };

  const inSt: React.CSSProperties = {
    width: '100%',
    padding: '10px 14px',
    background: 'var(--input-bg)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 2,
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
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
      padding: 20,
    }}>
      <div style={{
        width: '100%',
        // The import steps carry a preview table; 520 is right for a form but
        // squeezes nine columns into nothing.
        maxWidth: step === 2 || step === 3 ? 820 : 520,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        padding: 40,
      }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
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
                  background: 'none', border: 'none', color: 'var(--text-tertiary)',
                  fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', padding: 0,
                }}>
                  ← Back
                </button>
              )}
            </div>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              STEP {step} OF 4
            </span>
            <button onClick={handleSkip} style={{
              justifySelf: 'end',
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer', padding: 0,
            }}>
              Skip →
            </button>
          </div>
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${(step / 4) * 100}%`,
              background: 'var(--accent-primary)',
              borderRadius: 2,
              transition: 'width 0.3s ease',
            }} />
          </div>
        </div>

        {/* Step 1: Company Details */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Welcome to Truckwys
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
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
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 8,
                  }}>
                    Company Name *
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="ACME Logistics (Pty) Ltd"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 8,
                  }}>
                    Industry
                  </label>
                  <Select value={industry} onValueChange={setIndustry}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general_freight">General Freight</SelectItem>
                      <SelectItem value="refrigerated">Refrigerated Transport</SelectItem>
                      <SelectItem value="hazmat">Hazmat / Dangerous Goods</SelectItem>
                      <SelectItem value="construction">Construction Materials</SelectItem>
                      <SelectItem value="agriculture">Agriculture</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 8,
                  }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+27 11 123 4567"
                    style={{
                      width: '100%',
                      padding: '10px 12px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>

                <button
                  onClick={handleStep1Submit}
                  disabled={submitting}
                  className="btn-action"
                  style={{ width: '100%' }}
                >
                  {submitting ? 'Saving...' : 'Continue'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Customers — bring the list they already have */}
        {step === 2 && (
          <ImportStep
            title="Import your customers"
            blurb="Already have them in a spreadsheet? Paste the list straight in — we work out which column is which. You can always add them later instead."
            entity="customers"
            imported={customersImported}
            onImported={setCustomersImported}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
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
            onBack={() => setStep(2)}
          />
        )}

        {/* Step 4: You're all set */}
        {step === 4 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚛</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              You're all set!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              {customersImported > 0 || vehiclesImported > 0 ? (
                <>
                  {[customersImported > 0 ? `${customersImported} customers` : null,
                    vehiclesImported > 0 ? `${vehiclesImported} vehicles` : null]
                    .filter(Boolean).join(' and ')} imported. Jump in and price your first
                  load — you can add more any time from the app.
                </>
              ) : (
                <>
                  Your business is ready. Jump in and create your first quote — you can
                  import your customers and fleet any time from the app.
                </>
              )}
            </div>

            <button
              onClick={handleComplete}
              className="btn-action"
              style={{ width: '100%', marginBottom: 16 }}
            >
              Go to dashboard
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
              <a href="/bookings/quotes/new" style={{
                padding: '10px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                display: 'block',
              }}>
                + Create a quote
              </a>
              <a href="/fleet" style={{
                padding: '10px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                display: 'block',
              }}>
                + Add a vehicle
              </a>
            </div>
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
  title, blurb, entity, imported, onImported, onNext, onBack,
}: {
  title: string;
  blurb: string;
  entity: ImportEntity;
  imported: number;
  onImported: (n: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const noun = entity === 'customers' ? 'customers' : 'vehicles';

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
          {title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          {blurb}
        </div>
      </div>

      {imported > 0 && (
        <div style={{
          border: '1px solid var(--status-success)', borderRadius: 4, padding: '12px 16px',
          marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)',
        }}>
          <span style={{ color: 'var(--status-success)', fontWeight: 500 }}>
            {imported} {noun} imported.
          </span>{' '}
          Paste more below, or carry on.
        </div>
      )}

      {/* The wizard already has the heading, so the panel does without one. */}
      <PasteImportPanel
        entity={entity}
        showHeading={false}
        onImported={n => onImported(imported + n)}
      />

      <div style={{ display: 'flex', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-subtle)' }}>
        <button
          onClick={onBack}
          style={{
            background: 'none', border: '1px solid var(--border-subtle)',
            color: 'var(--text-secondary)', padding: '0 16px', borderRadius: 4,
            fontSize: 12, cursor: 'pointer',
          }}
        >Back</button>
        <button className="btn-action" onClick={onNext} style={{ flex: 1 }}>
          {imported > 0 ? 'Continue' : 'Skip for now'}
        </button>
      </div>
    </div>
  );
}
