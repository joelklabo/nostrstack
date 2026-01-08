import { Skeleton } from '@nostrstack/ui';
import { type ImgHTMLAttributes, useState } from 'react';

interface ImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  fallback?: string;
}

export function Image({ src, alt, className, style, onLoad, onError, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setLoaded(true);
    onLoad?.(e);
  };

  const handleError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setError(true);
    onError?.(e);
  };

  if (error && props.fallback) {
    return <img src={props.fallback} alt={alt} className={className} style={style} {...props} />;
  }

  return (
    <div className={`image-container ${className || ''}`} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {!loaded && !error && (
        <Skeleton 
          variant="rectangular" 
          width="100%" 
          height="100%" 
          style={{ position: 'absolute', inset: 0, zIndex: 1 }} 
        />
      )}
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onLoad={handleLoad}
        onError={handleError}
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%', 
          objectFit: 'cover',
          opacity: loaded ? 1 : 0, 
          transition: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'none' : 'opacity 0.2s ease-in-out' 
        }}
        {...props}
      />
    </div>
  );
}
