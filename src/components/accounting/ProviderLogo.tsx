import { providerConfig } from '@/lib/accounting';
import './accounting.css';

/** Provider logo from config, or a lettermark tile when we have no artwork. */
export function ProviderLogo({ provider, size = 'md' }: { provider: string; size?: 'sm' | 'md' }) {
  const cfg = providerConfig(provider);
  return (
    <span className={`acct-logo${size === 'sm' ? ' acct-logo--sm' : ''}`} aria-hidden="true">
      {cfg.logo ? <img src={cfg.logo} alt="" />
        : cfg.mark ? <span className="acct-logo__mark" style={{ background: cfg.mark.bg, color: cfg.mark.fg }}>{cfg.initials}</span>
        : cfg.initials}
    </span>
  );
}
