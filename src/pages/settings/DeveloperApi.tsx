import { useState, useEffect } from 'react';
import { fetchData, postData, patchData, deleteData } from '@/lib/Api';
import { ConfirmModal } from '@/components/ConfirmModal';

interface ApiKey {
  id: number;
  name: string;
  key: string;
  key_type: string;
  active: boolean;
  usage_count?: number;
  monthly_quota?: number;
  quota_used?: number;
  last_used_at?: string | null;
  allowed_ips?: string;
  webhook_url?: string;
  created_at?: string;
}

interface CallLog {
  id: number;
  scored_at: string;
  invoice_amount: string | null;
  risk_tier: string;
  score: number | null;
  eligible: boolean | null;
  caller_ip: string | null;
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)', marginBottom: 16,
};
const sectionHeader: React.CSSProperties = {
  padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};
const sectionTitle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 11,   letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600,
};
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };
const inputStyle: React.CSSProperties = {
  background: 'var(--input-bg)', border: '1px solid var(--border-subtle)',
  borderRadius: 2, padding: '8px 10px', color: 'var(--text-primary)',
  fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box',
};
const labelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)',
  marginBottom: 5, display: 'block',
};

const SAMPLE = {
  invoice: { amount: 50000, issue_date: '2026-06-01', due_date: '2026-07-01', status: 'SENT' },
  debtor: { name: 'Shoprite Holdings', credit_score: 82, avg_days_to_pay: 28, relationship_months: 18 },
  operator: { name: 'Acme Haulage', company_age_years: 7, fleet_size: 25, turnover_trend: 'growing' },
  facility: { limit: 1000000, available: 800000 },
};

const SCHEMA_FIELDS = [
  { obj: 'invoice', field: 'amount', type: 'number', required: true, desc: 'Invoice face value (ZAR)' },
  { obj: 'invoice', field: 'issue_date', type: 'string', required: false, desc: 'YYYY-MM-DD. Defaults to today.' },
  { obj: 'invoice', field: 'due_date', type: 'string', required: false, desc: 'YYYY-MM-DD. Defaults to issue_date + 30d.' },
  { obj: 'invoice', field: 'status', type: 'string', required: false, desc: 'SENT | PAID | OVERDUE. Defaults to SENT.' },
  { obj: 'invoice', field: 'age_days', type: 'number', required: false, desc: 'Days since issued (alternative to issue_date).' },
  { obj: 'invoice', field: 'terms_days', type: 'number', required: false, desc: 'Payment terms in days (alternative to due_date).' },
  { obj: 'debtor', field: 'name', type: 'string', required: false, desc: 'Debtor company name.' },
  { obj: 'debtor', field: 'credit_score', type: 'number', required: false, desc: '0–100. Higher = better payer.' },
  { obj: 'debtor', field: 'avg_days_to_pay', type: 'number', required: false, desc: 'Historical average payment days.' },
  { obj: 'debtor', field: 'relationship_months', type: 'number', required: false, desc: 'Months of trading relationship.' },
  { obj: 'debtor', field: 'is_active', type: 'boolean', required: false, desc: 'Whether debtor is currently active.' },
  { obj: 'operator', field: 'name', type: 'string', required: false, desc: 'Freight operator company name.' },
  { obj: 'operator', field: 'company_age_years', type: 'number', required: false, desc: 'Years in operation.' },
  { obj: 'operator', field: 'fleet_size', type: 'number', required: false, desc: 'Number of vehicles in fleet.' },
  { obj: 'operator', field: 'turnover_trend', type: 'string', required: false, desc: 'growing | stable | declining.' },
  { obj: 'operator', field: 'annual_turnover', type: 'number', required: false, desc: 'Annual revenue in ZAR.' },
  { obj: 'facility', field: 'limit', type: 'number', required: false, desc: 'Credit facility limit. Defaults to 10× invoice.' },
  { obj: 'facility', field: 'available', type: 'number', required: false, desc: 'Available facility balance.' },
];

const TIER_COLOR: Record<string, string> = {
  A: 'var(--status-success)',
  B: 'var(--accent-primary)',
  C: '#f59e0b',
  D: 'var(--status-danger)',
};

function fmtDate(s?: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
}

export function DeveloperApi() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  // Create form
  const [newName, setNewName] = useState('');
  const [newQuota, setNewQuota] = useState('');
  const [newIPs, setNewIPs] = useState('');
  const [newWebhook, setNewWebhook] = useState('');
  const [showAdvCreate, setShowAdvCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reveal key text
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  // Copy feedback: stores key id that was just copied
  const [copied, setCopied] = useState<number | null>(null);

  const copyKey = (k: ApiKey) => {
    navigator.clipboard?.writeText(k.key).then(() => {
      setCopied(k.id);
      setTimeout(() => setCopied(c => (c === k.id ? null : c)), 1500);
    });
  };

  // Revoke confirm
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);

  // Edit drawer
  const [editKey, setEditKey] = useState<ApiKey | null>(null);
  const [editForm, setEditForm] = useState({ name: '', monthly_quota: '', allowed_ips: '', webhook_url: '' });
  const [editSaving, setEditSaving] = useState(false);
  const [editErr, setEditErr] = useState('');

  // Call history
  const [expandedLogs, setExpandedLogs] = useState<Record<number, boolean>>({});
  const [logs, setLogs] = useState<Record<number, CallLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<number, boolean>>({});

  // Try-it console
  const [tryKeyId, setTryKeyId] = useState<number | ''>('');
  const [body, setBody] = useState(JSON.stringify(SAMPLE, null, 2));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [tryErr, setTryErr] = useState('');

  const load = () => {
    fetchData('api/v1/integrations/api-keys/')
      .then((d: any) => setKeys(Array.isArray(d) ? d : (d?.results || [])))
      .catch(() => setKeys([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createKey = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      await postData({
        url: 'api/v1/integrations/api-keys/',
        data: {
          name: newName.trim(), key_type: 'PARTNER',
          monthly_quota: newQuota ? Number(newQuota) : 0,
          allowed_ips: newIPs.trim(),
          webhook_url: newWebhook.trim(),
        },
      });
      setNewName(''); setNewQuota(''); setNewIPs(''); setNewWebhook('');
      setShowAdvCreate(false);
      load();
    } catch { /* surfaced by toast */ } finally { setCreating(false); }
  };

  const openEdit = (k: ApiKey) => {
    setEditKey(k);
    setEditForm({
      name: k.name,
      monthly_quota: k.monthly_quota ? String(k.monthly_quota) : '0',
      allowed_ips: k.allowed_ips || '',
      webhook_url: k.webhook_url || '',
    });
    setEditErr('');
  };

  const handleEditSave = async () => {
    if (!editKey || !editForm.name.trim()) return;
    setEditSaving(true);
    setEditErr('');
    try {
      await patchData({
        url: `api/v1/integrations/api-keys/${editKey.id}/`,
        data: {
          name: editForm.name.trim(),
          monthly_quota: editForm.monthly_quota ? Number(editForm.monthly_quota) : 0,
          allowed_ips: editForm.allowed_ips.trim(),
          webhook_url: editForm.webhook_url.trim(),
        },
      });
      setEditKey(null);
      load();
    } catch (e: any) {
      setEditErr(e?.data?.detail || 'Failed to save changes.');
    } finally { setEditSaving(false); }
  };

  const handleRevoke = async (id: number) => {
    await deleteData({ url: `api/v1/integrations/api-keys/${id}/` }).catch(() => {});
    setRevokeTarget(null);
    load();
  };

  const toggleLogs = async (k: ApiKey) => {
    const open = !expandedLogs[k.id];
    setExpandedLogs(prev => ({ ...prev, [k.id]: open }));
    if (open && !logs[k.id]) {
      setLogsLoading(prev => ({ ...prev, [k.id]: true }));
      try {
        const data: any = await fetchData(`api/v1/integrations/api-keys/${k.id}/calls/`);
        setLogs(prev => ({ ...prev, [k.id]: Array.isArray(data) ? data : (data?.results || []) }));
      } catch {
        setLogs(prev => ({ ...prev, [k.id]: [] }));
      } finally {
        setLogsLoading(prev => ({ ...prev, [k.id]: false }));
      }
    }
  };

  const BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || 'http://localhost:8000/';

  const runTry = async () => {
    setRunning(true); setResult(null); setTryErr('');
    try {
      const parsed = JSON.parse(body);
      let res: any;
      if (tryKeyId !== '') {
        const selectedKey = keys.find(k => k.id === tryKeyId);
        if (!selectedKey) throw new Error('Selected key not found');
        const resp = await fetch(`${BASE_URL}api/v1/risk/underwrite/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': selectedKey.key },
          body: JSON.stringify(parsed),
        });
        res = await resp.json();
        if (!resp.ok) throw new Error(res?.error || `HTTP ${resp.status}`);
      } else {
        res = await postData({ url: 'api/v1/risk/underwrite/', data: parsed });
      }
      setResult(res);
      // Refresh key list to show updated quota
      if (tryKeyId !== '') load();
    } catch (e: any) {
      setTryErr(e?.message || 'Request failed — check the JSON is valid.');
    } finally { setRunning(false); }
  };

  return (
    <div style={{ maxWidth: 960, margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Risk-Scoring API</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Score any invoice with the same 7-pillar underwriting engine your Capital product uses.
          Partners authenticate with an API key and are metered per call.
        </div>
      </div>

      {/* ── Endpoint reference ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader}><span style={sectionTitle}>Endpoint</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ ...mono, fontWeight: 700, color: 'var(--accent-primary)', padding: '3px 8px', border: '1px solid var(--accent-primary)', borderRadius: 2 }}>Post</span>
            <span style={{ ...mono, color: 'var(--text-primary)' }}>/api/v1/risk/underwrite/</span>
          </div>
          <div style={{ ...mono, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Auth (key): <span style={{ color: 'var(--text-secondary)' }}>X-API-Key: &lt;your key&gt;</span>
          </div>
          <div style={{ ...mono, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Auth (in-app): <span style={{ color: 'var(--text-secondary)' }}>Authorization: Token &lt;token&gt;</span>
          </div>
          <div style={{ ...mono, color: 'var(--text-tertiary)', marginBottom: 4 }}>
            Rate limit: <span style={{ color: 'var(--text-secondary)' }}>60 requests/minute per key</span>
          </div>
          <div style={{ ...mono, color: 'var(--text-tertiary)' }}>
            Returns: <span style={{ color: 'var(--text-secondary)' }}>eligible, risk_tier, score, fee_percent, max_advance_percent, net_advance, top_risk_drivers, top_strengths, pillars, _meta</span>
          </div>
        </div>
      </div>

      {/* ── Request body schema ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader}><span style={sectionTitle}>Request Body Schema</span></div>
        <div style={{ overflowY: 'auto', maxHeight: 320 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--bg-deep)' }}>
                {['Object', 'Field', 'Type', 'Required', 'Description'].map(h => (
                  <th key={h} style={{ position: 'sticky', top: 0, zIndex: 1, padding: '8px 14px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-subtle)', whiteSpace: 'nowrap', background: 'var(--bg-deep)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SCHEMA_FIELDS.map((f, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--border-row)' }}>
                  <td style={{ padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-primary)' }}>{f.obj}</td>
                  <td style={{ padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-primary)', fontWeight: 600 }}>{f.field}</td>
                  <td style={{ padding: '7px 14px', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)' }}>{f.type}</td>
                  <td style={{ padding: '7px 14px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, padding: '2px 6px', borderRadius: 2, background: f.required ? 'rgba(239,68,68,0.12)' : 'var(--bg-deep)', color: f.required ? 'var(--status-danger)' : 'var(--text-tertiary)' }}>
                      {f.required ? 'YES' : 'no'}
                    </span>
                  </td>
                  <td style={{ padding: '7px 14px', color: 'var(--text-secondary)' }}>{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── API keys ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader}><span style={sectionTitle}>API Keys</span></div>

        {/* Create row */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', marginBottom: showAdvCreate ? 12 : 0 }}>
            <div style={{ flex: 2 }}>
              <label style={labelStyle}>Key name</label>
              <input style={inputStyle} placeholder="e.g. ABSA Business Finance" value={newName} onChange={e => setNewName(e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Monthly quota (0 = ∞)</label>
              <input style={inputStyle} type="number" placeholder="0" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
            </div>
            <button
              onClick={() => setShowAdvCreate(p => !p)}
              style={{
                background: showAdvCreate ? 'rgba(var(--accent-primary-rgb,37,99,235),0.08)' : 'var(--bg-deep)',
                border: '1px solid var(--border-subtle)',
                color: showAdvCreate ? 'var(--accent-primary)' : 'var(--text-secondary)',
                fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                whiteSpace: 'nowrap', padding: '0 12px', borderRadius: 2,
                alignSelf: 'flex-end', height: 34, letterSpacing: '0.06em',
                transition: 'all 0.15s',
              }}
            >
              {showAdvCreate ? '▲ LESS OPTIONS' : '▼ MORE OPTIONS'}
            </button>
            <button className="btn-action" onClick={createKey} disabled={creating || !newName.trim()} style={{ whiteSpace: 'nowrap' }}>
              {creating ? 'CREATING…' : '+ CREATE KEY'}
            </button>
          </div>
          {showAdvCreate && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <label style={labelStyle}>Allowed IPs (comma-separated, empty = all)</label>
                <input style={inputStyle} placeholder="e.g. 41.13.0.1, 196.25.0.0" value={newIPs} onChange={e => setNewIPs(e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Webhook URL (POST results here after each score)</label>
                <input style={inputStyle} placeholder="https://partner.example.com/hooks/risk" value={newWebhook} onChange={e => setNewWebhook(e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* Key list */}
        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No API keys yet. Create one to start scoring.</div>
        ) : keys.map((k, i) => {
          const pct = k.monthly_quota ? Math.min(100, Math.round(((k.quota_used || 0) / k.monthly_quota) * 100)) : 0;
          const logsOpen = expandedLogs[k.id];
          return (
            <div key={k.id} style={{ borderBottom: i < keys.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
              {/* Key row */}
              <div style={{ padding: '14px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>{k.name}</div>
                    <div style={{ ...mono, fontSize: 11, color: 'var(--text-tertiary)', marginBottom: 6, wordBreak: 'break-all', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ letterSpacing: revealed[k.id] ? '0.04em' : 'normal' }}>
                        {revealed[k.id] ? k.key : `${k.key.slice(0, 12)}••••••••••••`}
                      </span>
                      <button
                        onClick={() => setRevealed(r => ({ ...r, [k.id]: !r[k.id] }))}
                        style={{ background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '2px 7px', borderRadius: 2, letterSpacing: '0.06em' }}
                      >
                        {revealed[k.id] ? '● HIDE' : '○ SHOW'}
                      </button>
                      <button
                        onClick={() => copyKey(k)}
                        style={{
                          background: copied === k.id ? 'rgba(34,197,94,0.12)' : 'var(--bg-deep)',
                          border: `1px solid ${copied === k.id ? 'var(--status-success)' : 'var(--border-subtle)'}`,
                          color: copied === k.id ? 'var(--status-success)' : 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9,
                          padding: '2px 7px', borderRadius: 2, letterSpacing: '0.06em',
                          transition: 'all 0.2s',
                        }}
                      >
                        {copied === k.id ? '✓ COPIED!' : '⎘ COPY'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ ...mono, fontSize: 11, color: 'var(--text-secondary)' }}>{(k.usage_count || 0).toLocaleString()} total calls</span>
                      <span style={{ ...mono, fontSize: 11, color: 'var(--text-tertiary)' }}>last used: {fmtDate(k.last_used_at)}</span>
                      {k.monthly_quota ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 120, height: 5, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? 'var(--status-danger)' : 'var(--accent-primary)' }} />
                          </div>
                          <span style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)' }}>{k.quota_used || 0}/{k.monthly_quota} this month</span>
                        </div>
                      ) : (
                        <span style={{ ...mono, fontSize: 11, color: 'var(--text-tertiary)' }}>unlimited quota</span>
                      )}
                      {k.allowed_ips && <span style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)' }}>IPs: {k.allowed_ips}</span>}
                      {k.webhook_url && <span style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>webhook: {k.webhook_url}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
                    <button onClick={() => toggleLogs(k)} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>
                      {logsOpen ? 'HIDE LOGS' : 'LOGS'}
                    </button>
                    <button onClick={() => openEdit(k)} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>Edit</button>
                    <button onClick={() => setRevokeTarget(k)} style={{ background: 'none', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>Revoke</button>
                  </div>
                </div>
              </div>

              {/* Call history panel */}
              {logsOpen && (
                <div style={{ background: 'var(--bg-deep)', borderTop: '1px solid var(--border-subtle)', padding: '10px 20px 14px' }}>
                  <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 8, letterSpacing: '0.08em' }}>Call History (last 100)</div>
                  {logsLoading[k.id] ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>Loading…</div>
                  ) : !logs[k.id] || logs[k.id].length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>No calls recorded yet.</div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                      <thead>
                        <tr>
                          {['Time', 'Invoice Amt', 'Tier', 'Score', 'Eligible', 'IP'].map(h => (
                            <th key={h} style={{ padding: '4px 10px', textAlign: 'left', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.07em', borderBottom: '1px solid var(--border-subtle)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {logs[k.id].map(log => (
                          <tr key={log.id} style={{ borderBottom: '1px solid var(--border-row)' }}>
                            <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{fmtDate(log.scored_at)}</td>
                            <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                              {log.invoice_amount ? `R${parseFloat(log.invoice_amount).toLocaleString('en-ZA', { maximumFractionDigits: 0 })}` : '—'}
                            </td>
                            <td style={{ padding: '5px 10px' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: TIER_COLOR[log.risk_tier] || 'var(--text-secondary)' }}>
                                {log.risk_tier || '—'}
                              </span>
                            </td>
                            <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>{log.score ?? '—'}</td>
                            <td style={{ padding: '5px 10px' }}>
                              {log.eligible === null ? <span style={{ color: 'var(--text-tertiary)' }}>—</span>
                                : log.eligible
                                  ? <span style={{ color: 'var(--status-success)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>YES</span>
                                  : <span style={{ color: 'var(--status-danger)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>NO</span>}
                            </td>
                            <td style={{ padding: '5px 10px', fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>{log.caller_ip || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Try it console ── */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Try it</span>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <div>
              <label style={{ ...labelStyle, marginBottom: 0, marginRight: 6, display: 'inline' }}>Auth as:</label>
              <select
                value={tryKeyId}
                onChange={e => setTryKeyId(e.target.value === '' ? '' : Number(e.target.value))}
                style={{ ...inputStyle, width: 'auto', padding: '5px 8px', fontSize: 11 }}
              >
                <option value="">Bearer (in-app / internal)</option>
                {keys.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
              </select>
            </div>
            <button className="btn-action" onClick={runTry} disabled={running}>{running ? 'SCORING…' : 'RUN ▸'}</button>
          </div>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, }}>Request body</div>
            <textarea value={body} onChange={e => setBody(e.target.value)} spellCheck={false}
              style={{ ...inputStyle, ...mono, height: 300, resize: 'vertical', lineHeight: 1.5, whiteSpace: 'pre' }} />
          </div>
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, }}>Response</div>
            {tryErr ? (
              <div style={{ ...mono, color: 'var(--status-danger)', fontSize: 12 }}>{tryErr}</div>
            ) : result ? (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Stat label="Tier" value={result.risk_tier || '—'} color={result.eligible ? (TIER_COLOR[result.risk_tier] || 'var(--accent-primary)') : 'var(--status-danger)'} />
                  <Stat label="Score" value={String(result.score ?? '—')} />
                  <Stat label="Fee" value={result.fee_percent != null ? `${result.fee_percent}%` : '—'} />
                  <Stat label="Advance" value={result.max_advance_percent != null ? `${result.max_advance_percent}%` : '—'} />
                  <Stat label="Net" value={result.net_advance != null ? `R${Math.round(result.net_advance).toLocaleString()}` : '—'} color="var(--status-success)" />
                </div>
                {result._meta && (
                  <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 10, padding: '6px 10px', background: 'var(--bg-deep)', borderRadius: 2, display: 'flex', gap: 16 }}>
                    <span>key: <b style={{ color: 'var(--text-secondary)' }}>{result._meta.key}</b></span>
                    <span>quota: <b style={{ color: 'var(--text-secondary)' }}>{result._meta.quota_used}/{result._meta.monthly_quota || '∞'}</b></span>
                    <span>lifetime: <b style={{ color: 'var(--text-secondary)' }}>{result._meta.usage_count}</b></span>
                  </div>
                )}
                <pre style={{ ...mono, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 12, maxHeight: 220, overflow: 'auto', margin: 0 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ ...mono, color: 'var(--text-tertiary)', fontSize: 12 }}>
                Select a key (or use Bearer) and hit RUN to score the sample invoice.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit key drawer ── */}
      {editKey && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setEditKey(null)}>
          <div style={{ width: 440, background: 'var(--bg-surface)', height: '100%', overflowY: 'auto', padding: 28, boxShadow: '-4px 0 24px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: 18 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>Edit API Key</div>
              <button onClick={() => setEditKey(null)} style={{ background: 'none', border: 'none', color: 'var(--text-tertiary)', fontSize: 20, cursor: 'pointer', lineHeight: 1 }}>×</button>
            </div>

            <div>
              <label style={labelStyle}>Key name *</label>
              <input style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} />
            </div>

            <div>
              <label style={labelStyle}>Monthly quota (0 = unlimited)</label>
              <input style={inputStyle} type="number" value={editForm.monthly_quota} onChange={e => setEditForm(f => ({ ...f, monthly_quota: e.target.value }))} />
            </div>

            <div>
              <label style={labelStyle}>Allowed IPs (comma-separated, empty = all)</label>
              <input style={inputStyle} placeholder="e.g. 41.13.0.1, 196.25.0.0" value={editForm.allowed_ips} onChange={e => setEditForm(f => ({ ...f, allowed_ips: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Leave empty to allow all IPs.</div>
            </div>

            <div>
              <label style={labelStyle}>Webhook URL</label>
              <input style={inputStyle} placeholder="https://partner.example.com/hooks/risk" value={editForm.webhook_url} onChange={e => setEditForm(f => ({ ...f, webhook_url: e.target.value }))} />
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>Truckwys will POST the full scoring result here after every call.</div>
            </div>

            {editErr && <div style={{ fontSize: 12, color: 'var(--status-danger)', padding: '8px 12px', background: 'var(--status-danger-bg)', borderRadius: 4 }}>{editErr}</div>}

            <div style={{ display: 'flex', gap: 10, marginTop: 'auto', paddingTop: 12 }}>
              <button className="btn-action" style={{ flex: 1 }} onClick={handleEditSave} disabled={editSaving || !editForm.name.trim()}>
                {editSaving ? 'SAVING…' : 'SAVE CHANGES'}
              </button>
              <button onClick={() => setEditKey(null)} style={{ flex: 1, background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', padding: '10px 0', fontFamily: 'var(--font-mono)', fontSize: 11, borderRadius: 2, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Revoke confirm ── */}
      {revokeTarget && (
        <ConfirmModal
          title="Revoke API Key"
          message={`Revoke "${revokeTarget.name}"? Any partner currently using this key will immediately lose access.`}
          confirmLabel="REVOKE"
          onConfirm={() => handleRevoke(revokeTarget.id)}
          onCancel={() => setRevokeTarget(null)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
