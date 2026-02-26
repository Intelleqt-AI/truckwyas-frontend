import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText } from "lucide-react";
import { postData } from "@/lib/Api";

interface InvoiceFromOrderButtonProps {
  orderId: string | number;
  orderStatus: string;
  size?: 'sm' | 'md';
  variant?: 'icon' | 'text';
  onSuccess?: () => void;
}

/**
 * Button component to convert a completed order/booking into an invoice.
 * Only shows for COMPLETED or DELIVERED orders.
 */
export function InvoiceFromOrderButton({
  orderId,
  orderStatus,
  size = 'sm',
  variant = 'icon',
  onSuccess
}: InvoiceFromOrderButtonProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  // Only show for completed or delivered orders
  const isEligible = ['completed', 'COMPLETED', 'delivered', 'DELIVERED'].includes(orderStatus);

  if (!isEligible) {
    return null;
  }

  const handleConvertToInvoice = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click navigation

    if (!confirm('Convert this order to an invoice?')) {
      return;
    }

    setLoading(true);

    try {
      // POST to create invoice from order/load
      const response = await postData<{ id: number }>('/api/v1/invoices/', {
        load_id: orderId
      });

      // Show success message
      alert('Invoice created successfully!');

      // Navigate to the new invoice
      navigate(`/finance/invoices/${response.id}`);

      // Call success callback if provided
      if (onSuccess) {
        onSuccess();
      }
    } catch (error: any) {
      const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
      alert(`Failed to create invoice: ${errorMsg}`);
    } finally {
      setLoading(false);
    }
  };

  if (variant === 'icon') {
    return (
      <button
        className="btn-export"
        title="Convert to Invoice"
        onClick={handleConvertToInvoice}
        disabled={loading}
        style={{
          padding: size === 'sm' ? '4px 8px' : '6px 10px',
          fontSize: size === 'sm' ? '11px' : '13px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          opacity: loading ? 0.5 : 1,
          cursor: loading ? 'not-allowed' : 'pointer'
        }}
      >
        <FileText style={{ width: size === 'sm' ? '12px' : '14px', height: size === 'sm' ? '12px' : '14px' }} />
        {loading && <span style={{ fontSize: '10px' }}>...</span>}
      </button>
    );
  }

  return (
    <button
      className="btn-action"
      onClick={handleConvertToInvoice}
      disabled={loading}
      style={{
        width: 'auto',
        padding: size === 'sm' ? '4px 10px' : '8px 16px',
        fontSize: size === 'sm' ? '11px' : '13px',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        opacity: loading ? 0.5 : 1,
        cursor: loading ? 'not-allowed' : 'pointer'
      }}
    >
      <FileText style={{ width: size === 'sm' ? '12px' : '14px', height: size === 'sm' ? '12px' : '14px' }} />
      {loading ? 'Creating...' : 'Convert to Invoice'}
    </button>
  );
}
