import { useEffect } from 'react';

/**
 * Public documents (quote and invoice links a client opens from email or
 * WhatsApp) follow the viewer's OS theme. The app normally sets
 * html[data-theme] from the operator's saved choice; a client has none, so
 * this sets it from `prefers-color-scheme` for as long as the page is open
 * (and tracks OS changes). An operator previewing their own link keeps the
 * app theme, because the attribute is already set. Nothing is stored.
 */
export function usePublicTheme() {
  useEffect(() => {
    const root = document.documentElement;
    if (root.hasAttribute('data-theme')) return;
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => root.setAttribute('data-theme', mq.matches ? 'light' : 'dark');
    apply();
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      root.removeAttribute('data-theme');
    };
  }, []);
}
