import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ToastProvider, useToast } from './Toast';

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders children', () => {
    render(
      <ToastProvider>
        <div data-testid="child">Child content</div>
      </ToastProvider>
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('renders toast region with correct accessibility attributes', () => {
    render(
      <ToastProvider>
        <div>Content</div>
      </ToastProvider>
    );
    const region = screen.getByTestId('toast-region');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveAttribute('aria-relevant', 'additions removals');
  });

  it('renders toast when toast() is called', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Hello!' })}>Show toast</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Hello!')).toBeInTheDocument();
  });

  it('applies correct CSS class for info tone (default)', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Info' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    const toast = screen.getByTestId('toast');
    expect(toast).toHaveClass('ns-toast--info');
  });

  it.each(['info', 'success', 'danger'] as const)(
    'applies correct CSS class for %s tone',
    (tone) => {
      function TestComponent() {
        const toast = useToast();
        return <button onClick={() => toast({ message: 'Test', tone })}>Show</button>;
      }

      render(
        <ToastProvider>
          <TestComponent />
        </ToastProvider>
      );

      fireEvent.click(screen.getByRole('button'));
      const toast = screen.getByTestId('toast');
      expect(toast).toHaveClass(`ns-toast--${tone}`);
    }
  );

  it('renders toast with role="status"', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Test' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('auto-dismisses toast after default duration', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Auto dismiss' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Auto dismiss')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2200);
    });

    expect(screen.queryByText('Auto dismiss')).not.toBeInTheDocument();
  });

  it('auto-dismisses toast after custom duration', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Custom', durationMs: 1000 })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Custom')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.getByText('Custom')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(screen.queryByText('Custom')).not.toBeInTheDocument();
  });

  it('dismisses toast when close button is clicked', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Dismissable' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByText('Dismissable')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Dismiss toast' });
    fireEvent.click(closeButton);

    expect(screen.queryByText('Dismissable')).not.toBeInTheDocument();
  });

  it('limits to maximum 5 toasts', () => {
    function TestComponent() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            for (let i = 1; i <= 7; i++) {
              toast({ message: `Toast ${i}` });
            }
          }}
        >
          Show many
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    const toasts = screen.getAllByTestId('toast');
    expect(toasts).toHaveLength(5);
  });

  it('shows newest toasts first (LIFO order)', () => {
    function TestComponent() {
      const toast = useToast();
      return (
        <button
          onClick={() => {
            toast({ message: 'First' });
            toast({ message: 'Second' });
            toast({ message: 'Third' });
          }}
        >
          Show
        </button>
      );
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button'));
    const toasts = screen.getAllByTestId('toast');
    expect(toasts[0]).toHaveTextContent('Third');
    expect(toasts[1]).toHaveTextContent('Second');
    expect(toasts[2]).toHaveTextContent('First');
  });

  it('has close button with accessible label', () => {
    function TestComponent() {
      const toast = useToast();
      return <button onClick={() => toast({ message: 'Test' })}>Show</button>;
    }

    render(
      <ToastProvider>
        <TestComponent />
      </ToastProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getByRole('button', { name: 'Dismiss toast' })).toBeInTheDocument();
  });
});

describe('useToast', () => {
  it('throws error when used outside ToastProvider', () => {
    const { result } = renderHook(() => {
      try {
        return useToast();
      } catch (e) {
        return e;
      }
    });

    expect(result.current).toBeInstanceOf(Error);
    expect((result.current as Error).message).toBe('useToast must be used within <ToastProvider>');
  });

  it('returns toast function when used within ToastProvider', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ToastProvider>{children}</ToastProvider>
    );

    const { result } = renderHook(() => useToast(), { wrapper });
    expect(typeof result.current).toBe('function');
  });
});
