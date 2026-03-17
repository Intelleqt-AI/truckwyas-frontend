import { toast as sonnerToast } from 'sonner';

/**
 * Toast notification utilities using sonner
 * Styled with CSS variables for dark/light mode compatibility
 */

const baseStyle = {
  style: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
  },
};

export const toast = {
  success: (message: string) => {
    sonnerToast.success(message, {
      ...baseStyle,
      style: {
        ...baseStyle.style,
        borderColor: 'var(--status-success)',
      },
    });
  },

  error: (message: string) => {
    sonnerToast.error(message, {
      ...baseStyle,
      style: {
        ...baseStyle.style,
        borderColor: 'var(--status-danger)',
      },
    });
  },

  info: (message: string) => {
    sonnerToast.info(message, {
      ...baseStyle,
      style: {
        ...baseStyle.style,
        borderColor: 'var(--accent-primary)',
      },
    });
  },

  warning: (message: string) => {
    sonnerToast.warning(message, {
      ...baseStyle,
      style: {
        ...baseStyle.style,
        borderColor: 'var(--status-warning)',
      },
    });
  },
};
