import { useState } from 'react';
import { formatDistance } from '@/lib/formatters';
import { Link, useNavigate } from 'react-router-dom';
import { dateText, loadDate, num, randCents, randWhole } from './parts';
import { StatusChip } from '@/components/ui/StatusChip';
import { isDelivered } from './record';


/**
 * Loads with their money: 48px rows, money right-aligned at the end.
 * Revenue is the order value; loads not yet delivered show it muted, because
 * Performance counts delivered work only. "Per km" is revenue over the load's
 * distance (no fuel or margin column: loads carry no cost of their own).
 * Rows open the booking. Ten rows, then "Show all".
 */
export function LoadsTable({ loads, showCustomer = true, initial = 10 }: { loads: any[]; showCustomer?: boolean; initial?: number }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  if (loads.length === 0) return <p className="fd-empty">No loads yet.</p>;
  const rows = all ? loads : loads.slice(0, initial);
  const open = (id: any) => navigate(`/bookings/${id}`);

  // One load: a single line. Its money is already the Performance figures
  // when delivered, so it is only printed here while the order is open.
  if (loads.length === 1) {
    const l = loads[0];
    const amount = num(l.total_amount);
    const done = isDelivered(l);
    const cancelled = /^CANCEL/.test(String(l.status || '').toUpperCase());
    return (
      <Link className="fd-oneload" to={`/bookings/${l.id}`}>
        <span className="fd-oneload__id">
          <span className="fd-mono fd-strong">{l.load_number || `Load ${l.id}`}</span>
          <span className="fd-oneload__route">{`${l.pickup_city || '—'} → ${l.delivery_city || '—'}`}{showCustomer && l.customer_name ? ` · ${l.customer_name}` : ''}</span>
        </span>
        <span className="fd-oneload__meta">
          <StatusChip status={l.status} size="sm" />
          <span className="fd-oneload__date">{dateText(loadDate(l)) || '—'}</span>
          {!done && !cancelled && amount > 0 && <span className="fd-oneload__amount" title="Order value; counted once delivered">{randWhole(amount)}</span>}
        </span>
      </Link>
    );
  }

  return (
    <>
      <div className="fd-table-scroll" role="region" aria-label="Loads" tabIndex={0}>
        <table className="fd-table">
          <thead>
            <tr>
              <th scope="col">Load</th>
              <th scope="col" className="fd-col-route">Route</th>
              {showCustomer && <th scope="col" className="fd-col-opt fd-col-customer">Customer</th>}
              <th scope="col" className="fd-col-status">Status</th>
              <th scope="col" className="fd-col-opt">Date</th>
              <th scope="col" className="is-num fd-col-opt fd-col-dist">Distance</th>
              <th scope="col" className="is-num fd-col-rev">Revenue</th>
              <th scope="col" className="is-num fd-col-opt fd-col-perkm">Per km</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l: any) => {
              const route = `${l.pickup_city || '—'} → ${l.delivery_city || '—'}`;
              const amount = num(l.total_amount);
              const km = num(l.distance);
              const done = isDelivered(l);
              const cancelled = /^CANCEL/.test(String(l.status || '').toUpperCase());
              return (
                <tr
                  key={l.id}
                  tabIndex={0}
                  onClick={() => open(l.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') open(l.id); }}
                >
                  <td>
                    <span className="fd-mono fd-strong">{l.load_number}</span>
                    <span className="fd-cell-sub">{route}</span>
                  </td>
                  <td className="fd-col-route fd-ellipsis" title={route}>{route}</td>
                  {showCustomer && <td className="fd-col-opt fd-col-customer fd-ellipsis" title={l.customer_name || undefined}>{l.customer_name || '—'}</td>}
                  <td className="fd-col-status">
                    <StatusChip status={l.status} size="sm" />
                  </td>
                  <td className="fd-col-opt" title={l.created_at ? `Created ${dateText(l.created_at)}` : undefined}>{dateText(loadDate(l)) || '—'}</td>
                  <td className="is-num fd-col-opt fd-col-dist">{km ? formatDistance(km) : '—'}</td>
                  <td className={`is-num fd-col-rev${done ? ' fd-strong' : ''}${cancelled ? ' fd-struck' : ''}`} title={done ? undefined : 'Order value; counted once delivered'}>{amount ? randWhole(amount) : '—'}</td>
                  <td className="is-num fd-col-opt fd-col-perkm">{amount && km && !cancelled ? randCents(amount / km) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {loads.length > initial && (
        <div className="fd-table-foot">
          <button type="button" className="fd-link" onClick={() => setAll((a) => !a)} aria-expanded={all}>
            {all ? 'Show fewer' : `Show all ${loads.length}`}
          </button>
        </div>
      )}
    </>
  );
}
