import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchData } from '@/lib/Api';

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
}

export interface LocationCoords {
  lat: number;
  lon: number;
}

interface LocationInputProps {
  value: string;
  onChange: (value: string, coords?: LocationCoords) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  onFocus?: () => void;
  resolvedText?: string;
}

export function LocationInput({ value, onChange, placeholder, style, onFocus, resolvedText }: LocationInputProps) {
  const [mode, setMode] = useState<'search' | 'gps'>('search');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const fetchSuggestions = useCallback((q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(q)}`)
      .then((data: Suggestion[]) => {
        const results = data || [];
        setSuggestions(results);
        setOpen(results.length > 0);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 300);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.label, { lat: s.lat, lon: s.lon });
    setSuggestions([]);
    setOpen(false);
  };

  const handleGpsChange = (newLat: string, newLng: string) => {
    const parsedLat = parseFloat(newLat);
    const parsedLng = parseFloat(newLng);
    if (!isNaN(parsedLat) && !isNaN(parsedLng) && newLat && newLng) {
      onChange(`${parsedLat}, ${parsedLng}`, { lat: parsedLat, lon: parsedLng });
    } else {
      onChange('');
    }
  };

  const switchToGps = () => {
    setMode('gps');
    setSuggestions([]);
    setOpen(false);
    // Pre-fill if value looks like coords already
    const parts = value.split(',').map(s => s.trim());
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      setLat(parts[0]);
      setLng(parts[1]);
    } else {
      setLat('');
      setLng('');
      onChange('');
    }
  };

  const switchToSearch = () => {
    setMode('search');
    setLat('');
    setLng('');
    onChange('');
  };

  const toggleLink: React.CSSProperties = {
    background: 'none',
    border: 'none',
    padding: 0,
    marginTop: 4,
    fontFamily: 'var(--font-mono)',
    fontSize: 10,
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    letterSpacing: '0.04em',
    display: 'block',
    textAlign: 'right' as const,
  };

  const gpsInputStyle: React.CSSProperties = {
    ...style,
    flex: 1,
  };

  if (mode === 'gps') {
    return (
      <div ref={containerRef}>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              placeholder="Latitude (e.g. -33.9249)"
              value={lat}
              onChange={e => { setLat(e.target.value); handleGpsChange(e.target.value, lng); }}
              style={gpsInputStyle}
              step="any"
            />
          </div>
          <div style={{ flex: 1 }}>
            <input
              type="number"
              placeholder="Longitude (e.g. 18.4241)"
              value={lng}
              onChange={e => { setLng(e.target.value); handleGpsChange(lat, e.target.value); }}
              style={gpsInputStyle}
              step="any"
            />
          </div>
        </div>
        <button type="button" style={toggleLink} onClick={switchToSearch}>
          ← Search by address
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleSearchChange}
        onFocus={() => { suggestions.length > 0 && setOpen(true); onFocus?.(); }}
        style={style}
        autoComplete="off"
      />
      {loading && (
        <div style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 10, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)', pointerEvents: 'none',
        }}>
          ...
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          zIndex: 1100, maxHeight: 220, overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '9px 12px', fontSize: 12, cursor: 'pointer',
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                lineHeight: 1.4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {s.label}
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <button type="button" style={{ ...toggleLink, marginTop: 4 }} onClick={switchToGps}>
          Enter GPS coordinates →
        </button>
        {resolvedText && <ResolvedInfo text={resolvedText} />}
      </div>
    </div>
  );
}

function ResolvedInfo({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', color: 'var(--text-tertiary)', fontSize: 13, lineHeight: 1, userSelect: 'none', marginTop: 4 }}
        aria-label={text}
      >
        ⓘ
      </span>
      {show && (
        <div style={{
          position: 'absolute', bottom: '100%', right: 0, zIndex: 20, marginBottom: 6,
          background: '#fff', border: '1px solid var(--border-subtle)',
          borderRadius: 4, padding: '8px 12px',
          fontSize: 10, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)',
          whiteSpace: 'nowrap', boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}
