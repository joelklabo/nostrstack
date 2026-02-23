import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ConnectionStatus, useConnectionStatus } from './ConnectionStatus';

describe('ConnectionStatus', () => {
  afterEach(() => {
    cleanup();
  });

  describe('component rendering', () => {
    it('renders connected state correctly', () => {
      render(
        <ConnectionStatus state="connected" network="regtest" lastSyncAt={Date.now() - 5000} />
      );

      expect(screen.getByText('Connected')).toBeTruthy();
      expect(screen.getByText('Regtest')).toBeTruthy();
      expect(screen.queryByRole('button', { name: /retry/i })).toBeNull();
    });

    it('renders connecting state correctly', () => {
      render(<ConnectionStatus state="connecting" network="testnet" lastSyncAt={null} />);

      expect(screen.getByText('Connecting')).toBeTruthy();
      expect(screen.getByText('Testnet')).toBeTruthy();
      expect(screen.getByText('Never')).toBeTruthy();
    });

    it('renders reconnecting state with attempt counter', () => {
      render(
        <ConnectionStatus
          state="reconnecting"
          network="mainnet"
          reconnectAttempt={3}
          maxReconnectAttempts={8}
        />
      );

      expect(screen.getByText('Reconnecting (3/8)')).toBeTruthy();
      expect(screen.getByText('Mainnet')).toBeTruthy();
    });

    it('renders offline state with retry button', () => {
      const onRetry = vi.fn();
      render(<ConnectionStatus state="offline" network="regtest" onRetry={onRetry} />);

      expect(screen.getByText('Offline')).toBeTruthy();
      const retryButton = screen.getByRole('button', { name: /retry/i });
      expect(retryButton).toBeTruthy();

      fireEvent.click(retryButton);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders error state with message and retry button', () => {
      const onRetry = vi.fn();
      render(
        <ConnectionStatus
          state="error"
          network="mutinynet"
          errorMessage="Authentication required"
          onRetry={onRetry}
        />
      );

      expect(screen.getByText('Error')).toBeTruthy();
      expect(screen.getByText('Authentication required')).toBeTruthy();
      expect(screen.getByRole('button', { name: /retry/i })).toBeTruthy();
    });

    it('renders compact variant', () => {
      render(<ConnectionStatus state="connected" network="mainnet" compact />);

      expect(screen.getByText('Mainnet')).toBeTruthy();
      // In compact mode, no label text
      expect(screen.queryByText('Connected')).toBeNull();
    });

    it('has correct ARIA attributes', () => {
      const { container } = render(<ConnectionStatus state="connected" network="testnet" />);

      // Get the outer container which has the main status role
      const statusElement = container.querySelector('.ns-conn');
      expect(statusElement?.getAttribute('aria-live')).toBe('polite');
      expect(statusElement?.getAttribute('aria-label')).toBe(
        'Bitcoin telemetry connected on Testnet network'
      );
    });
  });

  describe('network badge rendering', () => {
    it('renders mainnet network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="mainnet" />);
      expect(screen.getByText('Mainnet')).toBeTruthy();
    });

    it('renders testnet network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="testnet" />);
      expect(screen.getByText('Testnet')).toBeTruthy();
    });

    it('renders mutinynet network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="mutinynet" />);
      expect(screen.getByText('Mutinynet')).toBeTruthy();
    });

    it('renders signet network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="signet" />);
      expect(screen.getByText('Signet')).toBeTruthy();
    });

    it('renders regtest network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="regtest" />);
      expect(screen.getByText('Regtest')).toBeTruthy();
    });

    it('renders unknown network badge correctly', () => {
      render(<ConnectionStatus state="connected" network="unknown" />);
      expect(screen.getByText('Unknown')).toBeTruthy();
    });
  });

  describe('time display', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('displays "Just now" for recent sync', async () => {
      const now = 1705680000000; // Fixed timestamp
      vi.setSystemTime(now);

      render(
        <ConnectionStatus
          state="connected"
          network="regtest"
          lastSyncAt={now - 2000} // 2 seconds ago
        />
      );

      expect(screen.getByText('Just now')).toBeTruthy();
    });

    it('displays seconds for sync < 1 minute ago', async () => {
      const now = 1705680000000; // Fixed timestamp
      vi.setSystemTime(now);

      render(
        <ConnectionStatus
          state="connected"
          network="regtest"
          lastSyncAt={now - 30000} // 30 seconds ago
        />
      );

      expect(screen.getByText('30s ago')).toBeTruthy();
    });

    it('displays minutes for sync < 1 hour ago', async () => {
      const now = 1705680000000; // Fixed timestamp
      vi.setSystemTime(now);

      render(
        <ConnectionStatus
          state="connected"
          network="regtest"
          lastSyncAt={now - 300000} // 5 minutes ago
        />
      );

      expect(screen.getByText('5m ago')).toBeTruthy();
    });

    it('displays "Never" when lastSyncAt is null', async () => {
      render(<ConnectionStatus state="connected" network="regtest" lastSyncAt={null} />);

      expect(screen.getByText('Never')).toBeTruthy();
    });
  });
});

describe('useConnectionStatus hook', () => {
  it('initializes with default state', () => {
    const { result } = renderHook(() => useConnectionStatus());

    expect(result.current.state).toBe('connecting');
    expect(result.current.attempt).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('initializes with custom initial state', () => {
    const { result } = renderHook(() => useConnectionStatus({ initialState: 'connected' }));

    expect(result.current.state).toBe('connected');
  });

  it('transitions to connected state', () => {
    const { result } = renderHook(() => useConnectionStatus());

    act(() => {
      result.current.setConnected();
    });

    expect(result.current.state).toBe('connected');
    expect(result.current.attempt).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('transitions to error state', () => {
    const { result } = renderHook(() => useConnectionStatus());

    act(() => {
      result.current.setError('Test error message');
    });

    expect(result.current.state).toBe('error');
    expect(result.current.error).toBe('Test error message');
  });

  it('retry resets state to connecting', () => {
    const { result } = renderHook(() => useConnectionStatus({ initialState: 'error' }));

    act(() => {
      result.current.retry();
    });

    expect(result.current.state).toBe('connecting');
    expect(result.current.attempt).toBe(0);
    expect(result.current.error).toBeNull();
  });

  it('calls onStateChange callback', () => {
    const onStateChange = vi.fn();
    const { result } = renderHook(() => useConnectionStatus({ onStateChange }));

    act(() => {
      result.current.setConnected();
    });

    expect(onStateChange).toHaveBeenCalledWith('connected');
  });

  it('disconnect increments attempt counter', () => {
    const { result } = renderHook(() => useConnectionStatus());

    act(() => {
      result.current.setConnected();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state).toBe('reconnecting');
    expect(result.current.attempt).toBe(1);
  });

  it('disconnect transitions to offline after max attempts', () => {
    const { result } = renderHook(() => useConnectionStatus({ maxReconnectAttempts: 2 }));

    // Simulate multiple disconnects
    act(() => {
      result.current.setConnected();
    });

    act(() => {
      result.current.disconnect();
    });

    act(() => {
      result.current.disconnect();
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.state).toBe('offline');
  });
});
