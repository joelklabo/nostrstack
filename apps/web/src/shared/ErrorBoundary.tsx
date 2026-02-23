import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  resetToken?: unknown;
}

interface State {
  hasError: boolean;
  error?: Error;
}

// cspell:ignore dedup
const ERROR_DEDUP_WINDOW_MS = 2000;

export class ErrorBoundary extends Component<Props, State> {
  private lastErrorTime = 0;
  private lastErrorMessage = '';

  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const now = Date.now();
    const isModuleLoadError =
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Failed to load module script');

    if (
      isModuleLoadError &&
      now - this.lastErrorTime < ERROR_DEDUP_WINDOW_MS &&
      error.message === this.lastErrorMessage
    ) {
      return;
    }

    this.lastErrorTime = now;
    this.lastErrorMessage = error.message;

    console.error('ErrorBoundary caught an error:', error, info);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.state.hasError && prevProps.resetToken !== this.props.resetToken) {
      this.setState({ hasError: false, error: undefined });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{
            padding: '1rem',
            border: '1px solid var(--ns-color-danger-default)',
            color: 'var(--ns-color-danger-default)',
            background: 'var(--ns-color-danger-subtle)',
            borderRadius: 'var(--ns-radius-md)'
          }}
        >
          <strong>Something went wrong</strong>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto', marginTop: '0.5rem' }}>
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
