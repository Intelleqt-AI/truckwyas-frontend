import { ArrowUpRight } from 'lucide-react';

// Merchant Capital's own application: general business funding for the
// company, not an advance on any one invoice.
export const MERCHANT_CAPITAL_URL = 'https://getstarted.merchantcapital.co.za?actiontype=C_C&channel=Part_Trad&who=IA_SP';

export default function AccessCapitalButton() {
  return (
    <a
      href={MERCHANT_CAPITAL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="tw-btn"
      title="Apply for business funding from Merchant Capital (opens in a new tab)"
    >
      Access capital
      <ArrowUpRight size={16} strokeWidth={1.75} aria-hidden="true" />
    </a>
  );
}
