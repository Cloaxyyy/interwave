import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches rendering errors in child components and shows a recovery UI
 * instead of crashing the entire app to a blank screen.
 */
export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            padding: 32,
            background: 'var(--bg-base)',
          }}
        >
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 13, color: 'var(--destructive)', fontWeight: 600 }}>
            Something went wrong in this view.
          </p>
          <p style={{ fontFamily: 'Syne, sans-serif', fontSize: 11, color: 'var(--text-muted)', maxWidth: 320, textAlign: 'center' }}>
            {this.state.error?.message ?? 'Unknown error'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              fontFamily: 'Syne, sans-serif',
              fontSize: 12,
              padding: '6px 16px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
