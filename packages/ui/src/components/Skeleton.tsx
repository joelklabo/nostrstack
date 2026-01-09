import type { CSSProperties } from 'react';

export type SkeletonVariant = 'text' | 'circular' | 'rectangular';

export interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: CSSProperties;
  className?: string;
}

export function Skeleton({
  variant = 'text',
  width,
  height,
  borderRadius,
  style,
  className
}: SkeletonProps) {
  const variantClass =
    variant === 'circular' ? 'ns-skeleton--circle' : variant === 'text' ? 'ns-skeleton--text' : '';

  return (
    <div
      className={`ns-skeleton ${variantClass}${className ? ` ${className}` : ''}`.trim()}
      style={{
        width,
        height,
        ...(borderRadius !== undefined && { borderRadius }),
        ...style
      }}
      aria-hidden="true"
    />
  );
}

export function PostSkeleton() {
  return (
    <article className="ns-card" aria-busy="true">
      <div className="ns-card__body">
        <header
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ns-space-3)',
            marginBottom: 'var(--ns-space-3)'
          }}
        >
          <Skeleton variant="circular" width={40} height={40} />
          <div style={{ flex: 1 }}>
            <Skeleton width={120} height={16} style={{ marginBottom: 4 }} />
            <Skeleton width={80} height={14} />
          </div>
          <Skeleton width={60} height={14} />
        </header>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ns-space-2)' }}>
          <Skeleton width="100%" height={16} />
          <Skeleton width="90%" height={16} />
          <Skeleton width="75%" height={16} />
        </div>
        <footer
          style={{ display: 'flex', gap: 'var(--ns-space-3)', marginTop: 'var(--ns-space-4)' }}
        >
          <Skeleton width={80} height={32} />
          <Skeleton width={80} height={32} />
        </footer>
      </div>
    </article>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="ns-card" aria-busy="true">
      <div className="ns-card__body">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--ns-space-4)',
            marginBottom: 'var(--ns-space-4)'
          }}
        >
          <Skeleton variant="circular" width={80} height={80} />
          <div style={{ flex: 1 }}>
            <Skeleton width={180} height={24} style={{ marginBottom: 8 }} />
            <Skeleton width={240} height={16} style={{ marginBottom: 8 }} />
            <Skeleton width={140} height={14} />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--ns-space-3)' }}>
          <Skeleton width={100} height={36} />
          <Skeleton width={100} height={36} />
        </div>
      </div>
    </div>
  );
}

export function NotificationSkeleton() {
  return (
    <div className="ns-card" aria-busy="true">
      <div className="ns-card__body" style={{ padding: 'var(--ns-space-3)' }}>
        <div style={{ display: 'flex', gap: 'var(--ns-space-3)', alignItems: 'flex-start' }}>
          <Skeleton variant="circular" width={40} height={40} />
          <div style={{ flex: 1 }}>
            <Skeleton width="100%" height={16} style={{ marginBottom: 6 }} />
            <Skeleton width="60%" height={14} />
          </div>
          <Skeleton width={50} height={14} />
        </div>
      </div>
    </div>
  );
}
