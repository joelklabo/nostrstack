import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type MempoolData, MempoolVisualization } from './mempool-visualization';

describe('MempoolVisualization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const lowCongestionData: MempoolData = {
    txCount: 8500,
    sizeVMB: 25,
    feeRates: { low: 1, medium: 2, high: 4 }
  };

  const mediumCongestionData: MempoolData = {
    txCount: 35000,
    sizeVMB: 120,
    feeRates: { low: 12, medium: 25, high: 45 }
  };

  const highCongestionData: MempoolData = {
    txCount: 85000,
    sizeVMB: 280,
    feeRates: { low: 35, medium: 75, high: 150 }
  };

  it('renders with initial data', () => {
    render(<MempoolVisualization data={lowCongestionData} pollInterval={0} />);

    expect(screen.getByText('Mempool')).toBeInTheDocument();
    expect(screen.getByText('8.5K')).toBeInTheDocument();
    expect(screen.getByText('25.0 vMB')).toBeInTheDocument();
    expect(screen.getByText('1 sat/vB')).toBeInTheDocument();
  });

  it('shows low congestion status for small mempool', () => {
    render(<MempoolVisualization data={lowCongestionData} pollInterval={0} />);

    expect(screen.getByText('Low congestion')).toBeInTheDocument();
  });

  it('shows medium congestion status for moderate mempool', () => {
    render(<MempoolVisualization data={mediumCongestionData} pollInterval={0} />);

    expect(screen.getByText('Moderate congestion')).toBeInTheDocument();
  });

  it('shows high congestion status for large mempool', () => {
    render(<MempoolVisualization data={highCongestionData} pollInterval={0} />);

    expect(screen.getByText('High congestion')).toBeInTheDocument();
  });

  it('formats large numbers correctly', () => {
    const data: MempoolData = {
      txCount: 1500000,
      sizeVMB: 1200,
      feeRates: { low: 10, medium: 20, high: 50 }
    };

    render(<MempoolVisualization data={data} pollInterval={0} />);

    expect(screen.getByText('1.5M')).toBeInTheDocument();
    expect(screen.getByText('1.2 GB')).toBeInTheDocument();
  });

  it('displays all fee rate tiers', () => {
    render(<MempoolVisualization data={lowCongestionData} pollInterval={0} />);

    expect(screen.getByText('Low')).toBeInTheDocument();
    expect(screen.getByText('Med')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(screen.getByText('1 sat/vB')).toBeInTheDocument();
    expect(screen.getByText('2 sat/vB')).toBeInTheDocument();
    expect(screen.getByText('4 sat/vB')).toBeInTheDocument();
  });

  it('hides fee rates in compact mode', () => {
    render(<MempoolVisualization data={lowCongestionData} pollInterval={0} compact />);

    expect(screen.queryByText('Fee estimates')).not.toBeInTheDocument();
    expect(screen.queryByText('Low')).not.toBeInTheDocument();
  });

  it('has correct ARIA attributes', () => {
    render(<MempoolVisualization data={mediumCongestionData} pollInterval={0} />);

    expect(screen.getByRole('region', { name: 'Mempool status' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Moderate congestion');
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '40'); // 120/300 * 100
  });

  it('calls onDataUpdate callback when data changes', async () => {
    vi.useRealTimers();
    const onDataUpdate = vi.fn();
    const fetchData = vi.fn().mockResolvedValue(mediumCongestionData);

    render(
      <MempoolVisualization fetchData={fetchData} onDataUpdate={onDataUpdate} pollInterval={0} />
    );

    await waitFor(() => {
      expect(fetchData).toHaveBeenCalledTimes(1);
    });

    await waitFor(() => {
      expect(onDataUpdate).toHaveBeenCalledWith(mediumCongestionData);
    });
  });

  it('sets up polling interval when specified', () => {
    const setIntervalSpy = vi.spyOn(globalThis, 'setInterval');

    render(<MempoolVisualization data={lowCongestionData} pollInterval={5000} />);

    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 5000);
    setIntervalSpy.mockRestore();
  });

  it('stops polling when pollInterval is 0', async () => {
    const fetchData = vi.fn().mockResolvedValue(lowCongestionData);

    render(
      <MempoolVisualization data={lowCongestionData} fetchData={fetchData} pollInterval={0} />
    );

    // No fetch should happen with initial data and pollInterval 0
    await vi.advanceTimersByTimeAsync(10000);

    expect(fetchData).not.toHaveBeenCalled();
  });

  it('applies custom className', () => {
    render(
      <MempoolVisualization data={lowCongestionData} pollInterval={0} className="custom-class" />
    );

    const container = screen.getByRole('region');
    expect(container).toHaveClass('custom-class');
    expect(container).toHaveClass('ns-mempool');
  });

  it('calculates congestion bar fill correctly', () => {
    // 120 vMB out of 300 max = 40%
    render(<MempoolVisualization data={mediumCongestionData} pollInterval={0} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '40');
  });

  it('caps congestion bar at 100%', () => {
    const overflowData: MempoolData = {
      txCount: 100000,
      sizeVMB: 500, // Way over 300 max
      feeRates: { low: 50, medium: 100, high: 200 }
    };

    render(<MempoolVisualization data={overflowData} pollInterval={0} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });
});
