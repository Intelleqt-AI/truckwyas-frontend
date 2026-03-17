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
            borderRadius: 12,
            border: '1px solid var(--border-subtle)',
            padding: 32,
            maxWidth: 480,
            textAlign: 'center'
          }}>
            <div style={{
              fontSize: 48,
              marginBottom: 16
            }}>⚠️</div>
            <h2 style={{
              fontSize: 20,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 12
            }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: 14,
              color: 'var(--text-secondary)',
              marginBottom: 24,
              lineHeight: 1.5
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
                color: 'white',
                border: 'none',
                borderRadius: 6,
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer'
              }}
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
