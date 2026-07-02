import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { fetchData, patchData, postData } from "@/lib/Api";
import { toast } from "@/lib/toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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

  // Step 2: First vehicle
  const [plate, setPlate] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [vehicleTypeId, setVehicleTypeId] = useState('');
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([]);
  const [loadingTypes, setLoadingTypes] = useState(true);
  const [capacity, setCapacity] = useState('');
  const [fuelType, setFuelType] = useState('DIESEL');
  const [vin, setVin] = useState('');

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

  const handleStep2Submit = async () => {
    if (!plate.trim()) { toast.error('Registration plate is required'); return; }
    if (!make.trim())  { toast.error('Make is required'); return; }
    if (!model.trim()) { toast.error('Model is required'); return; }
    const yearNum = parseInt(year);
    const curYear = new Date().getFullYear();
    if (!year || yearNum < 1990 || yearNum > curYear + 1) {
      toast.error('Enter a valid year (1990–present)');
      return;
    }
    if (!capacity || parseFloat(capacity) <= 0) { toast.error('Capacity is required'); return; }
    if (!vehicleTypeId) { toast.error('Vehicle type is required'); return; }

    setSubmitting(true);
    try {
      await postData({
        url: 'api/v1/vehicles/',
        data: {
          plate: plate.trim().toUpperCase(),
          make,
          model,
          year: yearNum,
          vehicle_type: vehicleTypeId,
          capacity: parseFloat(capacity),
          fuel_type: fuelType,
          type: 'TRUCK',
          ...(vin.trim() ? { vin: vin.trim().toUpperCase() } : {}),
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
              STEP {step} OF 2
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
              width: `${(step / 2) * 100}%`,
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
                  {submitting ? 'SAVING...' : 'CONTINUE'}
                </button>
              </>
            )}
          </div>
        )}

        {/* Vehicle step removed from onboarding — vehicles are optional and
            added later from Fleet (the full vehicle form lives there). */}
        {false && (
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
                {/* Registration Plate */}
                <div style={{ marginBottom: 16 }}>
                  <label style={lblSt}>Registration Plate *</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={(e) => setPlate(e.target.value.toUpperCase())}
                    placeholder="ABC 123 GP"
                    autoFocus
                    style={{ ...inSt, fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                {/* Make + Model */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={lblSt}>Make *</label>
                    <input
                      list="truck-makes"
                      type="text"
                      value={make}
                      onChange={(e) => setMake(e.target.value)}
                      placeholder="Mercedes-Benz"
                      style={inSt}
                    />
                    <datalist id="truck-makes">
                      {['Mercedes-Benz','Volvo','MAN','Scania','DAF','Iveco',
                        'UD Trucks','Hino','Isuzu','Ford','Toyota']
                        .map(m => <option key={m} value={m} />)}
                    </datalist>
                  </div>
                  <div>
                    <label style={lblSt}>Model *</label>
                    <input
                      type="text"
                      value={model}
                      onChange={(e) => setModel(e.target.value)}
                      placeholder="Actros"
                      style={inSt}
                    />
                  </div>
                </div>

                {/* Year + Vehicle Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={lblSt}>Year *</label>
                    <input
                      type="number"
                      min={1990}
                      max={new Date().getFullYear() + 1}
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                      placeholder={new Date().getFullYear().toString()}
                      style={inSt}
                    />
                  </div>
                  <div>
                    <label style={lblSt}>Vehicle Type *</label>
                    <Select value={vehicleTypeId} onValueChange={setVehicleTypeId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {vehicleTypes.map((vt) => (
                          <SelectItem key={vt.id} value={String(vt.id)}>{vt.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Capacity + Fuel Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  <div>
                    <label style={lblSt}>Capacity (tonnes) *</label>
                    <input
                      type="number"
                      min={0.5}
                      max={200}
                      step={0.5}
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      placeholder="30"
                      style={inSt}
                    />
                  </div>
                  <div>
                    <label style={lblSt}>Fuel Type *</label>
                    <Select value={fuelType} onValueChange={setFuelType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="DIESEL">Diesel</SelectItem>
                        <SelectItem value="PETROL">Petrol</SelectItem>
                        <SelectItem value="ELECTRIC">Electric</SelectItem>
                        <SelectItem value="HYBRID">Hybrid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* VIN optional */}
                <div style={{ marginBottom: 24 }}>
                  <label style={lblSt}>
                    VIN{' '}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                      — optional
                    </span>
                  </label>
                  <input
                    type="text"
                    value={vin}
                    onChange={(e) => setVin(e.target.value.toUpperCase())}
                    placeholder="WDB9340321L123456"
                    style={{ ...inSt, fontFamily: 'var(--font-mono)' }}
                  />
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

        {/* Step 2: You're all set */}
        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 64, marginBottom: 16 }}>🚛</div>
            <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
              You're All Set!
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 32, lineHeight: 1.6 }}>
              Your business is ready. Jump in and create your first quote — you can add
              vehicles, drivers and staff any time from the app.
            </div>

            <button
              onClick={handleComplete}
              className="btn-action"
              style={{ width: '100%', marginBottom: 16 }}
            >
              GO TO DASHBOARD
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
