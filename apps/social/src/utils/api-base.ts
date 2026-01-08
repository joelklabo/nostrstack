import type { ApiBaseResolution } from '@nostrstack/react';
import { resolveApiBase } from '@nostrstack/react';

export type { ApiBaseResolution };
export { resolveApiBase };

export type GalleryApiBaseInput = {
  apiBase?: string;
  baseUrl?: string;
  apiBaseConfig?: ApiBaseResolution;
};

export function resolveGalleryApiBase(config: GalleryApiBaseInput = {}): ApiBaseResolution {
  if (config.apiBaseConfig) {
    return config.apiBaseConfig;
  }
  const raw =
    config.apiBase ??
    config.baseUrl ??
    import.meta.env.VITE_API_BASE_URL ??
    'http://localhost:3001';
  return resolveApiBase(raw);
}
