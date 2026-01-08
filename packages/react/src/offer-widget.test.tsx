import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { OfferWidget } from './offer-widget';

describe('OfferWidget', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders correctly', () => {
    render(<OfferWidget title="Offer" value="lnbc1..." subtitle="Subtitle" />);
    expect(screen.getByText('Offer')).toBeTruthy();
    expect(screen.getByText('Subtitle')).toBeTruthy();
    expect(screen.getByText('lnbc1...')).toBeTruthy();
  });

  it('handles copy action', () => {
    const onCopy = vi.fn();
    render(<OfferWidget title="Offer" value="lnbc1..." onCopy={onCopy} />);
    const btn = screen.getByText('COPY');
    fireEvent.click(btn);
    expect(onCopy).toHaveBeenCalled();
  });
});
