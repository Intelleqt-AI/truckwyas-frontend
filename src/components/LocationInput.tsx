import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import { fetchData, postData } from '@/lib/Api';
import { History } from 'lucide-react';

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
  const inputRef = useRef<HTMLInputElement>(null);
  // Presentation only (R11): the list may be wider than a narrow field so a
  // place's suburb isn't cut off (at least 320px on phones, 400px on wider
  // screens), kept inside the viewport with a 16px gutter by shifting it
  // left when the field sits near the right edge.
  const [listBox, setListBox] = useState<{ left: number; width: number } | null>(null);
  const listOpen = open && suggestions.length > 0;
  useLayoutEffect(() => {
    if (!listOpen || !inputRef.current) return;
    const place = () => {
      const r = inputRef.current?.getBoundingClientRect();
      if (!r) return;
      const vw = document.documentElement.clientWidth;
      const gutter = 16;
      const floor = vw <= 640 ? 320 : 400;
      const width = Math.round(Math.max(r.width, Math.min(floor, vw - 2 * gutter)));
      let left = 0;
      if (r.left + width > vw - gutter) left = vw - gutter - width - r.left;
      if (r.left + left < gutter) left = gutter - r.left;
      setListBox({ left: Math.round(left), width });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [listOpen]);
  // Rows are 44px on phones and touch screens (the touch floor).
  const coarse = typeof window !== 'undefined' && !!window.matchMedia?.('(max-width: 768px), (pointer: coarse)').matches;

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
    fontFamily: 'var(--font-sans)',
    fontSize: 13,
    lineHeight: '20px',
    color: 'var(--accent-primary)',
    cursor: 'pointer',
    letterSpacing: 'normal',
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
    <div ref={containerRef}>
      {/* The list anchors to the input's own box, not to the wrapper that
          also holds the GPS link, so it opens directly under the field. */}
      <div style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleSearchChange}
        onFocus={() => {
          if (suggestions.length > 0) setOpen(true);
          else if (!value) fetchRecentOnFocus();
          onFocus?.();
        }}
        onKeyDown={e => {
          // Escape closes the list only; the typed text stays as it is.
          if (e.key === 'Escape' && open) { e.preventDefault(); e.stopPropagation(); setOpen(false); }
        }}
        style={style}
        autoComplete="off"
      />
      {loading && (
        <div style={{
          position: 'absolute', right: 10, top: '50%',
          transform: 'translateY(-50%)',
          fontSize: 13, color: 'var(--text-secondary)',
          fontFamily: 'var(--font-sans)', pointerEvents: 'none',
        }}>
          ...
        </div>
      )}
      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)',
          ...(listBox ? { left: listBox.left, width: listBox.width } : { left: 0, right: 0 }),
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-control)',
          boxShadow: 'var(--shadow-pop)',
          zIndex: 1100, maxHeight: 220, overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                padding: coarse ? '12px 12px' : '10px 12px', minHeight: coarse ? 44 : 40, boxSizing: 'border-box', fontSize: 14, cursor: 'pointer',
                color: 'var(--text-primary)', fontFamily: 'var(--font-sans)',
                borderBottom: i < suggestions.length - 1 ? '1px solid var(--border-row)' : 'none',
                lineHeight: '20px',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-tint-hover)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* The row is a flex box, which never ellipsises its own text:
                  the label gets an inner span that wraps to at most two lines
                  (R11: the suburb is what tells rows apart), full text in title. */}
              <span title={s.label} style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
                {s.is_recent && <span title="Used before" aria-label="Used before" style={{ flexShrink: 0, display: 'inline-flex', color: 'var(--text-secondary)' }}><History size={14} aria-hidden="true" /></span>}
                <span style={{ minWidth: 0, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 2, overflowWrap: 'anywhere' }}>{s.label}</span>
              </span>
              {s.cross_border && (
                <span
                  title={`Cross-border: ${s.country || 'outside South Africa'}`}
                  style={{
                    flexShrink: 0, fontSize: 13, lineHeight: '20px', fontWeight: 500, letterSpacing: 'normal',
                    padding: '2px 8px', borderRadius: 'var(--radius-chip)', whiteSpace: 'nowrap',
                    color: 'var(--status-warning-text, var(--status-warning))',
                    background: 'color-mix(in srgb, var(--status-warning) 15%, transparent)',
                    border: '1px solid var(--status-warning)',
                  }}
                >
                  {(s.country_code || 'INTL').replace('ZAF', '')} · Cross-border
                </span>
              )}
            </div>
          ))}
        </div>
      )}
      </div>
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
          background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-control)', padding: '8px 12px',
          fontSize: 13, lineHeight: '20px', fontFamily: 'var(--font-sans)', color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          {text}
        </div>
      )}
    </span>
  );
}
