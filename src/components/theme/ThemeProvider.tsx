/**
 * TruckWys V3 Theme Provider
 * Manages dark/light mode via data-theme attribute on <html>
 * Default: dark mode
 */

import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    // Check localStorage first
    const stored = localStorage.getItem('truckwys-theme');
    if (stored === 'dark' || stored === 'light') return stored;
    // Default to dark mode for TruckWys OS
    return 'dark';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    // Set data-theme attribute for CSS variable switching
    root.setAttribute('data-theme', theme);
    // Also keep class for compatibility
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('truckwys-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setThemeState(prev => prev === 'light' ? 'dark' : 'light');
  };

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
