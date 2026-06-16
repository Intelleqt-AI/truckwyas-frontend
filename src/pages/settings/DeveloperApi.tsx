import { useState, useEffect } from 'react';
import { fetchData, postData, deleteData } from '@/lib/Api';

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
}

const sectionStyle: React.CSSProperties = {
  background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)', marginBottom: 16,
};
const sectionHeader: React.CSSProperties = { padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' };
const sectionTitle: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', fontWeight: 600 };
const mono: React.CSSProperties = { fontFamily: 'var(--font-mono)', fontSize: 12 };
const inputStyle: React.CSSProperties = { background: 'var(--input-bg)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none', width: '100%', boxSizing: 'border-box' };

const SAMPLE = {
  invoice: { amount: 50000, issue_date: '2026-06-01', due_date: '2026-07-01', status: 'SENT' },
  debtor: { name: 'Shoprite Holdings', credit_score: 82, avg_days_to_pay: 28, relationship_months: 18 },
  operator: { name: 'Acme Haulage', company_age_years: 7, fleet_size: 25, turnover_trend: 'growing' },
  facility: { limit: 1000000, available: 800000 },
};

export function DeveloperApi() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newQuota, setNewQuota] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  // Try-it console
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
      await postData({ url: 'api/v1/integrations/api-keys/', data: {
        name: newName.trim(), key_type: 'PARTNER',
        monthly_quota: newQuota ? Number(newQuota) : 0,
      }});
      setNewName(''); setNewQuota(''); load();
    } catch { /* surfaced by toast */ } finally { setCreating(false); }
  };

  const revoke = async (id: number) => {
    if (!confirm('Revoke this API key? Calls using it will stop working immediately.')) return;
    await deleteData({ url: `api/v1/integrations/api-keys/${id}/` }).catch(() => {});
    load();
  };

  const runTry = async () => {
    setRunning(true); setResult(null); setTryErr('');
    try {
      const parsed = JSON.parse(body);
      const res = await postData({ url: 'api/v1/risk/underwrite/', data: parsed });
      setResult(res);
    } catch (e: any) {
      setTryErr(e?.message || 'Request failed — check the JSON is valid.');
    } finally { setRunning(false); }
  };

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--text-primary)', marginBottom: 4 }}>Risk-Scoring API</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Score any invoice with the same 7-pillar underwriting engine your Capital product uses. Partners authenticate with an API key and are metered per call.
        </div>
      </div>

      {/* Endpoint reference */}
      <div style={sectionStyle}>
        <div style={sectionHeader}><span style={sectionTitle}>Endpoint</span></div>
        <div style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ ...mono, fontWeight: 700, color: 'var(--accent-primary)', padding: '3px 8px', border: '1px solid var(--accent-primary)', borderRadius: 2 }}>POST</span>
            <span style={{ ...mono, color: 'var(--text-primary)' }}>/api/v1/risk/underwrite/</span>
          </div>
          <div style={{ ...mono, color: 'var(--text-tertiary)', marginBottom: 6 }}>Header: <span style={{ color: 'var(--text-secondary)' }}>X-API-Key: &lt;your key&gt;</span></div>
          <div style={{ ...mono, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>
            Returns: <span style={{ color: 'var(--text-secondary)' }}>eligible, risk_tier, score, fee_percent, max_advance_percent, net_advance, top_risk_drivers, top_strengths, pillars</span>
          </div>
        </div>
      </div>

      {/* API keys */}
      <div style={sectionStyle}>
        <div style={sectionHeader}><span style={sectionTitle}>API Keys</span></div>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div style={{ flex: 2 }}>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5, textTransform: 'uppercase' }}>Key name</div>
            <input style={inputStyle} placeholder="e.g. ABSA Business Finance" value={newName} onChange={e => setNewName(e.target.value)} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 5, textTransform: 'uppercase' }}>Monthly quota (0 = ∞)</div>
            <input style={inputStyle} type="number" placeholder="0" value={newQuota} onChange={e => setNewQuota(e.target.value)} />
          </div>
          <button className="btn-action" onClick={createKey} disabled={creating || !newName.trim()}>{creating ? 'CREATING…' : '+ CREATE KEY'}</button>
        </div>

        {loading ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>Loading…</div>
        ) : keys.length === 0 ? (
          <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-tertiary)', fontSize: 12 }}>No API keys yet. Create one to start scoring.</div>
        ) : keys.map((k, i) => {
          const pct = k.monthly_quota ? Math.min(100, Math.round(((k.quota_used || 0) / k.monthly_quota) * 100)) : 0;
          return (
            <div key={k.id} style={{ padding: '14px 20px', borderBottom: i < keys.length - 1 ? '1px solid var(--border-row)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{k.name}</div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
                    {revealed[k.id] ? k.key : `${k.key.slice(0, 10)}••••••••••••`}
                    <button onClick={() => setRevealed(r => ({ ...r, [k.id]: !r[k.id] }))} style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10 }}>{revealed[k.id] ? 'HIDE' : 'SHOW'}</button>
                    <button onClick={() => navigator.clipboard?.writeText(k.key)} style={{ marginLeft: 6, background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 10 }}>COPY</button>
                  </div>
                </div>
                <button onClick={() => revoke(k.id)} style={{ background: 'none', border: '1px solid var(--status-danger)', color: 'var(--status-danger)', padding: '5px 10px', fontFamily: 'var(--font-mono)', fontSize: 10, borderRadius: 2, cursor: 'pointer' }}>REVOKE</button>
              </div>
              <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
                <span style={{ ...mono, fontSize: 11, color: 'var(--text-secondary)' }}>{(k.usage_count || 0).toLocaleString()} calls total</span>
                {k.monthly_quota ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, maxWidth: 280 }}>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? 'var(--status-danger)' : 'var(--accent-primary)' }} />
                    </div>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)' }}>{k.quota_used || 0}/{k.monthly_quota} this month</span>
                  </div>
                ) : (
                  <span style={{ ...mono, fontSize: 11, color: 'var(--text-tertiary)' }}>unlimited</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Try it console */}
      <div style={sectionStyle}>
        <div style={sectionHeader}>
          <span style={sectionTitle}>Try it</span>
          <button className="btn-action" onClick={runTry} disabled={running}>{running ? 'SCORING…' : 'RUN ▸'}</button>
        </div>
        <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>Request body</div>
            <textarea value={body} onChange={e => setBody(e.target.value)} spellCheck={false}
              style={{ ...inputStyle, ...mono, height: 280, resize: 'vertical', lineHeight: 1.5, whiteSpace: 'pre' }} />
          </div>
          <div>
            <div style={{ ...mono, fontSize: 10, color: 'var(--text-tertiary)', marginBottom: 6, textTransform: 'uppercase' }}>Response</div>
            {tryErr ? (
              <div style={{ ...mono, color: 'var(--status-danger)', fontSize: 12 }}>{tryErr}</div>
            ) : result ? (
              <div>
                <div style={{ display: 'flex', gap: 16, marginBottom: 12, flexWrap: 'wrap' }}>
                  <Stat label="Tier" value={result.risk_tier} color={result.eligible ? 'var(--accent-primary)' : 'var(--status-danger)'} />
                  <Stat label="Score" value={String(result.score)} />
                  <Stat label="Fee" value={`${result.fee_percent}%`} />
                  <Stat label="Advance" value={`${result.max_advance_percent}%`} />
                  <Stat label="Net" value={`R${Math.round(result.net_advance || 0).toLocaleString()}`} color="var(--status-success)" />
                </div>
                <pre style={{ ...mono, fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-deep)', border: '1px solid var(--border-subtle)', borderRadius: 2, padding: 12, maxHeight: 200, overflow: 'auto', margin: 0 }}>
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            ) : (
              <div style={{ ...mono, color: 'var(--text-tertiary)', fontSize: 12 }}>Hit RUN to score the sample invoice.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 700, color: color || 'var(--text-primary)' }}>{value}</div>
    </div>
  );
}
