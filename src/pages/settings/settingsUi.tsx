import '@/pages/settings/settings-brand.css';
import { createPortal } from 'react-dom';
import { useSettingsShell } from './SettingsShell';
import '@/components/layout/section-header.css';

// Shared presentation roles for every settings section (see
// docs/brand/BRAND-GUIDELINES.md). Each section used to carry its own copy of
// these objects and they had drifted (h2 vs h3 card titles, 48px vs 40px
// inputs, 11px help text, three different toggle drawings). Pure styling — no
// data, no behaviour beyond the switch's own click/keyboard contract.

export const settingsCardStyle: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-card)',
  marginBottom: 16,
  minWidth: 0,
};

export const settingsCardHeaderStyle: React.CSSProperties = {
  padding: '16px var(--card-pad, 20px)',
  borderBottom: '1px solid var(--border-subtle)',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  flexWrap: 'wrap',
};

/** Card titles are the h2 under each section's single h1. */
export const settingsCardTitleStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 600,
  letterSpacing: 'normal',
  textTransform: 'none',
  color: 'var(--text-primary)',
  margin: 0,
};

export const settingsCardBodyStyle: React.CSSProperties = { padding: 'var(--card-pad, 20px)' };

export const settingsLabelStyle: React.CSSProperties = {
  display: 'block',
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: 'normal',
  textTransform: 'none',
  color: 'var(--text-primary)',
  marginBottom: 6,
};

/** Desktop controls are 40px / 14px text. Below 640px the `.tw-settings-shell`
 *  rule in settings-brand.css lifts every settings field to 48px / 16px so
 *  iOS Safari does not zoom on focus — one rule for every section instead of
 *  the profile page alone using 48px on desktop too. */
export const settingsInputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  background: 'var(--input-bg)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-control)',
  minHeight: 'var(--field-h, 40px)',
  minWidth: 0,
  padding: '8px 12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: '20px',
  transition: 'border-color 0.15s',
};

export const settingsHelpStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: '20px',
  color: 'var(--text-tertiary)',
  marginTop: 6,
};

export const settingsErrorStyle: React.CSSProperties = {
  ...settingsHelpStyle,
  color: 'var(--status-danger-text)',
};

/** Right-aligned action row that closes a card (Save changes etc.). */
export const settingsCardActionsStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
  flexWrap: 'wrap',
  marginTop: 24,
};

interface SettingsSwitchProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
  title?: string;
}

/** Accessible on/off switch. Off = outlined track with a muted knob on the
 *  left; on = filled accent track with a contrasting knob on the right, so
 *  state reads by position and fill (not hue alone) in both themes. */
export function SettingsSwitch({ checked, onChange, label, disabled, title }: SettingsSwitchProps) {
  return (
    <button
      type="button"
      className="settings-control settings-switch"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      data-state={checked ? 'on' : 'off'}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      title={title}
    >
      <span className="settings-switch-knob" aria-hidden="true" />
    </button>
  );
}

interface SettingsToggleRowProps extends Omit<SettingsSwitchProps, 'title'> {
  description?: string;
  disabledTitle?: string;
  badge?: React.ReactNode;
}

export function SettingsToggleRow({ label, description, checked, onChange, disabled, disabledTitle, badge }: SettingsToggleRowProps) {
  return (
    <div className="settings-toggle-row" style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
      padding: '12px var(--card-pad, 20px)',
      minHeight: 48,
      opacity: disabled ? 0.6 : 1,
    }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, lineHeight: '20px', color: 'var(--text-primary)' }}>{label}</span>
          {badge}
        </div>
        {description && <div style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-tertiary)' }}>{description}</div>}
      </div>
      <SettingsSwitch checked={checked} onChange={onChange} label={label} disabled={disabled} title={disabled ? disabledTitle : undefined} />
    </div>
  );
}

/** Small neutral badge: the chip role (6px radius, 13/20 medium sans). */
export const settingsBadgeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: 13,
  lineHeight: '20px',
  fontWeight: 500,
  color: 'var(--text-secondary)',
  background: 'var(--status-neutral-bg)',
  border: '1px solid transparent',
  borderRadius: 'var(--radius-chip)',
  padding: '0 8px',
  display: 'inline-flex',
  alignItems: 'center',
  whiteSpace: 'nowrap',
};

/** Outlined secondary action (40px, 8px control radius). Pair with className="settings-control". */
export const settingsSecondaryButtonStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  background: 'transparent',
  border: '1px solid var(--border-subtle)',
  color: 'var(--text-primary)',
  padding: '0 14px',
  minHeight: 'var(--control-h, 36px)',
  borderRadius: 'var(--radius-control)',
  fontFamily: 'var(--font-sans)',
  fontSize: 14,
  lineHeight: '20px',
  fontWeight: 500,
  letterSpacing: 'normal',
  cursor: 'pointer',
  whiteSpace: 'nowrap',
};

/** Explicitly named destructive action — outlined in the danger role. */
export const settingsDangerButtonStyle: React.CSSProperties = {
  ...settingsSecondaryButtonStyle,
  border: '1px solid var(--status-danger)',
  color: 'var(--status-danger-text)',
};

/** Standard settings section title block (one h1 + supporting line). Same
 * geometry and type as the shared SectionHeader (28/34 title, one grey line,
 * actions on the title row), so every page head in the product matches. */
export function SettingsPageHeader({ title, description, actions }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode }) {
  // Inside the settings shell the head is portalled into the shell's head
  // slot, above the sub-nav, so the H1 sits where it does on every page.
  const shell = useSettingsShell();
  const head = (
    <header className="section-header settings-page-head">
      <div className="section-header__top">
        <div className="section-header__titles">
          <div className="section-header__title-row">
            <h1 className="section-header__title">{title}</h1>
          </div>
          <p className="section-header__description">{description}</p>
        </div>
        {actions ? <div className="section-header__actions">{actions}</div> : null}
      </div>
    </header>
  );
  if (!shell) return head;
  if (!shell.slot) return null;
  return createPortal(<>{head}{shell.phoneNav}</>, shell.slot);
}
