import { Skeleton } from '@nostrstack/ui';
import { type ImgHTMLAttributes, useCallback, useState } from 'react';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
  /** Show colored placeholder on error instead of broken image */
  showPlaceholder?: boolean;
  /** Text to show in placeholder (e.g., initials) */
  placeholderText?: string;
}

export function Image({
  src,
  alt,
  className,
  style,
  onLoad,
  onError,
  showPlaceholder = true,
  placeholderText,
  ...props
}: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [retried, setRetried] = useState(false);
  const resolvedAlt = alt ?? '';

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      setLoaded(true);
      setError(false);
      onLoad?.(e);
    },
    [onLoad]
  );

  const handleError = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
      // Retry once with a slight delay (helps with transient network issues)
      if (!retried && src) {
        setRetried(true);
        const img = e.currentTarget;
        setTimeout(() => {
          img.src = src;
        }, 1000);
        return;
      }
      setError(true);
      onError?.(e);
    },
    [onError, retried, src]
  );

  // Use explicit fallback image if provided
  if (error && props.fallback) {
    return (
      <img
        src={props.fallback}
        alt={resolvedAlt}
        className={className}
        style={style}
        decoding="async"
        {...props}
      />
    );
  }

  // Show placeholder on error
  if (error && showPlaceholder) {
    const displayText = placeholderText || resolvedAlt?.charAt(0)?.toUpperCase() || '?';
    return (
      <div
        className={`image-placeholder ${className || ''}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--ns-color-bg-muted)',
          color: 'var(--ns-color-text-muted)',
          fontWeight: 600,
          fontSize: '0.875rem',
          borderRadius: 'inherit',
          ...style
        }}
        role="img"
        aria-label={resolvedAlt || 'Image unavailable'}
      >
        {displayText}
      </div>
    );
  }

  return (
    <div
      className={`image-container ${className || ''}`}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      data-loaded={loaded}
      data-error={error}
      aria-busy={!loaded && !error}
    >
      {!loaded && !error && (
        <>
          <Skeleton
            variant="rectangular"
            width="100%"
            height="100%"
            style={{ position: 'absolute', inset: 0, zIndex: 1 }}
            aria-hidden="true"
          />
          <span className="sr-only">Loading image</span>
        </>
      )}
      <img
        src={src}
        alt={resolvedAlt}
        loading="lazy"
        decoding="async"
        onLoad={handleLoad}
        onError={handleError}
        className="image-container__img"
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          objectFit: 'cover'
        }}
        {...props}
      />
    </div>
  );
}
