import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            padding: '1rem',
            border: '1px solid var(--ns-color-danger-default)',
            color: 'var(--ns-color-danger-default)',
            background: 'var(--ns-color-danger-subtle)',
            borderRadius: 'var(--ns-radius-md)'
          }}
          role="alert"
        >
          <strong>COMPONENT CRASHED</strong>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto', marginTop: '0.5rem' }}>
            {this.state.error?.message}
          </pre>
        </div>
      );
    }

    return this.props.children;
  }
}
