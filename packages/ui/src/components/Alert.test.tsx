import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Alert } from './Alert';

describe('Alert', () => {
  it('renders children correctly', () => {
    render(<Alert>Test message</Alert>);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders title when provided', () => {
    render(<Alert title="Alert Title">Content</Alert>);
    expect(screen.getByText('Alert Title')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('does not render title when not provided', () => {
    render(<Alert>Content only</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert.querySelector('.ns-alert__title')).toBeNull();
  });

  it('applies default info tone', () => {
    render(<Alert>Info alert</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('ns-alert--info');
  });

  it.each(['info', 'success', 'warning', 'danger'] as const)(
    'applies %s tone correctly',
    (tone) => {
      render(<Alert tone={tone}>Alert content</Alert>);
      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass(`ns-alert--${tone}`);
    }
  );

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<Alert onRetry={onRetry}>Error message</Alert>);
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<Alert>Message</Alert>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', () => {
    const onRetry = vi.fn();
    render(<Alert onRetry={onRetry}>Error message</Alert>);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses custom retry label', () => {
    render(
      <Alert onRetry={() => {}} retryLabel="Try Again">
        Error
      </Alert>
    );
    expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Alert className="custom-class">Content</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveClass('custom-class');
    expect(alert).toHaveClass('ns-alert');
  });

  it('applies custom style', () => {
    render(<Alert style={{ marginTop: '10px' }}>Content</Alert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveStyle({ marginTop: '10px' });
  });

  it('has role="alert" by default', () => {
    render(<Alert>Content</Alert>);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('allows overriding role', () => {
    render(<Alert role="status">Content</Alert>);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('passes through additional HTML attributes', () => {
    render(
      <Alert data-testid="custom-alert" id="my-alert">
        Content
      </Alert>
    );
    const alert = screen.getByTestId('custom-alert');
    expect(alert).toHaveAttribute('id', 'my-alert');
  });
});
