import { useState, useRef, useEffect, useCallback } from 'react';
import { fetchData, postData } from '@/lib/Api';

interface Suggestion {
  label: string;
  lat: number;
  lon: number;
  country?: string;
  country_code?: string;
  cross_border?: boolean;
  is_recent?: boolean;
}

// Fire-and-forget: record a picked location into the company's shared
// history (core/views.py's LocationRecentView) so it surfaces first next
// time anyone on the team searches or focuses an empty field. Never blocks
// or fails the actual selection — errors are swallowed on purpose.
function recordLocationPick(label: string, lat: number, lon: number) {
  postData({ url: 'api/v1/location/recent/', data: { location_text: label, lat, lon } }).catch(() => {});
}

// Merge recent-history matches ahead of live geocoding results, deduped by
// label (case-insensitive) so nothing shows twice.
function mergeSuggestions(recent: Suggestion[], live: Suggestion[]): Suggestion[] {
  const seen = new Set(recent.map(s => s.label.toLowerCase()));
  return [...recent, ...live.filter(s => !seen.has(s.label.toLowerCase()))];
}

export interface LocationCoords {
  lat: number;
  lon: number;
  country_code?: string;  // ISO from the picked suggestion; drives cross-border detection
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
    // Recent-history matches and live geocoding results are independent
    // sources — fetch both in parallel and merge, so a slow/failed TomTom
    // call never blocks the (usually much faster) history lookup.
    Promise.all([
      fetchData(`api/v1/location/recent/?q=${encodeURIComponent(q)}`).catch(() => []),
      fetchData(`api/v1/location/suggest/?q=${encodeURIComponent(q)}`).catch(() => []),
    ])
      .then(([recent, live]: [Suggestion[], Suggestion[]]) => {
        const results = mergeSuggestions(recent || [], live || []);
        setSuggestions(results);
        setOpen(results.length > 0);
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false));
  }, []);

  // Empty field + focus: show the company's recent/frequent locations —
  // today's LocationSuggestView never fires for a query this short, so
  // without this an empty field's focus does nothing.
  const fetchRecentOnFocus = useCallback(() => {
    fetchData('api/v1/location/recent/')
      .then((data: Suggestion[]) => {
        const results = data || [];
        setSuggestions(results);
        setOpen(results.length > 0);
      })
      .catch(() => {});
  }, []);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 300);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.label, { lat: s.lat, lon: s.lon, country_code: s.country_code });
    recordLocationPick(s.label, s.lat, s.lon);
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
    // Pre-fill if value looks like coords already; otherwise just leave the
    // two GPS fields blank for fresh input. Deliberately does NOT clear an
    // existing address value here — merely opening this toggle shouldn't
    // wipe a location that was already set correctly; it's only replaced
    // once the user actually types real coordinates (handleGpsChange).
    const parts = value.split(',').map(s => s.trim());
    if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1]))) {
      setLat(parts[0]);
      setLng(parts[1]);
    } else {
      setLat('');
      setLng('');
    }
  };

  const switchToSearch = () => {
    setMode('search');
    setLat('');
    setLng('');
    // Same principle as switchToGps: merely toggling back to the search view
    // must not erase whatever value was already set (an untouched original
    // address, or real coordinates just entered in GPS mode) — only actually
    // typing a new search value should change it.
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
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          else if (!value) fetchRecentOnFocus();
          onFocus?.();
        }}
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
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: '9px 12px', fontSize: 12, cursor: 'pointer',
                color: 'var(--text-primary)', fontFamily: 'var(--font-mono)',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                lineHeight: 1.4,
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.is_recent && <span title="Used before" style={{ flexShrink: 0, opacity: 0.6 }}>🕘</span>}
                {s.label}
              </span>
              {s.cross_border && (
                <span
                  title={`Cross-border — ${s.country || 'outside South Africa'}`}
                  style={{
                    flexShrink: 0, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                    padding: '2px 6px', borderRadius: 3,
                    color: 'var(--status-warning)',
                    background: 'color-mix(in srgb, var(--status-warning) 15%, transparent)',
                    border: '1px solid var(--status-warning)',
                  }}
                >
                  {(s.country_code || 'INTL').replace('ZAF', '')} · CROSS-BORDER
                </span>
              )}
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
