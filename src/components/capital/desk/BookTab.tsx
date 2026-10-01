import { Link } from 'react-router-dom';
import { Info } from 'lucide-react';
import { KpiRow, KpiTile } from '@/components/ui/KpiTile';
import { InfoTip } from '@/components/ui/InfoTip';
import LoadError, { loadFailed } from '@/components/data/LoadError';
import { useDeskBook } from '@/lib/capital/api';
import type { Book } from '@/lib/capital/types';
import { CapBar, SkelCard, dayTime, money, pct } from '../capitalUi';
import { BandChip, HoldChip, num, type DeskCtx } from './common';

const bandTone = (b: string | null | undefined) => (b === 'red' ? 'danger' : b === 'amber' ? 'warning' : 'neutral') as 'danger' | 'warning' | 'neutral';

/** The funder's book on one screen: pot used, risk, concentration, mix, stress, and what is waiting. */
export function BookTab({ ctx }: { ctx: DeskCtx }) {
  const q = useDeskBook(ctx.funder);
  if (loadFailed(q)) {
    return <LoadError what="the book" error={q.error ?? q.failureReason} busy={q.isFetching} onRetry={() => q.refetch()} />;
  }
  if (q.isLoading || !q.data) {
    return (
      <div className="fin-stack fin-stack--16" aria-busy="true" aria-label="Loading the book">
        <SkelCard height={106} />
        <div className="cap-grid"><SkelCard height={240} /><SkelCard height={240} /></div>
        <SkelCard height={280} />
      </div>
    );
  }
  return <BookView b={q.data} />;
}

function BookView({ b }: { b: Book }) {
  const ri = b.risk_index;
  const outPct = b.pot_limit > 0 ? (b.outstanding / b.pot_limit) * 100 : 0;
  const resPct = b.pot_limit > 0 ? (b.reserved / b.pot_limit) * 100 : 0;
  const sectorMax = Math.max(1, ...b.sectors.map((s) => Math.max(s.pct_of_pot, s.cap)));
  const gradeMax = Math.max(1, ...b.grades.map((g) => g.pct));

  return (
    <div className="fin-stack fin-stack--16">
      <p className="fin-help" style={{ margin: 0 }}>{b.funder.name} · as of {dayTime(b.as_of)}</p>

      <KpiRow>
        <KpiTile label="Outstanding" figure={money(b.outstanding)} note={`${pct(b.utilisation_pct)} of the pot used`} />
        <KpiTile label="Reserved" figure={money(b.reserved)} note="Requested, not yet paid out" />
        <KpiTile label="Headroom" figure={money(b.headroom)} note={`of ${money(b.pot_limit)} pot`} emphasis />
        <KpiTile
          label="Book risk index"
          figure={ri.value != null ? num(ri.value, 1) : 'Not rated'}
          note={ri.band ? `${ri.band.charAt(0).toUpperCase()}${ri.band.slice(1)} band` : 'Too little data'}
          tone={bandTone(ri.band)}
        />
      </KpiRow>

      {b.small_book && (
        <div className="fl-notice" role="status">
          <Info size={16} aria-hidden="true" />
          <div>
            <strong>Small book</strong>
            Percentage-of-outstanding rules are off until the book passes R 10 million outstanding.
          </div>
        </div>
      )}

      <div className="cap-grid">
        <section className="card" aria-labelledby="bk-pot">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-pot" className="fin-panel-title">Pot used</h2>
              <p className="fin-panel-desc">Outstanding and reserved within the pot</p>
            </div>
          </div>
          <div className="cap-stack" role="img" aria-label={`Outstanding ${pct(outPct)}, reserved ${pct(resPct)} of the pot`}>
            <span className="cap-stack__a" style={{ width: `${Math.min(100, outPct)}%` }} />
            <span className="cap-stack__b" style={{ width: `${Math.max(0, Math.min(100 - outPct, resPct))}%` }} />
          </div>
          <dl className="fin-dl" style={{ marginTop: 8 }}>
            <div className="fin-dl__row"><dt>Pot</dt><dd>{money(b.pot_limit)}</dd></div>
            <div className="fin-dl__row"><dt>Committed</dt><dd>{money(b.committed)}</dd></div>
            <div className="fin-dl__row"><dt>Utilisation</dt><dd>{pct(b.utilisation_pct)}</dd></div>
            <div className="fin-dl__row"><dt>Expected loss</dt><dd>{money(b.expected_loss.amount)} · {pct(b.expected_loss.pct, 2)}</dd></div>
          </dl>
        </section>

        <section className="card" aria-labelledby="bk-ri">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-ri" className="fin-panel-title fin-panel-title--tip">
                Book risk index
                <InfoTip align="end">One number from three parts: expected loss, a concentration penalty and the stress ratio. Its band is set by the funder's policy.</InfoTip>
              </h2>
              <p className="fin-panel-desc">{ri.note || 'Its three components'}</p>
            </div>
            <BandChip band={ri.band} />
          </div>
          <dl className="fin-dl">
            <div className="fin-dl__row"><dt>Expected loss</dt><dd>{pct(ri.components.el_pct, 2)}</dd></div>
            <div className="fin-dl__row"><dt>Concentration penalty</dt><dd>{num(ri.components.concentration_penalty)}</dd></div>
            <div className="fin-dl__row"><dt>Stress ratio</dt><dd>{num(ri.components.stress_ratio)}</dd></div>
          </dl>
        </section>

        <section className="card" aria-labelledby="bk-conc">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-conc" className="fin-panel-title">Concentration</h2>
              <p className="fin-panel-desc">Debtor exposure, share of outstanding</p>
            </div>
            <BandChip band={b.concentration.top10_band} label={b.concentration.top10_band === 'ok' ? 'Within limits' : b.concentration.top10_band === 'soft' ? 'Soft limit' : 'Hard limit'} />
          </div>
          <dl className="fin-dl">
            <div className="fin-dl__row"><dt>Largest debtor</dt><dd>{pct(b.concentration.top1_pct)}</dd></div>
            <div className="fin-dl__row"><dt>Top 10 debtors</dt><dd>{pct(b.concentration.top10_pct)}</dd></div>
            <div className="fin-dl__row"><dt>HHI</dt><dd>{num(b.concentration.hhi, 3)}</dd></div>
            <div className="fin-dl__row"><dt>Effective number of debtors</dt><dd>{b.concentration.n_eff != null ? num(b.concentration.n_eff, 1) : '—'}</dd></div>
          </dl>
          {b.small_book && <p className="cap-sub" style={{ marginTop: 8 }}>Small book: concentration limits are not enforced yet.</p>}
        </section>

        <section className="card" aria-labelledby="bk-wait">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-wait" className="fin-panel-title">Waiting on the desk</h2>
              <p className="fin-panel-desc">Approvals, queue and open alerts</p>
            </div>
          </div>
          <dl className="fin-dl">
            <div className="fin-dl__row"><dt><Link className="fin-link" to="/capital/desk/approvals">Pending approval</Link></dt><dd>{b.pending_approvals.count} · {money(b.pending_approvals.amount)}</dd></div>
            <div className="fin-dl__row"><dt><Link className="fin-link" to="/capital/desk/queue">Queued</Link></dt><dd>{b.queue.count} · {money(b.queue.amount)}</dd></div>
            <div className="fin-dl__row"><dt><Link className="fin-link" to="/capital/desk/alerts">Open alerts</Link></dt><dd>{b.alerts_open.red} red · {b.alerts_open.amber} amber · {b.alerts_open.info} info</dd></div>
          </dl>
        </section>
      </div>

      <div className="cap-grid">
        <section className="card" aria-labelledby="bk-sec">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-sec" className="fin-panel-title fin-panel-title--tip">
                Sectors against caps
                <InfoTip align="end">Bar: share of the pot. Mark: the sector cap, as a share of the pot.</InfoTip>
              </h2>
              <p className="fin-panel-desc">Share of the pot by debtor sector</p>
            </div>
          </div>
          {b.sectors.length === 0 ? <div className="fin-empty fin-empty--compact">No exposure yet</div> : (
            <div className="cap-rows" role="table" aria-label="Sector exposure against caps">
              <div className="cap-row cap-row--head" role="row">
                <span role="columnheader">Sector</span><span aria-hidden="true" /><span role="columnheader" className="cap-row__value">Exposure</span><span role="columnheader" className="cap-row__note">Cap</span>
              </div>
              {b.sectors.map((s) => (
                <div key={s.sector} className="cap-row" role="row">
                  <span className="cap-row__label" role="cell" title={s.label}>{s.label}</span>
                  <CapBar value={s.pct_of_pot} cap={s.cap} scale={sectorMax} label={`${pct(s.pct_of_pot)} of pot, cap ${pct(s.cap)}`} />
                  <span className="cap-row__value" role="cell">{money(s.exposure)}<span className="cap-sub">{pct(s.pct_of_pot)}</span></span>
                  <span className="cap-row__note" role="cell">{pct(s.cap)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card" aria-labelledby="bk-grade">
          <div className="fin-panel-head">
            <div className="fin-panel-head__text">
              <h2 id="bk-grade" className="fin-panel-title">Grade mix</h2>
              <p className="fin-panel-desc">Outstanding by debtor grade</p>
            </div>
          </div>
          {b.grades.length === 0 ? <div className="fin-empty fin-empty--compact">No exposure yet</div> : (
            <div className="cap-rows" role="table" aria-label="Exposure by grade">
              {b.grades.map((g) => (
                <div key={g.grade} className="cap-row" role="row">
                  <span className="cap-row__label" role="cell">Grade {g.grade}</span>
                  <CapBar value={g.pct} scale={gradeMax} tone="accent" />
                  <span className="cap-row__value" role="cell">{money(g.exposure)}</span>
                  <span className="cap-row__note" role="cell">{pct(g.pct)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="card fin-table-card" aria-labelledby="bk-debtors">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="bk-debtors" className="fin-panel-title">Top debtors</h2>
            <p className="fin-panel-desc">Exposure against each debtor's cap</p>
          </div>
        </div>
        {b.top_debtors.length === 0 ? <div className="fin-empty fin-empty--compact">No debtor exposure yet</div> : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Debtor</th><th>Sector</th><th className="num">Exposure</th><th className="num">Cap</th><th style={{ minWidth: 120 }}>Used</th><th className="num">%</th><th /></tr></thead>
              <tbody>
                {b.top_debtors.map((d) => (
                  <tr key={d.debtor_id}>
                    <td className="fin-strong">{d.name}<span className="cap-sub">Grade {d.grade ?? '—'}</span></td>
                    <td>{d.sector || '—'}</td>
                    <td className="num">{money(d.exposure)}</td>
                    <td className="num">{money(d.cap)}</td>
                    <td><CapBar value={d.exposure} cap={d.cap} /></td>
                    <td className="num">{pct(d.utilisation_pct)}</td>
                    <td><HoldChip hold={d.hold} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card fin-table-card" aria-labelledby="bk-tr">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="bk-tr" className="fin-panel-title">Transporters against their line</h2>
            <p className="fin-panel-desc">Outstanding per transporter</p>
          </div>
        </div>
        {b.transporters.length === 0 ? <div className="fin-empty fin-empty--compact">No transporter exposure yet</div> : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Transporter</th><th>Grade</th><th className="num">Exposure</th><th className="num">Line</th><th style={{ minWidth: 120 }}>Used</th><th className="num">%</th></tr></thead>
              <tbody>
                {b.transporters.map((t) => (
                  <tr key={t.company_id}>
                    <td className="fin-strong">{t.name}</td>
                    <td>{t.grade ?? '—'}</td>
                    <td className="num">{money(t.exposure)}</td>
                    <td className="num">{money(t.line_limit)}</td>
                    <td><CapBar value={t.exposure} cap={t.line_limit} /></td>
                    <td className="num">{pct(t.utilisation_pct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card fin-table-card" aria-labelledby="bk-stress">
        <div className="fin-panel-head">
          <div className="fin-panel-head__text">
            <h2 id="bk-stress" className="fin-panel-title">Stress tests</h2>
            <p className="fin-panel-desc">Loss under each scenario against protection</p>
          </div>
        </div>
        {b.stress.length === 0 ? <div className="fin-empty fin-empty--compact">No scenarios run yet</div> : (
          <div className="fin-table-scroll">
            <table className="fin-table table-heading-roles">
              <thead><tr><th>Scenario</th><th className="num">Loss</th><th className="num">Protection</th><th>Status</th><th>Note</th></tr></thead>
              <tbody>
                {b.stress.map((s) => (
                  <tr key={s.scenario}>
                    <td className="fin-strong">{s.scenario}</td>
                    <td className="num">{money(s.loss)}</td>
                    <td className="num">{money(s.protection)}</td>
                    <td><BandChip band={s.status} label={s.status === 'ok' ? 'Covered' : s.status === 'watch' ? 'Watch' : 'Breach'} /></td>
                    <td className="fin-note">{s.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
