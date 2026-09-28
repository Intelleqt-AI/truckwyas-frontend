import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-deep)',
          padding: 24
        }}>
          <div style={{
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-card)',
            border: '1px solid var(--border-subtle)',
            padding: 24,
            maxWidth: 480,
            textAlign: 'center'
          }}>
            <h2 style={{
              fontSize: 16,
              lineHeight: '24px',
              fontWeight: 600,
              color: 'var(--text-primary)',
              margin: '0 0 4px'
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: 13,
              color: 'var(--text-secondary)',
              margin: '0 0 24px',
              lineHeight: '20px'
            }}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: undefined });
                window.location.href = '/';
              }}
              style={{
                background: 'var(--accent-primary)',
                color: 'var(--btn-action-color, #fff)',
                border: 'none',
                borderRadius: 'var(--radius-control)',
                padding: '8px 16px',
                minHeight: 40,
                fontSize: 14,
                lineHeight: '20px',
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Return to dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
