import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { nostrstackQrPresetOptions, renderQrCodeInto } from './qr.js';

// Mock QrCodeStyling
const mockAppend = vi.fn();
const mockQRCodeStyling = vi.fn().mockImplementation(() => ({
  append: mockAppend,
  getRawData: vi.fn().mockResolvedValue(new Blob([])),
  update: vi.fn()
}));

// We need to mock dynamic import
vi.mock('qr-code-styling', () => ({
  default: mockQRCodeStyling
}));

describe('renderQrCodeInto', () => {
  let host: HTMLElement;

  beforeEach(() => {
    host = document.createElement('div');
    vi.clearAllMocks();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders basic QR code without verification', async () => {
    const result = await renderQrCodeInto(host, 'test-data', { verify: 'off' });

    expect(mockQRCodeStyling).toHaveBeenCalledWith(
      expect.objectContaining({
        data: 'test-data'
      })
    );
    expect(mockAppend).toHaveBeenCalled();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.verifyEngine).toBe('none');
    }
  });

  it('generates correct options for presets', () => {
    const safe = nostrstackQrPresetOptions('safe');
    expect(safe.dotsOptions?.type).toBe('square');

    const brand = nostrstackQrPresetOptions('brand');
    expect(brand.dotsOptions?.type).toBe('rounded');

    const brandLogo = nostrstackQrPresetOptions('brandLogo');
    expect(brandLogo.image).toBeTruthy();
  });
});
