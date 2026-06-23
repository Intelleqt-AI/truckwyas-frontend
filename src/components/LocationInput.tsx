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
}

export function LocationInput({ value, onChange, placeholder, style }: LocationInputProps) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
    if (q.length < 2) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(e.target.value), 300);
  };

  const handleSelect = (s: Suggestion) => {
    onChange(s.label, { lat: s.lat, lon: s.lon });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
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
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px',
          zIndex: 200,
          maxHeight: 220,
          overflowY: 'auto',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>
          {suggestions.map((s, i) => (
            <div
              key={i}
              onMouseDown={() => handleSelect(s)}
              style={{
                padding: '9px 12px',
                fontSize: 12,
                cursor: 'pointer',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-mono)',
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
    </div>
  );
}
