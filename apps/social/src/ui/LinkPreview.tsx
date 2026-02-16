import { memo, useEffect, useMemo, useState } from 'react';

import { resolveRuntimeHost } from '../utils/api-base';
import { Image } from './Image';

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  url: string;
}

interface LinkPreviewProps {
  url: string;
  className?: string;
}

interface PreviewCacheEntry {
  data?: OpenGraphData;
  errorCount: number;
  retryAtMs: number;
  loading: boolean;
  resolvedAtMs?: number;
}

const MAX_CACHE_ENTRIES = 200;
const PREVIEW_TTL_MS = 10 * 60_000;
const BASE_RETRY_DELAY_MS = 2_000;
const MAX_RETRY_DELAY_MS = 60_000;
const PREVIEW_CACHE = new Map<string, PreviewCacheEntry>();

// Simple URL validation
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

// Extract domain from URL
function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Check if URL is a media file
function isMediaUrl(url: string): boolean {
  const mediaExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.webm', '.mov'];
  const lowered = url.toLowerCase();
  return mediaExtensions.some((ext) => lowered.includes(ext));
}

// Check if URL is YouTube
function isYouTubeUrl(url: string): { isYouTube: boolean; videoId?: string } {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /youtube\.com\/shorts\/([^&\n?#]+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { isYouTube: true, videoId: match[1] };
    }
  }
  return { isYouTube: false };
}

function parseRetryAfterMs(retryAfter: string | null): number | null {
  if (!retryAfter) return null;
  const trimmed = retryAfter.trim();
  if (!trimmed) return null;

  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.floor(seconds * 1000);
  }

  const asDate = Date.parse(trimmed);
  if (Number.isFinite(asDate)) {
    return Math.max(0, asDate - Date.now());
  }

  return null;
}

function createFallbackPreview(url: string): OpenGraphData {
  return {
    url,
    title: getDomain(url)
  };
}

function getCachedPreview(url: string): PreviewCacheEntry | undefined {
  const cached = PREVIEW_CACHE.get(url);
  if (!cached) return undefined;
  if (cached.data && cached.resolvedAtMs && Date.now() - cached.resolvedAtMs > PREVIEW_TTL_MS) {
    PREVIEW_CACHE.delete(url);
    return undefined;
  }
  if (!cached.loading && cached.retryAtMs && Date.now() < cached.retryAtMs && !cached.data) {
    return cached;
  }
  if (!cached.loading && cached.data && cached.resolvedAtMs) {
    return cached;
  }
  return cached.data || cached.loading ? cached : undefined;
}

function prunePreviewCache() {
  if (PREVIEW_CACHE.size <= MAX_CACHE_ENTRIES) return;
  for (const [key, entry] of PREVIEW_CACHE) {
    if (
      !entry.loading &&
      (!entry.data || (entry.resolvedAtMs && Date.now() - entry.resolvedAtMs > PREVIEW_TTL_MS))
    ) {
      PREVIEW_CACHE.delete(key);
    }
    if (PREVIEW_CACHE.size <= MAX_CACHE_ENTRIES) break;
  }
}

/**
 * Renders a preview card for a URL with Open Graph metadata.
 * Uses a public proxy to fetch OG data to avoid CORS issues.
 */
export const LinkPreview = memo(function LinkPreview({ url, className }: LinkPreviewProps) {
  const [data, setData] = useState<OpenGraphData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const isDirectMediaUrl = useMemo(() => isMediaUrl(url), [url]);

  useEffect(() => {
    if (!isValidUrl(url)) {
      setLoading(false);
      setError(true);
      return;
    }

    // Skip for direct media URLs - they're handled by image components
    if (isDirectMediaUrl) {
      setLoading(false);
      return;
    }

    const isLocalDev =
      import.meta.env.DEV && ['localhost', '127.0.0.1', '::1'].includes(resolveRuntimeHost());
    if (isLocalDev) {
      setData({
        url,
        title: getDomain(url)
      });
      setLoading(false);
      return;
    }

    let cancelled = false;
    const fallback = createFallbackPreview(url);
    const cached = getCachedPreview(url);

    if (!cached?.loading && cached?.data) {
      setData(cached.data);
      setError(false);
      setLoading(false);
      return;
    }

    if (cached?.loading) {
      setLoading(true);
    }

    if (cached?.data && !cached.loading && cached.retryAtMs && Date.now() < cached.retryAtMs) {
      setData(cached.data);
      setError(false);
      setLoading(false);
      return;
    }

    if (cached && cached.retryAtMs && Date.now() < cached.retryAtMs && !cached.data) {
      setData(fallback);
      setError(false);
      setLoading(false);
      return;
    }

    const fetchOgData = async () => {
      PREVIEW_CACHE.set(url, {
        ...cached,
        loading: true,
        data: cached?.data,
        errorCount: cached?.errorCount ?? 0,
        retryAtMs: cached?.retryAtMs ?? 0
      });
      prunePreviewCache();
      try {
        // Use a public Open Graph proxy service
        // Options: opengraph.io, microlink.io, or self-hosted
        const proxyUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}`;

        const response = await fetch(proxyUrl, {
          headers: { Accept: 'application/json' }
        });

        if (!response.ok) {
          const retryAfterMs = parseRetryAfterMs(response.headers.get('Retry-After'));
          const statusDelay = retryAfterMs !== null ? retryAfterMs : null;
          const errorRetryDelay =
            statusDelay ??
            Math.min(
              MAX_RETRY_DELAY_MS,
              BASE_RETRY_DELAY_MS * 2 ** Math.min(cached?.errorCount ?? 0, 12)
            );
          const now = Date.now();
          PREVIEW_CACHE.set(url, {
            data: cached?.data ?? fallback,
            errorCount: (cached?.errorCount ?? 0) + 1,
            retryAtMs: now + errorRetryDelay,
            loading: false,
            resolvedAtMs: now
          });
          setData(cached?.data ?? fallback);
          setError(false);
          return;
        }

        const result = (await response.json()) as {
          status: string;
          data?: {
            title?: string;
            description?: string;
            image?: { url?: string };
            publisher?: string;
            url?: string;
          };
        };

        if (cancelled) return;

        if (result.status === 'success' && result.data) {
          const now = Date.now();
          setData({
            title: result.data.title,
            description: result.data.description,
            image: result.data.image?.url,
            siteName: result.data.publisher,
            url: result.data.url || url
          });
          PREVIEW_CACHE.set(url, {
            data: {
              title: result.data.title,
              description: result.data.description,
              image: result.data.image?.url,
              siteName: result.data.publisher,
              url: result.data.url || url
            },
            errorCount: 0,
            retryAtMs: 0,
            loading: false,
            resolvedAtMs: now
          });
        } else {
          const now = Date.now();
          // Fallback to basic preview
          setData({
            url,
            title: getDomain(url)
          });
          PREVIEW_CACHE.set(url, {
            data: {
              url,
              title: getDomain(url)
            },
            errorCount: 0,
            retryAtMs: 0,
            loading: false,
            resolvedAtMs: now
          });
        }
      } catch {
        if (!cancelled) {
          // Fallback to basic preview on error
          const now = Date.now();
          const previous = PREVIEW_CACHE.get(url);
          PREVIEW_CACHE.set(url, {
            data: previous?.data ?? fallback,
            errorCount: (previous?.errorCount ?? cached?.errorCount ?? 0) + 1,
            retryAtMs:
              now +
              Math.min(
                MAX_RETRY_DELAY_MS,
                BASE_RETRY_DELAY_MS * 2 ** Math.min(previous?.errorCount ?? 0, 12)
              ),
            loading: false,
            resolvedAtMs: now
          });
          setData(previous?.data ?? fallback);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
          prunePreviewCache();
        }
      }
    };

    fetchOgData();

    return () => {
      cancelled = true;
    };
  }, [url, isDirectMediaUrl]);

  if (isDirectMediaUrl) return null;

  // Handle YouTube embeds specially
  const youtube = isYouTubeUrl(url);
  if (youtube.isYouTube && youtube.videoId) {
    return (
      <div className={`link-preview link-preview--youtube ${className || ''}`}>
        <div className="link-preview__video">
          <iframe
            src={`https://www.youtube.com/embed/${youtube.videoId}`}
            title="YouTube video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className={`link-preview link-preview--loading ${className || ''}`}
        aria-label="Loading link preview"
        aria-busy="true"
      >
        <div className="link-preview__skeleton">
          <div className="link-preview__skeleton-image" />
          <div className="link-preview__skeleton-content">
            <div className="link-preview__skeleton-title" />
            <div className="link-preview__skeleton-desc" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !data || (!data.title && !data.description && !data.image)) {
    return (
      <div
        className={`link-preview link-preview--empty ${className || ''}`}
        aria-label="Link preview unavailable"
      />
    );
  }

  // Don't show preview if we only have the URL (no metadata)
  if (!data.title && !data.description && !data.image) {
    return null;
  }

  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className={`link-preview ${className || ''}`}
      aria-label={`Preview: ${data.title || getDomain(url)}`}
    >
      {data.image && (
        <div className="link-preview__image">
          <Image src={data.image} alt={data.title || 'Link preview'} />
        </div>
      )}
      <div className="link-preview__content">
        <div className="link-preview__site">{data.siteName || getDomain(url)}</div>
        {data.title && <div className="link-preview__title">{data.title}</div>}
        {data.description && (
          <div className="link-preview__description">
            {data.description.length > 120
              ? `${data.description.slice(0, 120)}...`
              : data.description}
          </div>
        )}
      </div>
    </a>
  );
});

/**
 * Extract URLs from text content
 */
export function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;
  const matches = text.match(urlRegex);
  if (!matches) return [];

  // Deduplicate and filter
  const unique = [...new Set(matches)];
  return unique.filter((url) => isValidUrl(url));
}

/**
 * Component that renders link previews for all URLs in content
 */
export const LinkPreviews = memo(function LinkPreviews({ content }: { content: string }) {
  const urls = extractUrls(content);

  // Limit to first 3 URLs to avoid overwhelming the UI
  const previewUrls = urls.slice(0, 3);

  if (previewUrls.length === 0) return null;

  return (
    <div className="link-previews">
      {previewUrls.map((url) => (
        <LinkPreview key={url} url={url} />
      ))}
    </div>
  );
});
