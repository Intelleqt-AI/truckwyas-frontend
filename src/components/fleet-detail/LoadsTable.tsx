import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { dateText, loadDate, num, randWhole } from './parts';
import { StatusChip } from '@/components/ui/StatusChip';


/**
 * Recent loads: 48px rows, identifiers in mono, money right-aligned.
 * Rows open the booking. Ten rows, then "Show all".
 */
export function LoadsTable({ loads, showCustomer = true, initial = 10 }: { loads: any[]; showCustomer?: boolean; initial?: number }) {
  const navigate = useNavigate();
  const [all, setAll] = useState(false);
  if (loads.length === 0) return <p className="fd-empty">No loads yet.</p>;
  const rows = all ? loads : loads.slice(0, initial);
  const open = (id: any) => navigate(`/bookings/${id}`);

  return (
    <>
      <div className="fd-table-scroll" role="region" aria-label="Recent loads" tabIndex={0}>
        <table className="fd-table">
          <thead>
            <tr>
              <th scope="col">Load</th>
              <th scope="col" className="fd-col-route">Route</th>
              {showCustomer && <th scope="col" className="fd-col-opt fd-col-customer">Customer</th>}
              <th scope="col" className="is-num fd-col-opt fd-col-dist">Distance</th>
              <th scope="col" className="is-num">Revenue</th>
              <th scope="col" className="fd-col-status">Status</th>
              <th scope="col" className="fd-col-opt">Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l: any) => {
              const route = `${l.pickup_city || '—'} → ${l.delivery_city || '—'}`;
              const amount = num(l.total_amount);
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
                  <td className="is-num fd-col-opt fd-col-dist">{num(l.distance) ? `${Math.round(num(l.distance)).toLocaleString('en-ZA')} km` : '—'}</td>
                  <td className="is-num fd-strong">{amount ? randWhole(amount) : '—'}</td>
                  <td className="fd-col-status">
                    <StatusChip status={l.status} size="sm" />
                  </td>
                  <td className="fd-col-opt" title={l.created_at ? `Created ${dateText(l.created_at)}` : undefined}>{dateText(loadDate(l)) || '—'}</td>
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
