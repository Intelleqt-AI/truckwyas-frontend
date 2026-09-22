/**
 * Insurance — a placeholder while the insurer partnerships are being set up.
 *
 * Deliberately a real route rather than a disabled nav item: the tab is there
 * to signal what is coming, and a dead link that does nothing reads as a bug.
 */
export default function Insurance() {
  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            color: "var(--text-tertiary)",
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            marginBottom: 4,
          }}>
          Insurance
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 500, color: "var(--text-primary)" }}>
            Launching soon
          </div>
          <span
            style={{
              fontSize: 10,
              fontFamily: "var(--font-mono)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--accent-primary)",
              border: "1px solid var(--accent-primary)",
              borderRadius: 3,
              padding: "3px 7px",
            }}>
            Coming soon
          </span>
        </div>
      </div>

      <div
        className="card"
        style={{
          padding: "28px 32px",
          borderLeft: "3px solid var(--accent-primary)",
        }}>
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent-primary)"
            strokeWidth="1.5"
            width="26"
            height="26"
            style={{ flexShrink: 0, marginTop: 2 }}
            aria-hidden="true">
            <path d="M12 2l8 4v6c0 5-3.4 9.2-8 10-4.6-.8-8-5-8-10V6l8-4z" />
            <polyline points="9 12 11 14 15 10" />
          </svg>
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 500,
                color: "var(--text-primary)",
                marginBottom: 8,
              }}>
              Insurance &mdash; launching soon
            </div>
            <p
              style={{
                fontSize: 14,
                lineHeight: 1.65,
                color: "var(--text-secondary)",
                margin: 0,
              }}>
              We&rsquo;re partnering with leading insurers to bring cover directly into
              TruckWys, so you can manage your fleet&rsquo;s risk in the same place you
              manage your loads.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
