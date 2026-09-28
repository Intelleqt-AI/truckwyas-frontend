import React from 'react';

interface Props {
  children: React.ReactNode;
  /**
   * 'app' (default) fills the viewport; 'page' sits inside the app shell so the
   * navigation stays usable when one page fails to render.
   */
  variant?: 'app' | 'page';
  /** Changing this clears the error (e.g. the route path), so navigating away recovers. */
  resetKey?: unknown;
}

interface State {
  hasError: boolean;
}

/**
 * Last line of defence when a render throws. The user sees a plain, friendly
 * message with Reload; the technical details (message, stack, component stack)
 * go to the console only, never onto the screen.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo?.componentStack);
  }

  componentDidUpdate(prev: Props) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    const page = this.props.variant === 'page';
    return (
      <div
        role="alert"
        style={{
          display: 'flex',
          alignItems: page ? 'flex-start' : 'center',
          justifyContent: 'center',
          minHeight: page ? 0 : '100vh',
          background: page ? 'transparent' : 'var(--bg-deep)',
          padding: page ? '48px 16px' : 24,
        }}
      >
        <div style={{
          background: 'var(--bg-surface)',
          borderRadius: 'var(--radius-card)',
          border: '1px solid var(--border-subtle)',
          padding: 24,
          maxWidth: 440,
          width: '100%',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontSize: 16,
            lineHeight: '24px',
            fontWeight: 600,
            color: 'var(--text-primary)',
            margin: '0 0 4px',
          }}>
            {page ? 'This page didn’t load properly' : 'Something went wrong'}
          </h2>
          <p style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            margin: '0 0 20px',
            lineHeight: '20px',
          }}>
            Reload to try again. Anything you had already saved is safe.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="tw-btn tw-btn--primary"
              onClick={() => window.location.reload()}
              style={{ minHeight: 40 }}
            >
              Reload
            </button>
            <button
              type="button"
              className="tw-btn"
              onClick={() => { window.location.href = '/'; }}
              style={{ minHeight: 40 }}
            >
              Go to Today
            </button>
          </div>
        </div>
      </div>
    );
  }
}
