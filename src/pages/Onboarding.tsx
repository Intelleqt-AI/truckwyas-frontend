import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, patchData, postData } from "@/lib/Api";
import { toast } from "@/lib/toast";

interface CompanyProfile {
  company_name: string;
  industry: string;
  phone: string;
}

interface VehicleType {
  id: number;
  name: string;
}

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);

  // Step 1: Company details
  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('');
  const [phone, setPhone] = useState('');
  const [loadingCompany, setLoadingCompany] = useState(true);

  // Step 2: First vehicle
  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);

  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    // Load company profile
    fetchData('api/v1/company/profile/')
      .then((data: CompanyProfile) => {
        setCompanyName(data.company_name || '');
        setIndustry(data.industry || '');
        setPhone(data.phone || '');
      })
      .catch(() => {
        toast.error('Failed to load company info');
      })
      .finally(() => setLoadingCompany(false));

    // Load vehicle types
    fetchData('api/v1/vehicle-types/')
      .then((data: any) => {
        const arr = Array.isArray(data) ? data : (data?.results || []);
        setVehicleTypes(arr);
        if (arr.length > 0) setVehicleTypeId(arr[0].id.toString());
      })
      .catch(() => {
        setVehicleTypes([]);
      })
      .finally(() => setLoadingTypes(false));
  }, []);

  const handleSkip = () => {
    localStorage.setItem('onboarding_done', 'true');
    navigate('/dashboard');
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
        data: { company_name: companyName, industry, phone },
      });
      toast.success('Company details saved');
      setStep(2);
    } catch {
      toast.error('Failed to save company details');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2Submit = async () => {
    if (!registration.trim()) {
      toast.error('Please enter vehicle registration');
      return;
    }

    setSubmitting(true);
    try {
      await postData({
        url: 'api/v1/vehicles/',
        data: {
          registration,
          make,
          model,
          vehicle_type: vehicleTypeId,
        },
      });
      toast.success('Vehicle added');
      setStep(3);
    } catch {
      toast.error('Failed to add vehicle');
    } finally {
      setSubmitting(false);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding_done', 'true');
    navigate('/dashboard');
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
        maxWidth: 520,
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--card-radius)',
        padding: 40,
      }}>
        {/* Progress bar */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              STEP {step} OF 3
            </span>
            <button onClick={handleSkip} style={{
              background: 'none', border: 'none', color: 'var(--text-tertiary)',
              fontSize: 11, fontFamily: 'var(--font-mono)', cursor: 'pointer',
            }}>
              SKIP →
            </button>
          </div>
          <div style={{ height: 4, background: 'var(--border-subtle)', borderRadius: 2 }}>
            <div style={{
              height: '100%',
              width: `${(step / 3) * 100}%`,
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
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Loading...
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
                    marginBottom: 6,
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
                      padding: '10px 14px',
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
                    marginBottom: 6,
                  }}>
                    Industry
                  </label>
                  <select
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    <option value="">Select industry</option>
                    <option value="general_freight">General Freight</option>
                    <option value="refrigerated">Refrigerated Transport</option>
                    <option value="hazmat">Hazmat / Dangerous Goods</option>
                    <option value="construction">Construction Materials</option>
                    <option value="agriculture">Agriculture</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 6,
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
                      padding: '10px 14px',
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
                  {submitting ? 'SAVING...' : 'CONTINUE'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Step 2: Add First Vehicle */}
        {step === 2 && (
          <div>
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
                Add Your First Vehicle
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                Start building your fleet
              </div>
            </div>

            {loadingTypes ? (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-tertiary)' }}>
                Loading...
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
                    marginBottom: 6,
                  }}>
                    Registration *
                  </label>
                  <input
                    type="text"
                    value={registration}
                    onChange={(e) => setRegistration(e.target.value.toUpperCase())}
                    placeholder="ABC 123 GP"
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      fontFamily: 'var(--font-mono)',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      color: 'var(--text-tertiary)',
                      marginBottom: 6,
                    }}>
                      Make
                    </label>
                    <input
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="Mercedes-Benz"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 2,
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                  <div>
                    <label style={{
                      display: 'block',
                      fontSize: 11,
                      fontFamily: 'var(--font-mono)',
                      textTransform: 'uppercase' as const,
                      letterSpacing: '0.08em',
                      color: 'var(--text-tertiary)',
                      marginBottom: 6,
                    }}>
                      Model
                    </label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Actros"
                      style={{
                        width: '100%',
                        padding: '10px 14px',
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 2,
                        color: 'var(--text-primary)',
                        fontSize: 13,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{
                    display: 'block',
                    fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    textTransform: 'uppercase' as const,
                    letterSpacing: '0.08em',
                    color: 'var(--text-tertiary)',
                    marginBottom: 6,
                  }}>
                    Vehicle Type
                  </label>
                  <select
                    value={vehicleTypeId}
                    onChange={(e) => setVehicleTypeId(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      background: 'var(--input-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 2,
                      color: 'var(--text-primary)',
                      fontSize: 13,
                      outline: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {vehicleTypes.map((vt) => (
                      <option key={vt.id} value={vt.id}>
                        {vt.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  <button
                    onClick={() => setStep(1)}
                    style={{
                      background: 'none',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)',
                      padding: '10px 20px',
                      fontFamily: 'var(--font-mono)',
                      fontSize: 11,
                      borderRadius: 2,
                      cursor: 'pointer',
                    }}
                  >
                    BACK
                  </button>
                  <button
                    onClick={handleStep2Submit}
                    disabled={submitting}
                    className="btn-action"
                    style={{ flex: 1 }}
                  >
                    {submitting ? 'ADDING...' : 'ADD VEHICLE'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚛</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              You're All Set!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              Your account is ready. Start managing your fleet, creating quotes, and tracking loads.
            </div>

            <button
              onClick={handleComplete}
              className="btn-action"
              style={{ width: '100%', marginBottom: 16 }}
            >
              GO TO DASHBOARD
            </button>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, fontSize: 12 }}>
              <a href="/bookings/new" style={{
                padding: '10px',
                background: 'var(--bg-deep)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 2,
                color: 'var(--text-secondary)',
                textDecoration: 'none',
                display: 'block',
              }}>
                + Add Load
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
                + Add Driver
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
