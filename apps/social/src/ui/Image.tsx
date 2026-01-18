import { Skeleton } from '@nostrstack/ui';
import { type ImgHTMLAttributes, useState } from 'react';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export function Image({ src, alt, className, style, onLoad, onError, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const resolvedAlt = alt ?? '';

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setError(true);
    onError?.(e);
  };

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

  return (
    <div
      className={`image-container ${className || ''}`}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
      data-loaded={loaded}
      data-error={error}
      aria-busy={!loaded && !error}
    >
      {!loaded && !error && (
        <Skeleton
          variant="rectangular"
          width="100%"
          height="100%"
          style={{ position: 'absolute', inset: 0, zIndex: 1 }}
          aria-hidden="true"
        />
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
